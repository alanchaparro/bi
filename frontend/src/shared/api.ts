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
const USE_ANALYTICS_V2 = true;
const USE_COHORTE_V2_FIRST_PAINT = true;
const USE_FIRST_PAINT_ALL_SECTIONS = true;
const USE_FRONTEND_PERF_TELEMETRY = String(import.meta.env.VITE_USE_FRONTEND_PERF_TELEMETRY || "1").trim() !== "0";
export const USE_STRICT_UI_TOKENS = String(import.meta.env.VITE_USE_STRICT_UI_TOKENS || "1").trim() !== "0";
export const USE_UI_IOS_REFINEMENT = String(import.meta.env.VITE_USE_UI_IOS_REFINEMENT || "0").trim() === "1";
export const UI_IOS_REFINEMENT_MODULES = String(import.meta.env.VITE_USE_UI_IOS_REFINEMENT_MODULES || "all")
  .trim()
  .toLowerCase();

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
let perfReadySent = false;

function trackPerfApiCall(call: PerfApiCall): void {
  if (!USE_FRONTEND_PERF_TELEMETRY) return;
  perfApiCalls.push(call);
  while (perfApiCalls.length > 120) perfApiCalls.shift();
}

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
    trackPerfApiCall({
      endpoint,
      ms: Math.round(ms * 100) / 100,
      cache_hit: cacheHit,
      bytes,
      ts: Date.now(),
    });
    return response;
  },
  (error) => Promise.reject(error)
);

export function markPerfRoute(route: FrontendPerfRoute): void {
  perfRoute = route;
  perfRouteStart = performance.now();
  perfReadySent = false;
}

export async function markPerfReady(route: FrontendPerfRoute): Promise<void> {
  if (!USE_FRONTEND_PERF_TELEMETRY) return;
  if (perfReadySent && perfRoute === route) return;
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
    perfReadySent = true;
  } catch {
    // no-op: telemetry must not break UX
  }
}

type AnalyticsCachePolicy = "options" | "first_paint" | "summary" | "detail";
const ANALYTICS_CACHE_TTL_MS: Record<AnalyticsCachePolicy, number> = {
  options: 120_000,
  first_paint: 300_000,
  summary: 300_000,
  detail: 300_000,
};
type CachedEntry<T> = {
  expiresAt: number;
  value: T;
};
const analyticsCacheMemory = new Map<string, CachedEntry<unknown>>();
const ANALYTICS_CACHE_PREFIX = "analytics_api_cache:";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const next = value.map((item) => canonicalize(item));
    const scalar = next.every((item) => ["string", "number", "boolean"].includes(typeof item));
    return scalar ? [...next].sort((a, b) => String(a).localeCompare(String(b))) : next;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    for (const key of keys) out[key] = canonicalize(value[key]);
    return out;
  }
  return value ?? null;
}

function buildAnalyticsCacheKey(path: string, payload: unknown): string {
  const normalized = canonicalize(payload);
  return `${path}|${JSON.stringify(normalized)}`;
}

function getFromSessionCache<T>(cacheKey: string): CachedEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${ANALYTICS_CACHE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(`${ANALYTICS_CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setSessionCache<T>(cacheKey: string, entry: CachedEntry<T>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${ANALYTICS_CACHE_PREFIX}${cacheKey}`, JSON.stringify(entry));
  } catch {
    // ignore quota/storage issues
  }
}

function markCacheHitMeta<T>(value: T): T {
  if (!isPlainObject(value)) return value;
  const existingMeta = isPlainObject(value.meta) ? value.meta : {};
  return { ...value, meta: { ...existingMeta, cache_hit: true } } as T;
}

