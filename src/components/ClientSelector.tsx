import { Show, For, createResource, createMemo } from "solid-js";
import { api } from "../api";

export function ClientSelector(props: {
  value: () => string;
  onChange: (v: string) => void;
}) {
  const [list] = createResource(() => api.clientList());

  return (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <label
        style={{
          "font-size": "0.68rem",
          color: "var(--text-muted)",
          "text-transform": "uppercase",
          "letter-spacing": "0.06em",
          "white-space": "nowrap",
        }}
      >
        Client
      </label>
      <select
        value={props.value()}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          "border-radius": "5px",
          color: props.value() ? "var(--accent-bright)" : "var(--text-sec)",
          "font-family": "var(--font-mono)",
          "font-size": "0.72rem",
          "font-weight": "500",
          padding: "5px 28px 5px 10px",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 0.15s",
          "min-width": "150px",
          appearance: "none",
          "background-image":
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%234b5563\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M4 6l4 4 4-4\'/%3E%3C/svg%3E")',
          "background-repeat": "no-repeat",
          "background-position": "right 8px center",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <option value="">All Clients</option>
        <Show when={list()}>
          <For each={list()!}>
            {(c) => (
              <option value={c.client_ip}>
                {c.client_ip}{" "}
                ({c.total_queries.toLocaleString()} queries)
              </option>
            )}
          </For>
        </Show>
      </select>
    </div>
  );
}
