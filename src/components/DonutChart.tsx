import { Show, For, createMemo } from "solid-js";
import { createPolling, api } from "../api";

const COLORS: Record<string, string> = {
  A: "#3b82f6", AAAA: "#60a5fa", CNAME: "#8b5cf6", MX: "#f59e0b",
  TXT: "#22c55e", NS: "#ec4899", SOA: "#6366f1", PTR: "#14b8a6",
  SRV: "#f97316", HTTPS: "#a78bfa", ANY: "#fb7185",
};
function color(t: string) { return COLORS[t] || "#4b5563"; }

export function DonutChart(props: { range: () => string }) {
  const state = createPolling(props.range, (r) => api.types(r), 10000);
  const R = 62, SW = 20, C = 2 * Math.PI * R;

  const segments = createMemo(() => {
    const data = state().data;
    if (!data || !data.length) return [];
    const total = data.reduce((s, d) => s + d.count, 0);
    let offset = 0;
    return data.map((d) => {
      const dash = (d.count / total) * C;
      const seg = {
        query_type: d.query_type, count: d.count, pct: d.pct,
        dashArray: `${dash} ${C - dash}`, dashOffset: -offset,
      };
      offset += dash;
      return seg;
    });
  });

  return (
    <Show
      when={!state().loading && state().data !== undefined}
      fallback={
        state().error
          ? <div class="empty" style={{ color: "var(--danger)" }}>{"\u26A0"} {state().error}</div>
          : <div class="skeleton" style={{ height: "160px" }} />
      }
    >
      <Show
        when={state().data && state().data!.length > 0}
        fallback={<div class="empty">No data for this time range</div>}
      >
        <div class="donut-wrap">
          <svg class="donut-svg" viewBox="0 0 200 200">
            <For each={segments()}>
              {(seg) => (
                <circle cx="100" cy="100" r={R} fill="none" stroke={color(seg.query_type)}
                  stroke-width={SW} stroke-dasharray={seg.dashArray} stroke-dashoffset={seg.dashOffset}
                  stroke-linecap="butt" transform="rotate(-90 100 100)"
                  style={{ transition: "stroke-dasharray 0.6s ease" }} />
              )}
            </For>
            <text x="100" y="96" text-anchor="middle" fill="var(--text)" font-family="var(--font-display)" font-size="22" font-weight="700">
              {state().data!.reduce((s, d) => s + d.count, 0).toLocaleString()}
            </text>
            <text x="100" y="112" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="8.5" letter-spacing="0.1em">TOTAL</text>
          </svg>
          <div class="donut-legend">
            <For each={state().data!}>
              {(t) => (
                <div class="legend-item">
                  <span class="legend-swatch" style={{ background: color(t.query_type) }} />
                  <span>{t.query_type}</span>
                  <span class="legend-pct">{t.pct}%</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </Show>
  );
}
