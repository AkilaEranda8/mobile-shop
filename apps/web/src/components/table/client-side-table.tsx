'use client'

import { useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import {
  ClientSideTable as BaseClientSideTable,
  type DataTableFilterableColumn,
  type DataTableSearchableColumn,
} from 'react-table-craft'
import type { ColumnDef } from '@tanstack/react-table'

function colId<T>(col: ColumnDef<T, unknown>): string {
  return String(col.id ?? (col as { accessorKey?: string }).accessorKey ?? '')
}

function getRowFieldValue<T>(row: T, columnId: string, columns: ColumnDef<T, unknown>[]): string {
  const col = columns.find(c => colId(c) === columnId) as ColumnDef<T, unknown> & {
    accessorFn?: (row: T, index: number) => unknown
    accessorKey?: string
  }
  if (!col) return String((row as Record<string, unknown>)[columnId] ?? '')
  if (typeof col.accessorFn === 'function') {
    try {
      return String(col.accessorFn(row, 0) ?? '')
    } catch {
      return ''
    }
  }
  if (col.accessorKey) return String((row as Record<string, unknown>)[col.accessorKey] ?? '')
  return String((row as Record<string, unknown>)[columnId] ?? '')
}

function filterRows<T>(
  rows: T[],
  columns: ColumnDef<T, unknown>[],
  searchableColumns: DataTableSearchableColumn<T>[],
  filters: Record<string, string>,
): T[] {
  const active = searchableColumns.filter(col => filters[String(col.id)]?.trim())
  if (!active.length) return rows

  return rows.filter(row =>
    active.every(col => {
      const q = filters[String(col.id)].toLowerCase().trim()
      return getRowFieldValue(row, String(col.id), columns).toLowerCase().includes(q)
    }),
  )
}

function enhanceFilterColumns<T>(
  columns: ColumnDef<T, unknown>[],
  filterableColumns: DataTableFilterableColumn<T>[] = [],
): ColumnDef<T, unknown>[] {
  const filterIds = new Set(filterableColumns.map(c => String(c.id)))
  return columns.map(col => {
    const id = colId(col)
    if (!filterIds.has(id)) return col
    return {
      ...col,
      id: col.id ?? id,
      enableColumnFilter: true,
      filterFn: 'arrIncludes' as const,
    }
  })
}

type BaseProps<TData, TValue> = React.ComponentProps<typeof BaseClientSideTable<TData, TValue>>

/**
 * react-table-craft defaults per_page to 10 when no router is configured, ignoring the
 * pageSize prop. Provide a noop router with per_page so row slicing matches pageCount.
 */
function useTablePageSizeRouter(pageSize: number) {
  const searchParamsRef = useRef<URLSearchParams | null>(null)
  if (!searchParamsRef.current) {
    searchParamsRef.current = new URLSearchParams(`per_page=${pageSize}&page=1`)
  } else if (searchParamsRef.current.get('per_page') !== String(pageSize)) {
    searchParamsRef.current.set('per_page', String(pageSize))
  }

  return useMemo(
    () => ({
      push: () => {},
      replace: () => {},
      getSearchParams: () => searchParamsRef.current!,
      getPathname: () => '',
    }),
    [],
  )
}

export function ClientSideTable<TData, TValue>(props: BaseProps<TData, TValue>) {
  const {
    searchableColumns = [],
    filterableColumns = [],
    showFilter,
    data: _data,
    columns: _columns,
    pageCount: _pageCount,
    isQuerySearch: _isQuerySearch,
    searchableQuery: _searchableQuery,
    config: userConfig,
    pageSize: pageSizeProp,
    ...rest
  } = props
  const [filters, setFilters] = useState<Record<string, string>>({})
  const resolvedPageSize = pageSizeProp ?? 10
  const tableRouter = useTablePageSizeRouter(resolvedPageSize)

  const enhancedColumns = useMemo(
    () => enhanceFilterColumns(_columns as ColumnDef<TData, unknown>[], filterableColumns),
    [_columns, filterableColumns],
  )

  const filteredData = useMemo(
    () =>
      filterRows(
        _data ?? [],
        enhancedColumns,
        searchableColumns,
        filters,
      ),
    [_data, enhancedColumns, searchableColumns, filters],
  )

  const mergedConfig = useMemo(
    () => ({
      ...userConfig,
      router: userConfig?.router ?? tableRouter,
      pagination: {
        pageSizeOptions: [10, 20, 30, 40, 50, 100],
        defaultPageSize: resolvedPageSize,
        ...userConfig?.pagination,
      },
    }),
    [userConfig, tableRouter, resolvedPageSize],
  )

  return (
    <div className="space-y-3">
      {searchableColumns.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          {searchableColumns.map(col => {
            const id = String(col.id)
            return (
              <div key={id} className="relative flex-1 max-w-sm">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={filters[id] ?? ''}
                  onChange={e => setFilters(prev => ({ ...prev, [id]: e.target.value }))}
                  placeholder={`Search ${col.title ?? id}…`}
                  className="input-field pl-9 h-9 text-sm w-full"
                />
              </div>
            )
          })}
        </div>
      )}

      <BaseClientSideTable
        {...rest}
        pageSize={resolvedPageSize}
        config={mergedConfig}
        data={filteredData}
        columns={enhancedColumns as BaseProps<TData, TValue>['columns']}
        searchableColumns={[]}
        isQuerySearch={false}
        showFilter={showFilter !== false && filterableColumns.length > 0}
      />
    </div>
  )
}
