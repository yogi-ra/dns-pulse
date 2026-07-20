import { Show, For, createMemo } from "solid-js";
import { createPolling, api } from "../api";

export function TimelineChart(props: { range: () => string }) {
  const state = createPolling(props.range, (r) => api.timeline(r), 15000);
  const W = 900, H = 200, PAD = { t: 12, r: 16, b: 30, l: 46 };

  const chart = createMemo(() => {
    const s = state();
    if (!s.data || !s.data.length) return null;
    const data = s.data;
    const max = Math.max(...data.map((d) => d.count), 1);
    const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
    const step = data.length > 1 ? iW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: PAD.l + i * step,
      y: PAD.t + iH - (d.count / max) * iH,
      hour: d.hour,
      count: d.count,
    }));
    const line = pts.map((p, i) => (i ? "L" : "M") + p.x + "," + p.y).join(" ");
    const area = line + " L" + pts[pts.length - 1].x + "," + (PAD.t + iH) + " L" + PAD.l + "," + (PAD.t + iH) + " Z";
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: PAD.t + iH * (1 - f),
      label: Math.round(max * f).toLocaleString(),
    }));
    const xLabels = pts
      .filter((_, i) => i % Math.max(1, Math.floor(pts.length / 6)) === 0 || i === pts.length - 1)
      .map((p) => ({
        x: p.x,
        label: new Date(p.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
    return { pts, line, area, yTicks, xLabels };
  });

  return (
    <Show
      when={!state().loading && state().data !== undefined}
      fallback={
        state().error
          ? <div class="empty" style={{ color: "var(--danger)" }}>{"\u26A0"} {state().error}</div>
          : <div class="skeleton" style={{ height: "200px" }} />
      }
    >
      <Show
        when={chart()}
        fallback={<div class="empty">No data for this time range</div>}
      >
        {(c) => (
          <svg class="timeline-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2" />
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <For each={c().yTicks}>
              {(t) => (
                <g>
                  <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="var(--border)" stroke-dasharray="2 4" />
                  <text x={PAD.l - 8} y={t.y + 3} text-anchor="end" fill="var(--text-muted)" font-size="8.5" font-family="var(--font-mono)">{t.label}</text>
                </g>
              )}
            </For>
            <path d={c().area} fill="url(#areaGrad)" />
            <path d={c().line} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
            <For each={c().pts}>
              {(p) => <circle cx={p.x} cy={p.y} r="2" fill="var(--accent-bright)" opacity="0.6" />}
            </For>
            <For each={c().xLabels}>
              {(l) => <text x={l.x} y={H - 6} text-anchor="middle" fill="var(--text-muted)" font-size="8" font-family="var(--font-mono)">{l.label}</text>}
            </For>
          </svg>
        )}
      </Show>
    </Show>
  );
}
