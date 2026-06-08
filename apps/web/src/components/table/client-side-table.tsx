'use client'

import { useMemo } from 'react'
import {
  ClientSideTable as BaseClientSideTable,
  type DataTableFilterableColumn,
  type DataTableSearchableColumn,
} from 'react-table-craft'
import type { ColumnDef } from '@tanstack/react-table'

const SEARCH_INPUT_CLASS =
  'input-field !h-9 !rounded-xl !border-[var(--border-default)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)] placeholder:!text-[var(--text-placeholder)] focus-visible:!ring-violet-500/50 focus-visible:!border-violet-500'

function colId<T>(col: ColumnDef<T, unknown>): string {
  return String(col.id ?? (col as { accessorKey?: string }).accessorKey ?? '')
}

function enhanceColumns<T>(
  columns: ColumnDef<T, unknown>[],
  searchableColumns: DataTableSearchableColumn<T>[] = [],
  filterableColumns: DataTableFilterableColumn<T>[] = [],
): ColumnDef<T, unknown>[] {
  const searchIds = new Set(searchableColumns.map(c => String(c.id)))
  const filterIds = new Set(filterableColumns.map(c => String(c.id)))

  return columns.map(col => {
    const id = colId(col)
    if (searchIds.has(id)) {
      return {
        ...col,
        id: col.id ?? id,
        enableColumnFilter: true,
        filterFn: 'includesString' as const,
      }
    }
    if (filterIds.has(id)) {
      return {
        ...col,
        id: col.id ?? id,
        enableColumnFilter: true,
        filterFn: 'arrIncludes' as const,
      }
    }
    return col
  })
}

type BaseProps<TData, TValue> = React.ComponentProps<typeof BaseClientSideTable<TData, TValue>>

export function ClientSideTable<TData, TValue>(props: BaseProps<TData, TValue>) {
  const searchableColumns = props.searchableColumns ?? []
  const filterableColumns = props.filterableColumns ?? []

  const enhancedColumns = useMemo(
    () =>
      enhanceColumns(
        props.columns as ColumnDef<TData, unknown>[],
        searchableColumns,
        filterableColumns,
      ),
    [props.columns, searchableColumns, filterableColumns],
  )

  const customCss = [SEARCH_INPUT_CLASS, props.customCss ?? ''].filter(Boolean).join(' ')

  return (
    <BaseClientSideTable
      {...props}
      columns={enhancedColumns as BaseProps<TData, TValue>['columns']}
      customCss={customCss}
    />
  )
}
