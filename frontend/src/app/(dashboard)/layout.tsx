import { FilterLayoutConfigProvider } from "@/components/filters/FilterLayoutConfigContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      <FilterLayoutConfigProvider>{children}</FilterLayoutConfigProvider>
    </DashboardLayout>
  );
}
