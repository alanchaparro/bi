import axios, { type AxiosError } from "axios";
import type {
  BrokersFilters,
  BrokersPreferences,
  LoginRequest,
  LoginResponse,
  RulesRequest,
  RulesResponse,
  SupervisorsScopeResponse,
} from "./contracts";

export type { BrokersFilters, BrokersPreferences };
import { clearSession, getStoredRefreshToken, setStoredRefreshToken } from "./sessionStorage";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
});
const USE_ANALYTICS_V2 = String(import.meta.env.VITE_USE_ANALYTICS_V2 || "1").trim() !== "0";
const USE_COHORTE_V2_FIRST_PAINT = String(import.meta.env.VITE_USE_COHORTE_V2_FIRST_PAINT || "1").trim() !== "0";
const USE_FIRST_PAINT_ALL_SECTIONS = String(import.meta.env.VITE_USE_FIRST_PAINT_ALL_SECTIONS || "1").trim() !== "0";
const USE_FRONTEND_PERF_TELEMETRY = String(import.meta.env.VITE_USE_FRONTEND_PERF_TELEMETRY || "1").trim() !== "0";

/** Callback when session is invalid (e.g. refresh failed). App should clear auth state and show login. */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

/** Refresh tokens; returns new TokenOut or throws. */
export async function refreshToken(refreshTokenValue: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/refresh", {
    refresh_token: refreshTokenValue,
  });
  return response.data;
}

/** Restore session using stored refresh token. Returns auth payload or null. */
export async function restoreSession(): Promise<LoginResponse | null> {
  const stored = getStoredRefreshToken();
  if (!stored) return null;
  try {
    const data = await refreshToken(stored);
    setAuthToken(data.access_token);
    if (data.refresh_token) setStoredRefreshToken(data.refresh_token);
    return data;
  } catch {
    clearSession();
    setAuthToken(null);
    return null;
  }
}

export function logout(): void {
  clearSession();
  setAuthToken(null);
}

/** Setup response interceptor: on 401, try refresh then retry; if refresh fails, clear session and call onUnauthorized. */
function setupAuthInterceptor() {
  api.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      const originalRequest = err.config as typeof err.config & { _retry?: boolean };
      if (err.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(err);
      }
      const url = originalRequest?.url ?? "";
      if (url.includes("/auth/login")) {
        return Promise.reject(err);
      }
      if (url.includes("/auth/refresh")) {
        clearSession();
        setAuthToken(null);
        onUnauthorized?.();
        return Promise.reject(err);
      }
      const stored = getStoredRefreshToken();
      if (!stored) {
        setAuthToken(null);
        onUnauthorized?.();
        return Promise.reject(err);
      }
      originalRequest._retry = true;
      try {
        const data = await refreshToken(stored);
        setAuthToken(data.access_token);
        if (data.refresh_token) setStoredRefreshToken(data.refresh_token);
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch {
        clearSession();
        setAuthToken(null);
        onUnauthorized?.();
        return Promise.reject(err);
      }
    }
  );
}
setupAuthInterceptor();

type PerfApiCall = {
  endpoint: string;
  ms: number;
  cache_hit?: boolean;
  bytes?: number;
  ts: number;
};

let perfRoute: FrontendPerfRoute | null = null;
let perfSessionId = "";
let perfFcpMs: number | null = null;
const perfApiCalls: PerfApiCall[] = [];
let perfRouteStart = 0;

function ensurePerfSessionId(): string {
  if (perfSessionId) return perfSessionId;
  try {
    const existing = window.sessionStorage.getItem("frontend_perf_session_id");
    if (existing) {
      perfSessionId = existing;
      return perfSessionId;
    }
  } catch {
    // ignore storage read issues
  }
  perfSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    window.sessionStorage.setItem("frontend_perf_session_id", perfSessionId);
  } catch {
    // ignore storage write issues
  }
  return perfSessionId;
}

