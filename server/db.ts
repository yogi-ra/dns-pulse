import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('\x1b[31mMissing DATABASE_URL in .env\x1b[0m')
  process.exit(1)
}

function buildConnectionString(raw: string): string {
  const match = raw.match(/^(postgres(?:ql)?):\/\/([^:]+):([^@]+)@(.+)$/)
  if (!match) return raw
  const [, scheme, user, password, rest] = match
  return scheme + '://' + user + ':' + encodeURIComponent(password) + '@' + rest
}

const conn = buildConnectionString(url)
console.log('Connecting to:', conn.replace(/:([^@]+)@/, ':***@'))

const sql = postgres(conn)

// ── Helpers ─────────────────────────────────────────────────

const RANGES: Record<string, string> = {
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

// Return sql fragments — TRUE acts as a no-op so we always have valid WHERE
function rc(range?: string) {
  const iv = RANGES[range || '']
  return iv ? sql`last_seen > NOW() - ${iv}::interval` : sql`TRUE`
}

function cc(client?: string) {
  return client ? sql`client_ip = ${client}::inet` : sql`TRUE`
}

function shannonEntropy(str: string): number {
  if (!str.length) return 0
  const freq: Record<string, number> = {}
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1
  const len = str.length
  return -Object.values(freq).reduce((s, c) => {
    const p = c / len
    return s + p * Math.log2(p)
  }, 0)
}

function sld(domain: string): string {
  const parts = domain.replace(/\.$/, '').split('.')
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0]
}

// ── Queries ─────────────────────────────────────────────────

export async function getOverview(range?: string, client?: string) {
  const [row] = await sql`
    SELECT
      COALESCE(SUM(hit_count), 0)::int  AS total_queries,
      COUNT(DISTINCT client_ip)::int     AS unique_clients,
      COUNT(DISTINCT query_name)::int    AS unique_domains
    FROM dns_queries
    WHERE ${rc(range)} AND ${cc(client)}
  `

  const [{ cnt }] = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM dns_queries
    WHERE last_seen > NOW() - interval '1 minute'
  `

  const interval = RANGES[range || ''] || '1 hour'
  const [{ cnt: new_domains }] = await sql`
    SELECT COUNT(DISTINCT query_name)::int AS cnt
    FROM dns_queries
    WHERE first_seen > NOW() - ${interval}::interval
      AND ${rc(range)}
      AND ${cc(client)}
  `

  const [{ cnt: alert_count }] = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM dns_queries
    WHERE hit_count > 100
      AND EXTRACT(EPOCH FROM last_seen - first_seen)
          / NULLIF(hit_count - 1, 0) < 120
      AND ${rc(range)}
      AND ${cc(client)}
  `

  return {
    ...row,
    qps: +(cnt / 60).toFixed(2),
    new_domains,
    alert_count,
  }
}

export async function getRecentQueries(range?: string, client?: string, limit = 50) {
  return sql`
    SELECT client_ip, query_name, query_type, hit_count,
           first_seen, last_seen
    FROM dns_queries
    WHERE ${rc(range)} AND ${cc(client)}
    ORDER BY last_seen DESC
    LIMIT ${limit}
  `
}

export async function getTopDomains(range?: string, client?: string, limit = 20) {
  return sql`
    SELECT query_name, query_type,
           SUM(hit_count)::int            AS total_hits,
           COUNT(DISTINCT client_ip)::int AS unique_clients,
           MAX(last_seen)                 AS last_seen
    FROM dns_queries
    WHERE ${rc(range)} AND ${cc(client)}
    GROUP BY query_name, query_type
    ORDER BY total_hits DESC
    LIMIT ${limit}
  `
}

export async function getClients(range?: string, limit = 20) {
  return sql`
    SELECT client_ip,
           SUM(hit_count)::int             AS total_queries,
           COUNT(DISTINCT query_name)::int AS unique_domains,
           MIN(first_seen)                 AS first_seen,
           MAX(last_seen)                  AS last_seen
    FROM dns_queries
    WHERE ${rc(range)}
    GROUP BY client_ip
    ORDER BY total_queries DESC
    LIMIT ${limit}
  `
}

export async function getQueryTypes(range?: string, client?: string) {
  return sql`
    SELECT query_type,
           SUM(hit_count)::int AS count,
           ROUND(
             SUM(hit_count) * 100.0
             / NULLIF(SUM(SUM(hit_count)) OVER (), 0), 1
           ) AS pct
    FROM dns_queries
    WHERE ${rc(range)} AND ${cc(client)}
    GROUP BY query_type
    ORDER BY count DESC
  `
}

export async function getBeaconing(range?: string, client?: string) {
  return sql`
    SELECT client_ip, query_name, query_type, hit_count,
           first_seen, last_seen,
           ROUND(
             EXTRACT(EPOCH FROM last_seen - first_seen)
             / NULLIF(hit_count - 1, 0), 2
           ) AS avg_interval_sec
    FROM dns_queries
    WHERE hit_count > 100
      AND ${rc(range)}
      AND ${cc(client)}
    ORDER BY hit_count DESC
    LIMIT 50
  `
}

export async function getTimeline(range?: string, client?: string) {
  return sql`
    SELECT
      date_trunc('hour', last_seen) AS hour,
      SUM(hit_count)::int           AS count
    FROM dns_queries
    WHERE ${rc(range)} AND ${cc(client)}
    GROUP BY 1
    ORDER BY 1
  `
}

export async function getInsights(range?: string, client?: string) {
  const recentDomains = await sql`
    SELECT DISTINCT query_name
    FROM dns_queries
    WHERE length(query_name) > 12
      AND ${rc(range)}
      AND ${cc(client)}
    LIMIT 500
  `

  const highEntropy = recentDomains
    .map((r) => ({
      query_name: (r as any).query_name,
      entropy: +shannonEntropy(sld((r as any).query_name)).toFixed(2),
    }))
    .filter((d) => d.entropy > 3.5)
    .sort((a, b) => b.entropy - a.entropy)
    .slice(0, 10)

  const [{ cnt: total }] = await sql`
    SELECT COALESCE(SUM(hit_count), 0)::int AS cnt
    FROM dns_queries
    WHERE ${rc(range)} AND ${cc(client)}
  `

  return {
    high_entropy_domains: highEntropy,
    total_queries: total,
  }
}

export async function getClientList() {
  return sql`
    SELECT client_ip,
           SUM(hit_count)::int AS total_queries
    FROM dns_queries
    GROUP BY client_ip
    ORDER BY total_queries DESC
    LIMIT 100
  `
}

export { sql }
