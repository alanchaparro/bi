import React, { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { ErrorState } from "../../components/feedback/ErrorState";
import type { LoginRequest } from "../../shared/contracts";

type Props = {
  onSubmit: (payload: LoginRequest) => Promise<void>;
  error: string | null;
  loading?: boolean;
};

export function LoginView({ onSubmit, error, loading = false }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;
    if (!u || !p) return;
    setSubmitting(true);
    try {
      await onSubmit({ username: u, password: p });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>Cartera Cobranzas</h1>
        <p className="section-subtitle">Inicia sesión con tu usuario y contraseña.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <TextField className="form-group w-full" isDisabled={loading || submitting}>
            <Label htmlFor="login-username" className="input-label">Usuario</Label>
            <Input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              aria-label="Usuario"
              className="input w-full border border-[var(--color-border)] bg-[var(--input-bg)]"
            />
          </TextField>
          <TextField className="form-group w-full" isDisabled={loading || submitting}>
            <Label htmlFor="login-password" className="input-label">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              aria-label="Contraseña"
              className="input w-full border border-[var(--color-border)] bg-[var(--input-bg)]"
            />
          </TextField>
          {error ? <ErrorState message={error} className="mb-1" /> : null}
          <Button type="submit" variant="primary" className="w-full" isDisabled={loading || submitting || !username.trim() || !password} aria-label="Entrar">
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
