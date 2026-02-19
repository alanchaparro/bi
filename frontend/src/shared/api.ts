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
  target_table?: string | null;
  duplicates_detected?: number;
  duration_sec?: number | null;
  log?: string[];
  error?: string | null;
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

export async function getSyncStatus(params: {
  domain: SyncDomain;
  job_id?: string;
}): Promise<SyncStatusResponse> {
  const response = await api.get<SyncStatusResponse>("/sync/status", { params });
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
