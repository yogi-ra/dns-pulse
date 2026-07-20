import { Show, For, createMemo } from "solid-js";
import { createPolling, api } from "../api";

export function TopDomains(props: { range: () => string }) {
  const state = createPolling(props.range, (r) => api.topDomains(r, 15), 10000);

  const maxHits = createMemo(() => {
    const d = state().data;
    return d && d.length ? Math.max(...d.map((x) => x.total_hits)) : 1;
  });

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
        <div class="table-scroll" style={{ "max-height": "340px" }}>
          <For each={state().data!}>
            {(d, i) => (
              <div class="bar-row" style={{ "animation-delay": `${0.28 + i() * 0.04}s` }}>
                <span class="bar-name" title={d.query_name}>{d.query_name}</span>
                <div class="bar-track">
                  <div
                    class={`bar-fill${d.total_hits / maxHits() > 0.8 ? " danger" : ""}`}
                    style={{ width: `${(d.total_hits / maxHits()) * 100}%` }}
                  />
                </div>
                <span class="bar-count">{d.total_hits.toLocaleString()}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
