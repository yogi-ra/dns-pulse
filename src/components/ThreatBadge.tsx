import { Show, createSignal, createResource, For } from 'solid-js'
import { api, type ThreatResult } from '../api'

const RISK_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  clean: { bg: 'rgba(34,197,94,0.08)', color: 'var(--success)', label: 'Clean' },
  low: { bg: 'rgba(234,179,8,0.08)', color: 'var(--warning)', label: 'Low' },
  medium: { bg: 'rgba(234,179,8,0.12)', color: '#f59e0b', label: 'Medium' },
  high: { bg: 'rgba(239,68,68,0.08)', color: 'var(--danger)', label: 'High' },
  critical: { bg: 'rgba(239,68,68,0.15)', color: '#dc2626', label: 'Critical' },
}

export function ThreatBadge(props: { domain: string; autoFetch?: boolean }) {
  const [show, setShow] = createSignal(false)
  const [result] = createResource(
    () => props.autoFetch ? props.domain : (show() ? props.domain : null),
    (d) => api.threatDomain(d)
  )

  const style = () => {
    const r = result()
    if (!r) return null
    return RISK_STYLES[r.risk] || RISK_STYLES.clean
  }

  return (
    <span style={{ display: 'inline-flex', 'align-items': 'center', gap: '4px' }}>
      <Show
        when={result()}
        fallback={
          <button
            onClick={[setShow, true]}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              'border-radius': '4px',
              padding: '1px 6px',
              'font-size': '0.6rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              'font-family': 'var(--font-mono)',
              'line-height': '1.3',
            }}
          >
            check
          </button>
        }
      >
        {(r) => {
          const s = RISK_STYLES[r().risk] || RISK_STYLES.clean
          return (
            <a
              href={r().link}
              target="_blank"
              rel="noopener"
              style={{
                display: 'inline-flex',
                'align-items': 'center',
                gap: '4px',
                padding: '1px 7px',
                'border-radius': '4px',
                'font-size': '0.6rem',
                'font-weight': '500',
                'font-family': 'var(--font-mono)',
                background: s.bg,
                color: s.color,
                'text-decoration': 'none',
                border: '1px solid transparent',
                transition: 'border-color 0.15s',
                'white-space': 'nowrap',
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = s.color)}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              title={r().details}
            >
              {r().risk === 'clean' ? '\u2713' : '\u26A0'} {s.label} {r().score > 0 ? r().score : ''}
            </a>
          )
        }}
      </Show>
    </span>
  )
}
