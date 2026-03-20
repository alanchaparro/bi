/**
 * Env vars compatible with Next.js (NEXT_PUBLIC_*) and Vite (import.meta.env.VITE_*).
 * Use this in shared code so it works in both runtimes.
 */
function getEnv(key: string): string {
  if (typeof process !== "undefined" && process.env?.[key] !== undefined) {
    return String(process.env[key]);
  }
  if (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, unknown> }).env?.[key]) {
    return String((import.meta as unknown as { env: Record<string, string> }).env[key]);
  }
  return "";
}

export const API_BASE_URL = getEnv("NEXT_PUBLIC_API_BASE_URL") || getEnv("VITE_API_BASE_URL") || "http://localhost:8000/api/v1";
export const USE_FRONTEND_PERF_TELEMETRY = (getEnv("NEXT_PUBLIC_USE_FRONTEND_PERF_TELEMETRY") || getEnv("VITE_USE_FRONTEND_PERF_TELEMETRY") || "1").trim() !== "0";
export const USE_STRICT_UI_TOKENS = (getEnv("NEXT_PUBLIC_USE_STRICT_UI_TOKENS") || getEnv("VITE_USE_STRICT_UI_TOKENS") || "1").trim() !== "0";
export const USE_UI_IOS_REFINEMENT = (getEnv("NEXT_PUBLIC_USE_UI_IOS_REFINEMENT") || getEnv("VITE_USE_UI_IOS_REFINEMENT") || "0").trim() === "1";
export const UI_IOS_REFINEMENT_MODULES = (getEnv("NEXT_PUBLIC_USE_UI_IOS_REFINEMENT_MODULES") || getEnv("VITE_USE_UI_IOS_REFINEMENT_MODULES") || "all").trim().toLowerCase();
export const APP_VERSION = getEnv("NEXT_PUBLIC_APP_VERSION") || getEnv("VITE_APP_VERSION") || "dev";
export const LEGACY_DASHBOARD_URL = getEnv("NEXT_PUBLIC_LEGACY_DASHBOARD_URL") || getEnv("VITE_LEGACY_DASHBOARD_URL") || "";
