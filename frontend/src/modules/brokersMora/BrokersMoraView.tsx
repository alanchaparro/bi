import React from 'react'

type Props = {
  rows: any[]
}

export function BrokersMoraView({ rows }: Props) {
  return (
    <section>
      <h2>Mora Brokers</h2>
      <pre>{JSON.stringify(rows.slice(0, 20), null, 2)}</pre>
    </section>
  )
}