if (typeof window !== "undefined" && USE_FRONTEND_PERF_TELEMETRY) {
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          perfFcpMs = Math.round(entry.startTime * 100) / 100;
        }
      }
    });
    obs.observe({ type: "paint", buffered: true });
  } catch {
    // unsupported browser/api
  }
}

api.interceptors.request.use((config) => {
  (config as typeof config & { _perfStartedAt?: number })._perfStartedAt = performance.now();
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (!USE_FRONTEND_PERF_TELEMETRY) return response;
    const cfg = response.config as typeof response.config & { _perfStartedAt?: number };
    const started = Number(cfg._perfStartedAt || 0);
    const ms = started > 0 ? Math.max(0, performance.now() - started) : 0;
    const endpoint = String(cfg.url || "");
    if (endpoint.includes("/telemetry/frontend-perf")) {
      return response;
    }
    const cacheHit = Boolean((response.data as { meta?: { cache_hit?: boolean } } | undefined)?.meta?.cache_hit);
    const bytesRaw = response.headers?.["content-length"];
    const bytes = Number.isFinite(Number(bytesRaw)) ? Number(bytesRaw) : undefined;
    perfApiCalls.push({
      endpoint,
      ms: Math.round(ms * 100) / 100,
      cache_hit: cacheHit,
      bytes,
      ts: Date.now(),
    });
    while (perfApiCalls.length > 120) perfApiCalls.shift();
    return response;
  },
  (error) => Promise.reject(error)
);

export function markPerfRoute(route: FrontendPerfRoute): void {
  perfRoute = route;
  perfRouteStart = performance.now();
}

export async function markPerfReady(route: FrontendPerfRoute): Promise<void> {
  if (!USE_FRONTEND_PERF_TELEMETRY) return;
  const readyMs = perfRouteStart > 0 ? Math.max(0, performance.now() - perfRouteStart) : 0;
  const now = Date.now();
  const routeCalls = perfApiCalls.filter((c) => now - c.ts <= 120000);
  const ttfbMs = routeCalls.length > 0 ? routeCalls[0].ms : undefined;
  const payload: FrontendPerfIn = {
    route,
    session_id: ensurePerfSessionId(),
    ttfb_ms: ttfbMs,
    fcp_ms: perfFcpMs ?? undefined,
    ready_ms: Math.round(readyMs * 100) / 100,
    api_calls: routeCalls.map((c) => ({
      endpoint: c.endpoint,
      ms: c.ms,
      cache_hit: c.cache_hit,
      bytes: c.bytes,
    })),
    timestamp_utc: new Date().toISOString(),
    app_version: String(import.meta.env.VITE_APP_VERSION || "dev"),
  };
  try {
    await sendFrontendPerf(payload);
  } catch {
    // no-op: telemetry must not break UX
  }
}

export async function getSupervisorsScope(): Promise<SupervisorsScopeResponse> {
  const response = await api.get<SupervisorsScopeResponse>(
    "/brokers/supervisors-scope"
  );
  return response.data;
}

export async function saveSupervisorsScope(
  payload: SupervisorsScopeResponse
): Promise<SupervisorsScopeResponse> {
  const response = await api.post<SupervisorsScopeResponse>(
    "/brokers/supervisors-scope",
    payload
  );
  return response.data;
}

export async function getCommissionsRules(): Promise<RulesResponse> {
  const response = await api.get<RulesResponse>("/brokers/commissions");
  return response.data;
}

export async function saveCommissionsRules(
  payload: RulesRequest
): Promise<RulesResponse> {
  const response = await api.post<RulesResponse>("/brokers/commissions", payload);
  return response.data;
}

export async function getPrizesRules(): Promise<RulesResponse> {
  const response = await api.get<RulesResponse>("/brokers/prizes");
  return response.data;
}

export async function savePrizesRules(payload: RulesRequest): Promise<RulesResponse> {
  const response = await api.post<RulesResponse>("/brokers/prizes", payload);
  return response.data;
}

export async function getBrokersPreferences(): Promise<BrokersPreferences> {
  const response = await api.get<BrokersPreferences>("/brokers/preferences");
  return response.data;
}

