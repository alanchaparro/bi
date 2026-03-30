import React from "react";
import { Button, Popover } from "@heroui/react";

export type MetricExplainerItem = {
  label: string;
  formula: string;
  note?: string;
};

type Props = {
  title?: string;
  /** Texto bajo el titulo dentro del panel (reglas / contexto de la pantalla). */
  intro?: string;
  items: MetricExplainerItem[];
  className?: string;
};

function InfoGlyph(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function MetricExplainer({
  title = "Definiciones operativas",
  intro = "La pantalla usa reglas de negocio de cobranzas por mes de gestion.",
  items,
  className = "",
}: Props) {
  if (items.length === 0) return null;

  const panel = (
    <>
      <div className="metric-explainer-header metric-explainer-header--in-popover">
        <Popover.Heading className="metric-explainer-popover-title">{title}</Popover.Heading>
        <p className="metric-explainer-popover-intro">{intro}</p>
      </div>
      <div className="metric-explainer-grid metric-explainer-grid--in-popover">
        {items.map((item) => (
          <article key={item.label} className="metric-explainer-card">
            <span className="metric-explainer-label">{item.label}</span>
            <strong className="metric-explainer-formula">{item.formula}</strong>
            {item.note ? <p className="metric-explainer-note">{item.note}</p> : null}
          </article>
        ))}
      </div>
    </>
  );

  return (
    <section className={`metric-explainer metric-explainer--compact ${className}`.trim()} aria-label={title}>
      <Popover.Root>
        <Popover.Trigger className="metric-explainer-trigger-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            isIconOnly
            className="metric-explainer-info-btn"
            aria-label={`${title}: ver definiciones y formulas`}
          >
            <InfoGlyph />
          </Button>
        </Popover.Trigger>
        <Popover.Content placement="bottom" offset={8} className="metric-explainer-popover-content">
          <Popover.Dialog className="metric-explainer-popover-dialog">{panel}</Popover.Dialog>
        </Popover.Content>
      </Popover.Root>
    </section>
  );
}
