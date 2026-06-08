"use client";

import dynamic from "next/dynamic";
import { SectionSkeleton } from "@/components/feedback/SectionSkeleton";

const VIEW = dynamic(
  () => import("@/modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView").then((m) => ({ default: m.AnalisisCobranzasCohorteView })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-4">
          <SectionSkeleton type="kpi" count={3} />
        </div>
        <SectionSkeleton type="filters" />
        <SectionSkeleton type="table" />
      </div>
    ),
  }
);

export default function CobranzasCohortePage() {
  return <VIEW />;
}

