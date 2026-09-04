'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check, ClipboardList, FileText, Loader2, Package, Plus, Truck,
  RotateCcw, Wallet, BarChart3, MapPin,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency } from '@/lib/utils'
import { useActiveBranchId, useProducts } from '@/lib/hooks'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import { wholesaleApi, type WholesaleDealer } from '@/lib/wholesale-api'
import { usersApi } from '@/lib/api'
import {
  WholesaleEmptyState,
  WholesaleFeatureGate,
  WholesaleKpiCard,
  WholesaleModalShell,
  WholesalePageHeader,
  fieldClass,
  fieldStyle,
} from './wholesale-ui'
import {
  DispatchDetailModal,
  OrderDetailModal,
  PickListDetailModal,
  QuotationDetailModal,
  ReturnDetailModal,
  SettlementDetailModal,
  TripDetailModal,
} from './WholesaleDetailModals'

type CatalogProduct = {
  id: string
  name: string
  sku?: string | null
  wholesalePrice?: number | null
}

type AnyRow = Record<string, unknown>

function asRows(res: unknown): AnyRow[] {
  if (Array.isArray(res)) return res as AnyRow[]
  const r = res as { data?: unknown }
  const d = r?.data
  if (Array.isArray(d)) return d as AnyRow[]
  if (d && typeof d === 'object') {
    const obj = d as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as AnyRow[]
    if (Array.isArray(obj.data)) return obj.data as AnyRow[]
  }
  return []
}

