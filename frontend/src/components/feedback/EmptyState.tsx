import React from "react";

type EmptyStateProps = {
  message: React.ReactNode;
  className?: string;
};

export function EmptyState({ message, className = "" }: EmptyStateProps) {
  return <div className={`ui-state ui-state-empty ${className}`.trim()}>{message}</div>;
}

