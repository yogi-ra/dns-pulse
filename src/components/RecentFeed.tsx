import { Show, For } from "solid-js";
import { createPolling, api } from "../api";
import { ThreatBadge } from './ThreatBadge'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  if (ms < 60000) return Math.floor(ms / 1000) + "s ago";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m ago";
  return Math.floor(ms / 3600000) + "h ago";
}

const TYPE_COLORS: Record<string, string> = {
  A: "#3b82f6", AAAA: "#60a5fa", CNAME: "#8b5cf6",
  MX: "#f59e0b", TXT: "#22c55e", NS: "#ec4899",
};

export function RecentFeed(props: { range: () => string }) {
  const state = createPolling(props.range, (r) => api.recent(r, 40), 3000);

  return (
    <div class="panel" style={{ "animation-delay": "0.3s" }}>
      <div class="panel-header">
        <span class="panel-title">Recent DNS Queries</span>
        <span class="panel-badge info">live</span>
      </div>
      <Show
        when={!state().loading && state().data !== undefined}
        fallback={
          state().error
            ? <div class="empty" style={{ color: "var(--danger)" }}>{"\u26A0"} {state().error}</div>
            : <div class="skeleton" style={{ height: "300px" }} />
        }
      >
        <Show
          when={state().data && state().data!.length > 0}
          fallback={<div class="empty">No data for this time range</div>}
        >
          <div class="table-scroll" style={{ "max-height": "420px" }}>
            <table class="data-table">
              <thead><tr><th>Time</th><th>Client</th><th>Query</th><th>Threat Badge</th><th>Type</th><th>Hits</th></tr></thead>
              <tbody>
                <For each={state().data!}>
                  {(q) => (
                    <tr>
                      <td>{timeAgo(q.last_seen)}</td>
                      <td class="ip">{q.client_ip}</td>
                      <td style={{ "max-width": "320px" }}>{q.query_name}</td>
                      <td style={{ "max-width": "320px" }}>
                        {q.query_name}
                        <ThreatBadge domain={q.query_name} />
                      </td>
                      <td>
                        <span class="type-badge" style={{
                          "border-color": TYPE_COLORS[q.query_type] || "var(--border)",
                          color: TYPE_COLORS[q.query_type] || "var(--text-sec)",
                        }}>{q.query_type}</span>
                      </td>
                      <td class="mono">{q.hit_count.toLocaleString()}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  );
}
