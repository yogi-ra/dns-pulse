import { Show, For } from "solid-js";
import { createPolling, api } from "../api";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  if (ms < 60000) return Math.floor(ms / 1000) + "s ago";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m ago";
  return Math.floor(ms / 3600000) + "h ago";
}

export function BeaconAlerts(props: { range: () => string }) {
  const state = createPolling(props.range, (r) => api.beaconing(r), 20000);

  return (
    <Show when={!state().loading && state().data && state().data!.length > 0}>
      <div class="grid-full">
        <div class="panel danger-panel">
          <div class="panel-header">
            <span class="panel-title" style={{ color: "var(--danger)" }}>
              {"\u26A0"} Suspicious Beaconing Detected
            </span>
            <span class="panel-badge danger">{state().data!.length} alerts</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Client IP</th><th>Domain</th><th>Type</th><th>Hit Count</th><th>Avg Interval</th><th>Last Seen</th></tr></thead>
              <tbody>
                <For each={state().data!}>
                  {(b) => (
                    <tr>
                      <td class="ip">{b.client_ip}</td>
                      <td style={{ color: "var(--danger)" }}>{b.query_name}</td>
                      <td><span class="type-badge">{b.query_type}</span></td>
                      <td class="mono" style={{ color: "var(--danger)" }}>{b.hit_count.toLocaleString()}</td>
                      <td class="mono">{b.avg_interval_sec}s</td>
                      <td>{timeAgo(b.last_seen)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Show>
  );
}
