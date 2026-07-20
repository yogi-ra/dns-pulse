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

// ── Range helpers ───────────────────────────────────────────

const RANGES: Record<string, string> = {
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

function rw(range?: string) {
  const iv = RANGES[range || '']
  return iv ? sql`WHERE last_seen > NOW() - ${iv}::interval` : sql``
}

function ra(range?: string) {
  const iv = RANGES[range || '']
  return iv ? sql`AND last_seen > NOW() - ${iv}::interval` : sql``
}

// ── Helpers ─────────────────────────────────────────────────

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

export async function getOverview(range?: string) {
  const [row] = await sql`
    SELECT
      COALESCE(SUM(hit_count), 0)::int  AS total_queries,
      COUNT(DISTINCT client_ip)::int     AS unique_clients,
      COUNT(DISTINCT query_name)::int    AS unique_domains
    FROM dns_queries
    ${rw(range)}
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
  `

  const [{ cnt: alert_count }] = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM dns_queries
    WHERE hit_count > 100
      AND EXTRACT(EPOCH FROM last_seen - first_seen)
          / NULLIF(hit_count - 1, 0) < 120
    ${ra(range)}
  `

  return {
    ...row,
    qps: +(cnt / 60).toFixed(2),
    new_domains,
    alert_count,
  }
}

export async function getRecentQueries(range?: string, limit = 50) {
  return sql`
    SELECT client_ip, query_name, query_type, hit_count,
           first_seen, last_seen
    FROM dns_queries
    ${rw(range)}
    ORDER BY last_seen DESC
    LIMIT ${limit}
  `
}

export async function getTopDomains(range?: string, limit = 20) {
  return sql`
    SELECT query_name, query_type,
           SUM(hit_count)::int            AS total_hits,
           COUNT(DISTINCT client_ip)::int AS unique_clients,
           MAX(last_seen)                 AS last_seen
    FROM dns_queries
    ${rw(range)}
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
    ${rw(range)}
    GROUP BY client_ip
    ORDER BY total_queries DESC
    LIMIT ${limit}
  `
}

export async function getQueryTypes(range?: string) {
  return sql`
    SELECT query_type,
           SUM(hit_count)::int AS count,
           ROUND(
             SUM(hit_count) * 100.0
             / NULLIF(SUM(SUM(hit_count)) OVER (), 0), 1
           ) AS pct
    FROM dns_queries
    ${rw(range)}
    GROUP BY query_type
    ORDER BY count DESC
  `
}

export async function getBeaconing(range?: string) {
  return sql`
    SELECT client_ip, query_name, query_type, hit_count,
           first_seen, last_seen,
           ROUND(
             EXTRACT(EPOCH FROM last_seen - first_seen)
             / NULLIF(hit_count - 1, 0), 2
           ) AS avg_interval_sec
    FROM dns_queries
    WHERE hit_count > 100
    ${ra(range)}
    ORDER BY hit_count DESC
    LIMIT 50
  `
}

export async function getTimeline(range?: string) {
  return sql`
    SELECT
      date_trunc('hour', last_seen) AS hour,
      SUM(hit_count)::int           AS count
    FROM dns_queries
    ${rw(range)}
    GROUP BY 1
    ORDER BY 1
  `
}

export async function getInsights(range?: string) {
  const recentDomains = await sql`
    SELECT DISTINCT query_name
    FROM dns_queries
    WHERE length(query_name) > 12
    ${ra(range)}
    LIMIT 500
  `

  const highEntropy = recentDomains
    .map((r) => ({
      query_name: r.query_name,
      entropy: +shannonEntropy(sld(r.query_name)).toFixed(2),
    }))
    .filter((d) => d.entropy > 3.5)
    .sort((a, b) => b.entropy - a.entropy)
    .slice(0, 10)

  const [{ cnt: total }] = await sql`
    SELECT COALESCE(SUM(hit_count), 0)::int AS cnt
    FROM dns_queries
    ${rw(range)}
  `

  return {
    high_entropy_domains: highEntropy,
    total_queries: total,
  }
}

export { sql }
