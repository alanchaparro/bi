"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@heroui/react"

export type FloatingQuickFiltersProps = {
  /** Panel de campos abierto (además del FAB). */
  isOpen: boolean
  /** Al pulsar el FAB colapsado: preparar borradores y abrir. */
  onOpen: () => void
  onCollapse: () => void
  onApply: () => void | Promise<void>
  applyDisabled?: boolean
  applying?: boolean
  title?: string
  children: React.ReactNode
}

/**
 * Pestaña flotante arrastrable (mismo patrón que Rolo de cartera) para filtros rápidos en pantallas de analytics.
 */
export function FloatingQuickFilters({
  isOpen,
  onOpen,
  onCollapse,
  onApply,
  applyDisabled = false,
  applying = false,
  title = "Filtros rápidos",
  children,
}: FloatingQuickFiltersProps) {
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const startDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    document.body.classList.add("is-dragging-floating-filter")

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentWrap = wrapRef.current
      if (!currentWrap) return
      const currentRect = currentWrap.getBoundingClientRect()
      const maxLeft = Math.max(0, window.innerWidth - currentRect.width)
      const maxTop = Math.max(0, window.innerHeight - currentRect.height)
      const nextLeft = Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX))
      const nextTop = Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY))
      setPosition({ left: nextLeft, top: nextTop })
    }

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove)
      document.body.classList.remove("is-dragging-floating-filter")
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp, { once: true })
    window.addEventListener("pointercancel", onPointerUp, { once: true })
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      ref={wrapRef}
      className={`analytics-floating-filter-wrap ${isOpen ? "is-open" : ""}`}
      style={
        position
          ? {
              left: `${position.left}px`,
              top: `${position.top}px`,
              right: "auto",
              bottom: "auto",
              transform: "none",
            }
          : undefined
      }
    >
      <button
        type="button"
        className="analytics-floating-drag-btn"
        onPointerDown={startDrag}
        aria-label="Mover filtros rápidos"
        title="Mover filtros rápidos"
      >
        ::
      </button>
      {isOpen ? (
        <div className="card analytics-floating-filter-card">
          <div className="analytics-floating-filter-title">{title}</div>
          <div className="analytics-floating-filter-grid">{children}</div>
          <div className="analytics-floating-filter-actions">
            <Button size="sm" variant="primary" onPress={() => void onApply()} isDisabled={applyDisabled || applying}>
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onPress={onCollapse}>
              Contraer
            </Button>
          </div>
        </div>
      ) : (
        <Button className="analytics-floating-filter-fab analytics-floating-filter-fab-vertical" variant="primary" onPress={onOpen}>
          Filtros
        </Button>
      )}
    </div>,
    document.body,
  )
}