async function cachedAnalyticsPost<T>(path: string, payload: unknown, policy: AnalyticsCachePolicy): Promise<T> {
  const key = buildAnalyticsCacheKey(path, payload);
  const now = Date.now();
  const hitMem = analyticsCacheMemory.get(key);
  if (hitMem && hitMem.expiresAt > now) {
    trackPerfApiCall({
      endpoint: `${path}#cache`,
      ms: 0.1,
      cache_hit: true,
      bytes: undefined,
      ts: now,
    });
    return markCacheHitMeta(hitMem.value as T);
  }
  const hitSession = getFromSessionCache<T>(key);
  if (hitSession) {
    analyticsCacheMemory.set(key, hitSession as CachedEntry<unknown>);
    trackPerfApiCall({
      endpoint: `${path}#cache`,
      ms: 0.2,
      cache_hit: true,
      bytes: undefined,
      ts: now,
    });
    return markCacheHitMeta(hitSession.value);
  }
  const response = await api.post<T>(path, payload);
  const ttl = ANALYTICS_CACHE_TTL_MS[policy];
  const entry: CachedEntry<T> = { value: response.data, expiresAt: now + ttl };
  analyticsCacheMemory.set(key, entry as CachedEntry<unknown>);
  setSessionCache(key, entry);
  return response.data;
}

export function clearAnalyticsApiCache(pathPrefix?: string): void {
  for (const key of Array.from(analyticsCacheMemory.keys())) {
    if (!pathPrefix || key.startsWith(pathPrefix)) analyticsCacheMemory.delete(key);
  }
  if (typeof window === "undefined") return;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key || !key.startsWith(ANALYTICS_CACHE_PREFIX)) continue;
      const rawKey = key.slice(ANALYTICS_CACHE_PREFIX.length);
      if (!pathPrefix || rawKey.startsWith(pathPrefix)) keysToDelete.push(key);
    }
    for (const key of keysToDelete) window.sessionStorage.removeItem(key);
  } catch {
    // ignore storage iteration issues
  }
}

function getApiBaseUrl(): string {
  const base = String(api.defaults.baseURL || "");
  if (base.startsWith("http://") || base.startsWith("https://")) return base;
  if (typeof window !== "undefined") return `${window.location.origin}${base.startsWith("/") ? "" : "/"}${base}`;
  return base;
}

async function sendFrontendPerfKeepAlive(payload: FrontendPerfIn): Promise<boolean> {
  const endpoint = `${getApiBaseUrl()}/telemetry/frontend-perf`;
  const token = String(api.defaults.headers.common.Authorization || "");
  if (typeof fetch !== "function") return false;
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "include",
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function sendFrontendPerfBeacon(payload: FrontendPerfIn): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return false;
  const endpoint = `${getApiBaseUrl()}/telemetry/frontend-perf`;
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    return navigator.sendBeacon(endpoint, blob);
  } catch {
    return false;
  }
}

