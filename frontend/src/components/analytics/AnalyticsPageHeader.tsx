import React from "react";

type Props = {
  kicker?: string;
  pill?: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
};

export function AnalyticsPageHeader({ kicker, pill, title, subtitle, meta }: Props) {
  return (
    <div className="analysis-header">
      {(kicker != null || pill != null) ? (
        <div className="analysis-header-row">
          {kicker != null ? <span className="analysis-kicker" data-testid="page-kicker">{kicker}</span> : null}
          {pill != null ? <span className="analysis-live-pill">{pill}</span> : null}
        </div>
      ) : null}
      <h2 className="page-title">{title}</h2>
      {subtitle != null ? <p className="analysis-subtitle">{subtitle}</p> : null}
      {meta != null ? <div className="analysis-meta-row">{meta}</div> : null}
    </div>
  );
}
