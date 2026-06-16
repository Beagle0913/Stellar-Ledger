import React from 'react'

export interface Column<T> {
  key: string
  header: string
  /** Render the cell. */
  render: (row: T) => React.ReactNode
  /** Right-align + monospace (for numbers). */
  numeric?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: string
  onRowClick?: (row: T) => void
}

/** Minimal, dense, spreadsheet-style table used across pages. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'No data.',
  onRowClick
}: DataTableProps<T>): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>
  }
  return (
    <table className="data">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={c.numeric ? 'num' : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'clickable' : undefined}
          >
            {columns.map((c) => (
              <td key={c.key} className={c.numeric ? 'num' : undefined}>
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