if (typeof window !== "undefined" && USE_FRONTEND_PERF_TELEMETRY) {
  window.addEventListener("pagehide", () => {
    if (!perfRoute || perfReadySent) return;
    void markPerfReady(perfRoute);
  });
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
export type AnalyticsMeta = {
  generated_at?: string;
  source?: string;
  source_table?: string;
  cache_hit?: boolean;
  payload_mode?: "first_paint" | "summary" | "detail";
  data_freshness_at?: string;
  pipeline_version?: string;
  signature?: string;
  portfolio_keys?: number;
};

export type PortfolioOptionsResponse = {
  options: {
    uns?: string[];
    vias?: string[];
    tramos?: string[];
    categories?: string[];
    months?: string[];
    close_months?: string[];
  };
  meta?: AnalyticsMeta;
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
  meta?: AnalyticsMeta;
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
  meta?: AnalyticsMeta;
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
  meta?: AnalyticsMeta;
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
  by_tramo?: Record<string, {
    activos: number;
    pagaron: number;
    deberia: number;
    cobrado: number;
    pct_pago_contratos: number;
    pct_cobertura_monto: number;
  }>;
  meta?: AnalyticsMeta;
};

export type CobranzasCohorteFirstPaintResponse = {
  cutoff_month: string;
  effective_cartera_month?: string;
  totals: CobranzasCohorteSummaryResponse["totals"];
  by_year: CobranzasCohorteSummaryResponse["by_year"];
  by_tramo?: CobranzasCohorteSummaryResponse["by_tramo"];
  top_sale_months: CobranzasCohorteSummaryResponse["by_sale_month"];
  meta?: AnalyticsMeta;
};

export type CobranzasCohorteDetailResponse = {
  cutoff_month: string;
  effective_cartera_month?: string;
  items: CobranzasCohorteSummaryResponse["by_sale_month"];
  total_items: number;
  page: number;
  page_size: number;
  has_next: boolean;
  meta?: AnalyticsMeta;
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
  meta?: AnalyticsMeta;
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
  meta?: AnalyticsMeta;
};

export type AnualesOptionsResponse = {
  options: {
    uns?: string[];
    years?: string[];
    contract_months?: string[];
  };
  default_cutoff?: string | null;
  meta?: AnalyticsMeta;
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
  meta?: AnalyticsMeta;
};

export type PortfolioCorteFirstPaintResponse = {
  kpis: PortfolioCorteSummaryResponse["kpis"];
  mini_charts: {
    by_un_top5?: Record<string, number>;
    by_tramo?: Record<string, number>;
  };
  meta?: AnalyticsMeta;
};

export type RendimientoFirstPaintResponse = {
  totals: Pick<RendimientoSummaryResponse, "totalDebt" | "totalPaid" | "totalContracts" | "totalContractsPaid">;
  mini_trend?: Record<string, { d: number; p: number; c: number; cp: number }>;
  meta?: AnalyticsMeta;
};

export type AnualesFirstPaintResponse = {
  cutoff: string;
  rows_top: AnualesSummaryRow[];
  meta?: AnalyticsMeta;
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

export type AnalyticsOptionsConsistencyCheck = {
  ok: boolean;
  expected_months: number;
  actual_months: number;
  missing_months: string[];
  stale_months: string[];
};

export type AnalyticsOptionsConsistencyResponse = {
  ok: boolean;
  checks: Record<string, AnalyticsOptionsConsistencyCheck>;
  last_checked_at: string;
};

export type AnalyticsFreshnessRow = {
  source_table: string;
  max_updated_at?: string | null;
  tracked_updated_at?: string | null;
  last_job_id?: string | null;
  from_tracker: boolean;
};

export type AnalyticsFreshnessResponse = {
  generated_at: string;
  rows: AnalyticsFreshnessRow[];
};

export type AnalyticsOptionsRebuildResponse = {
  scope: "full" | "months";
  months: string[];
  rebuilt_rows: Record<string, number>;
  auto_rebuilt: boolean;
  auto_rebuilt_rows: Record<string, number>;
  consistency: AnalyticsOptionsConsistencyResponse;
  cache_invalidated: Record<string, number>;
  rebuilt_at: string;
  actor: string;
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
  clearAnalyticsApiCache("/analytics/");
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
  clearAnalyticsApiCache("/analytics/");
  return response.data;
}

export async function getSyncChunks(jobId: string): Promise<SyncChunkLogsResponse> {
  const response = await api.get<SyncChunkLogsResponse>(`/sync/chunks/${encodeURIComponent(jobId)}`);
  return response.data;
}

export async function getAnalyticsOptionsConsistency(): Promise<AnalyticsOptionsConsistencyResponse> {
  const response = await api.get<AnalyticsOptionsConsistencyResponse>("/admin/analytics/options/consistency");
  return response.data;
}

export async function rebuildAnalyticsOptions(payload: {
  scope: "full" | "months";
  months?: string[];
}): Promise<AnalyticsOptionsRebuildResponse> {
  const response = await api.post<AnalyticsOptionsRebuildResponse>("/admin/analytics/options/rebuild", payload, {
    timeout: 120000,
  });
  clearAnalyticsApiCache("/analytics/");
  return response.data;
}

export async function getAnalyticsFreshness(): Promise<AnalyticsFreshnessResponse> {
  const response = await api.get<AnalyticsFreshnessResponse>("/admin/analytics/freshness");
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
  clearAnalyticsApiCache("/analytics/");
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
  clearAnalyticsApiCache("/analytics/");
  return response.data;
}

export async function deleteSyncSchedule(scheduleId: number): Promise<void> {
  await api.delete(`/sync/schedules/${scheduleId}`);
  clearAnalyticsApiCache("/analytics/");
}

export async function runSyncScheduleNow(scheduleId: number): Promise<{ schedule_id: number; job_ids: string[] }> {
  const response = await api.post<{ schedule_id: number; job_ids: string[] }>(
    `/sync/schedules/${scheduleId}/run-now`
  );
  clearAnalyticsApiCache("/analytics/");
  return response.data;
}

export async function pauseSyncSchedule(scheduleId: number): Promise<void> {
  await api.post(`/sync/schedules/${scheduleId}/pause`);
  clearAnalyticsApiCache("/analytics/");
}

export async function resumeSyncSchedule(scheduleId: number): Promise<void> {
  await api.post(`/sync/schedules/${scheduleId}/resume`);
  clearAnalyticsApiCache("/analytics/");
}

export async function emergencyStopSchedules(): Promise<void> {
  await api.post("/sync/schedules/emergency-stop");
  clearAnalyticsApiCache("/analytics/");
}

export async function emergencyResumeSchedules(): Promise<void> {
  await api.post("/sync/schedules/emergency-resume");
  clearAnalyticsApiCache("/analytics/");
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
  return cachedAnalyticsPost<PortfolioOptionsResponse>("/analytics/portfolio/options", payload, "options");
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
  return cachedAnalyticsPost<PortfolioCorteOptionsResponse>("/analytics/portfolio-corte-v2/options", payload, "options");
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
  return cachedAnalyticsPost<PortfolioCorteSummaryResponse>("/analytics/portfolio-corte-v2/summary", payload, "summary");
}

export async function getCobranzasCohorteOptions(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
}): Promise<CobranzasCohorteOptionsResponse> {
  return cachedAnalyticsPost<CobranzasCohorteOptionsResponse>("/analytics/cobranzas-cohorte-v2/options", payload, "options");
}

export async function getCobranzasCohorteSummary(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
}): Promise<CobranzasCohorteSummaryResponse> {
  const firstPaint = await getCobranzasCohorteFirstPaint(payload);
  const detail = await getCobranzasCohorteDetail({ ...payload, page: 1, page_size: 120, sort_by: "sale_month", sort_dir: "asc" });
  return {
    cutoff_month: firstPaint.cutoff_month,
    effective_cartera_month: firstPaint.effective_cartera_month,
    totals: firstPaint.totals,
    by_year: firstPaint.by_year || {},
    by_tramo: firstPaint.by_tramo || {},
    by_sale_month: detail.items || [],
    meta: detail.meta || firstPaint.meta,
  };
}

