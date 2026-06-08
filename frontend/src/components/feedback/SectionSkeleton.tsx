"use client";

import React from "react";

interface SectionSkeletonProps {
  type: "kpi" | "table" | "chart" | "filters";
  count?: number;
}

const KPI_SKELETON = (
  <div className="animate-pulse rounded-lg bg-[var(--card-bg)] p-4" style={{ backgroundColor: "#004D5C" }}>
    <div className="mb-2 h-3 w-1/2 rounded bg-white/20" />
    <div className="mb-2 h-8 w-3/4 rounded bg-white/30" />
    <div className="h-3 w-1/3 rounded bg-white/20" />
  </div>
);

const TABLE_SKELETON = (
  <div className="animate-pulse space-y-2 rounded-lg bg-[var(--card-bg)] p-4">
    <div className="flex gap-4">
      <div className="h-10 flex-1 rounded bg-[var(--color-border-subtle)]" />
      <div className="h-10 w-24 rounded bg-[var(--color-border-subtle)]" />
      <div className="h-10 w-24 rounded bg-[var(--color-border-subtle)]" />
    </div>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="h-6 flex-1 rounded bg-[var(--color-surface-raised)]" />
        <div className="h-6 w-24 rounded bg-[var(--color-surface-raised)]" />
        <div className="h-6 w-24 rounded bg-[var(--color-surface-raised)]" />
      </div>
    ))}
  </div>
);

const CHART_SKELETON = (
  <div className="animate-pulse rounded-lg bg-[var(--card-bg)] p-4">
    <div className="mb-4 h-4 w-1/3 rounded bg-[var(--color-border-subtle)]" />
    <div className="flex h-64 items-end justify-around gap-2 px-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="w-8 rounded-t bg-[var(--color-border-subtle)]"
          style={{ height: `${20 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  </div>
);

const FILTERS_SKELETON = (
  <div className="flex animate-pulse flex-wrap gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-10 w-36 rounded-lg bg-[var(--color-border-subtle)]" />
    ))}
  </div>
);

export function SectionSkeleton({ type, count = 1 }: SectionSkeletonProps) {
  const template =
    type === "kpi" ? KPI_SKELETON :
    type === "table" ? TABLE_SKELETON :
    type === "chart" ? CHART_SKELETON :
    type === "filters" ? FILTERS_SKELETON :
    null;

  if (!template) return null;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{template}</div>
      ))}
    </>
  );
}
