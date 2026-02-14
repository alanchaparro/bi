import React from 'react'

type Props = {
  supervisors: string[]
}

export function BrokersSupervisorsView({ supervisors }: Props) {
  return (
    <section>
      <h2>Supervisores habilitados</h2>
      <pre>{JSON.stringify(supervisors, null, 2)}</pre>
    </section>
  )
}
