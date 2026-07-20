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

  app.get('/', () => Bun.file('dist/index.html'))
  app.get('*', ({ path }) => {
    if (!path.startsWith('/api')) {
      const file = `dist${path}`
      if (existsSync(file)) return Bun.file(file)
      return Bun.file('dist/index.html')
    }
  })
}

// Helper to extract common params
function p(q: Record<string, string | undefined>) {
  return { range: q.range, client: q.client }
}

app
  .get('/api/stats/overview', ({ query }) => db.getOverview(query.range, query.client))
  .get('/api/queries/recent', ({ query }) => db.getRecentQueries(query.range, query.client, Number(query.limit) || 50))
  .get('/api/domains/top', ({ query }) => db.getTopDomains(query.range, query.client, Number(query.limit) || 20))
  .get('/api/clients', ({ query }) => db.getClients(query.range, Number(query.limit) || 20))
  .get('/api/queries/types', ({ query }) => db.getQueryTypes(query.range, query.client))
  .get('/api/alerts/beaconing', ({ query }) => db.getBeaconing(query.range, query.client))
  .get('/api/queries/timeline', ({ query }) => db.getTimeline(query.range, query.client))
  .get('/api/insights', ({ query }) => db.getInsights(query.range, query.client))

  // Client list for the dropdown
  .get('/api/clients/list', () => db.getClientList())

  // Threat intel
  .get('/api/threat/domain/:domain', async ({ params }) => enrichDomain(params.domain))
  .get('/api/threat/ip/:ip', async ({ params }) => enrichIP(params.ip))
  .get('/api/threat/top', async ({ query }) => {
    return enrichTopDomains(db.sql, query.range, Number(query.limit) || 10)
  })
  .get('/api/threat/status', () => ({
    virustotal: !!process.env.VIRUSTOTAL_API_KEY,
    abuseipdb: !!process.env.ABUSEIPDB_API_KEY,
    community_feeds: true,
  }))

  .listen(PORT)

console.log('DNS Pulse API on http://localhost:' + PORT)
