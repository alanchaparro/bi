export type ApiErrorDetail = {
  message: string;
  error_code?: string;
  trace_id?: string;
};

/**
 * Extrae mensaje de error estándar de la API (axios error response).
 */
export function getApiErrorMessage(e: unknown): string {
  return parseApiError(e).message;
}

/**
 * Extrae mensaje, error_code y trace_id del error de la API (para logs o UI avanzada).
 */
export function parseApiError(e: unknown): ApiErrorDetail {
  if (e && typeof e === 'object' && 'response' in e) {
    const res = (e as { response?: { data?: { message?: string; error_code?: string; trace_id?: string }; status?: number } })
      .response;
    const msg = res?.data?.message;
    if (typeof msg === 'string')
      return {
        message: msg,
        error_code: res?.data?.error_code,
        trace_id: res?.data?.trace_id,
      };
    if (res?.data?.error_code === 'UNAUTHORIZED')
      return { message: 'Credenciales inválidas.', error_code: 'UNAUTHORIZED', trace_id: res?.data?.trace_id };
    if (res?.status === 429)
      return { message: 'Demasiados intentos. Espera un momento.', trace_id: res?.data?.trace_id };
    if (res?.status === 403)
      return { message: 'Cuenta bloqueada temporalmente. Intenta más tarde.', trace_id: res?.data?.trace_id };
  }
  return { message: 'Error de conexión. Revisa que la API esté disponible.' };
}
