import { Table } from "@heroui/react";

export type BrokersSummaryRow = {
  year: string;
  month: string;
  supervisor: string;
  un: string;
  via: string;
  count: number;
  mora3m: number;
  montoCuota: number;
  commission: number;
};

type Props = {
  rows: BrokersSummaryRow[];
};

/**
 * Tabla de solo lectura del resumen de brokers (spike Fase 4 HeroUI).
 * El contenedor `.table-wrap` aplica borde, scroll horizontal y estilos de celdas heredados.
 */
export function BrokersSummaryTable({ rows }: Props) {
  return (
    <Table variant="secondary" className="min-w-0 bg-transparent">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Resumen de brokers por año, mes, supervisor, UN y vía"
          className="min-w-[56rem]"
        >
          <Table.Header>
            <Table.Column isRowHeader>Año</Table.Column>
            <Table.Column>Mes</Table.Column>
            <Table.Column>Supervisor</Table.Column>
            <Table.Column>UN</Table.Column>
            <Table.Column>Vía</Table.Column>
            <Table.Column className="text-end">Contratos</Table.Column>
            <Table.Column className="text-end">Mora 3M</Table.Column>
            <Table.Column className="text-end">Monto</Table.Column>
            <Table.Column className="text-end">Comisiones</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((r, i) => (
              <Table.Row key={`${r.month}-${r.supervisor}-${r.un}-${r.via}-${i}`}>
                <Table.Cell>{r.year}</Table.Cell>
                <Table.Cell>{r.month}</Table.Cell>
                <Table.Cell>{r.supervisor}</Table.Cell>
                <Table.Cell>{r.un}</Table.Cell>
                <Table.Cell>{r.via}</Table.Cell>
                <Table.Cell className="text-end tabular-nums">{r.count}</Table.Cell>
                <Table.Cell className="text-end tabular-nums">{r.mora3m}</Table.Cell>
                <Table.Cell className="text-end tabular-nums">{Number(r.montoCuota || 0).toFixed(2)}</Table.Cell>
                <Table.Cell className="text-end tabular-nums">{Number(r.commission || 0).toFixed(2)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
