"use client";

import React, { Suspense } from "react";
import { useSyncLive } from "@/components/layout/SyncLiveContext";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ConfigView } from "@/modules/config/ConfigView";

function ConfigPageInner() {
  const { setSyncLive, setScheduleLive } = useSyncLive();
  return (
    <ConfigView
      onSyncLiveChange={setSyncLive}
      onScheduleLiveChange={setScheduleLive}
    />
  );
}

export default function ConfigPage() {
  return (
    <Suspense
      fallback={
        <section className="flex min-h-[40vh] items-center justify-center p-6">
          <LoadingState message="Cargando configuración..." className="max-w-md" />
        </section>
      }
    >
      <ConfigPageInner />
    </Suspense>
  );
}

