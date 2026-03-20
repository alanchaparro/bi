import React from "react";
import { EmptyState } from "../feedback/EmptyState";

type Props = {
  title: string;
  subtitle?: string;
  hasData: boolean;
  emptyMessage: React.ReactNode;
  emptySuggestion?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function ChartSection({
  title,
  subtitle,
  hasData,
  emptyMessage,
  emptySuggestion,
  className = "",
  children,
}: Props) {
  return (
    <article className={`card chart-card chart-card-wide rend-chart-card ${className}`.trim()}>
      <div className="chart-section-header">
        <h3 className="rend-chart-title">{title}</h3>
        {subtitle ? <p className="chart-section-subtitle">{subtitle}</p> : null}
      </div>
      {hasData ? children : <EmptyState message={emptyMessage} suggestion={emptySuggestion} className="rend-no-data" />}
    </article>
  );
}
