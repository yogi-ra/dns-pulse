import { Show, For } from "solid-js";
import { createPolling, api } from "../api";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  if (ms < 60000) return Math.floor(ms / 1000) + "s ago";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m ago";
  if (ms < 86400000) return Math.floor(ms / 3600000) + "h ago";
  return Math.floor(ms / 86400000) + "d ago";
}

export function ClientTable(props: { range: () => string }) {
  const state = createPolling(props.range, (r) => api.clients(r, 15), 8000);

  return (
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
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>IP Address</th><th>Queries</th><th>Domains</th><th>Last Seen</th></tr></thead>
            <tbody>
              <For each={state().data!}>
                {(c) => (
                  <tr>
                    <td class="ip">{c.client_ip}</td>
                    <td class="mono">{c.total_queries.toLocaleString()}</td>
                    <td class="mono">{c.unique_domains.toLocaleString()}</td>
                    <td>{timeAgo(c.last_seen)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </Show>
  );
}
