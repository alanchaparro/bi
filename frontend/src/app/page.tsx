"use client";

import { useAuth } from "./providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { auth, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!auth) {
      router.replace("/login");
      return;
    }
    router.replace("/analisis-cartera");
  }, [auth, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
        <p className="text-[var(--text-secondary)]">Cargando aplicación...</p>
      </div>
    );
  }

  return null;
}
