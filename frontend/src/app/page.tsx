"use client";

import { useAuth } from "./providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/feedback/LoadingState";

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
        <LoadingState message="Cargando aplicación..." className="w-full max-w-md" />
      </div>
    );
  }

  return null;
}