export async function saveBrokersPreferences(
  payload: BrokersPreferences
): Promise<BrokersPreferences> {
  const response = await api.post<BrokersPreferences>("/brokers/preferences", payload);
  return response.data;
}

export async function getCarteraPreferences(): Promise<BrokersPreferences> {
  const response = await api.get<BrokersPreferences>("/brokers/preferences/cartera");
  return response.data;
}

export async function saveCarteraPreferences(
  payload: BrokersPreferences
): Promise<BrokersPreferences> {
  const response = await api.post<BrokersPreferences>("/brokers/preferences/cartera", payload);
  return response.data;
}

export type MysqlConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl_disabled: boolean;
};

export type MysqlConnectionTestResponse = {
  ok: boolean;
  message: string;
  latency_ms?: number | null;
};

export async function getMysqlConnectionConfig(): Promise<MysqlConnectionConfig> {
  const response = await api.get<MysqlConnectionConfig>("/brokers/mysql-connection");
  return response.data;
}

export async function saveMysqlConnectionConfig(
  payload: MysqlConnectionConfig
): Promise<MysqlConnectionConfig> {
  const response = await api.post<MysqlConnectionConfig>("/brokers/mysql-connection", payload);
  return response.data;
}

export async function testMysqlConnectionConfig(
  payload: MysqlConnectionConfig
): Promise<MysqlConnectionTestResponse> {
  const response = await api.post<MysqlConnectionTestResponse>("/brokers/mysql-connection/test", payload);
  return response.data;
}

export type UserItem = {
  username: string;
  role: "admin" | "analyst" | "viewer" | string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function listUsers(): Promise<{ users: UserItem[] }> {
  const response = await api.get<{ users: UserItem[] }>("/brokers/users");
  return response.data;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: "admin" | "analyst" | "viewer" | string;
  is_active: boolean;
}): Promise<UserItem> {
  const response = await api.post<UserItem>("/brokers/users", payload);
  return response.data;
}

export async function updateUser(
  username: string,
  payload: {
    role?: "admin" | "analyst" | "viewer" | string;
    is_active?: boolean;
    password?: string;
  }
): Promise<UserItem> {
  const response = await api.put<UserItem>(`/brokers/users/${encodeURIComponent(username)}`, payload);
  return response.data;
}

export type SyncDomain = "analytics" | "cartera" | "cobranzas" | "contratos" | "gestores";

export type PortfolioOptionsResponse = {
  options: {
    uns?: string[];
    vias?: string[];
    tramos?: string[];
    categories?: string[];
    months?: string[];
    close_months?: string[];
  };
  meta?: {
    generated_at?: string;
    source_table?: string;
  };
};

export type PortfolioCorteOptionsResponse = {
  options: {
    uns?: string[];
    supervisors?: string[];
    vias?: string[];
    tramos?: string[];
    categories?: string[];
    gestion_months?: string[];
    close_months?: string[];
    contract_years?: string[];
  };
  meta?: {
    generated_at?: string;
    source_table?: string;
  };
};

export type PortfolioCorteSummaryResponse = {
  kpis?: {
    total_cartera?: number;
    vigentes_total?: number;
    morosos_total?: number;
    via_cobrador_total?: number;
    via_debito_total?: number;
    monto_total_corte?: number;
    monto_vencido_total?: number;
    paid_total?: number;
  };
  charts?: {
    by_un?: Record<string, number>;
    by_tramo?: Record<string, number>;
    by_via?: Record<string, number>;
    by_contract_year?: Record<string, number>;
    series_vigente_moroso_by_month?: Record<string, { vigente?: number; moroso?: number }>;
    series_cobrador_debito_by_month?: Record<string, { cobrador?: number; debito?: number }>;
  };
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
  };
};

export type CobranzasCohorteOptionsResponse = {
  options: {
    cutoff_months?: string[];
    uns?: string[];
    supervisors?: string[];
    vias?: string[];
    categories?: string[];
  };
  default_cutoff?: string | null;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
  };
};

