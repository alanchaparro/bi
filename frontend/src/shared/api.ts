import axios from "axios";
import type {
  LoginRequest,
  LoginResponse,
  RulesRequest,
  RulesResponse,
  SupervisorsScopeResponse,
} from "./contracts";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
});

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

export type BrokersFilters = {
  supervisors: string[];
  uns: string[];
  vias: string[];
  years: string[];
  months: string[];
};

export type BrokersPreferences = {
  filters: BrokersFilters;
};

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
