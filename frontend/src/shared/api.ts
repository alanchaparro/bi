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
