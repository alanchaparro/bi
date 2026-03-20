"use client";

import { useSyncLive } from "@/components/layout/DashboardLayout";
import { ConfigView } from "@/modules/config/ConfigView";

export default function ConfigPage() {
  const { setSyncLive, setScheduleLive } = useSyncLive();
  return (
    <ConfigView
      onSyncLiveChange={setSyncLive}
      onScheduleLiveChange={setScheduleLive}
    />
  );
}
