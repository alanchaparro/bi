import React from 'react'

type Props = {
  rules: any[]
}

export function BrokersCommissionsView({ rules }: Props) {
  return (
    <section>
      <h2>Configuración de Comisiones</h2>
      <pre>{JSON.stringify(rules, null, 2)}</pre>
    </section>
  )
}
