import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { api, createPolling } from "./api";
import { DonutChart } from "./components/DonutChart";
import { TimelineChart } from "./components/TimelineChart";
import { TopDomains } from "./components/TopDomains";
import { ClientTable } from "./components/ClientTable";
import { RecentFeed } from "./components/RecentFeed";
import { BeaconAlerts } from "./components/BeaconAlerts";
import { ThreatPanel } from './components/ThreatPanel'

function fmt(n: number | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 10000) return (n / 1000).toFixed(1) + "K";
  if (n >= 1000) return (n / 1000).toFixed(2) + "K";
  return String(n);
}

function Clock() {
  const [time, setTime] = createSignal(new Date().toLocaleTimeString());
  onMount(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    onCleanup(() => clearInterval(id));
  });
  return <span class="clock">{time()}</span>;
}

const RANGES = ["1h", "6h", "24h", "7d", "30d", "All"];

function StatCard(props: {
  label: string;
  value?: number | string;
  sub?: string;
  subClass?: string;
  color?: string;
}) {
  return (
    <div class="stat-card">
      <div class="stat-label">{props.label}</div>
      <div class="stat-value" style={props.color ? { color: props.color } : undefined}>
        {props.value != null ? fmt(typeof props.value === "number" ? props.value : undefined) || props.value : "\u2014"}
      </div>
      <Show when={props.sub}>
        <div class={"stat-sub " + (props.subClass || "neutral")}>{props.sub}</div>
      </Show>
    </div>
  );
}

function ErrorBanner(props: { message: string }) {
  return (
    <div style={{
      background: "var(--danger-dim)",
      border: "1px solid rgba(239,68,68,0.2)",
      "border-radius": "var(--radius-sm)",
      padding: "8px 14px",
      "font-size": "0.74rem",
      color: "var(--danger)",
      "margin-bottom": "14px",
    }}>
      {"\u26A0"} {props.message}
    </div>
  );
}

export function App() {
  const [range, setRange] = createSignal("all");

  const overview = createPolling(range, (r) => api.overview(r), 5000);
  const insights = createPolling(range, (r) => api.insights(r), 15000);

  const o = () => overview();
  const i = () => insights();

  return (
    <div class="dashboard">
      <header class="header">
        <div class="header-left">
          <div class="logo">
            <div class="logo-icon">{"\u25C9"}</div>
            <span class="logo-text">DNS PULSE</span>
          </div>
          <span class="logo-sub">Network DNS Monitoring</span>
        </div>
        <div class="header-right">
          <div class="range-selector">
            <For each={RANGES}>{(r) => (
              <button
                class={"range-pill" + (range() === r.toLowerCase() ? " active" : "")}
                onClick={() => setRange(r.toLowerCase())}
              >{r}</button>
            )}</For>
          </div>
          <div class="status-badge">
            <span class="status-dot" />
            <Show when={o().data}>
              <span>{o().data!.qps} qps</span>
            </Show>
          </div>
          <Clock />
        </div>
      </header>

      <Show when={o().error}>
        <ErrorBanner message={o().error!} />
      </Show>

      <div class="stat-grid">
        <StatCard
          label="Total Queries"
          value={o().loading ? undefined : o().data?.total_queries}
          sub={o().data ? "in selected range" : undefined}
          subClass="neutral"
        />
        <StatCard
          label="Unique Clients"
          value={o().loading ? undefined : o().data?.unique_clients}
        />
        <StatCard
          label="Unique Domains"
          value={o().loading ? undefined : o().data?.unique_domains}
        />
        <StatCard
          label="Queries / Sec"
          value={o().loading ? undefined : o().data?.qps}
          sub={o().data ? "live" : undefined}
          subClass="neutral"
        />
        <StatCard
          label="Alerts"
          value={o().loading ? undefined : o().data?.alert_count}
          sub={o().data ? (o().data!.alert_count > 0 ? "beaconing detected" : "all clear") : undefined}
          subClass={o().data && o().data!.alert_count > 0 ? "negative" : "positive"}
          color={o().data && o().data!.alert_count > 0 ? "var(--danger)" : undefined}
        />
      </div>

      <div class="grid-full">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Query Volume</span>
          </div>
          <TimelineChart range={range} />
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Query Types</span>
          </div>
          <DonutChart range={range} />
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Insights</span>
          </div>
          <Show when={i().error}>
            <ErrorBanner message={i().error!} />
          </Show>
          <Show
            when={!i().loading && i().data}
            fallback={<div class="skeleton" style={{ height: "160px" }} />}
          >
            {(ins) => (
              <div class="insight-grid">
                <div class="insight-box">
                  <div class="insight-label">Total queries</div>
                  <div class="insight-value">{fmt(ins().total_queries)}</div>
                </div>
                <div class="insight-box">
                  <div class="insight-label">High-entropy domains</div>
                  <div
                    class="insight-value"
                    style={{
                      color: ins().high_entropy_domains.length > 0
                        ? "var(--warning)"
                        : "var(--success)",
                    }}
                  >
                    {ins().high_entropy_domains.length}
                  </div>
                </div>
                <div class="insight-box wide">
                  <div class="insight-label">Possible DGA domains</div>
                  <Show
                    when={ins().high_entropy_domains.length > 0}
                    fallback={
                      <div style={{ color: "var(--success)", "font-size": "0.78rem", "margin-top": "4px" }}>
                        None detected
                      </div>
                    }
                  >
                    <ul class="entropy-list">
                      <For each={ins().high_entropy_domains.slice(0, 5)}>
                        {(d) => (
                          <li>
                            <span style={{ color: "var(--danger)" }}>{d.query_name}</span>
                            <span class="entropy-val">{d.entropy}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>

      <BeaconAlerts range={range} />

      <div class="grid-full">
        <ThreatPanel range={range} />
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Top Domains</span>
          </div>
          <TopDomains range={range} />
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Client Activity</span>
          </div>
          <ClientTable range={range} />
        </div>
      </div>

      <RecentFeed range={range} />
    </div>
  );
}
