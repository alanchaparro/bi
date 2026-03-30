import { toast } from "@heroui/react";

export type AppToastType = "success" | "info" | "error";

/** Paridad con el auto-cierre previo del ToastStack custom (HeroUI default ~4000 ms). */
export const APP_TOAST_TIMEOUT_MS = 3500;

/**
 * API estable para notificaciones globales: delega en HeroUI `toast.*` (imperativo).
 * Usar solo en cliente; requiere `<Toast.Provider />` montado (p. ej. en `providers.tsx`).
 */
export function pushAppToast(
  type: AppToastType,
  message: string,
  timeoutMs: number = APP_TOAST_TIMEOUT_MS
): string {
  const opts = { timeout: timeoutMs };
  if (type === "success") return toast.success(message, opts);
  if (type === "info") return toast.info(message, opts);
  return toast.danger(message, opts);
}
