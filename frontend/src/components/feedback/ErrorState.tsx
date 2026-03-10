import React from "react";

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
        <button type="button" className="btn btn-secondary" onClick={onRetry} disabled={disabled}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

