import React from "react";
import { Button } from "@heroui/react";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Reintentar",
  className = "",
  disabled = false,
}: ErrorStateProps) {
  return (
    <div className={`ui-state ui-state-error ${className}`.trim()} role="alert">
      <span>{message}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onPress={onRetry} isDisabled={disabled}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

