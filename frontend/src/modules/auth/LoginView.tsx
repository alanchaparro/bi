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
    <main
      style={{
        fontFamily: "Outfit, sans-serif",
        padding: 24,
        maxWidth: 400,
        margin: "40px auto",
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Cartera Cobranzas</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Inicia sesión con tu usuario y contraseña.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="login-username" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Usuario
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading || submitting}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="login-password" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || submitting}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>
        {error ? (
          <p style={{ color: "crimson", marginBottom: 16, fontSize: 14 }}>{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading || submitting || !username.trim() || !password}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 500,
            cursor: loading || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
