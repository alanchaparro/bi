import React from "react";

export type MetricExplainerItem = {
  label: string;
  formula: string;
  note?: string;
};

type Props = {
  title?: string;
  items: MetricExplainerItem[];
  className?: string;
};

export function MetricExplainer({ title = "Definiciones operativas", items, className = "" }: Props) {
  if (items.length === 0) return null;

  return (
    <section className={`metric-explainer ${className}`.trim()} aria-label={title}>
      <div className="metric-explainer-header">
        <h3>{title}</h3>
        <p>La pantalla usa reglas de negocio de cobranzas por mes de gestion.</p>
      </div>
      <div className="metric-explainer-grid">
        {items.map((item) => (
          <article key={item.label} className="metric-explainer-card">
            <span className="metric-explainer-label">{item.label}</span>
            <strong className="metric-explainer-formula">{item.formula}</strong>
            {item.note ? <p className="metric-explainer-note">{item.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
