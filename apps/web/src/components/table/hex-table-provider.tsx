'use client'

import { TableProvider, createTableConfig } from 'react-table-craft'

/** Table config without URL router — router sync was clearing column filters. */
export function HexTableProvider({ children }: { children: React.ReactNode }) {
  return (
    <TableProvider config={createTableConfig({ search: { debounceMs: 300 } })}>
      {children}
    </TableProvider>
  )
}
