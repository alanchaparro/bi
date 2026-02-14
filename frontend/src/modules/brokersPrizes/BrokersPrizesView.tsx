import React from 'react'

type Props = {
  rules: any[]
}

export function BrokersPrizesView({ rules }: Props) {
  return (
    <section>
      <h2>Configuración de Premios</h2>
      <pre>{JSON.stringify(rules, null, 2)}</pre>
    </section>
  )
}
