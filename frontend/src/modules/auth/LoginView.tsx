import React, { useState } from "react";
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
      <div className="login-card">
        <h1>Cartera Cobranzas</h1>
        <p className="subtitle">Inicia sesión con tu usuario y contraseña.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-username" className="input-label">
              Usuario
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || submitting}
              placeholder="Tu usuario"
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password" className="input-label">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || submitting}
              placeholder="••••••••"
            />
          </div>
          {error ? <p className="error-msg">{error}</p> : null}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || submitting || !username.trim() || !password}
            style={{ width: "100%", padding: "0.625rem 1rem" }}
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