export type CobranzasCohorteSummaryResponse = {
  cutoff_month: string;
  effective_cartera_month?: string;
  totals: {
    activos: number;
    pagaron: number;
    deberia: number;
    cobrado: number;
    transacciones?: number;
    pct_pago_contratos: number;
    pct_cobertura_monto: number;
  };
  by_sale_month: Array<{
    sale_month: string;
    activos: number;
    pagaron: number;
    deberia: number;
    cobrado: number;
    pct_pago_contratos: number;
    pct_cobertura_monto: number;
  }>;
  by_year: Record<string, {
    activos: number;
    pagaron: number;
    deberia: number;
    cobrado: number;
    pct_pago_contratos: number;
    pct_cobertura_monto: number;
  }>;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
  };
};

export type CobranzasCohorteFirstPaintResponse = {
  cutoff_month: string;
  effective_cartera_month?: string;
  totals: CobranzasCohorteSummaryResponse["totals"];
  by_year: CobranzasCohorteSummaryResponse["by_year"];
  top_sale_months: CobranzasCohorteSummaryResponse["by_sale_month"];
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    cache_hit?: boolean;
    data_freshness_at?: string;
    pipeline_version?: string;
    payload_mode?: string;
  };
};

export type CobranzasCohorteDetailResponse = {
  cutoff_month: string;
  effective_cartera_month?: string;
  items: CobranzasCohorteSummaryResponse["by_sale_month"];
  total_items: number;
  page: number;
  page_size: number;
  has_next: boolean;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    cache_hit?: boolean;
    data_freshness_at?: string;
    pipeline_version?: string;
    payload_mode?: string;
  };
};

export type RendimientoOptionsResponse = {
  options: {
    uns?: string[];
    tramos?: string[];
    gestion_months?: string[];
    vias_cobro?: string[];
    vias_pago?: string[];
    categorias?: string[];
    supervisors?: string[];
  };
  default_gestion_month?: string | null;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
  };
};

export type RendimientoSummaryResponse = {
  totalDebt: number;
  totalPaid: number;
  totalContracts: number;
  totalContractsPaid: number;
  tramoStats: Record<string, { d: number; p: number }>;
  unStats: Record<string, { d: number; p: number }>;
  viaCStats: Record<string, { d: number; p: number }>;
  gestorStats: Record<string, { d: number; p: number }>;
  matrixStats: Record<string, Record<string, number>>;
  trendStats: Record<string, { d: number; p: number; c: number; cp: number }>;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    portfolio_keys?: number;
  };
};

export type AnualesOptionsResponse = {
  options: {
    uns?: string[];
    years?: string[];
    contract_months?: string[];
  };
  default_cutoff?: string | null;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
  };
};

export type AnualesSummaryRow = {
  year: string;
  contracts: number;
  contractsVigentes: number;
  tkpContrato: number;
  tkpTransaccional: number;
  tkpPago: number;
  culminados: number;
  culminadosVigentes: number;
  tkpContratoCulminado: number;
  tkpPagoCulminado: number;
  tkpContratoCulminadoVigente: number;
  tkpPagoCulminadoVigente: number;
  ltvCulminadoVigente: number;
};

export type AnualesSummaryResponse = {
  rows: AnualesSummaryRow[];
  cutoff: string;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    signature?: string;
  };
};

export type PortfolioCorteFirstPaintResponse = {
  kpis: PortfolioCorteSummaryResponse["kpis"];
  mini_charts: {
    by_un_top5?: Record<string, number>;
    by_tramo?: Record<string, number>;
  };
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    cache_hit?: boolean;
    data_freshness_at?: string;
    pipeline_version?: string;
    payload_mode?: string;
  };
};

export type RendimientoFirstPaintResponse = {
  totals: Pick<RendimientoSummaryResponse, "totalDebt" | "totalPaid" | "totalContracts" | "totalContractsPaid">;
  mini_trend?: Record<string, { d: number; p: number; c: number; cp: number }>;
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    cache_hit?: boolean;
    data_freshness_at?: string;
    pipeline_version?: string;
    payload_mode?: string;
  };
};

