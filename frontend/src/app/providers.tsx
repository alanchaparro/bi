"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { RouterProvider } from "@heroui/react";
import type { LoginResponse } from "@/shared/contracts";
import {
  restoreSession,
  setOnUnauthorized,
  setAuthToken,
  logout as apiLogout,
} from "@/shared/api";

type AuthContextValue = {
  auth: LoginResponse | null;
  loading: boolean;
  login: (authRes: LoginResponse, token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function HeroUIRouterAdapter({ children }: { children: ReactNode }) {
  const router = useRouter();

  const navigate = useCallback(
    (path: string, _routerOptions?: unknown) => {
      router.push(path);
    },
    [router]
  );

  const useHref = useCallback((href: string) => href, []);

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      {children}
    </RouterProvider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((authRes: LoginResponse, token: string) => {
    setAuthToken(token);
    setAuth(authRes);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setAuth(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => setAuth(null));
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((restored) => {
        if (!cancelled && restored) {
          setAuthToken(restored.access_token);
          setAuth(restored);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, loading, login, logout }),
    [auth, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      <HeroUIRouterAdapter>{children}</HeroUIRouterAdapter>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
