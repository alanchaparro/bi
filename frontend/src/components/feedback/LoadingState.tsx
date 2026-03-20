import React from "react";
import { Spinner, Text } from "@heroui/react";

type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({ message = "Cargando...", className = "" }: LoadingStateProps) {
  return (
    <div className={`ui-state ui-state-loading flex flex-col items-center justify-center gap-3 py-8 ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <Spinner size="lg" color="accent" aria-hidden />
      <Text size="sm" className="text-[var(--color-text-muted)]">{message}</Text>
    </div>
  );
}

