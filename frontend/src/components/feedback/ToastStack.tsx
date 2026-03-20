import React from "react";
import { Button } from "@heroui/react";

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
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={item.message.length <= 40 ? `Cerrar notificación: ${item.message}` : "Cerrar notificación"}
            onPress={() => onDismiss(item.id)}
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}
