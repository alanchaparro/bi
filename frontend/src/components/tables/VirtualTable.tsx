import React from "react";

// Mejora UX #2: Virtualización de tablas con react-window (v2 beta).
// Import dinámico para evitar problemas de tipos y SSR.

type Col<T> = {
  key: string;
  label: string;
  accessor: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  data: T[];
  columns: Col<T>[];
  rowHeight?: number;
  virtualizeThreshold?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ListRef: any = null;
function initList(): Promise<void> {
  if (ListRef) return Promise.resolve();
  return import("react-window")
    .then((mod: any) => {
      ListRef = mod.List || null;
    })
    .catch(() => {});
}

function NativeTable<T>({ data, columns }: { data: T[]; columns: Col<T>[] }) {
  return (
    <>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="text-left p-2 font-semibold text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key} className={col.className || "p-2 text-sm"}>
                {col.accessor(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </>
  );
}

/**
 * VirtualTable: si data.length >= virtualizeThreshold (default 100),
 * renderiza con react-window List (v2). Si no, tabla nativa.
 */
export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 40,
  virtualizeThreshold = 100,
}: Props<T>) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (data.length >= virtualizeThreshold) {
      initList().then(() => setReady(true));
    }
  }, [data.length, virtualizeThreshold]);

  if (data.length < virtualizeThreshold) {
    return (
      <table className="w-full text-sm border-collapse">
        <NativeTable data={data} columns={columns} />
      </table>
    );
  }

  const List = ListRef;
  if (!List || !ready) {
    return (
      <table className="w-full text-sm border-collapse">
        <NativeTable data={data.slice(0, 100)} columns={columns} />
      </table>
    );
  }

  const RowComp = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = data[index];
    return (
      <tr style={style} className="virtual-table-tr">
        {columns.map((col) => (
          <td key={col.key} className={col.className || "p-2 text-sm"}>
            {col.accessor(row)}
          </td>
        ))}
      </tr>
    );
  };

  const headerH = 40;
  const listH = Math.min(data.length * rowHeight, 480);

  return (
    <table className="w-full text-sm border-collapse">
      <>
        <thead style={{ display: "block" }}>
          <tr style={{ display: "flex", height: headerH }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left p-2 font-semibold text-xs uppercase tracking-wide text-[var(--color-text-muted)] flex-shrink-0"
                style={{ minWidth: 80, flex: 1 }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ display: "block" }}>
          <List
            height={listH}
            rowCount={data.length}
            rowHeight={rowHeight}
            width="100%"
            rowComponent={RowComp}
          />
        </tbody>
      </>
    </table>
  );
}

export default VirtualTable;