export async function getCobranzasCohorteFirstPaint(payload: {
  cutoff_month?: string;
  un?: string[];
  via_cobro?: string[];
  categoria?: string[];
  supervisor?: string[];
  top_n_sale_months?: number;
}): Promise<CobranzasCohorteFirstPaintResponse> {
  return cachedAnalyticsPost<CobranzasCohorteFirstPaintResponse>(
    "/analytics/cobranzas-cohorte-v2/first-paint",
    payload,
    "first_paint"
  );
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
  return cachedAnalyticsPost<CobranzasCohorteDetailResponse>("/analytics/cobranzas-cohorte-v2/detail", payload, "detail");
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
  return cachedAnalyticsPost<RendimientoOptionsResponse>("/analytics/rendimiento-v2/options", payload, "options");
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
  return cachedAnalyticsPost<RendimientoSummaryResponse>("/analytics/rendimiento-v2/summary", payload, "summary");
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
  return cachedAnalyticsPost<RendimientoFirstPaintResponse>("/analytics/rendimiento-v2/first-paint", payload, "first_paint");
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
  return cachedAnalyticsPost<AnualesOptionsResponse>("/analytics/anuales-v2/options", payload, "options");
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
  return cachedAnalyticsPost<AnualesSummaryResponse>("/analytics/anuales-v2/summary", payload, "summary");
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
  return cachedAnalyticsPost<AnualesFirstPaintResponse>("/analytics/anuales-v2/first-paint", payload, "first_paint");
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
  return cachedAnalyticsPost<PortfolioCorteFirstPaintResponse>("/analytics/portfolio-corte-v2/first-paint", payload, "first_paint");
}

export async function sendFrontendPerf(payload: FrontendPerfIn): Promise<void> {
  if (!USE_FRONTEND_PERF_TELEMETRY) return;
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  if (hidden && sendFrontendPerfBeacon(payload)) return;
  if (await sendFrontendPerfKeepAlive(payload)) return;
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
