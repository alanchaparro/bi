/**
 * Auth persistence helpers.
 * refresh_token is stored in localStorage so it survives page refresh/reloads.
 * For an internal BI app this trade-off is acceptable (persistent session convenience > XSS risk).
 */

const KEY_REFRESH_TOKEN = "cobranzas_refresh_token";
const KEY_ACCESS_TOKEN = "cobranzas_access_token";

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(KEY_REFRESH_TOKEN);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(KEY_REFRESH_TOKEN, token);
    } else {
      localStorage.removeItem(KEY_REFRESH_TOKEN);
    }
  } catch {
    // ignore
  }
}

export function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(KEY_ACCESS_TOKEN);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(KEY_ACCESS_TOKEN, token);
    } else {
      localStorage.removeItem(KEY_ACCESS_TOKEN);
    }
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  setStoredRefreshToken(null);
  setStoredAccessToken(null);
}
