import React from "react";

export type ToastType = "success" | "info" | "error";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

type Props = {
  items: ToastMessage[];
  onDismiss: (id: string) => void;
};

export function ToastStack({ items, onDismiss }: Props) {
  if (items.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.type}`} role="status">
          <span>{item.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(item.id)}
            aria-label="Cerrar notificacion"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
