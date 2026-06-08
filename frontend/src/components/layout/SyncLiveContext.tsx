"use client";

import React from "react";

export type SyncLive = {
  running?: boolean;
  currentDomain?: string | null;
  progressPct?: number;
  message?: string;
  currentQueryFile?: string | null;
  etaSeconds?: number | null;
  jobStep?: string | null;
  queuePosition?: number | null;
  chunkKey?: string | null;
  chunkStatus?: string | null;
  skippedUnchangedChunks?: number;
  error?: string | null;
  lastUpdatedAt?: string | null;
};

export type ScheduleLive = {
  runningCount: number;
  domains: string[];
  progressPct?: number | null;
  lastUpdatedAt?: string | null;
};

export type SyncLiveContextValue = {
  syncLive: SyncLive | null;
  scheduleLive: ScheduleLive | null;
  setSyncLive: (v: SyncLive | null) => void;
  setScheduleLive: (v: ScheduleLive | null) => void;
};

export const SyncLiveContext = React.createContext<SyncLiveContextValue | null>(null);

export function useSyncLive() {
  const ctx = React.useContext(SyncLiveContext);
  return ctx ?? { syncLive: null, scheduleLive: null, setSyncLive: () => {}, setScheduleLive: () => {} };
}