export type AnualesFirstPaintResponse = {
  cutoff: string;
  rows_top: AnualesSummaryRow[];
  meta?: {
    source?: string;
    source_table?: string;
    generated_at?: string;
    cache_hit?: boolean;
    data_freshness_at?: string;
    pipeline_version?: string;
    payload_mode?: string;
  };
};

export type FrontendPerfRoute = "cartera" | "cohorte" | "rendimiento" | "anuales" | "brokers";

export type FrontendPerfIn = {
  route: FrontendPerfRoute;
  session_id: string;
  trace_id?: string;
  ttfb_ms?: number;
  fcp_ms?: number;
  ready_ms: number;
  api_calls: Array<{ endpoint: string; ms: number; cache_hit?: boolean; bytes?: number }>;
  timestamp_utc: string;
  app_version: string;
};

export type FrontendPerfSummaryOut = {
  sample_count: number;
  route?: FrontendPerfRoute;
  window?: { from_utc?: string; to_utc?: string };
  ttfb_ms?: { p50: number; p95: number; p99: number };
  fcp_ms?: { p50: number; p95: number; p99: number };
  ready_ms?: { p50: number; p95: number; p99: number };
  breakdown?: { cold: number; warm: number };
  counts_by_route?: Array<{ route: FrontendPerfRoute; count: number }>;
};

export type SyncRunResponse = {
  job_id: string;
  domain: SyncDomain;
  mode: "full_all" | "full_year" | "full_month" | "range_months";
  year_from?: number | null;
  close_month?: string | null;
  close_month_from?: string | null;
  close_month_to?: string | null;
  target_table?: string | null;
  started_at?: string;
  status: "accepted";
};

export type SyncStatusResponse = {
  job_id?: string | null;
  domain: SyncDomain;
  running: boolean;
  started_at?: string | null;
  finished_at?: string | null;
  stage?: string | null;
  progress_pct?: number;
  status_message?: string | null;
  mode?: string | null;
  year_from?: number | null;
  close_month?: string | null;
  close_month_from?: string | null;
  close_month_to?: string | null;
  rows_inserted?: number;
  rows_updated?: number;
  rows_skipped?: number;
  rows_read?: number;
  rows_upserted?: number;
  rows_unchanged?: number;
  throughput_rows_per_sec?: number;
  eta_seconds?: number | null;
  current_query_file?: string | null;
  job_step?: string | null;
  queue_position?: number | null;
  watermark?: {
    domain: string;
    query_file: string;
    partition_key: string;
    last_updated_at?: string | null;
    last_source_id?: string | null;
    last_success_job_id?: string | null;
    last_row_count?: number;
    updated_at?: string | null;
  } | null;
  chunk_key?: string | null;
  chunk_status?: string | null;
  skipped_unchanged_chunks?: number;
  affected_months?: string[];
  target_table?: string | null;
  agg_refresh_started?: boolean;
  agg_refresh_completed?: boolean;
  agg_rows_written?: number;
  agg_duration_sec?: number | null;
  duplicates_detected?: number;
  duration_sec?: number | null;
  log?: string[];
  error?: string | null;
};

export type SyncPerfSummaryResponse = {
  generated_at: string;
  totals: Record<string, number>;
  by_domain: Record<string, Record<string, number>>;
  top_slowest_jobs: Array<Record<string, string | number | null>>;
};

export type SyncWatermarkResponse = {
  domain: SyncDomain;
  query_file: string;
  partition_key: string;
  last_updated_at?: string | null;
  last_source_id?: string | null;
  last_success_job_id?: string | null;
  last_row_count?: number;
  updated_at?: string | null;
};

export type SyncWatermarkResetResponse = {
  domain: SyncDomain;
  query_file?: string | null;
  partition_key?: string | null;
  deleted: number;
};

