import type { paths } from "./api-types";

export type ApiPaths = paths;

export type LoginRequest =
  ApiPaths["/api/v1/auth/login"]["post"]["requestBody"]["content"]["application/json"];

export type LoginResponse =
  ApiPaths["/api/v1/auth/login"]["post"]["responses"]["200"]["content"]["application/json"];

export type SupervisorsScopeResponse =
  ApiPaths["/api/v1/brokers/supervisors-scope"]["get"]["responses"]["200"]["content"]["application/json"];

export type RulesResponse =
  ApiPaths["/api/v1/brokers/commissions"]["get"]["responses"]["200"]["content"]["application/json"];

export type RulesRequest =
  ApiPaths["/api/v1/brokers/commissions"]["post"]["requestBody"]["content"]["application/json"];

/** Filtros de Brokers (resumen, preferencias). Origen único de verdad para tipos. */
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

export const EMPTY_BROKERS_FILTERS: BrokersFilters = {
  supervisors: [],
  uns: [],
  vias: [],
  years: [],
  months: [],
};
