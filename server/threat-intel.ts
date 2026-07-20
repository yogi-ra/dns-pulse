// ── VirusTotal + AbuseIPDB + local threat feeds ────────────

import postgres from 'postgres'

const VT_KEY = process.env.VIRUSTOTAL_API_KEY || ''
const ABUSE_KEY = process.env.ABUSEIPDB_API_KEY || ''

// ── Types ──────────────────────────────────────────────────

export interface ThreatResult {
  domain: string
  risk: 'clean' | 'low' | 'medium' | 'high' | 'critical'
  score: number          // 0-100
  source: string
  details: string
  link?: string
  categories?: string[]
  last_analysis_stats?: {
    malicious: number
    suspicious: number
    harmless: number
    undetected: number
  }
  registrar?: string
  country?: string
  whois?: string
}

// ── VirusTotal lookup (API v3) ─────────────────────────────

async function vtLookup(domain: string): Promise<ThreatResult | null> {
  if (!VT_KEY) return null

  try {
    const res = await fetch(
      `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`,
      {
        headers: { 'x-apikey': VT_KEY },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (res.status === 404) {
      return {
        domain,
        risk: 'clean',
        score: 0,
        source: 'VirusTotal',
        details: 'Domain not found in VT database',
        link: `https://www.virustotal.com/gui/domain/${domain}`,
      }
    }

    if (res.status === 429) {
      console.warn('VT rate limit hit')
      return null
    }

    if (!res.ok) return null

    const json = await res.json()
    const attrs = json.data?.attributes || {}
    const stats = attrs.last_analysis_stats || {}

    const malicious = stats.malicious || 0
    const suspicious = stats.suspicious || 0
    const total = (malicious + suspicious + (stats.harmless || 0) + (stats.undetected || 0)) || 1
    const pct = ((malicious + suspicious) / total) * 100

    let risk: ThreatResult['risk'] = 'clean'
    let score = Math.round(pct)
    if (malicious > 5) { risk = 'critical'; score = Math.max(score, 90) }
    else if (malicious > 2) { risk = 'high'; score = Math.max(score, 70) }
    else if (malicious > 0 || suspicious > 3) { risk = 'medium'; score = Math.max(score, 40) }
    else if (suspicious > 0) { risk = 'low'; score = Math.max(score, 15) }

    const categories = Object.values(attrs.categories || {}) as string[]

    return {
      domain,
      risk,
      score: Math.min(score, 100),
      source: 'VirusTotal',
      details: `${malicious}/${total} engines flagged malicious, ${suspicious} suspicious`,
      link: `https://www.virustotal.com/gui/domain/${domain}`,
      categories: categories.slice(0, 5),
      last_analysis_stats: stats,
      registrar: attrs.registrar,
      country: attrs.last_https_certificate?.issuer?.C || attrs.registrar_country,
    }
  } catch (e: any) {
    console.error('VT lookup error:', e?.message)
    return null
  }
}

// ── AbuseIPDB lookup (for IP addresses) ────────────────────

async function abuseLookup(ip: string): Promise<ThreatResult | null> {
  if (!ABUSE_KEY) return null

  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
      {
        headers: { Key: ABUSE_KEY, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) return null
    const json = await res.json()
    const d = json.data
    if (!d) return null

    const score = d.abuseConfidenceScore || 0
    let risk: ThreatResult['risk'] = 'clean'
    if (score >= 90) risk = 'critical'
    else if (score >= 70) risk = 'high'
    else if (score >= 40) risk = 'medium'
    else if (score > 0) risk = 'low'

    return {
      domain: ip,
      risk,
      score,
      source: 'AbuseIPDB',
      details: `${d.totalReports} reports, ${d.abuseConfidenceScore}% confidence, ISP: ${d.isp || 'unknown'}`,
      link: `https://www.abuseipdb.com/check/${ip}`,
      country: d.countryCode,
    }
  } catch (e: any) {
    console.error('AbuseIPDB error:', e?.message)
    return null
  }
}

// ── Free community threat feeds (no API key needed) ────────

// Cached lists — refreshed periodically
let blocklistCache: Set<string> = new Set()
let blocklistLastFetch = 0
const BLOCKLIST_TTL = 3600_000 // 1 hour

const FEED_URLS = [
  'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/native.txt',
  'https://hole.cert.pl/domains/domains.txt',
]

async function refreshBlocklist(): Promise<void> {
  if (Date.now() - blocklistLastFetch < BLOCKLIST_TTL && blocklistCache.size > 0) return

  const newSet = new Set<string>()
  for (const url of FEED_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) continue
      const text = await res.text()
      for (const line of text.split('\n')) {
        // hosts format: "0.0.0.0 domain.com" or just "domain.com"
        const cleaned = line.trim().split(/\s+/)
        const domain = (cleaned.length > 1 ? cleaned[1] : cleaned[0]) || ''
        if (domain && !domain.startsWith('#') && !domain.startsWith('!') && domain.includes('.')) {
          newSet.add(domain.toLowerCase())
        }
      }
    } catch (e: any) {
      console.warn('Feed fetch failed:', url, e?.message)
    }
  }

  if (newSet.size > 0) {
    blocklistCache = newSet
    blocklistLastFetch = Date.now()
    console.log(`Loaded ${newSet.size} domains from community blocklists`)
  }
}