export type SyncChunkLogResponse = {
  chunk_key: string;
  stage: string;
  status: string;
  rows: number;
  duration_sec: number;
  throughput_rows_per_sec: number;
  details?: Record<string, unknown>;
  created_at?: string | null;
};

export type SyncChunkLogsResponse = {
  job_id: string;
  domain?: SyncDomain | null;
  chunks: SyncChunkLogResponse[];
};

export type SyncPreviewResponse = {
  domain: SyncDomain;
  mode: "full_all" | "full_year" | "full_month" | "range_months";
  year_from?: number | null;
  close_month?: string | null;
  close_month_from?: string | null;
  close_month_to?: string | null;
  estimated_rows: number;
  max_rows_allowed?: number | null;
  would_exceed_limit: boolean;
  sampled: boolean;
  scan_mode?: "sampled" | "full";
  sample_rows?: number;
  estimate_confidence?: "low" | "medium" | "high";
  estimated_duration_sec?: number | null;
  risk_level?: "low" | "medium" | "high";
};

export async function runSync(payload: {
  domain: SyncDomain;
  year_from?: number;
  close_month?: string;
  close_month_from?: string;
  close_month_to?: string;
}): Promise<SyncRunResponse> {
  const response = await api.post<SyncRunResponse>("/sync/run", payload, { timeout: 60000 });
  return response.data;
}

export async function previewSync(payload: {
  domain: SyncDomain;
  year_from?: number;
  close_month?: string;
  close_month_from?: string;
  close_month_to?: string;
}, options?: {
  sampled?: boolean;
  sample_rows?: number;
  timeout_seconds?: number;
}): Promise<SyncPreviewResponse> {
  const response = await api.post<SyncPreviewResponse>("/sync/preview", payload, {
    timeout: 300000,
    params: options,
  });
  return response.data;
}

export async function getSyncStatus(params: {
  domain: SyncDomain;
  job_id?: string;
}): Promise<SyncStatusResponse> {
  const response = await api.get<SyncStatusResponse>("/sync/status", { params });
  return response.data;
}

export async function getSyncPerfSummary(params?: { limit?: number }): Promise<SyncPerfSummaryResponse> {
  const response = await api.get<SyncPerfSummaryResponse>("/sync/perf/summary", { params });
  return response.data;
}

export async function getSyncWatermarks(params?: {
  domain?: SyncDomain;
}): Promise<SyncWatermarkResponse[]> {
  const response = await api.get<SyncWatermarkResponse[]>("/sync/watermarks", { params });
  return response.data;
}

export async function resetSyncWatermarks(payload: {
  domain: SyncDomain;
  query_file?: string;
  partition_key?: string;
}): Promise<SyncWatermarkResetResponse> {
  const response = await api.post<SyncWatermarkResetResponse>("/sync/watermarks/reset", payload, { timeout: 60000 });
  return response.data;
}

export async function getSyncChunks(jobId: string): Promise<SyncChunkLogsResponse> {
  const response = await api.get<SyncChunkLogsResponse>(`/sync/chunks/${encodeURIComponent(jobId)}`);
  return response.data;
}

