import React, { useEffect, useState } from "react";
import {
  getCommissionsRules,
  getPrizesRules,
  getSupervisorsScope,
  login,
  setAuthToken,
} from "./shared/api";

export default function App() {
  const [scope, setScope] = useState<string[]>([]);
  const [commissionsCount, setCommissionsCount] = useState(0);
  const [prizesCount, setPrizesCount] = useState(0);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const auth = await login({ username: "admin", password: "admin123" });
        setAuthToken(auth.access_token);
        setRole(auth.role);

        const [scopeRes, commRes, prizeRes] = await Promise.all([
          getSupervisorsScope(),
          getCommissionsRules(),
          getPrizesRules(),
        ]);

        setScope(scopeRes.supervisors || []);
        setCommissionsCount((commRes.rules || []).length);
        setPrizesCount((prizeRes.rules || []).length);
      } catch (e: any) {
        setError(e?.response?.data?.message || "No se pudo cargar Brokers v1");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <main style={{ fontFamily: "Outfit, sans-serif", padding: 24 }}>
      <h1>Frontend v1 - Brokers</h1>
      <p>Base React/TS para migracion progresiva de modulos Brokers con contratos tipados OpenAPI.</p>
      {loading ? <p>Cargando...</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <h2>Sesion</h2>
      <pre>{JSON.stringify({ role }, null, 2)}</pre>
      <h2>Supervisores habilitados</h2>
      <pre>{JSON.stringify(scope, null, 2)}</pre>
      <h2>Resumen reglas</h2>
      <pre>{JSON.stringify({ commissionsCount, prizesCount }, null, 2)}</pre>
    </main>
  );
}
