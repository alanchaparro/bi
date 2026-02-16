/**
 * Session storage keys and helpers for auth.
 * refresh_token is stored in sessionStorage (cleared when tab closes; avoid localStorage for XSS).
 */

const KEY_REFRESH_TOKEN = "cobranzas_refresh_token";

export function getStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(KEY_REFRESH_TOKEN);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(KEY_REFRESH_TOKEN, token);
    } else {
      sessionStorage.removeItem(KEY_REFRESH_TOKEN);
    }
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  setStoredRefreshToken(null);
}
