import React from "react";

type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({ message = "Cargando...", className = "" }: LoadingStateProps) {
  return (
    <div className={`ui-state ui-state-loading ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <span className="inline-spinner" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