// ── Aggregate: check a domain across all sources ───────────

export async function enrichDomain(domain: string): Promise<ThreatResult> {
  // 1. Check community blocklists first (free, instant)
  await refreshBlocklist()
  const isBlocked = blocklistCache.has(domain.toLowerCase()) ||
    blocklistCache.has(domain.replace(/^www\./, '').toLowerCase())

  // 2. VT lookup (if key available)
  const vt = await vtLookup(domain)

  // 3. Merge results — worst risk wins
  if (vt) {
    if (isBlocked && vt.risk === 'clean') {
      vt.risk = 'medium'
      vt.score = Math.max(vt.score, 45)
      vt.details += '; Found in community blocklist'
    }
    return vt
  }

  // Fallback: community blocklist only
  if (isBlocked) {
    return {
      domain,
      risk: 'medium',
      score: 45,
      source: 'Community Blocklists',
      details: 'Domain found in curated blocklist (StevenBlack/hagezi/cert.pl)',
      link: `https://www.virustotal.com/gui/domain/${domain}`,
    }
  }

  return {
    domain,
    risk: 'clean',
    score: 0,
    source: 'Community Blocklists',
    details: 'Not found in any threat feed',
    link: `https://www.virustotal.com/gui/domain/${domain}`,
  }
}

// ── Bulk: enrich top N unique domains from the database ────

export async function enrichTopDomains(
  sql: postgres.Sql,
  range?: string,
  limit = 10
): Promise<ThreatResult[]> {
  const rangeClause = range ? sql`WHERE last_seen > NOW() - ${(range === '1h' ? '1 hour' : range === '6h' ? '6 hours' : range === '24h' ? '24 hours' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : '100 years')}::interval` : sql``

  const domains = await sql`
    SELECT query_name, SUM(hit_count)::int AS hits
    FROM dns_queries
    ${rangeClause}
    GROUP BY query_name
    ORDER BY hits DESC
    LIMIT ${limit}
  `

  const results: ThreatResult[] = []
  for (const row of domains) {
    try {
      const r = await enrichDomain(row.query_name)
      results.push(r)
    } catch {
      // skip on error
    }
  }
  return results
}

// ── IP enrichment ──────────────────────────────────────────

export async function enrichIP(ip: string): Promise<ThreatResult> {
  const abuse = await abuseLookup(ip)
  if (abuse) return abuse

  return {
    domain: ip,
    risk: 'clean',
    score: 0,
    source: 'AbuseIPDB',
    details: ABUSE_KEY ? 'Not found in AbuseIPDB' : 'AbuseIPDB API key not configured',
    link: `https://www.abuseipdb.com/check/${ip}`,
  }
}
