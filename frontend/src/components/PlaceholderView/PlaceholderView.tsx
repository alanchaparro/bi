import React from 'react'

type Props = {
  title: string
  message?: string
}

export function PlaceholderView({ title, message = 'Módulo en desarrollo. Próximamente disponible.' }: Props) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </section>
  )
}
