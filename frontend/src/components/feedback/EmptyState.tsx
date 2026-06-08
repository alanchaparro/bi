import React from "react";

type EmptyStateProps = {
  message: React.ReactNode;
  /** Sugerencia opcional para el usuario (ej. "Prueba a cambiar los filtros"). */
  suggestion?: React.ReactNode;
  className?: string;
};

export function EmptyState({ message, suggestion, className = "" }: EmptyStateProps) {
  return (
    <div className={`ui-state ui-state-empty flex flex-col items-center justify-center gap-2 py-8 px-4 ${className}`.trim()} role="status">
      <p className="text-sm empty-state-message text-center text-[var(--color-text-muted)]">{message}</p>
      {suggestion ? <p className="text-sm empty-state-suggestion text-center text-[var(--color-text-muted)] opacity-90">{suggestion}</p> : null}
    </div>
  );
}