export type SyncScheduleOut = {
  id: number;
  name: string;
  interval_value: number;
  interval_unit: string;
  domains: SyncDomain[];
  mode: string | null;
  year_from: number | null;
  close_month: string | null;
  close_month_from: string | null;
  close_month_to: string | null;
  enabled: boolean;
  paused: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_summary: Record<string, unknown> | unknown[] | null;
  next_run_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function listSyncSchedules(): Promise<SyncScheduleOut[]> {
  const response = await api.get<SyncScheduleOut[]>("/sync/schedules");
  return response.data;
}

export async function getSyncSchedule(scheduleId: number): Promise<SyncScheduleOut | null> {
  try {
    const response = await api.get<SyncScheduleOut>(`/sync/schedules/${scheduleId}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function createSyncSchedule(payload: {
  name: string;
  interval_value: number;
  interval_unit: string;
  domains: SyncDomain[];
}): Promise<SyncScheduleOut> {
  const response = await api.post<SyncScheduleOut>("/sync/schedules", payload);
  return response.data;
}

export async function updateSyncSchedule(
  scheduleId: number,
  payload: Partial<{
    name: string;
    interval_value: number;
    interval_unit: string;
    domains: SyncDomain[];
    mode: string | null;
    year_from: number | null;
    close_month: string | null;
    close_month_from: string | null;
    close_month_to: string | null;
    enabled: boolean;
    paused: boolean;
  }>
): Promise<SyncScheduleOut> {
  const response = await api.patch<SyncScheduleOut>(`/sync/schedules/${scheduleId}`, payload);
  return response.data;
}

export async function deleteSyncSchedule(scheduleId: number): Promise<void> {
  await api.delete(`/sync/schedules/${scheduleId}`);
}

export async function runSyncScheduleNow(scheduleId: number): Promise<{ schedule_id: number; job_ids: string[] }> {
  const response = await api.post<{ schedule_id: number; job_ids: string[] }>(
    `/sync/schedules/${scheduleId}/run-now`
  );
  return response.data;
}

export async function pauseSyncSchedule(scheduleId: number): Promise<void> {
  await api.post(`/sync/schedules/${scheduleId}/pause`);
}

export async function resumeSyncSchedule(scheduleId: number): Promise<void> {
  await api.post(`/sync/schedules/${scheduleId}/resume`);
}

export async function emergencyStopSchedules(): Promise<void> {
  await api.post("/sync/schedules/emergency-stop");
}

export async function emergencyResumeSchedules(): Promise<void> {
  await api.post("/sync/schedules/emergency-resume");
}

export async function getPortfolioOptions(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<PortfolioOptionsResponse> {
  const response = await api.post<PortfolioOptionsResponse>("/analytics/portfolio/options", payload);
  return response.data;
}

export async function getPortfolioCorteOptions(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<PortfolioCorteOptionsResponse> {
  const response = await api.post<PortfolioCorteOptionsResponse>("/analytics/portfolio/corte/options", payload);
  return response.data;
}

export async function getPortfolioCorteSummary(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
  include_rows?: boolean;
}): Promise<PortfolioCorteSummaryResponse> {
  const response = await api.post<PortfolioCorteSummaryResponse>("/analytics/portfolio/corte/summary", payload);
  return response.data;
}

export async function getCobranzasCohorteOptions(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
}): Promise<CobranzasCohorteOptionsResponse> {
  const response = await api.post<CobranzasCohorteOptionsResponse>("/analytics/cobranzas-cohorte/options", payload);
  return response.data;
}

export async function getCobranzasCohorteSummary(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
}): Promise<CobranzasCohorteSummaryResponse> {
  const response = await api.post<CobranzasCohorteSummaryResponse>("/analytics/cobranzas-cohorte/summary", payload);
  return response.data;
}

export async function getCobranzasCohorteFirstPaint(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
  top_n_sale_months?: number;
}): Promise<CobranzasCohorteFirstPaintResponse> {
  const path = USE_COHORTE_V2_FIRST_PAINT
    ? "/analytics/cobranzas-cohorte-v2/first-paint"
    : "/analytics/cobranzas-cohorte/summary";
  const response = await api.post<CobranzasCohorteFirstPaintResponse>(path, payload);
  return response.data;
}

export async function getCobranzasCohorteDetail(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
  page?: number;
  page_size?: number;
  sort_by?: "sale_month" | "cobrado" | "deberia" | "pagaron";
  sort_dir?: "asc" | "desc";
}): Promise<CobranzasCohorteDetailResponse> {
  if (!USE_COHORTE_V2_FIRST_PAINT) {
    const fallback = await getCobranzasCohorteSummary(payload);
    return {
      cutoff_month: fallback.cutoff_month,
      effective_cartera_month: fallback.effective_cartera_month,
      items: fallback.by_sale_month || [],
      total_items: (fallback.by_sale_month || []).length,
      page: 1,
      page_size: (fallback.by_sale_month || []).length || 24,
      has_next: false,
      meta: fallback.meta,
    };
  }
  const response = await api.post<CobranzasCohorteDetailResponse>("/analytics/cobranzas-cohorte-v2/detail", payload);
  return response.data;
}

export async function getRendimientoOptions(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<RendimientoOptionsResponse> {
  const path = USE_ANALYTICS_V2 ? "/analytics/rendimiento-v2/options" : "/analytics/rendimiento/options";
  const response = await api.post<RendimientoOptionsResponse>(path, payload);
  return response.data;
}

export async function getRendimientoSummary(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<RendimientoSummaryResponse> {
  const path = USE_ANALYTICS_V2 ? "/analytics/rendimiento-v2/summary" : "/analytics/rendimiento/summary";
  const response = await api.post<RendimientoSummaryResponse>(path, payload);
  return response.data;
}

export async function getRendimientoFirstPaint(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<RendimientoFirstPaintResponse> {
  if (!USE_FIRST_PAINT_ALL_SECTIONS || !USE_ANALYTICS_V2) {
    const full = await getRendimientoSummary(payload);
    return {
      totals: {
        totalDebt: full.totalDebt,
        totalPaid: full.totalPaid,
        totalContracts: full.totalContracts,
        totalContractsPaid: full.totalContractsPaid,
      },
      mini_trend: full.trendStats,
      meta: full.meta,
    };
  }
  const response = await api.post<RendimientoFirstPaintResponse>("/analytics/rendimiento-v2/first-paint", payload);
  return response.data;
}

export async function getAnualesOptions(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<AnualesOptionsResponse> {
  const path = USE_ANALYTICS_V2 ? "/analytics/anuales-v2/options" : "/analytics/anuales/options";
  const response = await api.post<AnualesOptionsResponse>(path, payload);
  return response.data;
}

export async function getAnualesSummary(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<AnualesSummaryResponse> {
  const path = USE_ANALYTICS_V2 ? "/analytics/anuales-v2/summary" : "/analytics/anuales/summary";
  const response = await api.post<AnualesSummaryResponse>(path, payload);
  return response.data;
}

export async function getAnualesFirstPaint(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
}): Promise<AnualesFirstPaintResponse> {
  if (!USE_FIRST_PAINT_ALL_SECTIONS || !USE_ANALYTICS_V2) {
    const full = await getAnualesSummary(payload);
    return {
      cutoff: full.cutoff,
      rows_top: full.rows || [],
      meta: full.meta,
    };
  }
  const response = await api.post<AnualesFirstPaintResponse>("/analytics/anuales-v2/first-paint", payload);
  return response.data;
}

export async function getPortfolioCorteFirstPaint(payload: {
  supervisor?: string[];
  un?: string[];
  via_cobro?: string[];
  anio?: string[];
  contract_month?: string[];
  gestion_month?: string[];
  close_month?: string[];
  via_pago?: string[];
  categoria?: string[];
  tramo?: string[];
  include_rows?: boolean;
}): Promise<PortfolioCorteFirstPaintResponse> {
  if (!USE_FIRST_PAINT_ALL_SECTIONS) {
    const full = await getPortfolioCorteSummary(payload);
    return { kpis: full.kpis || {}, mini_charts: { by_tramo: full.charts?.by_tramo || {} }, meta: full.meta };
  }
  const response = await api.post<PortfolioCorteFirstPaintResponse>("/analytics/portfolio-corte-v2/first-paint", payload);
  return response.data;
}

export async function sendFrontendPerf(payload: FrontendPerfIn): Promise<void> {
  if (!USE_FRONTEND_PERF_TELEMETRY) return;
  await api.post("/telemetry/frontend-perf", payload);
}

export async function getFrontendPerfSummary(params?: {
  route?: FrontendPerfRoute;
  from_utc?: string;
  to_utc?: string;
  limit?: number;
}): Promise<FrontendPerfSummaryOut> {
  const response = await api.get<FrontendPerfSummaryOut>("/telemetry/frontend-perf/summary", { params });
  return response.data;
}
