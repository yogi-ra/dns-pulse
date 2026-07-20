import { Show, For, createResource, createMemo } from 'solid-js'
import { api, type ThreatResult } from '../api'

const RISK_COLORS: Record<string, string> = {
  clean: 'var(--success)',
  low: 'var(--warning)',
  medium: '#f59e0b',
  high: 'var(--danger)',
  critical: '#dc2626',
}

const RISK_BG: Record<string, string> = {
  clean: 'rgba(34,197,94,0.06)',
  low: 'rgba(234,179,8,0.06)',
  medium: 'rgba(234,179,8,0.1)',
  high: 'rgba(239,68,68,0.06)',
  critical: 'rgba(239,68,68,0.12)',
}

export function ThreatPanel(props: { range: () => string }) {
  const [data] = createResource(
    () => props.range(),
    (r) => api.threatTop(r, 15)
  )

  const [status] = createResource(() => api.threatStatus())

  const sorted = createMemo(() => {
    const d = data()
    if (!d) return []
    return [...d].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, clean: 4 }
      return (order[a.risk] ?? 5) - (order[b.risk] ?? 5)
    })
  })

  const threats = createMemo(() => sorted().filter((d) => d.risk !== 'clean'))

  return (
    <div class="panel" style={{ 'animation-delay': '0.26s' }}>
      <div class="panel-header">
        <span class="panel-title">Threat Intelligence</span>
        <Show when={status()}>
          {(s) => (
            <span class="panel-badge info">
              {s().virustotal ? 'VT' : ''}
              {s().virustotal && s().community_feeds ? ' + ' : ''}
              {s().community_feeds ? 'Community' : ''}
              {!s().virustotal && !s().community_feeds ? 'none' : ''}
            </span>
          )}
        </Show>
      </div>

      <Show
        when={data()}
        fallback={<div class="skeleton" style={{ height: '200px' }} />}
      >
        <Show
          when={data()!.length > 0}
          fallback={<div class="empty">No domains to scan</div>}
        >
          {/* Summary bar */}
          <Show when={threats().length > 0}>
            <div style={{
              display: 'flex',
              gap: '8px',
              'margin-bottom': '16px',
              'flex-wrap': 'wrap',
            }}>
              <For each={[...new Set(threats().map((t) => t.risk))]}>
                {(risk) => (
                  <span style={{
                    padding: '3px 10px',
                    'border-radius': '4px',
                    'font-size': '0.66rem',
                    'font-weight': '500',
                    'font-family': 'var(--font-mono)',
                    background: RISK_BG[risk],
                    color: RISK_COLORS[risk],
                    border: `1px solid ${RISK_COLORS[risk]}33`,
                  }}>
                    {threats().filter((t) => t.risk === risk).length} {risk}
                  </span>
                )}
              </For>
            </div>
          </Show>

          {/* Domain list */}
          <div class="table-scroll" style={{ 'max-height': '340px' }}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Risk</th>
                  <th>Score</th>
                  <th>Source</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <For each={sorted()}>
                  {(t) => (
                    <tr style={t.risk !== 'clean' ? { background: RISK_BG[t.risk] } : undefined}>
                      <td>
                        <a
                          href={t.link}
                          target="_blank"
                          rel="noopener"
                          style={{
                            color: t.risk !== 'clean' ? RISK_COLORS[t.risk] : 'var(--text)',
                            'text-decoration': 'none',
                            'font-weight': t.risk !== 'clean' ? '500' : '400',
                          }}
                        >
                          {t.domain}
                        </a>
                        <Show when={t.categories && t.categories.length > 0}>
                          <div style={{
                            'font-size': '0.6rem',
                            color: 'var(--text-muted)',
                            'margin-top': '2px',
                          }}>
                            {t.categories!.slice(0, 2).join(', ')}
                          </div>
                        </Show>
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          'border-radius': '4px',
                          'font-size': '0.63rem',
                          'font-weight': '600',
                          background: RISK_BG[t.risk] || 'var(--bg-surface)',
                          color: RISK_COLORS[t.risk] || 'var(--text-sec)',
                          'text-transform': 'uppercase',
                          'letter-spacing': '0.04em',
                        }}>
                          {t.risk}
                        </span>
                      </td>
                      <td class="mono" style={{
                        color: t.score > 40 ? 'var(--danger)' :
                          t.score > 10 ? 'var(--warning)' :
                            'var(--text-sec)',
                        'font-weight': t.score > 40 ? '600' : '400',
                      }}>
                        {t.score}/100
                      </td>
                      <td style={{ color: 'var(--text-muted)', 'font-size': '0.68rem' }}>
                        {t.source}
                      </td>
                      <td style={{
                        'max-width': '280px',
                        'font-size': '0.68rem',
                        color: 'var(--text-sec)',
                      }}>
                        {t.details}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  )
}
