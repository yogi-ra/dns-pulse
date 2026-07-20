import { createSignal, createResource, onCleanup, onMount } from "solid-js";

export interface OverviewStats {
  total_queries: number;
  unique_clients: number;
  unique_domains: number;
  qps: number;
  new_domains: number;
  alert_count: number;
}

export interface Query {
  client_ip: string;
  query_name: string;
  query_type: string;
  hit_count: number;
  first_seen: string;
  last_seen: string;
}

export interface TopDomain {
  query_name: string;
  query_type: string;
  total_hits: number;
  unique_clients: number;
  last_seen: string;
}

export interface ClientRow {
  client_ip: string;
  total_queries: number;
  unique_domains: number;
  first_seen: string;
  last_seen: string;
}

export interface QueryType {
  query_type: string;
  count: number;
  pct: number;
}

export interface Beacon {
  client_ip: string;
  query_name: string;
  query_type: string;
  hit_count: number;
  first_seen: string;
  last_seen: string;
  avg_interval_sec: number;
}

export interface TimelinePoint {
  hour: string;
  count: number;
}

export interface Insights {
  high_entropy_domains: { query_name: string; entropy: number }[];
  total_queries: number;
}

export interface ThreatResult {
  domain: string;
  risk: "clean" | "low" | "medium" | "high" | "critical";
  score: number;
  source: string;
  details: string;
  link?: string;
  categories?: string[];
  registrar?: string;
  country?: string;
}

export interface ThreatStatus {
  virustotal: boolean;
  abuseipdb: boolean;
  community_feeds: boolean;
}

export interface ClientListItem {
  client_ip: string;
  total_queries: number;
}

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(r.status + " " + r.statusText);
  return r.json();
}

function qs(params: Record<string, any>) {
  const s = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return s ? "?" + s : "";
}

export const api = {
  overview: (range?: string, client?: string) =>
    get<OverviewStats>("/stats/overview" + qs({ range, client })),
  recent: (range?: string, client?: string, n?: number) =>
    get<Query[]>("/queries/recent" + qs({ range, client, limit: n || 50 })),
  topDomains: (range?: string, client?: string, n?: number) =>
    get<TopDomain[]>("/domains/top" + qs({ range, client, limit: n || 20 })),
  clients: (range?: string, n?: number) =>
    get<ClientRow[]>("/clients" + qs({ range, limit: n || 20 })),
  types: (range?: string, client?: string) =>
    get<QueryType[]>("/queries/types" + qs({ range, client })),
  beaconing: (range?: string, client?: string) =>
    get<Beacon[]>("/alerts/beaconing" + qs({ range, client })),
  timeline: (range?: string, client?: string) =>
    get<TimelinePoint[]>("/queries/timeline" + qs({ range, client })),
  insights: (range?: string, client?: string) =>
    get<Insights>("/insights" + qs({ range, client })),
  clientList: () => get<ClientListItem[]>("/clients/list"),
  threatDomain: (domain: string) =>
    get<ThreatResult>("/threat/domain/" + encodeURIComponent(domain)),
  threatIP: (ip: string) =>
    get<ThreatResult>("/threat/ip/" + encodeURIComponent(ip)),
  threatTop: (range?: string, limit = 10) =>
    get<ThreatResult[]>("/threat/top" + qs({ range, limit })),
  threatStatus: () => get<ThreatStatus>("/threat/status"),
};

// ── Polling hook — fixed refetch ────────────────────────────

export interface PollState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

export function createPolling<T>(
  source: () => string,
  fetcher: (key: string) => Promise<T>,
  ms = 5000
): () => PollState<T> {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [data, { refetch }] = createResource(source, async (s) => {
    setLoading(true);
    setError(null);
    try {
      return await fetcher(s);
    } catch (e: any) {
      setError(e?.message || "Request failed");
      return undefined as unknown as T;
    } finally {
      setLoading(false);
    }
  });

  onMount(() => {
    const id = setInterval(() => {
      if (!loading()) refetch();
    }, ms);
    onCleanup(() => clearInterval(id));
  });

  return () => ({
    data: data(),
    loading: loading() && data() === undefined,
    error: error(),
  });
}
