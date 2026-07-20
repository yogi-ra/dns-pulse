import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { existsSync } from 'fs'
import * as db from './db'
import { enrichDomain, enrichIP, enrichTopDomains } from './threat-intel'

const PORT = Number(process.env.PORT || 3000)
const isProd = process.env.NODE_ENV === 'production'

const app = new Elysia()
  .use(cors())

if (isProd && existsSync('dist')) {
  app.use(staticPlugin({ assets: 'dist', prefix: '/' }))
}

// ── Existing routes ──

app
  .get('/api/stats/overview', ({ query }) => db.getOverview(query.range))
  .get('/api/queries/recent', ({ query }) => db.getRecentQueries(query.range, Number(query.limit) || 50))
  .get('/api/domains/top', ({ query }) => db.getTopDomains(query.range, Number(query.limit) || 20))
  .get('/api/clients', ({ query }) => db.getClients(query.range, Number(query.limit) || 20))
  .get('/api/queries/types', ({ query }) => db.getQueryTypes(query.range))
  .get('/api/alerts/beaconing', ({ query }) => db.getBeaconing(query.range))
  .get('/api/queries/timeline', ({ query }) => db.getTimeline(query.range))
  .get('/api/insights', ({ query }) => db.getInsights(query.range))

  // ── Threat Intel routes ──

  // Enrich a single domain
  .get('/api/threat/domain/:domain', async ({ params }) => {
    return enrichDomain(params.domain)
  })

  // Enrich a single IP
  .get('/api/threat/ip/:ip', async ({ params }) => {
    return enrichIP(params.ip)
  })

  // Bulk enrich top domains for a range
  .get('/api/threat/top', async ({ query }) => {
    const limit = Number(query.limit) || 10
    return enrichTopDomains(db.sql, query.range, limit)
  })

  // Check if threat intel keys are configured
  .get('/api/threat/status', () => {
    return {
      virustotal: !!process.env.VIRUSTOTAL_API_KEY,
      abuseipdb: !!process.env.ABUSEIPDB_API_KEY,
      community_feeds: true,
    }
  })

  .listen(PORT)

console.log('DNS Pulse API on http://localhost:' + PORT)
