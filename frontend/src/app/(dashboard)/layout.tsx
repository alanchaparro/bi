import { Suspense } from "react";
import { FilterLayoutConfigProvider } from "@/components/filters/FilterLayoutConfigContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LoadingState } from "@/components/feedback/LoadingState";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
          <LoadingState message="Cargando aplicación…" className="w-full max-w-md" />
        </div>
      }
    >
      <DashboardLayout>
        <FilterLayoutConfigProvider>{children}</FilterLayoutConfigProvider>
      </DashboardLayout>
    </Suspense>
  );
}
