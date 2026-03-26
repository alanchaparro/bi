"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, Label } from "@heroui/react";
import { useAuth } from "../providers";
import { login as apiLogin } from "@/shared/api";
import { setStoredRefreshToken } from "@/shared/sessionStorage";
import { getApiErrorMessage } from "@/shared/apiErrors";
import type { LoginRequest } from "@/shared/contracts";
import { ErrorState } from "@/components/feedback/ErrorState";

export default function LoginPage() {
  const { auth, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && auth) {
    router.replace("/analisis-cartera");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;
    if (!u || !p) return;
    setError(null);
    setSubmitting(true);
    try {
      const authRes = await apiLogin({ username: u, password: p } as LoginRequest);
      if (authRes.refresh_token) setStoredRefreshToken(authRes.refresh_token);
      login(authRes, authRes.access_token);
      router.replace("/analisis-cartera");
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loading || submitting;
  const canSubmit = Boolean(username.trim() && password && !isLoading);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)] p-4">
      <Card className="w-full max-w-md border border-[var(--color-border)] bg-[var(--card-bg)]" variant="secondary">
        <Card.Header className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
          <Card.Title className="text-xl font-semibold text-[var(--text-primary)]">
            Cartera Cobranzas
          </Card.Title>
          <Card.Description className="text-sm text-[var(--text-secondary)]">
            Introduce tu usuario y contraseña para acceder.
          </Card.Description>
        </Card.Header>
        <Card.Content className="gap-4 px-6 pb-6 pt-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-username" className="text-[var(--text-primary)]">
                Usuario
              </Label>
              <Input
                id="login-username"
                placeholder="Tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isLoading}
                aria-label="Usuario"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password" className="text-[var(--text-primary)]">
                Contraseña
              </Label>
              <Input
                id="login-password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
                aria-label="Contraseña"
              />
            </div>
            <div className="min-h-[4.5rem] flex items-center" aria-live="assertive">
              {error ? (
                <ErrorState message={error} className="w-full" />
              ) : null}
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isDisabled={!canSubmit || submitting}
              aria-label="Entrar"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
