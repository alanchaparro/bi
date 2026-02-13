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