function statusChip(status: string) {
  const s = String(status || '—')
  const tone =
    s.includes('CONFIRM') || s === 'ACTIVE' || s === 'PAID' || s === 'DELIVERED' || s === 'ISSUED'
      ? 'bg-emerald-500/10 text-emerald-700'
      : s.includes('HOLD') || s === 'PARTIAL' || s === 'DRAFT' || s === 'PENDING'
        ? 'bg-amber-500/10 text-amber-700'
        : s.includes('CANCEL') || s === 'REJECTED'
          ? 'bg-rose-500/10 text-rose-700'
          : 'bg-sky-500/10 text-sky-700'
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${tone}`}>{s}</span>
  )
}

function dealerLabel(row: AnyRow) {
  const d = row.dealer as { tradingName?: string; legalName?: string; dealerCode?: string } | undefined
  if (!d) return '—'
  return d.tradingName || d.legalName || d.dealerCode || '—'
}

function useEscClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

function StatusFilterChips({
  value,
  options,
  onChange,
}: {
  value: string
  options: { id: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            value === o.id
              ? 'bg-sky-600 text-white border-sky-600'
              : 'border-[var(--border-subtle)]'
          }`}
          style={value === o.id ? undefined : { color: 'var(--text-muted)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Compact product search — picks catalog productId for reserve/confirm workflows. */
function ProductSearchField({
  selected,
  onSelect,
  required,
}: {
  selected: CatalogProduct | null
  onSelect: (p: CatalogProduct | null) => void
  required?: boolean
}) {
  const { data, loading } = useProducts({ isActive: 'true' })
  const products = useMemo(
    () => ((data?.data ?? []) as CatalogProduct[]),
    [data],
  )
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products.slice(0, 8)
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.sku ?? '').toLowerCase().includes(s) ||
          p.id.toLowerCase().includes(s),
      )
      .slice(0, 8)
  }, [products, q])

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Product {required ? '' : '(optional)'}
        <input
          className={`${fieldClass()} mt-1`}
          style={fieldStyle()}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / SKU…"
          autoComplete="off"
        />
      </label>
      {selected && (
        <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs bg-sky-500/10 text-sky-800">
          <span className="truncate">
            {selected.name}
            {selected.sku ? ` · ${selected.sku}` : ''}
          </span>
          <button type="button" className="shrink-0 underline" onClick={() => onSelect(null)}>
            Clear
          </button>
        </div>
      )}
      {!selected && (
        <ul
          className="max-h-36 overflow-auto rounded-lg border text-xs"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {loading && (
            <li className="px-2.5 py-2" style={{ color: 'var(--text-muted)' }}>
              Loading products…
            </li>
          )}
          {!loading && filtered.length === 0 && (
            <li className="px-2.5 py-2" style={{ color: 'var(--text-muted)' }}>
              No products found
            </li>
          )}
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-2.5 py-1.5 hover:bg-sky-500/10"
                onClick={() => {
                  onSelect(p)
                  setQ('')
                }}
              >
                <span className="font-medium">{p.name}</span>
                {p.sku ? (
                  <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                    {p.sku}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Quotations ─────────────────────────────────────────────────────── */

export function WholesaleQuotationsPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .quotations({ limit: '200', ...(status ? { status } : {}) })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi.dealers({ limit: '500', isActive: 'true' }).then((r) => setDealers(r.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') setShowCreate(true)
    const q = params.get('q')
    if (q) setSearch(q)
    const id = params.get('id')
    if (id) setDetailId(id)
  }, [])

  useEscClose(showCreate, () => setShowCreate(false))
  useEscClose(!!detailId, () => setDetailId(null))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const num = String(r.quoteNumber ?? r.number ?? '')
      return num.toLowerCase().includes(q) || dealerLabel(r).toLowerCase().includes(q)
    })
  }, [rows, search])

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) {
      viewOnlyToast('quotations')
      return
    }
    setBusyId(id)
    try {
      await fn()
      toast.success(ok)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'quoteNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Quote #" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setDetailId(String(row.original.id))}
          >
            {String(row.original.quoteNumber ?? '—')}
          </button>
        ),
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => dealerLabel(row.original),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusChip(String(row.original.status)),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => formatCurrency(Number(row.original.total ?? 0)),
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setDetailId(String(row.original.id))}
          >
            View
          </button>
        ),
      },
    ],
    [busyId, canEdit],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Quotations"
          subtitle="Issue quotes and convert accepted quotes to sales orders"
          action={
            <button
              type="button"
              onClick={() => {
                if (!canEdit) return viewOnlyToast('quotations')
                setShowCreate(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
            >
              <Plus size={15} />
              New quote
            </button>
          }
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search quote # or dealer…" />
          <StatusFilterChips
            value={status}
            onChange={setStatus}
            options={[
              { id: '', label: 'All' },
              { id: 'DRAFT', label: 'Draft' },
              { id: 'ISSUED', label: 'Issued' },
              { id: 'ACCEPTED', label: 'Accepted' },
              { id: 'REJECTED', label: 'Rejected' },
            ]}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="No quotations"
            description="Create a draft quote, issue it to the dealer, then accept to open a sales order."
          />
        ) : (
          <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
        )}

        {showCreate && (
          <CreateQuoteOrOrderModal
            mode="quote"
            dealers={dealers}
            branchId={branchId}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}

        {detailId && (
          <QuotationDetailModal
            id={detailId}
            onClose={() => setDetailId(null)}
            onChanged={load}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Orders ─────────────────────────────────────────────────────────── */

export function WholesaleOrdersPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .orders({ limit: '200', ...(status ? { status } : {}) })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi.dealers({ limit: '500', isActive: 'true' }).then((r) => setDealers(r.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') setShowCreate(true)
    const id = params.get('id')
    if (id) setDetailId(id)
  }, [])

  useEscClose(showCreate, () => setShowCreate(false))
  useEscClose(!!detailId, () => setDetailId(null))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const num = String(r.orderNumber ?? '')
      return num.toLowerCase().includes(q) || dealerLabel(r).toLowerCase().includes(q)
    })
  }, [rows, search])

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) {
      viewOnlyToast('orders')
      return
    }
    setBusyId(id)
    try {
      await fn()
      toast.success(ok)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'orderNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setDetailId(String(row.original.id))}
          >
            {String(row.original.orderNumber ?? '—')}
          </button>
        ),
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => dealerLabel(row.original),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusChip(String(row.original.status)),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => formatCurrency(Number(row.original.total ?? 0)),
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setDetailId(String(row.original.id))}
          >
            View
          </button>
        ),
      },
    ],
    [busyId, canEdit],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Sales orders"
          subtitle="Delivery-channel orders — submit, confirm (reserve stock), then pick"
          action={
            <button
              type="button"
              onClick={() => {
                if (!canEdit) return viewOnlyToast('orders')
                setShowCreate(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
            >
              <Plus size={15} />
              New order
            </button>
          }
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search order # or dealer…" />
          <StatusFilterChips
            value={status}
            onChange={setStatus}
            options={[
              { id: '', label: 'All' },
              { id: 'DRAFT', label: 'Draft' },
              { id: 'SUBMITTED', label: 'Submitted' },
              { id: 'ON_HOLD', label: 'On hold' },
              { id: 'CONFIRMED', label: 'Confirmed' },
              { id: 'FULFILLED', label: 'Fulfilled' },
            ]}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="No sales orders"
            description="Accept a quotation or create an order for warehouse fulfilment."
          />
        ) : (
          <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
        )}

        {showCreate && (
          <CreateQuoteOrOrderModal
            mode="order"
            dealers={dealers}
            branchId={branchId}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}

        {detailId && (
          <OrderDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Warehouse ──────────────────────────────────────────────────────── */

export function WholesaleWarehousePage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [tab, setTab] = useState<'queue' | 'picks' | 'dispatches'>('queue')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bindDispatch, setBindDispatch] = useState<AnyRow | null>(null)
  const [detailPickId, setDetailPickId] = useState<string | null>(null)
  const [detailDispatchId, setDetailDispatchId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const req =
      tab === 'queue'
        ? wholesaleApi.pickQueue({ limit: '200' })
        : tab === 'picks'
          ? wholesaleApi.pickLists({ limit: '200' })
          : wholesaleApi.dispatches({ limit: '200' })
    req
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEscClose(!!bindDispatch, () => setBindDispatch(null))
  useEscClose(!!detailPickId, () => setDetailPickId(null))
  useEscClose(!!detailDispatchId, () => setDetailDispatchId(null))

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) return
    if (tab === 'picks') setDetailPickId(id)
    if (tab === 'dispatches') setDetailDispatchId(id)
  }, [tab])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const createPick = async (orderId: string) => {
    if (!canEdit) {
      viewOnlyToast('warehouse')
      return
    }
    setBusyId(orderId)
    try {
      await wholesaleApi.createPickList({ salesOrderId: orderId })
      toast.success('Pick list created')
      setTab('picks')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const completePick = async (id: string) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    setBusyId(id)
    try {
      await wholesaleApi.completePick(id)
      toast.success('Pick completed')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const pickAll = async (row: AnyRow) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    const id = String(row.id)
    setBusyId(id)
    try {
      let lines = (row.lines as Array<{ id: string; quantity: number; pickedQty?: number }> | undefined) ?? []
      if (!lines.length) {
        const res = await wholesaleApi.pickList(id)
        const detail = (res as { data?: AnyRow })?.data ?? (res as AnyRow)
        lines = (detail.lines as typeof lines) ?? []
      }
      if (!lines.length) throw new Error('No pick lines')
      await wholesaleApi.recordPick(id, {
        lines: lines.map((l) => ({
          pickLineId: l.id,
          pickedQty: Number(l.quantity),
        })),
      })
      toast.success('All lines marked picked')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const createDispatch = async (pickListId: string) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    setBusyId(pickListId)
    try {
      await wholesaleApi.createDispatch({ pickListId })
      toast.success('Dispatch note created')
      setTab('dispatches')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const packPick = async (id: string) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    setBusyId(id)
    try {
      await wholesaleApi.packPick(id)
      toast.success('Packed')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDispatch = async (id: string) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    setBusyId(id)
    try {
      await wholesaleApi.confirmDispatch(id)
      toast.success('Dispatch confirmed')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<AnyRow>[]>(() => {
    if (tab === 'queue') {
      return [
        {
          accessorKey: 'orderNumber',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold">
              {String(row.original.orderNumber ?? row.original.id)}
            </span>
          ),
        },
        {
          id: 'dealer',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
          cell: ({ row }) => dealerLabel(row.original),
        },
        {
          accessorKey: 'status',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) => statusChip(String(row.original.status)),
        },
        {
          id: 'actions',
          header: () => <span className="text-xs">Actions</span>,
          cell: ({ row }) => (
            <button
              type="button"
              disabled={busyId === String(row.original.id)}
              className="text-[11px] px-2 py-1 rounded-lg bg-sky-600 text-white"
              onClick={() => createPick(String(row.original.id))}
            >
              Create pick list
            </button>
          ),
        },
      ]
    }
    if (tab === 'picks') {
      return [
        {
          accessorKey: 'pickNumber',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Pick #" />,
          cell: ({ row }) => (
            <button
              type="button"
              className="font-mono text-xs font-semibold text-sky-700 hover:underline"
              onClick={() => setDetailPickId(String(row.original.id))}
            >
              {String(row.original.pickNumber ?? row.original.id)}
            </button>
          ),
        },
        {
          accessorKey: 'status',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) => statusChip(String(row.original.status)),
        },
        {
          id: 'actions',
          header: () => <span className="text-xs">Actions</span>,
          cell: ({ row }) => (
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-lg border"
              style={{ borderColor: 'var(--border-subtle)' }}
              onClick={() => setDetailPickId(String(row.original.id))}
            >
              View
            </button>
          ),
        },
      ]
    }
    return [
      {
        accessorKey: 'dispatchNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="DN #" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setDetailDispatchId(String(row.original.id))}
          >
            {String(row.original.dispatchNumber ?? row.original.id)}
          </button>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusChip(String(row.original.status)),
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setDetailDispatchId(String(row.original.id))}
          >
            View
          </button>
        ),
      },
    ]
  }, [tab, busyId, canEdit])

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Warehouse"
          subtitle="Pick queue, pack verification and dispatch notes"
        />
        <StatusFilterChips
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { id: 'queue', label: 'Pick queue' },
            { id: 'picks', label: 'Pick lists' },
            { id: 'dispatches', label: 'Dispatches' },
          ]}
        />
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search…" />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="Nothing in this queue"
            description="Confirm a sales order to see it in the pick queue."
          />
        ) : (
          <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
        )}

        {bindDispatch && (
          <BindDispatchImeiModal
            dispatch={bindDispatch}
            onClose={() => setBindDispatch(null)}
            onSaved={() => {
              setBindDispatch(null)
              load()
            }}
          />
        )}

        {detailPickId && (
          <PickListDetailModal
            id={detailPickId}
            onClose={() => setDetailPickId(null)}
            onChanged={() => {
              load()
              if (tab !== 'picks') setTab('picks')
            }}
          />
        )}

        {detailDispatchId && (
          <DispatchDetailModal
            id={detailDispatchId}
            onClose={() => setDetailDispatchId(null)}
            onChanged={load}
            onBindImei={(row) => {
              setDetailDispatchId(null)
              setBindDispatch(row)
            }}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Delivery ───────────────────────────────────────────────────────── */

export function WholesaleDeliveryPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [showPod, setShowPod] = useState<{ tripId: string; stopId: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .trips({ limit: '200' })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [branchId, load])

  useEffect(() => {
    wholesaleApi.dealers({ limit: '500', isActive: 'true' }).then((r) => setDealers(r.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (id) setDetailId(id)
  }, [])

  useEscClose(showCreate, () => setShowCreate(false))
  useEscClose(!!detailId, () => setDetailId(null))
  useEscClose(!!showPod, () => setShowPod(null))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'tripNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Trip #" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setDetailId(String(row.original.id))}
          >
            {String(row.original.tripNumber ?? row.original.id)}
          </button>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusChip(String(row.original.status)),
      },
      {
        accessorKey: 'routeName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Route" />,
        cell: ({ row }) => String(row.original.routeName ?? '—'),
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setDetailId(String(row.original.id))}
          >
            View
          </button>
        ),
      },
    ],
    [],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Wholesale delivery"
          subtitle="Distribution trips — start run, POD on stops, then invoice on acceptance"
          action={
            <button
              type="button"
              onClick={() => {
                if (!canEdit) return viewOnlyToast('delivery')
                setShowCreate(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
            >
              <Plus size={15} />
              New trip
            </button>
          }
        />
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search trips…" />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="No delivery trips"
            description="Create a trip after dispatch notes are ready for the road."
          />
        ) : (
          <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
        )}

        {showCreate && (
          <CreateTripModal
            dealers={dealers}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); load() }}
          />
        )}

        {detailId && (
          <TripDetailModal
            id={detailId}
            onClose={() => setDetailId(null)}
            onChanged={load}
            onPod={(tripId, stopId) => setShowPod({ tripId, stopId })}
          />
        )}

        {showPod && (
          <PodModal
            tripId={showPod.tripId}
            stopId={showPod.stopId}
            onClose={() => setShowPod(null)}
            onSaved={() => {
              setShowPod(null)
              load()
            }}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Returns ────────────────────────────────────────────────────────── */

export function WholesaleReturnsPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .returns({ limit: '200' })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [branchId, load])

  useEffect(() => {
    wholesaleApi.dealers({ limit: '500', isActive: 'true' }).then((r) => setDealers(r.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (id) setDetailId(id)
  }, [])

  useEscClose(showCreate, () => setShowCreate(false))
  useEscClose(!!detailId, () => setDetailId(null))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'returnNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="RMA #" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setDetailId(String(row.original.id))}
          >
            {String(row.original.returnNumber ?? row.original.id)}
          </button>
        ),
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => dealerLabel(row.original),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusChip(String(row.original.status)),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
        cell: ({ row }) => formatCurrency(Number(row.original.total ?? row.original.refundAmount ?? 0)),
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setDetailId(String(row.original.id))}
          >
            View
          </button>
        ),
      },
    ],
    [],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Returns / RMA"
          subtitle="Dealer returns, QC disposition and credit notes"
          action={
            <button
              type="button"
              onClick={() => {
                if (!canEdit) return viewOnlyToast('returns')
                setShowCreate(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
            >
              <Plus size={15} />
              New RMA
            </button>
          }
        />
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search returns…" />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState title="No returns" description="Opened RMAs will list here for approve → QC → credit note." />
        ) : (
          <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
        )}

        {showCreate && (
          <CreateReturnModal
            dealers={dealers}
            branchId={branchId}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); load() }}
          />
        )}

        {detailId && (
          <ReturnDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Collections ────────────────────────────────────────────────────── */

export function WholesaleCollectionsPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [tab, setTab] = useState<'ageing' | 'payments' | 'tasks' | 'statement'>('ageing')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showPay, setShowPay] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [payDealerId, setPayDealerId] = useState<string | undefined>()
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [statementDealerId, setStatementDealerId] = useState('')
  const [statement, setStatement] = useState<AnyRow | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (tab === 'statement') {
      setLoading(false)
      setRows([])
      return
    }
    setLoading(true)
    const req =
      tab === 'ageing'
        ? wholesaleApi.ageing({ limit: '200' })
        : tab === 'payments'
          ? wholesaleApi.payments({ limit: '200' })
          : wholesaleApi.collectionTasks({ limit: '200' })
    req
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi.dealers({ limit: '500' }).then((r) => {
      const list = r.data ?? []
      setDealers(list)
      if (!statementDealerId && list[0]?.id) setStatementDealerId(list[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const dealerId = params.get('dealerId')
    if (dealerId) {
      setPayDealerId(dealerId)
      setShowPay(true)
      setStatementDealerId(dealerId)
    }
    if (params.get('action') === 'add' || params.get('action') === 'new') setShowPay(true)
  }, [])

  useEscClose(showPay, () => setShowPay(false))
  useEscClose(showTask, () => setShowTask(false))

  const loadStatement = async (dealerId: string) => {
    if (!dealerId) return
    setLoading(true)
    try {
      const res = await wholesaleApi.statement(dealerId)
      setStatement(((res as { data?: AnyRow })?.data ?? res) as AnyRow)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'statement' && statementDealerId) {
      void loadStatement(statementDealerId)
    }
  }, [tab, statementDealerId, branchId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const markTaskDone = async (id: string) => {
    if (!canEdit) return viewOnlyToast('collections')
    setBusyTaskId(id)
    try {
      await wholesaleApi.updateCollectionTask(id, { status: 'DONE' })
      toast.success('Task done')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyTaskId(null)
    }
  }

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        id: 'primary',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tab === 'ageing' ? 'Dealer' : tab === 'payments' ? 'Payment' : 'Task'}
          />
        ),
        cell: ({ row }) => {
          if (tab === 'ageing') {
            const d = row.original.dealer as WholesaleDealer | undefined
            const id = String(d?.id ?? row.original.dealerId ?? '')
            return (
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  if (!canEdit) return viewOnlyToast('collections')
                  setPayDealerId(id || undefined)
                  setShowPay(true)
                }}
              >
                <p className="text-sm font-semibold text-sky-700 hover:underline">{dealerLabel(row.original)}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {String(d?.dealerCode ?? row.original.dealerCode ?? '')}
                </p>
              </button>
            )
          }
          if (tab === 'tasks') {
            return (
              <div>
                <p className="text-sm font-semibold">{dealerLabel(row.original)}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {String(row.original.notes ?? row.original.id)}
                </p>
              </div>
            )
          }
          return (
            <span className="font-mono text-xs">
              {String(row.original.paymentNumber ?? row.original.id)}
            </span>
          )
        },
      },
      {
        id: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        cell: ({ row }) =>
          formatCurrency(
            Number(
              row.original.totalDue ??
                row.original.amount ??
                row.original.targetAmount ??
                row.original.outstanding ??
                0,
            ),
          ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusChip(String(row.original.status ?? 'OPEN')),
      },
      ...(tab === 'tasks'
        ? [
            {
              id: 'actions',
              header: () => <span className="text-xs">Actions</span>,
              cell: ({ row }: { row: { original: AnyRow } }) => {
                const id = String(row.original.id)
                const st = String(row.original.status ?? '')
                if (st === 'DONE' || st === 'CANCELLED') return null
                return (
                  <button
                    type="button"
                    disabled={busyTaskId === id}
                    className="text-[11px] px-2 py-1 rounded-lg bg-emerald-600 text-white"
                    onClick={() => markTaskDone(id)}
                  >
                    Done
                  </button>
                )
              },
            } as ColumnDef<AnyRow>,
          ]
        : []),
    ],
    [tab, canEdit, busyTaskId],
  )

  const statementLines = useMemo(() => {
    if (!statement) return []
    const inv = statement.invoices ?? statement.lines ?? statement.entries
    return Array.isArray(inv) ? (inv as AnyRow[]) : []
  }, [statement])

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Collections"
          subtitle="Ageing, receipts, statements and follow-up tasks"
          action={
            <div className="flex gap-2 flex-wrap">
              {tab === 'tasks' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) return viewOnlyToast('collections')
                    setShowTask(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Plus size={15} />
                  New task
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!canEdit) return viewOnlyToast('collections')
                  setPayDealerId(undefined)
                  setShowPay(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
              >
                <Plus size={15} />
                Record payment
              </button>
            </div>
          }
        />
        <StatusFilterChips
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { id: 'ageing', label: 'Ageing' },
            { id: 'payments', label: 'Payments' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'statement', label: 'Statement' },
          ]}
        />

        {tab === 'statement' ? (
          <div className="space-y-3">
            <label className="block text-xs font-medium max-w-md" style={{ color: 'var(--text-muted)' }}>
              Dealer
              <select
                className={`${fieldClass()} mt-1`}
                style={fieldStyle()}
                value={statementDealerId}
                onChange={(e) => setStatementDealerId(e.target.value)}
              >
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.tradingName || d.legalName} ({d.dealerCode})
                  </option>
                ))}
              </select>
            </label>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-sky-500" />
              </div>
            ) : !statement ? (
              <WholesaleEmptyState title="No statement" description="Select a dealer to load AR statement." />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <WholesaleKpiCard
                    label="Outstanding"
                    value={formatCurrency(
                      Number(
                        (statement.dealer as { totalDue?: number } | undefined)?.totalDue ??
                          statement.totalDue ??
                          statement.outstanding ??
                          0,
                      ),
                    )}
                    icon={Wallet}
                    tone="amber"
                  />
                  <WholesaleKpiCard
                    label="Invoices"
                    value={statementLines.length}
                    icon={FileText}
                    tone="sky"
                  />
                </div>
                <ClientSideTable
                  columns={[
                    {
                      id: 'doc',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Doc" />,
                      cell: ({ row }) => (
                        <span className="font-mono text-xs">
                          {String(row.original.invoiceNumber ?? row.original.number ?? row.original.id)}
                        </span>
                      ),
                    },
                    {
                      id: 'due',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
                      cell: ({ row }) =>
                        formatCurrency(Number(row.original.dueAmount ?? row.original.amountDue ?? row.original.due ?? row.original.total ?? 0)),
                    },
                    {
                      accessorKey: 'status',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
                      cell: ({ row }) => statusChip(String(row.original.status ?? 'OPEN')),
                    },
                  ]}
                  data={statementLines}
                  searchableColumns={[]}
                  showFilter={false}
                  pageSize={25}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search…" />
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-sky-500" />
              </div>
            ) : filtered.length === 0 ? (
              <WholesaleEmptyState title="Nothing here" description="Dealer dues and receipts will show when invoices are posted." />
            ) : (
              <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
            )}
          </>
        )}

        {showPay && (
          <RecordPaymentModal
            dealers={dealers}
            initialDealerId={payDealerId}
            onClose={() => setShowPay(false)}
            onSaved={() => {
              setShowPay(false)
              setTab('payments')
              load()
            }}
          />
        )}

        {showTask && (
          <CreateCollectionTaskModal
            dealers={dealers}
            branchId={branchId}
            onClose={() => setShowTask(false)}
            onCreated={() => {
              setShowTask(false)
              setTab('tasks')
              load()
            }}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

function CreateQuoteOrOrderModal({
  mode,
  dealers,
  branchId,
  onClose,
  onCreated,
}: {
  mode: 'quote' | 'order'
  dealers: WholesaleDealer[]
  branchId: string | null | undefined
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!product) return
    setProductName(product.name)
    if (product.wholesalePrice != null) setUnitPrice(String(product.wholesalePrice))
  }, [product])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId) {
      toast.error('Select a dealer')
      return
    }
    if (mode === 'order' && !product?.id) {
      toast.error('Select a catalog product (needed to reserve stock)')
      return
    }
    if (!product?.id && !productName.trim()) {
      toast.error('Product / description required')
      return
    }
    const qty = Number(quantity)
    const price = Number(unitPrice)
    if (!(qty > 0)) {
      toast.error('Quantity must be positive')
      return
    }
    setSaving(true)
    try {
      const body = {
        dealerId,
        branchId: branchId || undefined,
        notes: notes.trim() || null,
        lines: [
          {
            productId: product?.id || null,
            productName: (productName.trim() || product?.name || 'Item').trim(),
            sku: product?.sku ?? null,
            quantity: qty,
            unitPrice: price >= 0 ? price : 0,
            sellUnit: 'PIECE' as const,
          },
        ],
      }
      if (mode === 'quote') {
        await wholesaleApi.createQuotation(body)
        toast.success('Quotation created')
      } else {
        await wholesaleApi.createOrder(body)
        toast.success('Order created')
      }
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title={mode === 'quote' ? 'New quotation' : 'New sales order'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dealer
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            required
          >
            {dealers.length === 0 && <option value="">No dealers</option>}
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tradingName || d.legalName} ({d.dealerCode})
              </option>
            ))}
          </select>
        </label>
        <ProductSearchField selected={product} onSelect={setProduct} required={mode === 'order'} />
        {!product && (
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Description
            <input
              className={`${fieldClass()} mt-1`}
              style={fieldStyle()}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Type-C cable 1m"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Qty
            <input
              type="number"
              min={0.001}
              step="any"
              className={`${fieldClass()} mt-1`}
              style={fieldStyle()}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Unit price
            <input
              type="number"
              min={0}
              step="any"
              className={`${fieldClass()} mt-1`}
              style={fieldStyle()}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Notes
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function RecordPaymentModal({
  dealers,
  initialDealerId,
  onClose,
  onSaved,
}: {
  dealers: WholesaleDealer[]
  initialDealerId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dealerId, setDealerId] = useState(initialDealerId || dealers[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')

  useEffect(() => {
    if (initialDealerId) setDealerId(initialDealerId)
  }, [initialDealerId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId || !amount) {
      toast.error('Dealer and amount required')
      return
    }
    setSaving(true)
    try {
      await wholesaleApi.createPayment({
        dealerId,
        amount: Number(amount),
        method,
      })
      toast.success('Payment recorded')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="Record dealer payment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dealer
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tradingName || d.legalName} ({d.dealerCode})
                {Number(d.totalDue) > 0 ? ` · due ${formatCurrency(Number(d.totalDue))}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Amount
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            required
            autoFocus
          />
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Method
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'WALLET'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function CreateCollectionTaskModal({
  dealers,
  branchId,
  onClose,
  onCreated,
}: {
  dealers: WholesaleDealer[]
  branchId: string | null | undefined
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')
  const [targetAmount, setTargetAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId) { toast.error('Select a dealer'); return }
    setSaving(true)
    try {
      await wholesaleApi.createCollectionTask({
        dealerId,
        branchId: branchId || undefined,
        targetAmount: targetAmount ? Number(targetAmount) : null,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
      })
      toast.success('Collection task created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="New collection task" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dealer
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            required
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tradingName || d.legalName} ({d.dealerCode})
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Target amount
            <input
              type="number"
              min={0}
              step="any"
              className={`${fieldClass()} mt-1`}
              style={fieldStyle()}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Due date
            <input
              type="date"
              className={`${fieldClass()} mt-1`}
              style={fieldStyle()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Notes
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create task'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

/* ── Reports ────────────────────────────────────────────────────────── */

export function WholesaleReportsPage() {
  const branchId = useActiveBranchId()
  const [channelRows, setChannelRows] = useState<AnyRow[]>([])
  const [movers, setMovers] = useState<AnyRow[]>([])
  const [outstanding, setOutstanding] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      wholesaleApi.salesByChannel().catch(() => ({ data: [] })),
      wholesaleApi.movers({ limit: '10' }).catch(() => ({ data: [] })),
      wholesaleApi.outstandingReport().catch(() => ({ data: [] })),
    ])
      .then(([ch, mv, ou]) => {
        setChannelRows(asRows(ch))
        setMovers(asRows(mv))
        setOutstanding(asRows(ou))
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [branchId])

  const channelTotal = channelRows.reduce((s, r) => s + Number(r.total ?? r.revenue ?? 0), 0)

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Wholesale reports"
          subtitle="Sales by channel — Counter, Van, Delivery"
        />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <WholesaleKpiCard label="Channel revenue" value={formatCurrency(channelTotal)} icon={BarChart3} tone="sky" />
              <WholesaleKpiCard label="Channels" value={channelRows.length} icon={ClipboardList} tone="violet" />
              <WholesaleKpiCard label="Top movers" value={movers.length} icon={Package} tone="emerald" />
              <WholesaleKpiCard label="AR dealers" value={outstanding.length} icon={Wallet} tone="amber" />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Sales by channel</h3>
                {channelRows.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No invoices yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {channelRows.map((r, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span>{String(r.channel ?? r.name ?? '—')}</span>
                        <span className="font-semibold">{formatCurrency(Number(r.total ?? r.revenue ?? 0))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Fast / slow movers</h3>
                {movers.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No movement data yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {movers.slice(0, 8).map((r, i) => (
                      <li key={i} className="flex justify-between text-sm gap-2">
                        <span className="truncate">{String(r.productName ?? r.name ?? r.sku ?? '—')}</span>
                        <span className="shrink-0 font-mono text-xs">{String(r.qty ?? r.quantity ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Van ────────────────────────────────────────────────────────────── */

export function WholesaleVanPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [tab, setTab] = useState<'vehicles' | 'reps' | 'settlements'>('vehicles')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateRep, setShowCreateRep] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showLoadStock, setShowLoadStock] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showVanSale, setShowVanSale] = useState(false)
  const [vehiclesForRep, setVehiclesForRep] = useState<AnyRow[]>([])
  const [vehiclesForOps, setVehiclesForOps] = useState<AnyRow[]>([])
  const [dealersForSale, setDealersForSale] = useState<WholesaleDealer[]>([])
  const [assignVehicle, setAssignVehicle] = useState<AnyRow | null>(null)
  const [settlementDetail, setSettlementDetail] = useState<AnyRow | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const req =
      tab === 'vehicles'
        ? wholesaleApi.vehicles({ limit: '200' })
        : tab === 'reps'
          ? wholesaleApi.reps({ limit: '200' })
          : wholesaleApi.settlements({ limit: '200' })
    req
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    if (tab === 'reps') {
      wholesaleApi.vehicles({ limit: '100' }).then((r) => setVehiclesForRep(asRows(r))).catch(() => {})
    }
    if (tab === 'settlements' || tab === 'vehicles') {
      wholesaleApi.vehicles({ limit: '100' }).then((r) => setVehiclesForOps(asRows(r))).catch(() => {})
    }
  }, [tab, branchId])

  useEscClose(showCreate, () => setShowCreate(false))
  useEscClose(showCreateRep, () => setShowCreateRep(false))
  useEscClose(showLoadStock, () => setShowLoadStock(false))
  useEscClose(showSettlement, () => setShowSettlement(false))
  useEscClose(showVanSale, () => setShowVanSale(false))
  useEscClose(!!assignVehicle, () => setAssignVehicle(null))
  useEscClose(!!settlementDetail, () => setSettlementDetail(null))

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    if (!canEdit) return viewOnlyToast('van')
    setBusyId(id)
    try {
      await fn()
      toast.success(ok)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        id: 'primary',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tab === 'vehicles' ? 'Vehicle' : tab === 'reps' ? 'Rep' : 'Settlement'}
          />
        ),
        cell: ({ row }) => {
          if (tab === 'vehicles') {
            const rep = row.original.assignedRepUser as { name?: string; email?: string } | undefined
            return (
              <div>
                <p className="text-sm font-semibold">{String(row.original.plateNumber ?? row.original.name)}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {String(row.original.name ?? '')}
                  {rep ? ` · ${rep.name || rep.email}` : ' · Unassigned'}
                </p>
              </div>
            )
          }
          if (tab === 'reps') {
            const u = row.original.user as { name?: string; email?: string } | undefined
            const v = row.original.defaultVehicle as { plateNumber?: string; name?: string } | undefined
            return (
              <div>
                <p className="text-sm font-semibold">{String(u?.name ?? '—')}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {String(u?.email ?? '')}
                  {v ? ` · ${v.plateNumber || v.name}` : ''}
                </p>
              </div>
            )
          }
          const vehicle = row.original.vehicle as { plateNumber?: string; name?: string } | undefined
          return (
            <button type="button" className="text-left" onClick={() => setSettlementDetail(row.original)}>
              <p className="text-sm font-semibold text-sky-700 hover:underline">
                {String(vehicle?.plateNumber || vehicle?.name || row.original.id)}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {formatCurrency(Number(row.original.declaredCash ?? 0))} declared
              </p>
            </button>
          )
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) =>
          statusChip(String(row.original.isActive === false ? 'INACTIVE' : row.original.status ?? 'ACTIVE')),
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => {
          const id = String(row.original.id)
          if (tab === 'vehicles') {
            return (
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded-lg border"
                style={{ borderColor: 'var(--border-subtle)' }}
                onClick={() => {
                  if (!canEdit) return viewOnlyToast('van')
                  setAssignVehicle(row.original)
                }}
              >
                Assign rep
              </button>
            )
          }
          if (tab !== 'settlements') return null
          return (
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-lg border"
              style={{ borderColor: 'var(--border-subtle)' }}
              onClick={() => setSettlementDetail(row.original)}
            >
              View
            </button>
          )
        },
      },
    ],
    [tab, canEdit],
  )

  return (
    <WholesaleFeatureGate feature="REP_VAN_SALES" label="Rep / Van Sales">
      <div className="space-y-4">
        <WholesalePageHeader
          title="Rep / Van sales"
          subtitle="Vehicles, reps and end-of-day settlements"
          action={
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/dashboard/hr/commission"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                HR commission
              </Link>
              <Link
                href="/rep"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <MapPin size={14} />
                Open Rep app
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (!canEdit) return viewOnlyToast('van')
                  wholesaleApi.dealers({ limit: '500', isActive: 'true' }).then((r) => setDealersForSale(r.data ?? [])).catch(() => {})
                  if (!vehiclesForOps.length) {
                    wholesaleApi.vehicles({ limit: '100' }).then((r) => setVehiclesForOps(asRows(r))).catch(() => {})
                  }
                  setShowVanSale(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                Van sale
              </button>
              {tab === 'vehicles' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canEdit) return viewOnlyToast('van')
                      setShowLoadStock(true)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    <Package size={14} />
                    Load stock
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canEdit) return viewOnlyToast('van')
                      setShowCreate(true)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
                  >
                    <Plus size={15} />
                    Add vehicle
                  </button>
                </>
              )}
              {tab === 'reps' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) return viewOnlyToast('van')
                    setShowCreateRep(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
                >
                  <Plus size={15} />
                  Add sales rep
                </button>
              )}
              {tab === 'settlements' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) return viewOnlyToast('van')
                    if (!vehiclesForOps.length) {
                      wholesaleApi.vehicles({ limit: '100' }).then((r) => setVehiclesForOps(asRows(r))).catch(() => {})
                    }
                    setShowSettlement(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
                >
                  <Plus size={15} />
                  New settlement
                </button>
              )}
            </div>
          }
        />
        <StatusFilterChips
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { id: 'vehicles', label: 'Vehicles' },
            { id: 'reps', label: 'Reps' },
            { id: 'settlements', label: 'Settlements' },
          ]}
        />
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search…" />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title={tab === 'reps' ? 'No sales reps yet' : tab === 'settlements' ? 'No settlements yet' : 'Nothing yet'}
            description={
              tab === 'reps'
                ? 'Add a sales rep — create a new login or link an existing staff user.'
                : tab === 'settlements'
                  ? 'Create an end-of-day settlement for a vehicle / rep.'
                  : 'Add a vehicle (creates a stock branch) then load stock for field sales.'
            }
          />
        ) : (
          <ClientSideTable columns={columns} data={filtered} searchableColumns={[]} showFilter={false} pageSize={25} />
        )}

        {showCreate && (
          <CreateVehicleModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}

        {showCreateRep && (
          <CreateRepModal
            vehicles={vehiclesForRep}
            existingRepUserIds={rows.map((r) => String((r.user as { id?: string })?.id ?? '')).filter(Boolean)}
            branchId={branchId}
            onClose={() => setShowCreateRep(false)}
            onCreated={() => {
              setShowCreateRep(false)
              load()
            }}
          />
        )}

        {showLoadStock && (
          <LoadStockModal
            vehicles={tab === 'vehicles' ? rows : vehiclesForOps}
            onClose={() => setShowLoadStock(false)}
            onLoaded={() => { setShowLoadStock(false); load() }}
          />
        )}

        {showSettlement && (
          <CreateSettlementModal
            vehicles={vehiclesForOps}
            onClose={() => setShowSettlement(false)}
            onCreated={() => {
              setShowSettlement(false)
              load()
            }}
          />
        )}

        {showVanSale && (
          <DesktopVanSaleModal
            vehicles={vehiclesForOps.length ? vehiclesForOps : rows}
            dealers={dealersForSale}
            onClose={() => setShowVanSale(false)}
            onCreated={() => {
              setShowVanSale(false)
              toast.success('Van sale posted')
            }}
          />
        )}

        {assignVehicle && (
          <AssignVehicleRepModal
            vehicle={assignVehicle}
            onClose={() => setAssignVehicle(null)}
            onSaved={() => {
              setAssignVehicle(null)
              load()
            }}
          />
        )}

        {settlementDetail && (
          <SettlementDetailModal
            id={String(settlementDetail.id)}
            initial={settlementDetail}
            onClose={() => setSettlementDetail(null)}
            onChanged={load}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

function CreateVehicleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const branchId = useActiveBranchId()
  const [saving, setSaving] = useState(false)
  const [plateNumber, setPlate] = useState('')
  const [name, setName] = useState('')
  const [reps, setReps] = useState<AnyRow[]>([])
  const [assignedRepUserId, setAssignedRepUserId] = useState('')

  useEffect(() => {
    wholesaleApi
      .reps({ limit: '200' })
      .then((res) => setReps(asRows(res).filter((r) => r.isActive !== false)))
      .catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plateNumber.trim()) {
      toast.error('Plate number required')
      return
    }
    if (!branchId) {
      toast.error('Select an active branch (home depot)')
      return
    }
    setSaving(true)
    try {
      await wholesaleApi.createVehicle({
        plateNumber: plateNumber.trim(),
        name: name.trim() || plateNumber.trim(),
        homeBranchId: branchId,
        assignedRepUserId: assignedRepUserId || null,
      })
      toast.success('Vehicle created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="Add vehicle" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Plate number
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={plateNumber}
            onChange={(e) => setPlate(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Display name
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Assign sales rep (optional)
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={assignedRepUserId}
            onChange={(e) => setAssignedRepUserId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {reps.map((r) => {
              const u = r.user as { id?: string; name?: string; email?: string }
              return (
                <option key={String(r.id)} value={String(u?.id ?? '')}>
                  {u?.name || u?.email || String(r.id)}
                </option>
              )
            })}
          </select>
        </label>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Home depot = current branch. A vehicle stock branch is created automatically.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function CreateRepModal({
  vehicles,
  existingRepUserIds,
  branchId,
  onClose,
  onCreated,
}: {
  vehicles: AnyRow[]
  existingRepUserIds: string[]
  branchId: string | null | undefined
  onClose: () => void
  onCreated: () => void
}) {
  const [mode, setMode] = useState<'new' | 'link'>('new')
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<Array<{ id: string; name: string; email: string; role: string }>>([])
  const [userId, setUserId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    usersApi
      .list({ limit: '200' })
      .then((res) => {
        const list = ((res as { data?: unknown }).data ?? res) as unknown
        const arr = Array.isArray(list) ? list : []
        const mapped = arr
          .filter((u): u is Record<string, unknown> => !!u && typeof u === 'object')
          .map((u) => ({
            id: String(u.id),
            name: String(u.name ?? ''),
            email: String(u.email ?? ''),
            role: String(u.role ?? ''),
          }))
          .filter((u) => u.role !== 'PLATFORM_ADMIN' && !existingRepUserIds.includes(u.id))
        setStaff(mapped)
        if (mapped[0]) setUserId(mapped[0].id)
      })
      .catch(() => {})
  }, [existingRepUserIds])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      let uid = userId
      if (mode === 'new') {
        if (!name.trim() || !email.trim() || password.length < 8) {
          toast.error('Name, email and password (8+) required')
          setSaving(false)
          return
        }
        if (!branchId) {
          toast.error('Select an active branch')
          setSaving(false)
          return
        }
        const created = await usersApi.create({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: 'CASHIER',
          branchIds: [branchId],
        })
        const data = (created as { data?: { id?: string } }).data
        uid = String(data?.id ?? (created as { id?: string }).id ?? '')
        if (!uid) throw new Error('User created but id missing')
      } else if (!uid) {
        toast.error('Select a staff user')
        setSaving(false)
        return
      }

      await wholesaleApi.createRep({
        userId: uid,
        defaultVehicleId: vehicleId || null,
        monthlyTarget: target ? Number(target) : null,
        isActive: true,
      })
      toast.success('Sales rep created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="Add sales rep" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`text-xs px-2.5 py-1 rounded-lg border ${mode === 'new' ? 'bg-sky-600 text-white border-sky-600' : ''}`}
            style={mode === 'new' ? undefined : { borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            New login
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`text-xs px-2.5 py-1 rounded-lg border ${mode === 'link' ? 'bg-sky-600 text-white border-sky-600' : ''}`}
            style={mode === 'link' ? undefined : { borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            Link existing staff
          </button>
        </div>

        {mode === 'new' ? (
          <>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Name
              <input className={`${fieldClass()} mt-1`} style={fieldStyle()} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Email (login)
              <input type="email" className={`${fieldClass()} mt-1`} style={fieldStyle()} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Password
              <input type="password" className={`${fieldClass()} mt-1`} style={fieldStyle()} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Creates a Cashier login with van sell / collect permissions, then links a rep profile.
            </p>
          </>
        ) : (
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Staff user
            <select className={`${fieldClass()} mt-1`} style={fieldStyle()} value={userId} onChange={(e) => setUserId(e.target.value)} required>
              {staff.length === 0 && <option value="">No eligible staff</option>}
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.email} ({u.role})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Default vehicle (optional)
          <select className={`${fieldClass()} mt-1`} style={fieldStyle()} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">None</option>
            {vehicles.map((v) => (
              <option key={String(v.id)} value={String(v.id)}>
                {String(v.plateNumber ?? v.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Monthly target (optional)
          <input type="number" min={0} className={`${fieldClass()} mt-1`} style={fieldStyle()} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>

        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          An HR Employee is linked automatically so van invoices appear under HR → Commission (Van / wholesale rep source).
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60">
            {saving ? 'Saving…' : 'Create rep'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function CreateTripModal({
  dealers,
  onClose,
  onCreated,
}: {
  dealers: WholesaleDealer[]
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId) { toast.error('Select a dealer'); return }
    setSaving(true)
    try {
      await wholesaleApi.createTrip({ stops: [{ dealerId }] })
      toast.success('Trip created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="New delivery trip" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dealer (first stop)
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            required
          >
            {dealers.length === 0 && <option value="">No dealers</option>}
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tradingName || d.legalName} ({d.dealerCode})
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create trip'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function PodModal({
  tripId,
  stopId,
  onClose,
  onSaved,
}: {
  tripId: string
  stopId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [outcome, setOutcome] = useState<'ACCEPT' | 'PARTIAL' | 'REJECT'>('ACCEPT')
  const [cod, setCod] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await wholesaleApi.podStop(tripId, stopId, {
        outcome,
        ...(cod ? { codAmount: Number(cod) } : {}),
      })
      toast.success('POD recorded')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="Proof of delivery" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Outcome
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          >
            <option value="ACCEPT">Accept</option>
            <option value="PARTIAL">Partial</option>
            <option value="REJECT">Reject</option>
          </select>
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          COD amount (optional)
          <input
            type="number"
            min={0}
            step="any"
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={cod}
            onChange={(e) => setCod(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Record POD'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function BindDispatchImeiModal({
  dispatch,
  onClose,
  onSaved,
}: {
  dispatch: AnyRow
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const lines = useMemo(
    () => (dispatch.lines as Array<{ id: string; productName?: string; quantity?: number }> | undefined) ?? [],
    [dispatch],
  )
  const [lineId, setLineId] = useState(String(lines[0]?.id ?? ''))
  const [imei, setImei] = useState('')

  useEffect(() => {
    if (!lineId && lines[0]?.id) setLineId(String(lines[0].id))
  }, [lines, lineId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lineId) { toast.error('Select a line'); return }
    if (imei.trim().length < 8) { toast.error('IMEI must be at least 8 characters'); return }
    setSaving(true)
    try {
      await wholesaleApi.bindDispatchImei(String(dispatch.id), {
        dispatchLineId: lineId,
        imei: imei.trim(),
      })
      toast.success('IMEI bound')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell
      title={`Bind IMEI · ${String(dispatch.dispatchNumber ?? dispatch.id)}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dispatch line
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            required
          >
            {lines.length === 0 && <option value="">No lines</option>}
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.productName || l.id} × {l.quantity ?? 1}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          IMEI
          <input
            className={`${fieldClass()} mt-1 font-mono`}
            style={fieldStyle()}
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="Scan or type IMEI"
            autoFocus
            required
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Bind'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function CreateReturnModal({
  dealers,
  branchId,
  onClose,
  onCreated,
}: {
  dealers: WholesaleDealer[]
  branchId: string | null | undefined
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [productName, setProductName] = useState('')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (product) setProductName(product.name)
  }, [product])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId) { toast.error('Select a dealer'); return }
    if (!branchId) { toast.error('Select an active branch first'); return }
    if (!product?.id && !productName.trim()) { toast.error('Product required'); return }
    const quantity = Number(qty)
    if (!(quantity > 0)) { toast.error('Qty must be positive'); return }
    setSaving(true)
    try {
      await wholesaleApi.createReturn({
        dealerId,
        branchId,
        reason: reason.trim() || null,
        lines: [
          {
            productId: product?.id || null,
            productName: (productName.trim() || product?.name || 'Item').trim(),
            sku: product?.sku ?? null,
            quantity,
          },
        ],
      })
      toast.success('RMA created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="New RMA" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dealer
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            required
          >
            {dealers.length === 0 && <option value="">No dealers</option>}
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tradingName || d.legalName} ({d.dealerCode})
              </option>
            ))}
          </select>
        </label>
        <ProductSearchField selected={product} onSelect={setProduct} />
        {!product && (
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Product / description
            <input
              className={`${fieldClass()} mt-1`}
              style={fieldStyle()}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Type-C cable 1m"
              required
            />
          </label>
        )}
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Qty
          <input
            type="number"
            min={0.001}
            step="any"
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Reason
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged / wrong item / …"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create RMA'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function AssignVehicleRepModal({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: AnyRow
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [reps, setReps] = useState<AnyRow[]>([])
  const current = (vehicle.assignedRepUser as { id?: string } | undefined)?.id ?? ''
  const [repUserId, setRepUserId] = useState(current)

  useEffect(() => {
    wholesaleApi
      .reps({ limit: '200' })
      .then((res) => {
        const list = asRows(res).filter((r) => r.isActive !== false)
        setReps(list)
      })
      .catch((e: Error) => toast.error(e.message))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await wholesaleApi.updateVehicle(String(vehicle.id), {
        assignedRepUserId: repUserId || null,
      })
      // Keep rep profile default vehicle in sync when assigning
      if (repUserId) {
        const match = reps.find((r) => String((r.user as { id?: string })?.id) === repUserId)
        if (match?.id) {
          try {
            await wholesaleApi.updateRep(String(match.id), { defaultVehicleId: String(vehicle.id) })
          } catch {
            // best-effort sync of rep default vehicle
          }
        }
      }
      toast.success(repUserId ? 'Rep assigned to vehicle' : 'Rep unassigned')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell
      title={`Assign rep · ${String(vehicle.plateNumber ?? vehicle.name)}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Sales rep
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={repUserId}
            onChange={(e) => setRepUserId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {reps.map((r) => {
              const u = r.user as { id?: string; name?: string; email?: string }
              return (
                <option key={String(r.id)} value={String(u?.id ?? '')}>
                  {u?.name || u?.email || String(r.id)}
                </option>
              )
            })}
          </select>
        </label>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Add sales reps under the Reps tab first if the list is empty.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function CreateSettlementModal({
  vehicles,
  onClose,
  onCreated,
}: {
  vehicles: AnyRow[]
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [vehicleId, setVehicleId] = useState(String(vehicles[0]?.id ?? ''))
  const [declaredCash, setDeclaredCash] = useState('0')
  const [notes, setNotes] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleId) { toast.error('Select a vehicle'); return }
    setSaving(true)
    try {
      const vehicle = vehicles.find((v) => String(v.id) === vehicleId)
      const repUserId =
        (vehicle?.assignedRepUser as { id?: string } | undefined)?.id ||
        (vehicle?.assignedRepUserId as string | undefined) ||
        undefined
      await wholesaleApi.createSettlement({
        vehicleId,
        repUserId: repUserId || undefined,
        declaredCash: Number(declaredCash) || 0,
        notes: notes.trim() || null,
      })
      toast.success('Settlement created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="New van settlement" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Vehicle
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            required
          >
            {vehicles.length === 0 && <option value="">No vehicles</option>}
            {vehicles.map((v) => (
              <option key={String(v.id)} value={String(v.id)}>
                {String(v.plateNumber ?? v.name ?? v.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Declared cash
          <input
            type="number"
            min={0}
            step="any"
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={declaredCash}
            onChange={(e) => setDeclaredCash(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Notes
          <input
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function DesktopVanSaleModal({
  vehicles,
  dealers,
  onClose,
  onCreated,
}: {
  vehicles: AnyRow[]
  dealers: WholesaleDealer[]
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [vehicleId, setVehicleId] = useState(String(vehicles[0]?.id ?? ''))
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [qty, setQty] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [cash, setCash] = useState('')
  const [method, setMethod] = useState('CASH')

  useEffect(() => {
    if (product?.wholesalePrice != null) setUnitPrice(String(product.wholesalePrice))
  }, [product])

  useEffect(() => {
    if (!dealerId && dealers[0]?.id) setDealerId(dealers[0].id)
  }, [dealers, dealerId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleId || !dealerId) { toast.error('Vehicle and dealer required'); return }
    if (!product?.id) { toast.error('Select a product'); return }
    const quantity = Number(qty)
    const price = Number(unitPrice)
    const payAmt = Number(cash)
    if (!(quantity > 0)) { toast.error('Qty must be positive'); return }
    if (!(payAmt > 0)) { toast.error('Payment amount required'); return }
    setSaving(true)
    try {
      await wholesaleApi.vanSale({
        vehicleId,
        dealerId,
        lines: [
          {
            productId: product.id,
            quantity,
            unitPrice: price >= 0 ? price : 0,
            sellUnit: 'PIECE',
          },
        ],
        payments: [{ method, amount: payAmt }],
      })
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="Desktop van sale" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Vehicle
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            required
          >
            {vehicles.map((v) => (
              <option key={String(v.id)} value={String(v.id)}>
                {String(v.plateNumber ?? v.name ?? v.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Dealer
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            required
          >
            {dealers.length === 0 && <option value="">Loading dealers…</option>}
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tradingName || d.legalName} ({d.dealerCode})
              </option>
            ))}
          </select>
        </label>
        <ProductSearchField selected={product} onSelect={setProduct} required />
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Qty
            <input type="number" min={0.001} step="any" className={`${fieldClass()} mt-1`} style={fieldStyle()} value={qty} onChange={(e) => setQty(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Unit price
            <input type="number" min={0} step="any" className={`${fieldClass()} mt-1`} style={fieldStyle()} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </label>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Paid
            <input type="number" min={0.01} step="any" className={`${fieldClass()} mt-1`} style={fieldStyle()} value={cash} onChange={(e) => setCash(e.target.value)} required />
          </label>
        </div>
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Payment method
          <select className={`${fieldClass()} mt-1`} style={fieldStyle()} value={method} onChange={(e) => setMethod(e.target.value)}>
            {['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT', 'CHEQUE', 'UPI'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-emerald-600 disabled:opacity-60">
            {saving ? 'Posting…' : 'Post van sale'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

function LoadStockModal({
  vehicles,
  onClose,
  onLoaded,
}: {
  vehicles: AnyRow[]
  onClose: () => void
  onLoaded: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [vehicleId, setVehicleId] = useState(String(vehicles[0]?.id ?? ''))
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [qty, setQty] = useState('1')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleId) { toast.error('Select a vehicle'); return }
    if (!product?.id) { toast.error('Select a product'); return }
    const quantity = Number(qty)
    if (!(quantity > 0) || !Number.isInteger(quantity)) {
      toast.error('Qty must be a positive whole number')
      return
    }
    setSaving(true)
    try {
      await wholesaleApi.vanLoad({
        vehicleId,
        lines: [{ productId: product.id, quantity }],
      })
      toast.success('Stock loaded')
      onLoaded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="Load stock to vehicle" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Vehicle
          <select
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            required
          >
            {vehicles.length === 0 && <option value="">No vehicles</option>}
            {vehicles.map((v) => (
              <option key={String(v.id)} value={String(v.id)}>
                {String(v.plateNumber ?? v.name ?? v.id)}
              </option>
            ))}
          </select>
        </label>
        <ProductSearchField selected={product} onSelect={setProduct} required />
        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Qty (pieces)
          <input
            type="number"
            min={1}
            step={1}
            className={`${fieldClass()} mt-1`}
            style={fieldStyle()}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
          >
            {saving ? 'Loading…' : 'Load stock'}
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}
