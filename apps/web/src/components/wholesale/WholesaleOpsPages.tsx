'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check, ClipboardList, FileText, Loader2, Package, Plus, Truck,
  RotateCcw, Wallet, BarChart3, MapPin, Building2, Users, ShoppingCart,
  SlidersHorizontal, ChevronRight, ArrowUpDown, CreditCard,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { formatCurrency, formatDate } from '@/lib/utils'
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

const QUOTE_SEGMENTS = [
  { key: 'all', label: 'All quotes' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ISSUED', label: 'Issued' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'EXPIRED', label: 'Expired' },
] as const

function quoteStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'ACCEPTED' || s === 'ISSUED') {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  }
  if (s === 'DRAFT') return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  if (s === 'REJECTED' || s === 'EXPIRED') {
    return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  }
  return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
}

export function WholesaleQuotationsPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [segment, setSegment] = useState<(typeof QUOTE_SEGMENTS)[number]['key']>('all')
  const [textSearch, setTextSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .quotations({ limit: '200' })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500', isActive: 'true' })
      .then((r) => setDealers(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (canEdit) setShowCreate(true)
      else viewOnlyToast('quotations')
    }
    const q = params.get('q')
    if (q) setTextSearch(q)
    const id = params.get('id')
    if (id) setDetailId(id)
    const st = params.get('status')
    if (st && QUOTE_SEGMENTS.some((s) => s.key === st)) {
      setSegment(st as (typeof QUOTE_SEGMENTS)[number]['key'])
    }
  }, [canEdit])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openDetail = useCallback((id: string) => setDetailId(id), [])

  const activeSeg = QUOTE_SEGMENTS.find((s) => s.key === segment) ?? QUOTE_SEGMENTS[0]

  const filtered = useMemo(() => {
    let list = rows
    if (segment !== 'all') list = list.filter((r) => String(r.status) === segment)

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const num = String(r.quoteNumber ?? r.number ?? '')
        return num.toLowerCase().includes(q) || dealerLabel(r).toLowerCase().includes(q)
      })
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'amount') return Number(b.total ?? 0) - Number(a.total ?? 0)
      if (sortBy === 'amountAsc') return Number(a.total ?? 0) - Number(b.total ?? 0)
      if (sortBy === 'dealer') return dealerLabel(a).localeCompare(dealerLabel(b))
      const ad = new Date(String(a.createdAt ?? a.issuedAt ?? 0)).getTime()
      const bd = new Date(String(b.createdAt ?? b.issuedAt ?? 0)).getTime()
      return bd - ad
    })
  }, [rows, segment, textSearch, sortBy])

  const hasActiveFilters =
    segment !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setSegment('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const draftCount = rows.filter((r) => r.status === 'DRAFT').length
  const issuedCount = rows.filter((r) => r.status === 'ISSUED').length
  const acceptedCount = rows.filter((r) => r.status === 'ACCEPTED').length
  const pipelineValue = rows
    .filter((r) => r.status === 'DRAFT' || r.status === 'ISSUED')
    .reduce((s, r) => s + Number(r.total ?? 0), 0)

  const act = useCallback(
    async (id: string, fn: () => Promise<unknown>, ok: string) => {
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
    },
    [canEdit, load],
  )

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'quoteNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Quote" />,
        cell: ({ row }) => {
          const r = row.original
          const num = String(r.quoteNumber ?? '—')
          const dealer = dealerLabel(r)
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/20 flex items-center justify-center text-sm font-bold text-sky-600 dark:text-sky-300 flex-shrink-0">
                <FileText size={14} />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors font-mono"
                  onClick={() => openDetail(String(r.id))}
                >
                  {num}
                </button>
                <p className="flex items-center gap-1 text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  <Building2 size={9} />
                  {dealer}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {dealerLabel(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {formatCurrency(Number(row.original.total ?? 0))}
          </span>
        ),
      },
      {
        id: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const d = row.original.issuedAt ?? row.original.createdAt
          return (
            <span className="text-xs font-medium text-gray-500 dark:text-slate-500">
              {d ? formatDate(String(d)) : '—'}
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? '—')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${quoteStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const st = String(r.status ?? '')
          const busy = busyId === id
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && st === 'DRAFT' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.issueQuotation(id), 'Issued')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                >
                  Issue
                </button>
              )}
              {canEdit && st === 'ISSUED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(id, () => wholesaleApi.acceptQuotation(id), 'Accepted → order')
                  }
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                >
                  Accept
                </button>
              )}
              <TableActionsRow showAction={{ action: () => openDetail(id) }} />
            </div>
          )
        },
      },
    ],
    [act, busyId, canEdit, openDetail],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
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
          <QuotationDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
        )}

        {/* Header — Dealers style */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Quotations</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {filtered.length} of {rows.length} shown ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              ) : (
                <>
                  {issuedCount} issued · {rows.length} total ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/wholesale/dealers"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Building2 size={14} />
              Dealers
            </Link>
            <Link
              href="/dashboard/wholesale/orders"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <ClipboardList size={14} />
              Orders
            </Link>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              Segment
              {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Filter by status
                </p>
                {QUOTE_SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSegment(s.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      segment === s.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {s.key === 'all'
                          ? rows.length
                          : rows.filter((r) => String(r.status) === s.key).length}
                      </span>
                      {segment === s.key && <ChevronRight size={12} className="text-sky-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                New quote
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Draft', value: draftCount.toString(), icon: FileText, color: 'amber' },
            { label: 'Issued', value: issuedCount.toString(), icon: Check, color: 'sky' },
            { label: 'Accepted', value: acceptedCount.toString(), icon: ClipboardList, color: 'emerald' },
            {
              label: 'Pipeline value',
              value: formatCurrency(pipelineValue),
              icon: CreditCard,
              color: 'violet',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch
            value={textSearch}
            onChange={setTextSearch}
            placeholder="Search quote # or dealer…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {QUOTE_SEGMENTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSegment(s.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  segment === s.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <FilterDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Newest first' },
              { value: 'amount', label: 'Amount (high)' },
              { value: 'amountAsc', label: 'Amount (low)' },
              { value: 'dealer', label: 'Dealer A–Z' },
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {rows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
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
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Orders ─────────────────────────────────────────────────────────── */

const ORDER_SEGMENTS = [
  { key: 'all', label: 'All orders' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'ON_HOLD', label: 'On hold' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'FULFILLED', label: 'Fulfilled' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

function orderStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'CONFIRMED' || s === 'FULFILLED') {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  }
  if (s === 'DRAFT' || s === 'SUBMITTED' || s === 'PARTIAL') {
    return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  }
  if (s === 'ON_HOLD') return 'bg-violet-500/10 border-violet-500/25 text-violet-500'
  if (s === 'CANCELLED' || s === 'CLOSED') {
    return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  }
  return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
}

export function WholesaleOrdersPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [segment, setSegment] = useState<(typeof ORDER_SEGMENTS)[number]['key']>('all')
  const [textSearch, setTextSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .orders({ limit: '200' })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500', isActive: 'true' })
      .then((r) => setDealers(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (canEdit) setShowCreate(true)
      else viewOnlyToast('orders')
    }
    const q = params.get('q')
    if (q) setTextSearch(q)
    const id = params.get('id')
    if (id) setDetailId(id)
    const st = params.get('status')
    if (st && ORDER_SEGMENTS.some((s) => s.key === st)) {
      setSegment(st as (typeof ORDER_SEGMENTS)[number]['key'])
    }
  }, [canEdit])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openDetail = useCallback((id: string) => setDetailId(id), [])

  const activeSeg = ORDER_SEGMENTS.find((s) => s.key === segment) ?? ORDER_SEGMENTS[0]

  const filtered = useMemo(() => {
    let list = rows
    if (segment !== 'all') list = list.filter((r) => String(r.status) === segment)

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const num = String(r.orderNumber ?? '')
        return num.toLowerCase().includes(q) || dealerLabel(r).toLowerCase().includes(q)
      })
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'amount') return Number(b.total ?? 0) - Number(a.total ?? 0)
      if (sortBy === 'amountAsc') return Number(a.total ?? 0) - Number(b.total ?? 0)
      if (sortBy === 'dealer') return dealerLabel(a).localeCompare(dealerLabel(b))
      const ad = new Date(String(a.createdAt ?? a.confirmedAt ?? 0)).getTime()
      const bd = new Date(String(b.createdAt ?? b.confirmedAt ?? 0)).getTime()
      return bd - ad
    })
  }, [rows, segment, textSearch, sortBy])

  const hasActiveFilters =
    segment !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setSegment('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const draftCount = rows.filter((r) => r.status === 'DRAFT').length
  const openCount = rows.filter((r) =>
    ['SUBMITTED', 'ON_HOLD', 'CONFIRMED', 'PARTIAL'].includes(String(r.status)),
  ).length
  const confirmedCount = rows.filter((r) => r.status === 'CONFIRMED' || r.status === 'PARTIAL').length
  const openValue = rows
    .filter((r) => !['FULFILLED', 'CANCELLED', 'CLOSED'].includes(String(r.status)))
    .reduce((s, r) => s + Number(r.total ?? 0), 0)

  const act = useCallback(
    async (id: string, fn: () => Promise<unknown>, ok: string) => {
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
    },
    [canEdit, load],
  )

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'orderNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
        cell: ({ row }) => {
          const r = row.original
          const num = String(r.orderNumber ?? '—')
          const dealer = dealerLabel(r)
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 flex-shrink-0">
                <ClipboardList size={14} />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors font-mono"
                  onClick={() => openDetail(String(r.id))}
                >
                  {num}
                </button>
                <p className="flex items-center gap-1 text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  <Building2 size={9} />
                  {dealer}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {dealerLabel(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {formatCurrency(Number(row.original.total ?? 0))}
          </span>
        ),
      },
      {
        id: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const d = row.original.confirmedAt ?? row.original.createdAt
          return (
            <span className="text-xs font-medium text-gray-500 dark:text-slate-500">
              {d ? formatDate(String(d)) : '—'}
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? '—')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${orderStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const st = String(r.status ?? '')
          const busy = busyId === id
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && st === 'DRAFT' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.submitOrder(id), 'Submitted')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                >
                  Submit
                </button>
              )}
              {canEdit && (st === 'SUBMITTED' || st === 'ON_HOLD') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(id, () => wholesaleApi.confirmOrder(id), 'Confirmed & reserved')
                  }
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                >
                  Confirm
                </button>
              )}
              {canEdit && st === 'CONFIRMED' && (
                <Link
                  href="/dashboard/wholesale/warehouse"
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-violet-600/15 text-violet-500 border border-violet-500/25 hover:bg-violet-600/25"
                >
                  Pick
                </Link>
              )}
              <TableActionsRow showAction={{ action: () => openDetail(id) }} />
            </div>
          )
        },
      },
    ],
    [act, busyId, canEdit, openDetail],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Sales orders</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {filtered.length} of {rows.length} shown ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              ) : (
                <>
                  {openCount} open · {rows.length} total ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/wholesale/quotations"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <FileText size={14} />
              Quotes
            </Link>
            <Link
              href="/dashboard/wholesale/warehouse"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Package size={14} />
              Warehouse
            </Link>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              Segment
              {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Filter by status
                </p>
                {ORDER_SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSegment(s.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      segment === s.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {s.key === 'all'
                          ? rows.length
                          : rows.filter((r) => String(r.status) === s.key).length}
                      </span>
                      {segment === s.key && <ChevronRight size={12} className="text-sky-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                New order
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Draft', value: draftCount.toString(), icon: FileText, color: 'amber' },
            { label: 'Open pipeline', value: openCount.toString(), icon: ClipboardList, color: 'sky' },
            { label: 'To pick', value: confirmedCount.toString(), icon: Package, color: 'violet' },
            {
              label: 'Open value',
              value: formatCurrency(openValue),
              icon: CreditCard,
              color: 'emerald',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch
            value={textSearch}
            onChange={setTextSearch}
            placeholder="Search order # or dealer…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {ORDER_SEGMENTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSegment(s.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  segment === s.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <FilterDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Newest first' },
              { value: 'amount', label: 'Amount (high)' },
              { value: 'amountAsc', label: 'Amount (low)' },
              { value: 'dealer', label: 'Dealer A–Z' },
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {rows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
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
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Warehouse ──────────────────────────────────────────────────────── */

const WAREHOUSE_TABS = [
  { key: 'queue', label: 'Pick queue' },
  { key: 'picks', label: 'Pick lists' },
  { key: 'dispatches', label: 'Dispatches' },
] as const

type WarehouseTab = (typeof WAREHOUSE_TABS)[number]['key']

const PICK_STATUS_SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

const DISPATCH_STATUS_SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'DISPATCHED', label: 'Dispatched' },
] as const

function whStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'COMPLETED' || s === 'DISPATCHED' || s === 'CONFIRMED' || s === 'FULFILLED') {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  }
  if (s === 'DRAFT' || s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'PARTIAL') {
    return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  }
  if (s === 'CANCELLED') return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
}

export function WholesaleWarehousePage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [tab, setTab] = useState<WarehouseTab>('queue')
  const [queueRows, setQueueRows] = useState<AnyRow[]>([])
  const [pickRows, setPickRows] = useState<AnyRow[]>([])
  const [dispatchRows, setDispatchRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bindDispatch, setBindDispatch] = useState<AnyRow | null>(null)
  const [detailPickId, setDetailPickId] = useState<string | null>(null)
  const [detailDispatchId, setDetailDispatchId] = useState<string | null>(null)
  const [textSearch, setTextSearch] = useState('')
  const [statusSeg, setStatusSeg] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      wholesaleApi.pickQueue({ limit: '200' }),
      wholesaleApi.pickLists({ limit: '200' }),
      wholesaleApi.dispatches({ limit: '200' }),
    ])
      .then(([q, p, d]) => {
        setQueueRows(asRows(q))
        setPickRows(asRows(p))
        setDispatchRows(asRows(d))
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    setStatusSeg('all')
    setTextSearch('')
    setSortBy('recent')
  }, [tab])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t === 'queue' || t === 'picks' || t === 'dispatches') setTab(t)
    const id = params.get('id')
    if (!id) return
    if (t === 'dispatches' || (!t && params.get('type') === 'dispatch')) setDetailDispatchId(id)
    else if (t === 'picks' || !t) setDetailPickId(id)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeTab = WAREHOUSE_TABS.find((t) => t.key === tab) ?? WAREHOUSE_TABS[0]
  const statusOptions =
    tab === 'picks' ? PICK_STATUS_SEGMENTS : tab === 'dispatches' ? DISPATCH_STATUS_SEGMENTS : null

  const sourceRows =
    tab === 'queue' ? queueRows : tab === 'picks' ? pickRows : dispatchRows

  const filtered = useMemo(() => {
    let list = sourceRows
    if (statusSeg !== 'all' && tab !== 'queue') {
      list = list.filter((r) => String(r.status) === statusSeg)
    }

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const num = String(
          r.orderNumber ?? r.pickNumber ?? r.dispatchNumber ?? r.id ?? '',
        ).toLowerCase()
        const dealer = dealerLabel(r).toLowerCase()
        return num.includes(q) || dealer.includes(q) || JSON.stringify(r).toLowerCase().includes(q)
      })
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'status') {
        return String(a.status ?? '').localeCompare(String(b.status ?? ''))
      }
      if (sortBy === 'dealer') return dealerLabel(a).localeCompare(dealerLabel(b))
      const ad = new Date(String(a.createdAt ?? a.completedAt ?? a.confirmedAt ?? 0)).getTime()
      const bd = new Date(String(b.createdAt ?? b.completedAt ?? b.confirmedAt ?? 0)).getTime()
      return bd - ad
    })
  }, [sourceRows, statusSeg, tab, textSearch, sortBy])

  const hasActiveFilters =
    statusSeg !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setStatusSeg('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const openPicks = pickRows.filter((r) =>
    ['DRAFT', 'ASSIGNED', 'IN_PROGRESS'].includes(String(r.status)),
  ).length
  const completedPicks = pickRows.filter((r) => r.status === 'COMPLETED').length
  const draftDns = dispatchRows.filter((r) => r.status === 'DRAFT').length

  const act = useCallback(
    async (id: string, fn: () => Promise<unknown>, ok: string, after?: () => void) => {
      if (!canEdit) {
        viewOnlyToast('warehouse')
        return
      }
      setBusyId(id)
      try {
        await fn()
        toast.success(ok)
        after?.()
        load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusyId(null)
      }
    },
    [canEdit, load],
  )

  const createPick = (orderId: string) =>
    void act(orderId, () => wholesaleApi.createPickList({ salesOrderId: orderId }), 'Pick list created', () =>
      setTab('picks'),
    )

  const pickAll = async (row: AnyRow) => {
    if (!canEdit) return viewOnlyToast('warehouse')
    const id = String(row.id)
    setBusyId(id)
    try {
      let lines =
        (row.lines as Array<{ id: string; quantity: number; pickedQty?: number }> | undefined) ?? []
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

  const columns = useMemo<ColumnDef<AnyRow>[]>(() => {
    if (tab === 'queue') {
      return [
        {
          accessorKey: 'orderNumber',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
          cell: ({ row }) => {
            const r = row.original
            const num = String(r.orderNumber ?? r.id)
            return (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={14} className="text-amber-600 dark:text-amber-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 truncate">
                    {num}
                  </p>
                  <p className="flex items-center gap-1 text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    <Building2 size={9} />
                    {dealerLabel(r)}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          id: 'dealer',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
          cell: ({ row }) => (
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              {dealerLabel(row.original)}
            </span>
          ),
        },
        {
          id: 'status',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) => {
            const st = String(row.original.status ?? '—')
            return (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${whStatusPill(st)}`}
              >
                {st.replace(/_/g, ' ')}
              </span>
            )
          },
        },
        {
          id: 'date',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Confirmed" />,
          cell: ({ row }) => {
            const d = row.original.confirmedAt ?? row.original.createdAt
            return (
              <span className="text-xs text-gray-500 dark:text-slate-500">
                {d ? formatDate(String(d)) : '—'}
              </span>
            )
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            const id = String(row.original.id)
            return (
              <div className="flex items-center gap-1 justify-end">
                {canEdit && (
                  <button
                    type="button"
                    disabled={busyId === id}
                    onClick={() => createPick(id)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                  >
                    Create pick
                  </button>
                )}
                <Link
                  href={`/dashboard/wholesale/orders?id=${id}`}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                >
                  Order
                </Link>
              </div>
            )
          },
        },
      ]
    }

    if (tab === 'picks') {
      return [
        {
          accessorKey: 'pickNumber',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Pick list" />,
          cell: ({ row }) => {
            const r = row.original
            const num = String(r.pickNumber ?? r.id)
            const orderNum = String(
              (r.salesOrder as { orderNumber?: string } | undefined)?.orderNumber ??
                r.salesOrderId ??
                '—',
            )
            return (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-violet-600 dark:text-violet-300" />
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors"
                    onClick={() => setDetailPickId(String(r.id))}
                  >
                    {num}
                  </button>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    Order {orderNum}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          id: 'status',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) => {
            const st = String(row.original.status ?? '—')
            return (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${whStatusPill(st)}`}
              >
                {st.replace(/_/g, ' ')}
              </span>
            )
          },
        },
        {
          id: 'date',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
          cell: ({ row }) => {
            const d = row.original.completedAt ?? row.original.createdAt
            return (
              <span className="text-xs text-gray-500 dark:text-slate-500">
                {d ? formatDate(String(d)) : '—'}
              </span>
            )
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            const r = row.original
            const id = String(r.id)
            const st = String(r.status ?? '')
            const busy = busyId === id
            return (
              <div className="flex items-center gap-1 justify-end">
                {canEdit && ['DRAFT', 'ASSIGNED', 'IN_PROGRESS'].includes(st) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pickAll(r)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    Pick all
                  </button>
                )}
                {canEdit && st !== 'COMPLETED' && st !== 'CANCELLED' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(id, () => wholesaleApi.completePick(id), 'Pick completed')
                    }
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
                {canEdit && st === 'COMPLETED' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        id,
                        () => wholesaleApi.createDispatch({ pickListId: id }),
                        'Dispatch note created',
                        () => setTab('dispatches'),
                      )
                    }
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                  >
                    Create DN
                  </button>
                )}
                <TableActionsRow showAction={{ action: () => setDetailPickId(id) }} />
              </div>
            )
          },
        },
      ]
    }

    return [
      {
        accessorKey: 'dispatchNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dispatch" />,
        cell: ({ row }) => {
          const r = row.original
          const num = String(r.dispatchNumber ?? r.id)
          const pickNum = String(
            (r.pickList as { pickNumber?: string } | undefined)?.pickNumber ?? r.pickListId ?? '—',
          )
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                <Truck size={14} className="text-sky-600 dark:text-sky-300" />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors"
                  onClick={() => setDetailDispatchId(String(r.id))}
                >
                  {num}
                </button>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  Pick {pickNum}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {dealerLabel(row.original)}
          </span>
        ),
      },
      {
        id: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? '—')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${whStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const d = row.original.confirmedAt ?? row.original.createdAt
          return (
            <span className="text-xs text-gray-500 dark:text-slate-500">
              {d ? formatDate(String(d)) : '—'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const st = String(r.status ?? '')
          const busy = busyId === id
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && st === 'DRAFT' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setBindDispatch(r)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    Bind IMEI
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(id, () => wholesaleApi.confirmDispatch(id), 'Dispatch confirmed')
                    }
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </>
              )}
              <TableActionsRow showAction={{ action: () => setDetailDispatchId(id) }} />
            </div>
          )
        },
      },
    ]
  }, [tab, busyId, canEdit, act])

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Warehouse</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {filtered.length} of {sourceRows.length} shown ·{' '}
                  <span className="text-sky-500">{activeTab.label}</span>
                </>
              ) : (
                <>
                  {queueRows.length} waiting · {openPicks} picking ·{' '}
                  <span className="text-sky-500">{activeTab.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/wholesale/orders"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <ClipboardList size={14} />
              Orders
            </Link>
            <Link
              href="/dashboard/wholesale/delivery"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Truck size={14} />
              Delivery
            </Link>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              View
              {tab !== 'queue' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Warehouse view
                </p>
                {WAREHOUSE_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      tab === t.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{t.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {t.key === 'queue'
                          ? queueRows.length
                          : t.key === 'picks'
                            ? pickRows.length
                            : dispatchRows.length}
                      </span>
                      {tab === t.key && <ChevronRight size={12} className="text-sky-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pick queue', value: queueRows.length.toString(), icon: ClipboardList, color: 'amber' },
            { label: 'Open picks', value: openPicks.toString(), icon: Package, color: 'violet' },
            { label: 'Ready for DN', value: completedPicks.toString(), icon: Check, color: 'emerald' },
            { label: 'Draft DNs', value: draftDns.toString(), icon: Truck, color: 'sky' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch
            value={textSearch}
            onChange={setTextSearch}
            placeholder={
              tab === 'queue'
                ? 'Search order # or dealer…'
                : tab === 'picks'
                  ? 'Search pick #…'
                  : 'Search DN #…'
            }
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {WAREHOUSE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  tab === t.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          {statusOptions && (
            <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
              {statusOptions.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusSeg(s.key)}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                  style={
                    statusSeg === s.key
                      ? { background: 'var(--brand-primary-light)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <FilterDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Newest first' },
              { value: 'status', label: 'Status' },
              { value: 'dealer', label: 'Dealer A–Z' },
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {sourceRows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="Nothing in this queue"
            description={
              tab === 'queue'
                ? 'Confirm a sales order to see it in the pick queue.'
                : tab === 'picks'
                  ? 'Create a pick list from a confirmed order in the pick queue.'
                  : 'Complete a pick list and create a dispatch note.'
            }
          />
        ) : (
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Delivery ───────────────────────────────────────────────────────── */

const TRIP_SEGMENTS = [
  { key: 'all', label: 'All trips' },
  { key: 'PLANNED', label: 'Planned' },
  { key: 'LOADED', label: 'Loaded' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

function tripStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'COMPLETED') return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  if (s === 'IN_PROGRESS' || s === 'STARTED' || s === 'LOADED') {
    return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
  }
  if (s === 'PLANNED' || s === 'DRAFT') {
    return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  }
  if (s === 'CANCELLED') return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  return 'bg-violet-500/10 border-violet-500/25 text-violet-500'
}

function vehicleLabel(row: AnyRow) {
  const v = row.vehicle as { plateNumber?: string; name?: string } | undefined
  return v?.plateNumber || v?.name || '—'
}

function stopCount(row: AnyRow) {
  const stops = row.stops as unknown[] | undefined
  if (Array.isArray(stops)) return stops.length
  return Number(row._count && typeof row._count === 'object'
    ? (row._count as { stops?: number }).stops ?? 0
    : 0)
}

export function WholesaleDeliveryPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [showPod, setShowPod] = useState<{ tripId: string; stopId: string } | null>(null)
  const [segment, setSegment] = useState<(typeof TRIP_SEGMENTS)[number]['key']>('all')
  const [textSearch, setTextSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .trips({ limit: '200' })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500', isActive: 'true' })
      .then((r) => setDealers(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (canEdit) setShowCreate(true)
      else viewOnlyToast('delivery')
    }
    const q = params.get('q')
    if (q) setTextSearch(q)
    const id = params.get('id')
    if (id) setDetailId(id)
    const st = params.get('status')
    if (st && TRIP_SEGMENTS.some((s) => s.key === st)) {
      setSegment(st as (typeof TRIP_SEGMENTS)[number]['key'])
    }
  }, [canEdit])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openDetail = useCallback((id: string) => setDetailId(id), [])
  const activeSeg = TRIP_SEGMENTS.find((s) => s.key === segment) ?? TRIP_SEGMENTS[0]

  const filtered = useMemo(() => {
    let list = rows
    if (segment !== 'all') list = list.filter((r) => String(r.status) === segment)

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const num = String(r.tripNumber ?? '')
        const route = String(r.routeName ?? '')
        const vehicle = vehicleLabel(r)
        const driver = String(
          (r.driver as { name?: string } | undefined)?.name ?? '',
        )
        return (
          num.toLowerCase().includes(q) ||
          route.toLowerCase().includes(q) ||
          vehicle.toLowerCase().includes(q) ||
          driver.toLowerCase().includes(q) ||
          JSON.stringify(r).toLowerCase().includes(q)
        )
      })
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'stops') return stopCount(b) - stopCount(a)
      if (sortBy === 'route') {
        return String(a.routeName ?? '').localeCompare(String(b.routeName ?? ''))
      }
      if (sortBy === 'status') {
        return String(a.status ?? '').localeCompare(String(b.status ?? ''))
      }
      const ad = new Date(String(a.plannedDate ?? a.startedAt ?? a.createdAt ?? 0)).getTime()
      const bd = new Date(String(b.plannedDate ?? b.startedAt ?? b.createdAt ?? 0)).getTime()
      return bd - ad
    })
  }, [rows, segment, textSearch, sortBy])

  const hasActiveFilters =
    segment !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setSegment('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const plannedCount = rows.filter((r) => r.status === 'PLANNED' || r.status === 'LOADED').length
  const activeCount = rows.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'STARTED').length
  const completedCount = rows.filter((r) => r.status === 'COMPLETED').length
  const totalStops = rows.reduce((s, r) => s + stopCount(r), 0)

  const act = useCallback(
    async (id: string, fn: () => Promise<unknown>, ok: string) => {
      if (!canEdit) {
        viewOnlyToast('delivery')
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
    },
    [canEdit, load],
  )

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'tripNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Trip" />,
        cell: ({ row }) => {
          const r = row.original
          const num = String(r.tripNumber ?? r.id)
          const route = String(r.routeName ?? 'No route')
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Truck size={14} className="text-emerald-600 dark:text-emerald-300" />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors"
                  onClick={() => openDetail(String(r.id))}
                >
                  {num}
                </button>
                <p className="flex items-center gap-1 text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={9} />
                  {route}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'vehicle',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Vehicle" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {vehicleLabel(row.original)}
          </span>
        ),
      },
      {
        id: 'stops',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Stops" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {stopCount(row.original)}
          </span>
        ),
      },
      {
        id: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const d = row.original.plannedDate ?? row.original.startedAt ?? row.original.createdAt
          return (
            <span className="text-xs font-medium text-gray-500 dark:text-slate-500">
              {d ? formatDate(String(d)) : '—'}
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? '—')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${tripStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const st = String(r.status ?? '')
          const busy = busyId === id
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && (st === 'PLANNED' || st === 'LOADED' || st === 'DRAFT') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.startTrip(id), 'Trip started')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                >
                  Start
                </button>
              )}
              {canEdit && (st === 'IN_PROGRESS' || st === 'STARTED') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.completeTrip(id), 'Trip completed')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                >
                  Complete
                </button>
              )}
              <TableActionsRow showAction={{ action: () => openDetail(id) }} />
            </div>
          )
        },
      },
    ],
    [act, busyId, canEdit, openDetail],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
        {showCreate && (
          <CreateTripModal
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Wholesale delivery</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {filtered.length} of {rows.length} shown ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              ) : (
                <>
                  {activeCount} on road · {rows.length} total ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/wholesale/warehouse"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Package size={14} />
              Warehouse
            </Link>
            <Link
              href="/dashboard/wholesale/orders"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <ClipboardList size={14} />
              Orders
            </Link>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              Segment
              {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Filter by status
                </p>
                {TRIP_SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSegment(s.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      segment === s.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {s.key === 'all'
                          ? rows.length
                          : rows.filter((r) => String(r.status) === s.key).length}
                      </span>
                      {segment === s.key && <ChevronRight size={12} className="text-sky-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                New trip
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ready to start', value: plannedCount.toString(), icon: MapPin, color: 'amber' },
            { label: 'On the road', value: activeCount.toString(), icon: Truck, color: 'sky' },
            { label: 'Completed', value: completedCount.toString(), icon: Check, color: 'emerald' },
            { label: 'Total stops', value: totalStops.toString(), icon: Building2, color: 'violet' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch
            value={textSearch}
            onChange={setTextSearch}
            placeholder="Search trip #, route, vehicle…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {TRIP_SEGMENTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSegment(s.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  segment === s.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <FilterDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Newest first' },
              { value: 'stops', label: 'Most stops' },
              { value: 'route', label: 'Route A–Z' },
              { value: 'status', label: 'Status' },
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {rows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
        </div>

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
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Returns ────────────────────────────────────────────────────────── */

const RETURN_SEGMENTS = [
  { key: 'all', label: 'All RMAs' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'QC', label: 'QC' },
  { key: 'CREDITED', label: 'Credited' },
  { key: 'CLOSED', label: 'Closed' },
] as const

function returnStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'CREDITED' || s === 'CLOSED') {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  }
  if (s === 'DRAFT' || s === 'RECEIVED' || s === 'QC') {
    return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  }
  if (s === 'CANCELLED' || s === 'REJECTED') {
    return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  }
  return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
}

export function WholesaleReturnsPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [segment, setSegment] = useState<(typeof RETURN_SEGMENTS)[number]['key']>('all')
  const [textSearch, setTextSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .returns({ limit: '200' })
      .then((res) => setRows(asRows(res)))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500', isActive: 'true' })
      .then((r) => setDealers(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (canEdit) setShowCreate(true)
      else viewOnlyToast('returns')
    }
    const q = params.get('q')
    if (q) setTextSearch(q)
    const id = params.get('id')
    if (id) setDetailId(id)
    const st = params.get('status')
    if (st && RETURN_SEGMENTS.some((s) => s.key === st)) {
      setSegment(st as (typeof RETURN_SEGMENTS)[number]['key'])
    }
  }, [canEdit])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openDetail = useCallback((id: string) => setDetailId(id), [])
  const activeSeg = RETURN_SEGMENTS.find((s) => s.key === segment) ?? RETURN_SEGMENTS[0]

  const filtered = useMemo(() => {
    let list = rows
    if (segment !== 'all') list = list.filter((r) => String(r.status) === segment)

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const num = String(r.returnNumber ?? '')
        return (
          num.toLowerCase().includes(q) ||
          dealerLabel(r).toLowerCase().includes(q) ||
          String(r.reason ?? '').toLowerCase().includes(q) ||
          JSON.stringify(r).toLowerCase().includes(q)
        )
      })
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'amount') {
        return (
          Number(b.total ?? b.refundAmount ?? 0) - Number(a.total ?? a.refundAmount ?? 0)
        )
      }
      if (sortBy === 'amountAsc') {
        return (
          Number(a.total ?? a.refundAmount ?? 0) - Number(b.total ?? b.refundAmount ?? 0)
        )
      }
      if (sortBy === 'dealer') return dealerLabel(a).localeCompare(dealerLabel(b))
      const ad = new Date(String(a.createdAt ?? a.receivedAt ?? 0)).getTime()
      const bd = new Date(String(b.createdAt ?? b.receivedAt ?? 0)).getTime()
      return bd - ad
    })
  }, [rows, segment, textSearch, sortBy])

  const hasActiveFilters =
    segment !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setSegment('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const draftCount = rows.filter((r) => r.status === 'DRAFT').length
  const inProgressCount = rows.filter((r) =>
    ['RECEIVED', 'QC'].includes(String(r.status)),
  ).length
  const creditedCount = rows.filter((r) => r.status === 'CREDITED' || r.status === 'CLOSED').length
  const openValue = rows
    .filter((r) => !['CLOSED', 'CANCELLED'].includes(String(r.status)))
    .reduce((s, r) => s + Number(r.total ?? r.refundAmount ?? 0), 0)

  const act = useCallback(
    async (id: string, fn: () => Promise<unknown>, ok: string) => {
      if (!canEdit) {
        viewOnlyToast('returns')
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
    },
    [canEdit, load],
  )

  const columns = useMemo<ColumnDef<AnyRow>[]>(
    () => [
      {
        accessorKey: 'returnNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="RMA" />,
        cell: ({ row }) => {
          const r = row.original
          const num = String(r.returnNumber ?? r.id)
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                <RotateCcw size={14} className="text-rose-600 dark:text-rose-300" />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors"
                  onClick={() => openDetail(String(r.id))}
                >
                  {num}
                </button>
                <p className="flex items-center gap-1 text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  <Building2 size={9} />
                  {dealerLabel(r)}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'dealer',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {dealerLabel(row.original)}
          </span>
        ),
      },
      {
        id: 'value',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {formatCurrency(Number(row.original.total ?? row.original.refundAmount ?? 0))}
          </span>
        ),
      },
      {
        id: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const d = row.original.receivedAt ?? row.original.createdAt
          return (
            <span className="text-xs font-medium text-gray-500 dark:text-slate-500">
              {d ? formatDate(String(d)) : '—'}
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? '—')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${returnStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const st = String(r.status ?? '')
          const busy = busyId === id
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && st === 'DRAFT' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(id, () => wholesaleApi.approveReturn(id), 'Approved (received)')
                  }
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {canEdit && st === 'RECEIVED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.qcReturn(id), 'QC recorded')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-50"
                >
                  QC
                </button>
              )}
              {canEdit && st === 'QC' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(id, () => wholesaleApi.creditNoteReturn(id), 'Credit note issued')
                  }
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                >
                  Credit
                </button>
              )}
              <TableActionsRow showAction={{ action: () => openDetail(id) }} />
            </div>
          )
        },
      },
    ],
    [act, busyId, canEdit, openDetail],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
        {showCreate && (
          <CreateReturnModal
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
          <ReturnDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Returns / RMA</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {filtered.length} of {rows.length} shown ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              ) : (
                <>
                  {inProgressCount} in progress · {rows.length} total ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/wholesale/dealers"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Building2 size={14} />
              Dealers
            </Link>
            <Link
              href="/dashboard/wholesale/collections"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Wallet size={14} />
              Collections
            </Link>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              Segment
              {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Filter by status
                </p>
                {RETURN_SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSegment(s.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      segment === s.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {s.key === 'all'
                          ? rows.length
                          : rows.filter((r) => String(r.status) === s.key).length}
                      </span>
                      {segment === s.key && <ChevronRight size={12} className="text-sky-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                New RMA
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Draft', value: draftCount.toString(), icon: FileText, color: 'amber' },
            { label: 'In progress', value: inProgressCount.toString(), icon: RotateCcw, color: 'sky' },
            { label: 'Credited / closed', value: creditedCount.toString(), icon: Check, color: 'emerald' },
            {
              label: 'Open value',
              value: formatCurrency(openValue),
              icon: CreditCard,
              color: 'rose',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch
            value={textSearch}
            onChange={setTextSearch}
            placeholder="Search RMA #, dealer, reason…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {RETURN_SEGMENTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSegment(s.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  segment === s.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <FilterDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Newest first' },
              { value: 'amount', label: 'Value (high)' },
              { value: 'amountAsc', label: 'Value (low)' },
              { value: 'dealer', label: 'Dealer A–Z' },
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {rows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="No returns"
            description="Opened RMAs will list here for approve → QC → credit note."
          />
        ) : (
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Collections ────────────────────────────────────────────────────── */

const COLLECTION_TABS = [
  { key: 'ageing', label: 'Ageing' },
  { key: 'payments', label: 'Payments' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'statement', label: 'Statement' },
] as const

type CollectionTab = (typeof COLLECTION_TABS)[number]['key']

const TASK_STATUS_SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'DONE', label: 'Done' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

function collectionStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'DONE' || s === 'PAID' || s === 'POSTED' || s === 'COMPLETED') {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  }
  if (s === 'OPEN' || s === 'IN_PROGRESS' || s === 'PARTIAL' || s === 'PENDING') {
    return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  }
  if (s === 'CANCELLED' || s === 'OVERDUE') {
    return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  }
  return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
}

function ageingDue(row: AnyRow) {
  return Number(row.totalDue ?? row.outstanding ?? 0)
}

function asAgeingRows(res: unknown): AnyRow[] {
  const r = res as { data?: unknown }
  const d = r?.data
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const obj = d as Record<string, unknown>
    if (Array.isArray(obj.dealers)) return obj.dealers as AnyRow[]
  }
  return asRows(res)
}

export function WholesaleCollectionsPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [tab, setTab] = useState<CollectionTab>('ageing')
  const [ageingRows, setAgeingRows] = useState<AnyRow[]>([])
  const [paymentRows, setPaymentRows] = useState<AnyRow[]>([])
  const [taskRows, setTaskRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showPay, setShowPay] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [payDealerId, setPayDealerId] = useState<string | undefined>()
  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [statementDealerId, setStatementDealerId] = useState('')
  const [statement, setStatement] = useState<AnyRow | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [textSearch, setTextSearch] = useState('')
  const [statusSeg, setStatusSeg] = useState('all')
  const [sortBy, setSortBy] = useState('amount')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      wholesaleApi.ageing({ limit: '200' }),
      wholesaleApi.payments({ limit: '200' }),
      wholesaleApi.collectionTasks({ limit: '200' }),
    ])
      .then(([a, p, t]) => {
        setAgeingRows(asAgeingRows(a))
        setPaymentRows(asRows(p))
        setTaskRows(asRows(t))
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    setStatusSeg('all')
    setTextSearch('')
    setSortBy(tab === 'ageing' ? 'amount' : 'recent')
  }, [tab])

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500' })
      .then((r) => {
        const list = r.data ?? []
        setDealers(list)
        setStatementDealerId((prev) => prev || list[0]?.id || '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const dealerId = params.get('dealerId')
    if (dealerId) {
      setPayDealerId(dealerId)
      setShowPay(true)
      setStatementDealerId(dealerId)
    }
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (canEdit) setShowPay(true)
      else viewOnlyToast('collections')
    }
    const t = params.get('tab')
    if (t === 'ageing' || t === 'payments' || t === 'tasks' || t === 'statement') setTab(t)
    const q = params.get('q')
    if (q) setTextSearch(q)
  }, [canEdit])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadStatement = useCallback(async (dealerId: string) => {
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
  }, [])

  useEffect(() => {
    if (tab === 'statement' && statementDealerId) {
      void loadStatement(statementDealerId)
    }
  }, [tab, statementDealerId, branchId, loadStatement])

  const activeTab = COLLECTION_TABS.find((t) => t.key === tab) ?? COLLECTION_TABS[0]
  const sourceRows =
    tab === 'ageing' ? ageingRows : tab === 'payments' ? paymentRows : tab === 'tasks' ? taskRows : []

  const filtered = useMemo(() => {
    let list = sourceRows
    if (tab === 'tasks' && statusSeg !== 'all') {
      list = list.filter((r) => String(r.status) === statusSeg)
    }
    if (tab === 'ageing' && statusSeg === 'due') {
      list = list.filter((r) => ageingDue(r) > 0)
    }

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'amount' || sortBy === 'amountAsc') {
        const av = Number(
          a.totalDue ?? a.amount ?? a.targetAmount ?? a.outstanding ?? 0,
        )
        const bv = Number(
          b.totalDue ?? b.amount ?? b.targetAmount ?? b.outstanding ?? 0,
        )
        return sortBy === 'amountAsc' ? av - bv : bv - av
      }
      if (sortBy === 'dealer') return dealerLabel(a).localeCompare(dealerLabel(b))
      const ad = new Date(String(a.paidAt ?? a.createdAt ?? a.dueDate ?? 0)).getTime()
      const bd = new Date(String(b.paidAt ?? b.createdAt ?? b.dueDate ?? 0)).getTime()
      return bd - ad
    })
  }, [sourceRows, tab, statusSeg, textSearch, sortBy])

  const hasActiveFilters =
    statusSeg !== 'all' ||
    textSearch.trim().length > 0 ||
    (tab === 'ageing' ? sortBy !== 'amount' : sortBy !== 'recent')

  const clearFilters = () => {
    setStatusSeg('all')
    setTextSearch('')
    setSortBy(tab === 'ageing' ? 'amount' : 'recent')
  }

  const totalOutstanding = ageingRows.reduce((s, r) => s + ageingDue(r), 0)
  const dealersWithDue = ageingRows.filter((r) => ageingDue(r) > 0).length
  const paymentsTotal = paymentRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const openTasks = taskRows.filter((r) =>
    ['OPEN', 'IN_PROGRESS'].includes(String(r.status)),
  ).length

  const markTaskDone = useCallback(
    async (id: string) => {
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
    },
    [canEdit, load],
  )

  const openCollect = (dealerId?: string) => {
    if (!canEdit) return viewOnlyToast('collections')
    setPayDealerId(dealerId)
    setShowPay(true)
  }

  const statementLines = useMemo(() => {
    if (!statement) return []
    const inv = statement.invoices ?? statement.lines ?? statement.entries
    return Array.isArray(inv) ? (inv as AnyRow[]) : []
  }, [statement])

  const statementPayments = useMemo(() => {
    if (!statement) return []
    const p = statement.payments
    return Array.isArray(p) ? (p as AnyRow[]) : []
  }, [statement])

  const columns = useMemo<ColumnDef<AnyRow>[]>(() => {
    if (tab === 'ageing') {
      return [
        {
          id: 'dealer',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
          cell: ({ row }) => {
            const r = row.original
            const d = r.dealer as WholesaleDealer | undefined
            const name = dealerLabel(r)
            const code = String(d?.dealerCode ?? r.dealerCode ?? '')
            return (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-600 dark:text-amber-300 flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">{name}</p>
                  <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                    {code || '—'}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          id: 'due',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
          cell: ({ row }) => {
            const due = ageingDue(row.original)
            return (
              <span className={`text-xs font-bold ${due > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {formatCurrency(due)}
              </span>
            )
          },
        },
        {
          id: 'invoices',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Invoices" />,
          cell: ({ row }) => {
            const inv = row.original.invoices
            const n = Array.isArray(inv) ? inv.length : 0
            return <span className="text-xs text-gray-600 dark:text-slate-400">{n}</span>
          },
        },
        {
          id: 'buckets',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Ageing" />,
          cell: ({ row }) => {
            const buckets = (row.original.buckets as Record<string, number> | undefined) ?? {}
            const parts = Object.entries(buckets)
              .filter(([, v]) => Number(v) > 0)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${formatCurrency(Number(v))}`)
            return (
              <span className="text-[10px] text-gray-500 dark:text-slate-500 truncate max-w-[200px] block">
                {parts.length ? parts.join(' · ') : '—'}
              </span>
            )
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            const d = row.original.dealer as { id?: string } | undefined
            const id = String(d?.id ?? row.original.dealerId ?? '')
            return (
              <div className="flex items-center gap-1 justify-end">
                {canEdit && ageingDue(row.original) > 0 && (
                  <button
                    type="button"
                    onClick={() => openCollect(id || undefined)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30"
                  >
                    Collect
                  </button>
                )}
                {id && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatementDealerId(id)
                      setTab('statement')
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold border"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                  >
                    Statement
                  </button>
                )}
              </div>
            )
          },
        },
      ]
    }

    if (tab === 'payments') {
      return [
        {
          id: 'payment',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
          cell: ({ row }) => {
            const r = row.original
            const num = String(r.paymentNumber ?? r.receiptNumber ?? r.id)
            return (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Wallet size={14} className="text-emerald-600 dark:text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 truncate">
                    {num}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {dealerLabel(r)}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          id: 'dealer',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
          cell: ({ row }) => (
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
              {dealerLabel(row.original)}
            </span>
          ),
        },
        {
          id: 'amount',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
          cell: ({ row }) => (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Number(row.original.amount ?? 0))}
            </span>
          ),
        },
        {
          id: 'method',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
          cell: ({ row }) => (
            <span className="text-xs text-gray-600 dark:text-slate-400">
              {String(row.original.method ?? '—')}
            </span>
          ),
        },
        {
          id: 'date',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
          cell: ({ row }) => {
            const d = row.original.paidAt ?? row.original.createdAt
            return (
              <span className="text-xs text-gray-500 dark:text-slate-500">
                {d ? formatDate(String(d)) : '—'}
              </span>
            )
          },
        },
      ]
    }

    return [
      {
        id: 'task',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={14} className="text-violet-600 dark:text-violet-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">
                  {dealerLabel(r)}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {String(r.notes ?? r.id)}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'target',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Target" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {formatCurrency(Number(row.original.targetAmount ?? 0))}
          </span>
        ),
      },
      {
        id: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? 'OPEN')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${collectionStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const id = String(row.original.id)
          const st = String(row.original.status ?? '')
          if (st === 'DONE' || st === 'CANCELLED') {
            return null
          }
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && (
                <button
                  type="button"
                  disabled={busyTaskId === id}
                  onClick={() => void markTaskDone(id)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                >
                  Done
                </button>
              )}
            </div>
          )
        },
      },
    ]
  }, [tab, canEdit, busyTaskId, markTaskDone])

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Collections</h1>
            <p className="page-subtitle">
              {tab === 'statement' ? (
                <>
                  AR statement · <span className="text-sky-500">{activeTab.label}</span>
                </>
              ) : hasActiveFilters ? (
                <>
                  {filtered.length} of {sourceRows.length} shown ·{' '}
                  <span className="text-sky-500">{activeTab.label}</span>
                </>
              ) : (
                <>
                  {dealersWithDue} with dues · {formatCurrency(totalOutstanding)} ·{' '}
                  <span className="text-sky-500">{activeTab.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/wholesale/dealers"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Building2 size={14} />
              Dealers
            </Link>
            <Link
              href="/dashboard/wholesale/returns"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <RotateCcw size={14} />
              Returns
            </Link>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              View
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Collections view
                </p>
                {COLLECTION_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      tab === t.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{t.label}</span>
                    {tab === t.key && <ChevronRight size={12} className="text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
            {canEdit && tab === 'tasks' && (
              <button
                type="button"
                onClick={() => setShowTask(true)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                New task
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openCollect(undefined)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                Record payment
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Outstanding',
              value: formatCurrency(totalOutstanding),
              icon: CreditCard,
              color: 'red',
            },
            {
              label: 'Dealers with due',
              value: dealersWithDue.toString(),
              icon: Building2,
              color: 'amber',
            },
            {
              label: 'Payments total',
              value: formatCurrency(paymentsTotal),
              icon: Wallet,
              color: 'emerald',
            },
            { label: 'Open tasks', value: openTasks.toString(), icon: ClipboardList, color: 'violet' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab !== 'statement' && (
            <ToolbarSearch
              value={textSearch}
              onChange={setTextSearch}
              placeholder={
                tab === 'ageing'
                  ? 'Search dealer…'
                  : tab === 'payments'
                    ? 'Search payment # or dealer…'
                    : 'Search task…'
              }
              className="w-full sm:w-auto sm:min-w-[220px]"
            />
          )}
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {COLLECTION_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  tab === t.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'tasks' && (
            <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
              {TASK_STATUS_SEGMENTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusSeg(s.key)}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                  style={
                    statusSeg === s.key
                      ? { background: 'var(--brand-primary-light)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {tab !== 'statement' && (
            <FilterDropdown
              value={sortBy}
              onChange={setSortBy}
              options={
                tab === 'ageing'
                  ? [
                      { value: 'amount', label: 'Due (high)' },
                      { value: 'amountAsc', label: 'Due (low)' },
                      { value: 'dealer', label: 'Dealer A–Z' },
                    ]
                  : [
                      { value: 'recent', label: 'Newest first' },
                      { value: 'amount', label: 'Amount (high)' },
                      { value: 'dealer', label: 'Dealer A–Z' },
                    ]
              }
              icon={ArrowUpDown}
              placeholder="Sort by"
              active={tab === 'ageing' ? sortBy !== 'amount' : sortBy !== 'recent'}
              onClear={() => setSortBy(tab === 'ageing' ? 'amount' : 'recent')}
            />
          )}
          {tab !== 'statement' && hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {sourceRows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
        </div>

        {tab === 'statement' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-xs font-medium min-w-[240px]" style={{ color: 'var(--text-muted)' }}>
                Dealer
                <select
                  className="input-field h-11 mt-1"
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
              {canEdit && statementDealerId && (
                <button
                  type="button"
                  onClick={() => openCollect(statementDealerId)}
                  className="btn-primary text-sm flex items-center gap-2 h-11"
                >
                  <Wallet size={14} />
                  Collect
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-sky-500" />
              </div>
            ) : !statement ? (
              <WholesaleEmptyState
                title="No statement"
                description="Select a dealer to load AR statement."
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card p-4">
                    <p className="text-[11px] text-gray-500 dark:text-slate-500">Outstanding</p>
                    <p className="text-lg font-bold text-red-400">
                      {formatCurrency(
                        Number(
                          (statement.dealer as { totalDue?: number } | undefined)?.totalDue ??
                            statement.totalDue ??
                            statement.outstanding ??
                            0,
                        ),
                      )}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-[11px] text-gray-500 dark:text-slate-500">Invoices</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {statementLines.length}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-[11px] text-gray-500 dark:text-slate-500">Payments</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {statementPayments.length}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-[11px] text-gray-500 dark:text-slate-500">Dealer</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {dealerLabel(statement) !== '—'
                        ? dealerLabel(statement)
                        : String(
                            (statement.dealer as { tradingName?: string; legalName?: string } | undefined)
                              ?.tradingName ||
                              (statement.dealer as { legalName?: string } | undefined)?.legalName ||
                              '—',
                          )}
                    </p>
                  </div>
                </div>
                <ClientSideTable
                  columns={[
                    {
                      id: 'doc',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
                      cell: ({ row }) => (
                        <span className="font-mono text-xs font-semibold">
                          {String(
                            row.original.invoiceNumber ?? row.original.number ?? row.original.id,
                          )}
                        </span>
                      ),
                    },
                    {
                      id: 'total',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
                      cell: ({ row }) =>
                        formatCurrency(Number(row.original.total ?? 0)),
                    },
                    {
                      id: 'due',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
                      cell: ({ row }) => {
                        const due = Number(
                          row.original.dueAmount ??
                            row.original.amountDue ??
                            row.original.due ??
                            0,
                        )
                        return (
                          <span className={`text-xs font-bold ${due > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {formatCurrency(due)}
                          </span>
                        )
                      },
                    },
                    {
                      accessorKey: 'status',
                      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
                      cell: ({ row }) => {
                        const st = String(row.original.status ?? 'OPEN')
                        return (
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${collectionStatusPill(st)}`}
                          >
                            {st.replace(/_/g, ' ')}
                          </span>
                        )
                      },
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
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="Nothing here"
            description="Dealer dues and receipts will show when invoices are posted."
          />
        ) : (
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
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

const VAN_TABS = [
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'reps', label: 'Reps' },
  { key: 'settlements', label: 'Settlements' },
] as const

type VanTab = (typeof VAN_TABS)[number]['key']

const SETTLEMENT_STATUS_SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'APPROVED', label: 'Approved' },
] as const

function vanStatusPill(status: string) {
  const s = String(status || '')
  if (s === 'ACTIVE' || s === 'APPROVED') {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  }
  if (s === 'DRAFT' || s === 'SUBMITTED') {
    return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  }
  if (s === 'INACTIVE' || s === 'CANCELLED') {
    return 'bg-rose-500/10 border-rose-500/25 text-rose-500'
  }
  return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
}

export function WholesaleVanPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [tab, setTab] = useState<VanTab>('vehicles')
  const [vehicleRows, setVehicleRows] = useState<AnyRow[]>([])
  const [repRows, setRepRows] = useState<AnyRow[]>([])
  const [settlementRows, setSettlementRows] = useState<AnyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateRep, setShowCreateRep] = useState(false)
  const [showLoadStock, setShowLoadStock] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showVanSale, setShowVanSale] = useState(false)
  const [dealersForSale, setDealersForSale] = useState<WholesaleDealer[]>([])
  const [assignVehicle, setAssignVehicle] = useState<AnyRow | null>(null)
  const [settlementDetail, setSettlementDetail] = useState<AnyRow | null>(null)
  const [textSearch, setTextSearch] = useState('')
  const [statusSeg, setStatusSeg] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      wholesaleApi.vehicles({ limit: '200' }),
      wholesaleApi.reps({ limit: '200' }),
      wholesaleApi.settlements({ limit: '200' }),
    ])
      .then(([v, r, s]) => {
        setVehicleRows(asRows(v))
        setRepRows(asRows(r))
        setSettlementRows(asRows(s))
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    setStatusSeg('all')
    setTextSearch('')
    setSortBy('recent')
  }, [tab])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t === 'vehicles' || t === 'reps' || t === 'settlements') setTab(t)
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (!canEdit) viewOnlyToast('van')
      else if (t === 'reps') setShowCreateRep(true)
      else if (t === 'settlements') setShowSettlement(true)
      else setShowCreate(true)
    }
    const q = params.get('q')
    if (q) setTextSearch(q)
  }, [canEdit])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeTab = VAN_TABS.find((t) => t.key === tab) ?? VAN_TABS[0]
  const sourceRows =
    tab === 'vehicles' ? vehicleRows : tab === 'reps' ? repRows : settlementRows

  const filtered = useMemo(() => {
    let list = sourceRows
    if (tab === 'settlements' && statusSeg !== 'all') {
      list = list.filter((r) => String(r.status) === statusSeg)
    }
    if (tab === 'vehicles' && statusSeg === 'active') {
      list = list.filter((r) => r.isActive !== false)
    }
    if (tab === 'vehicles' && statusSeg === 'inactive') {
      list = list.filter((r) => r.isActive === false)
    }
    if (tab === 'reps' && statusSeg === 'active') {
      list = list.filter((r) => r.isActive !== false)
    }
    if (tab === 'reps' && statusSeg === 'inactive') {
      list = list.filter((r) => r.isActive === false)
    }

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        const an =
          tab === 'vehicles'
            ? String(a.plateNumber ?? a.name ?? '')
            : tab === 'reps'
              ? String((a.user as { name?: string } | undefined)?.name ?? '')
              : String(
                  (a.vehicle as { plateNumber?: string } | undefined)?.plateNumber ?? '',
                )
        const bn =
          tab === 'vehicles'
            ? String(b.plateNumber ?? b.name ?? '')
            : tab === 'reps'
              ? String((b.user as { name?: string } | undefined)?.name ?? '')
              : String(
                  (b.vehicle as { plateNumber?: string } | undefined)?.plateNumber ?? '',
                )
        return an.localeCompare(bn)
      }
      if (sortBy === 'amount' && tab === 'settlements') {
        return Number(b.declaredCash ?? 0) - Number(a.declaredCash ?? 0)
      }
      const ad = new Date(String(a.createdAt ?? a.settlementDate ?? 0)).getTime()
      const bd = new Date(String(b.createdAt ?? b.settlementDate ?? 0)).getTime()
      return bd - ad
    })
  }, [sourceRows, tab, statusSeg, textSearch, sortBy])

  const hasActiveFilters =
    statusSeg !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setStatusSeg('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const activeVehicles = vehicleRows.filter((r) => r.isActive !== false).length
  const activeReps = repRows.filter((r) => r.isActive !== false).length
  const openSettlements = settlementRows.filter((r) =>
    ['DRAFT', 'SUBMITTED'].includes(String(r.status)),
  ).length
  const declaredTotal = settlementRows
    .filter((r) => String(r.status) !== 'CANCELLED')
    .reduce((s, r) => s + Number(r.declaredCash ?? 0), 0)

  const act = useCallback(
    async (id: string, fn: () => Promise<unknown>, ok: string) => {
      if (!canEdit) {
        viewOnlyToast('van')
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
    },
    [canEdit, load],
  )

  const openVanSale = () => {
    if (!canEdit) return viewOnlyToast('van')
    wholesaleApi
      .dealers({ limit: '500', isActive: 'true' })
      .then((r) => setDealersForSale(r.data ?? []))
      .catch(() => {})
    setShowVanSale(true)
  }

  const columns = useMemo<ColumnDef<AnyRow>[]>(() => {
    if (tab === 'vehicles') {
      return [
        {
          id: 'vehicle',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Vehicle" />,
          cell: ({ row }) => {
            const r = row.original
            const plate = String(r.plateNumber ?? r.name ?? '—')
            const rep = r.assignedRepUser as { name?: string; email?: string } | undefined
            return (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <Truck size={14} className="text-sky-600 dark:text-sky-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate font-mono">
                    {plate}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {String(r.name ?? '')}
                    {rep ? ` · ${rep.name || rep.email}` : ' · Unassigned'}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          id: 'rep',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned rep" />,
          cell: ({ row }) => {
            const rep = row.original.assignedRepUser as { name?: string; email?: string } | undefined
            return (
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                {rep?.name || rep?.email || '—'}
              </span>
            )
          },
        },
        {
          id: 'status',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) => {
            const st = row.original.isActive === false ? 'INACTIVE' : 'ACTIVE'
            return (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${vanStatusPill(st)}`}
              >
                {st}
              </span>
            )
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setAssignVehicle(row.original)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25"
                >
                  Assign rep
                </button>
              )}
            </div>
          ),
        },
      ]
    }

    if (tab === 'reps') {
      return [
        {
          id: 'rep',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Sales rep" />,
          cell: ({ row }) => {
            const u = row.original.user as { name?: string; email?: string } | undefined
            const v = row.original.defaultVehicle as { plateNumber?: string; name?: string } | undefined
            const name = String(u?.name ?? '—')
            return (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">{name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {String(u?.email ?? '')}
                    {v ? ` · ${v.plateNumber || v.name}` : ''}
                  </p>
                </div>
              </div>
            )
          },
        },
        {
          id: 'vehicle',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Default van" />,
          cell: ({ row }) => {
            const v = row.original.defaultVehicle as { plateNumber?: string; name?: string } | undefined
            return (
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                {v?.plateNumber || v?.name || '—'}
              </span>
            )
          },
        },
        {
          id: 'status',
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          cell: ({ row }) => {
            const st = row.original.isActive === false ? 'INACTIVE' : 'ACTIVE'
            return (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${vanStatusPill(st)}`}
              >
                {st}
              </span>
            )
          },
        },
        {
          id: 'actions',
          cell: () => (
            <div className="flex items-center gap-1 justify-end">
              <Link
                href="/dashboard/hr/commission"
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25"
              >
                Commission
              </Link>
            </div>
          ),
        },
      ]
    }

    return [
      {
        id: 'settlement',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Settlement" />,
        cell: ({ row }) => {
          const r = row.original
          const vehicle = r.vehicle as { plateNumber?: string; name?: string } | undefined
          const label = String(vehicle?.plateNumber || vehicle?.name || r.id)
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Wallet size={14} className="text-emerald-600 dark:text-emerald-300" />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold font-mono text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors"
                  onClick={() => setSettlementDetail(r)}
                >
                  {label}
                </button>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {r.settlementDate ? formatDate(String(r.settlementDate)) : '—'}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'cash',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Declared" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {formatCurrency(Number(row.original.declaredCash ?? 0))}
          </span>
        ),
      },
      {
        id: 'expected',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Expected" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {formatCurrency(Number(row.original.expectedCash ?? 0))}
          </span>
        ),
      },
      {
        id: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const st = String(row.original.status ?? '—')
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${vanStatusPill(st)}`}
            >
              {st.replace(/_/g, ' ')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const st = String(r.status ?? '')
          const busy = busyId === id
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && st === 'DRAFT' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.submitSettlement(id), 'Submitted')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-sky-600/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:bg-sky-600/25 disabled:opacity-50"
                >
                  Submit
                </button>
              )}
              {canEdit && st === 'SUBMITTED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(id, () => wholesaleApi.approveSettlement(id), 'Approved')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              <TableActionsRow showAction={{ action: () => setSettlementDetail(r) }} />
            </div>
          )
        },
      },
    ]
  }, [tab, canEdit, busyId, act])

  const statusChips =
    tab === 'settlements'
      ? SETTLEMENT_STATUS_SEGMENTS
      : ([
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'inactive', label: 'Inactive' },
        ] as const)

  return (
    <WholesaleFeatureGate feature="REP_VAN_SALES" label="Rep / Van Sales">
      <div className="space-y-6">
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
            vehicles={vehicleRows}
            existingRepUserIds={repRows
              .map((r) => String((r.user as { id?: string })?.id ?? ''))
              .filter(Boolean)}
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
            vehicles={vehicleRows}
            onClose={() => setShowLoadStock(false)}
            onLoaded={() => {
              setShowLoadStock(false)
              load()
            }}
          />
        )}
        {showSettlement && (
          <CreateSettlementModal
            vehicles={vehicleRows}
            onClose={() => setShowSettlement(false)}
            onCreated={() => {
              setShowSettlement(false)
              load()
            }}
          />
        )}
        {showVanSale && (
          <DesktopVanSaleModal
            vehicles={vehicleRows}
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Rep / Van sales</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {filtered.length} of {sourceRows.length} shown ·{' '}
                  <span className="text-sky-500">{activeTab.label}</span>
                </>
              ) : (
                <>
                  {activeVehicles} vans · {activeReps} reps ·{' '}
                  <span className="text-sky-500">{activeTab.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link
              href="/dashboard/hr/commission"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Wallet size={14} />
              HR commission
            </Link>
            <Link href="/rep" className="btn-secondary text-sm flex items-center gap-2">
              <MapPin size={14} />
              Rep app
            </Link>
            <button
              type="button"
              onClick={openVanSale}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <ShoppingCart size={14} />
              Van sale
            </button>
            <button
              type="button"
              onClick={() => setShowSegment((v) => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-sky-500/40 text-sky-300' : ''}`}
            >
              <SlidersHorizontal size={14} />
              View
            </button>
            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Van view
                </p>
                {VAN_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key)
                      setShowSegment(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      tab === t.key ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{t.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {t.key === 'vehicles'
                          ? vehicleRows.length
                          : t.key === 'reps'
                            ? repRows.length
                            : settlementRows.length}
                      </span>
                      {tab === t.key && <ChevronRight size={12} className="text-sky-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {canEdit && tab === 'vehicles' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowLoadStock(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Package size={14} />
                  Load stock
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Add vehicle
                </button>
              </>
            )}
            {canEdit && tab === 'reps' && (
              <button
                type="button"
                onClick={() => setShowCreateRep(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                Add sales rep
              </button>
            )}
            {canEdit && tab === 'settlements' && (
              <button
                type="button"
                onClick={() => setShowSettlement(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} />
                New settlement
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active vans', value: activeVehicles.toString(), icon: Truck, color: 'sky' },
            { label: 'Active reps', value: activeReps.toString(), icon: Users, color: 'violet' },
            { label: 'Open settlements', value: openSettlements.toString(), icon: Wallet, color: 'amber' },
            {
              label: 'Declared cash',
              value: formatCurrency(declaredTotal),
              icon: CreditCard,
              color: 'emerald',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}
              >
                <Icon size={15} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch
            value={textSearch}
            onChange={setTextSearch}
            placeholder={
              tab === 'vehicles'
                ? 'Search plate or name…'
                : tab === 'reps'
                  ? 'Search rep name or email…'
                  : 'Search settlement…'
            }
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {VAN_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  tab === t.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {statusChips.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatusSeg(s.key)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  statusSeg === s.key
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <FilterDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Newest first' },
              { value: 'name', label: 'Name A–Z' },
              ...(tab === 'settlements'
                ? [{ value: 'amount', label: 'Declared (high)' }]
                : []),
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {filtered.length} of {sourceRows.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={11} />
                Clear
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title={
              tab === 'reps'
                ? 'No sales reps yet'
                : tab === 'settlements'
                  ? 'No settlements yet'
                  : 'No vehicles yet'
            }
            description={
              tab === 'reps'
                ? 'Add a sales rep — create a new login or link an existing staff user.'
                : tab === 'settlements'
                  ? 'Create an end-of-day settlement for a vehicle / rep.'
                  : 'Add a vehicle (creates a stock branch) then load stock for field sales.'
            }
          />
        ) : (
          <ClientSideTable
            columns={columns}
            data={filtered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
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
  branchId,
  onClose,
  onCreated,
}: {
  dealers: WholesaleDealer[]
  branchId?: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dealerId, setDealerId] = useState(dealers[0]?.id ?? '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealerId) {
      toast.error('Select a dealer')
      return
    }
    if (!branchId) {
      toast.error('Select an active branch first')
      return
    }
    setSaving(true)
    try {
      await wholesaleApi.createTrip({ branchId, stops: [{ dealerId }] })
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
          <button type="button" onClick={onClose} className="text-sm px-3 py-2">
            Cancel
          </button>
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
