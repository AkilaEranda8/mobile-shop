'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Building2, ClipboardList, FileText, Loader2, Plus, ShoppingCart,
  Tag, Wallet, BarChart3, Settings, Phone, Mail, Users, CreditCard,
  SlidersHorizontal, ChevronRight, ArrowUpDown, RotateCcw, X, UserPlus,
  Pencil, Hash,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useActiveBranchId } from '@/lib/hooks'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import {
  wholesaleApi,
  type WholesaleDealer,
  type WholesaleSettings,
} from '@/lib/wholesale-api'
import {
  WholesaleEmptyState,
  WholesaleFeatureGate,
  WholesaleKpiCard,
  WholesalePageHeader,
  fieldClass,
  fieldStyle,
} from './wholesale-ui'
import { DealerDetailModal } from './WholesaleDetailModals'

function unwrapItems(res: unknown): unknown[] {
  const r = res as { data?: unknown }
  const d = r?.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') {
    const obj = d as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items
    if (Array.isArray(obj.data)) return obj.data
  }
  return []
}

/* ── Dashboard ───────────────────────────────────────────────────────── */

export function WholesaleDashboardPage() {
  const branchId = useActiveBranchId()
  const [loading, setLoading] = useState(true)
  const [dealersCount, setDealersCount] = useState(0)
  const [openOrders, setOpenOrders] = useState(0)
  const [totalDues, setTotalDues] = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      wholesaleApi.dealers({ limit: '500', isActive: 'true' }),
      wholesaleApi.orders().catch(() => ({ data: { items: [] } })),
    ])
      .then(([dealersRes, ordersRes]) => {
        const dealers = (dealersRes as { data?: WholesaleDealer[] }).data ?? []
        setDealersCount(dealers.length)
        setTotalDues(dealers.reduce((s, d) => s + Number(d.totalDue ?? 0), 0))
        setOpenOrders(unwrapItems(ordersRes).length)
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [branchId])

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
        <WholesalePageHeader
          title="Wholesale"
          subtitle="Dealers, counter sales, orders and distribution"
          action={
            <Link
              href="/dashboard/wholesale/pos"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500"
            >
              <ShoppingCart size={15} />
              Open Counter POS
            </Link>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <WholesaleKpiCard label="Active dealers" value={dealersCount} icon={Building2} tone="sky" />
            <WholesaleKpiCard label="Open orders" value={openOrders} icon={ClipboardList} tone="blue" />
            <WholesaleKpiCard label="Dealer dues" value={formatCurrency(totalDues)} icon={Wallet} tone="amber" />
            <WholesaleKpiCard
              label="Quick sale"
              value="POS"
              icon={ShoppingCart}
              tone="emerald"
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/wholesale/dealers', label: 'Dealers', icon: Building2 },
            { href: '/dashboard/wholesale/pricing', label: 'Pricing', icon: Tag },
            { href: '/dashboard/wholesale/quotations', label: 'Quotations', icon: FileText },
            { href: '/dashboard/wholesale/orders', label: 'Orders', icon: ClipboardList },
            { href: '/dashboard/wholesale/collections', label: 'Collections', icon: Wallet },
            { href: '/dashboard/wholesale/reports', label: 'Reports', icon: BarChart3 },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card p-4 flex items-center gap-3 hover:opacity-90 transition-opacity"
            >
              <item.icon size={16} className="text-sky-600" />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </WholesaleFeatureGate>
  )
}

/* ── Dealers (Customers-page layout) ─────────────────────────────────── */

const DEALER_SEGMENTS = [
  { key: 'all', label: 'All Dealers', filter: (d: WholesaleDealer) => d.isActive !== false },
  { key: 'active', label: 'Active', filter: (d: WholesaleDealer) => d.isActive !== false && d.status === 'ACTIVE' },
  { key: 'outstanding', label: 'Has Outstanding', filter: (d: WholesaleDealer) => d.isActive !== false && Number(d.totalDue) > 0 },
  { key: 'cash', label: 'Cash only', filter: (d: WholesaleDealer) => d.isActive !== false && d.cashOnly },
  { key: 'hold', label: 'On Hold', filter: (d: WholesaleDealer) => d.status === 'ON_HOLD' },
  { key: 'suspended', label: 'Suspended', filter: (d: WholesaleDealer) => d.status === 'SUSPENDED' || d.isActive === false },
  {
    key: 'new',
    label: 'New (≤30 days)',
    filter: (d: WholesaleDealer) => {
      if (d.isActive === false || !d.createdAt) return false
      return (Date.now() - new Date(d.createdAt).getTime()) / 86400000 <= 30
    },
  },
]

const DEALER_SORT_OPTIONS: {
  value: string
  label: string
  compare: (a: WholesaleDealer, b: WholesaleDealer) => number
}[] = [
  {
    value: 'recent',
    label: 'Newest first',
    compare: (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  },
  {
    value: 'oldest',
    label: 'Oldest first',
    compare: (a, b) =>
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  },
  {
    value: 'name',
    label: 'Name (A–Z)',
    compare: (a, b) =>
      (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName),
  },
  {
    value: 'due',
    label: 'Highest due',
    compare: (a, b) => Number(b.totalDue) - Number(a.totalDue),
  },
  {
    value: 'limit',
    label: 'Highest credit limit',
    compare: (a, b) => Number(b.creditLimit) - Number(a.creditLimit),
  },
]

const DEALER_DUE_OPTIONS = [
  { id: 'all', label: 'Any balance' },
  { id: 'due', label: 'Has due' },
  { id: 'paid', label: 'Settled' },
] as const

type DealerDueFilter = (typeof DEALER_DUE_OPTIONS)[number]['id']

function dealerStatusPill(status: string, isActive: boolean) {
  if (isActive === false || status === 'SUSPENDED') {
    return 'bg-slate-500/10 border-slate-500/25 text-slate-500'
  }
  if (status === 'ACTIVE') return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
  if (status === 'ON_HOLD') return 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
  if (status === 'DRAFT') return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
  return 'bg-brand-500/10 border-brand-500/25 text-brand-500'
}

export function WholesaleDealersPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<WholesaleDealer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editDealer, setEditDealer] = useState<WholesaleDealer | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [segment, setSegment] = useState('all')
  const [textSearch, setTextSearch] = useState('')
  const [dueFilter, setDueFilter] = useState<DealerDueFilter>('all')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    wholesaleApi
      .dealers({ limit: '500' })
      .then((res) => setRows(res.data ?? []))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [branchId, load])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add' || params.get('action') === 'new') {
      if (canEdit) setShowCreate(true)
      else viewOnlyToast('dealers')
    }
    const id = params.get('id')
    if (id) setDetailId(id)
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

  const openDetail = useCallback((id: string) => setDetailId(id), [])

  const activeSeg = DEALER_SEGMENTS.find((s) => s.key === segment) ?? DEALER_SEGMENTS[0]

  const segmentFiltered = useMemo(() => {
    let list = rows.filter(activeSeg.filter)

    if (dueFilter === 'due') list = list.filter((d) => Number(d.totalDue) > 0)
    if (dueFilter === 'paid') list = list.filter((d) => Number(d.totalDue) <= 0)

    const q = textSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (d) =>
          d.legalName.toLowerCase().includes(q) ||
          (d.tradingName ?? '').toLowerCase().includes(q) ||
          d.dealerCode.toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          (d.email ?? '').toLowerCase().includes(q) ||
          (d.tier?.name ?? '').toLowerCase().includes(q),
      )
    }

    const sorter = DEALER_SORT_OPTIONS.find((s) => s.value === sortBy)
    return sorter ? [...list].sort(sorter.compare) : list
  }, [rows, activeSeg, dueFilter, textSearch, sortBy])

  const hasActiveFilters =
    segment !== 'all' || dueFilter !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setSegment('all')
    setDueFilter('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const activeCount = rows.filter((d) => d.isActive !== false && d.status === 'ACTIVE').length
  const totalDue = rows
    .filter((d) => d.isActive !== false)
    .reduce((s, d) => s + Number(d.totalDue ?? 0), 0)
  const cashOnlyCount = rows.filter((d) => d.isActive !== false && d.cashOnly).length
  const outstandingCount = rows.filter((d) => d.isActive !== false && Number(d.totalDue) > 0).length

  const handleHold = useCallback(
    async (d: WholesaleDealer) => {
      if (!canEdit) return viewOnlyToast('dealers')
      if (!window.confirm(`Put ${d.tradingName || d.legalName} on hold?`)) return
      try {
        await wholesaleApi.holdDealer(d.id)
        toast.success('Dealer on hold')
        load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed')
      }
    },
    [canEdit, load],
  )

  const handleApprove = useCallback(
    async (d: WholesaleDealer) => {
      if (!canEdit) return viewOnlyToast('dealers')
      try {
        await wholesaleApi.approveDealer(d.id)
        toast.success('Dealer activated')
        load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed')
      }
    },
    [canEdit, load],
  )

  const columns = useMemo<ColumnDef<WholesaleDealer>[]>(
    () => [
      {
        accessorKey: 'legalName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => {
          const d = row.original
          const name = d.tradingName || d.legalName
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/20 flex items-center justify-center text-sm font-bold text-sky-600 dark:text-sky-300 flex-shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className="text-sm font-bold text-gray-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 text-left transition-colors"
                  onClick={() => openDetail(d.id)}
                >
                  {name}
                </button>
                <p className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <Hash size={9} />
                  {d.dealerCode}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
              <Phone size={10} />
              {row.original.phone}
            </span>
            {row.original.email && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-500">
                <Mail size={10} />
                {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'tier',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tier" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {row.original.tier?.name ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'creditLimit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Credit limit" />,
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            {row.original.cashOnly ? (
              <span className="text-amber-600 dark:text-amber-400">Cash only</span>
            ) : (
              formatCurrency(Number(row.original.creditLimit ?? 0))
            )}
          </span>
        ),
      },
      {
        accessorKey: 'totalDue',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
        cell: ({ row }) => {
          const due = Number(row.original.totalDue ?? 0)
          return (
            <span className={`text-xs font-bold ${due > 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {formatCurrency(due)}
            </span>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-500 dark:text-slate-500">
            {row.original.createdAt ? formatDate(row.original.createdAt) : '—'}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${dealerStatusPill(row.original.status, row.original.isActive)}`}
          >
            {row.original.isActive === false ? 'Inactive' : row.original.status.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && Number(d.totalDue) > 0 && d.status === 'ACTIVE' && (
                <Link
                  href={`/dashboard/wholesale/collections?dealerId=${d.id}`}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30"
                >
                  Collect
                </Link>
              )}
              {canEdit && d.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => void handleHold(d)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 hover:bg-amber-500/25"
                >
                  Hold
                </button>
              )}
              {canEdit && d.status !== 'ACTIVE' && d.status !== 'CLOSED' && (
                <button
                  type="button"
                  onClick={() => void handleApprove(d)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25"
                >
                  Activate
                </button>
              )}
              <TableActionsRow
                showAction={{ action: () => openDetail(d.id) }}
                editAction={
                  canEdit
                    ? {
                        action: () => setEditDealer(d),
                        disabled: d.status === 'CLOSED',
                      }
                    : undefined
                }
              />
            </div>
          )
        },
      },
    ],
    [canEdit, openDetail, handleHold, handleApprove],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
        {showCreate && (
          <DealerFormModal
            onClose={() => setShowCreate(false)}
            onSaved={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}
        {editDealer && (
          <DealerFormModal
            dealer={editDealer}
            onClose={() => setEditDealer(null)}
            onSaved={() => {
              setEditDealer(null)
              load()
            }}
          />
        )}
        {detailId && (
          <DealerDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
        )}

        {/* Header — Customers style */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Dealers</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {segmentFiltered.length} of {rows.length} shown ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              ) : (
                <>
                  {activeCount} active · {rows.length} total ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative" ref={segmentRef}>
            <Link href="/dashboard/wholesale/pos" className="btn-secondary text-sm flex items-center gap-2">
              <ShoppingCart size={14} />
              Wholesale POS
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
              <div className="absolute top-full right-0 mt-2 w-56 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">
                  Filter by segment
                </p>
                {DEALER_SEGMENTS.map((s) => (
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
                      <span className="text-xs text-slate-600">{rows.filter(s.filter).length}</span>
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
                Add Dealer
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Dealers', value: activeCount.toString(), icon: Users, color: 'sky' },
            { label: 'Total Outstanding', value: formatCurrency(totalDue), icon: CreditCard, color: 'red' },
            { label: 'With Balance Due', value: outstandingCount.toString(), icon: Wallet, color: 'amber' },
            { label: 'Cash Only', value: cashOnlyCount.toString(), icon: Building2, color: 'blue' },
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
            placeholder="Search name, code, phone…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {DEALER_SEGMENTS.map((s) => (
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
            options={DEALER_SORT_OPTIONS.map(({ value, label }) => ({ value, label }))}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'recent'}
            onClear={() => setSortBy('recent')}
          />

          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {DEALER_DUE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDueFilter(opt.id)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={
                  dueFilter === opt.id
                    ? { background: 'var(--brand-primary-light)', color: '#fff' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {segmentFiltered.length} of {rows.length}
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
        ) : segmentFiltered.length === 0 ? (
          <WholesaleEmptyState
            title="No dealers found"
            description={
              hasActiveFilters
                ? 'Try clearing filters or search.'
                : 'Create a dealer to start wholesale counter sales and credit accounts.'
            }
          />
        ) : (
          <ClientSideTable
            columns={columns}
            data={segmentFiltered}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

function DealerFormModal({
  dealer,
  onClose,
  onSaved,
}: {
  dealer?: WholesaleDealer
  onClose: () => void
  onSaved: () => void
}) {
  const { canEdit } = useModuleAccess()
  const isEditing = Boolean(dealer)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    legalName: dealer?.legalName ?? '',
    tradingName: dealer?.tradingName ?? '',
    phone: dealer?.phone ?? '',
    email: dealer?.email ?? '',
    creditLimit: String(dealer?.creditLimit ?? 0),
    paymentTermsDays: String(dealer?.paymentTermsDays ?? 0),
    cashOnly: dealer?.cashOnly ?? false,
    notes: dealer?.notes ?? '',
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      viewOnlyToast('dealers')
      return
    }
    if (!form.legalName.trim() || !form.phone.trim()) {
      setError('Legal name and phone are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        legalName: form.legalName.trim(),
        tradingName: form.tradingName.trim() || null,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        creditLimit: Number(form.creditLimit) || 0,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
        cashOnly: form.cashOnly,
        notes: form.notes.trim() || null,
      }
      if (dealer) {
        await wholesaleApi.updateDealer(dealer.id, body)
        toast.success('Dealer updated')
      } else {
        await wholesaleApi.createDealer({ ...body, status: 'ACTIVE' })
        toast.success('Dealer created')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} dealer`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="rounded-2xl w-full max-w-lg shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500/10 border border-sky-500/20">
              {isEditing ? (
                <Pencil size={18} className="text-sky-500" />
              ) : (
                <UserPlus size={18} className="text-sky-500" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {isEditing ? 'Edit Dealer' : 'Add Dealer'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isEditing
                  ? 'Update dealer account and credit terms'
                  : 'Register a B2B dealer for wholesale sales'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Legal name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  className="input-field pl-10 h-11"
                  placeholder="Registered business name"
                  value={form.legalName}
                  onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                  autoFocus
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Trading name
              </label>
              <input
                className="input-field h-11"
                placeholder="Display / shop name"
                value={form.tradingName}
                onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  className="input-field pl-10 h-11"
                  placeholder="07X XXX XXXX"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className="input-field pl-10 h-11"
                  placeholder="dealer@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Credit limit
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input-field h-11"
                value={form.creditLimit}
                onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                disabled={form.cashOnly}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Payment terms (days)
              </label>
              <input
                type="number"
                min={0}
                className="input-field h-11"
                value={form.paymentTermsDays}
                onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={form.cashOnly}
              onChange={(e) => setForm((f) => ({ ...f, cashOnly: e.target.checked }))}
              className="rounded"
            />
            <span style={{ color: 'var(--text-muted)' }}>Cash only (no credit sales)</span>
          </label>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Notes
            </label>
            <textarea
              className="input-field min-h-[72px] py-2.5"
              placeholder="Optional notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-sm inline-flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? 'Save changes' : 'Create dealer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Pricing (Dealers-page layout) ───────────────────────────────────── */

type TierRow = {
  id: string
  name: string
  code?: string | null
  sortOrder?: number
  isActive?: boolean
  _count?: { dealers: number; priceLists: number }
}

type PriceListRow = {
  id: string
  name: string
  code?: string | null
  isDefault?: boolean
  isActive?: boolean
  currency?: string
  tier?: { id: string; name: string } | null
  _count?: { items: number }
}

type PricingKind = 'tier' | 'list'

type PricingUnifiedRow =
  | { kind: 'tier'; data: TierRow }
  | { kind: 'list'; data: PriceListRow }

const PRICING_SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'tiers', label: 'Tiers' },
  { key: 'lists', label: 'Price lists' },
  { key: 'active', label: 'Active' },
  { key: 'default', label: 'Default lists' },
  { key: 'inactive', label: 'Inactive' },
] as const

export function WholesalePricingPage() {
  const { canEdit } = useModuleAccess()
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [lists, setLists] = useState<PriceListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showTier, setShowTier] = useState(false)
  const [showList, setShowList] = useState(false)
  const [editTier, setEditTier] = useState<TierRow | null>(null)
  const [editList, setEditList] = useState<PriceListRow | null>(null)
  const [segment, setSegment] = useState<(typeof PRICING_SEGMENTS)[number]['key']>('all')
  const [textSearch, setTextSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([wholesaleApi.tiers(), wholesaleApi.priceLists()])
      .then(([tRes, lRes]) => {
        setTiers((tRes.data as TierRow[]) ?? [])
        setLists((lRes.data as PriceListRow[]) ?? [])
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unified = useMemo<PricingUnifiedRow[]>(() => {
    const rows: PricingUnifiedRow[] = [
      ...tiers.map((data) => ({ kind: 'tier' as const, data })),
      ...lists.map((data) => ({ kind: 'list' as const, data })),
    ]

    let filtered = rows
    if (segment === 'tiers') filtered = rows.filter((r) => r.kind === 'tier')
    else if (segment === 'lists') filtered = rows.filter((r) => r.kind === 'list')
    else if (segment === 'active') {
      filtered = rows.filter((r) =>
        r.kind === 'tier' ? r.data.isActive !== false : r.data.isActive !== false,
      )
    } else if (segment === 'default') {
      filtered = rows.filter((r) => r.kind === 'list' && r.data.isDefault)
    } else if (segment === 'inactive') {
      filtered = rows.filter((r) =>
        r.kind === 'tier' ? r.data.isActive === false : r.data.isActive === false,
      )
    }

    const q = textSearch.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((r) => {
        if (r.kind === 'tier') {
          return (
            r.data.name.toLowerCase().includes(q) ||
            (r.data.code ?? '').toLowerCase().includes(q)
          )
        }
        return (
          r.data.name.toLowerCase().includes(q) ||
          (r.data.code ?? '').toLowerCase().includes(q) ||
          (r.data.tier?.name ?? '').toLowerCase().includes(q)
        )
      })
    }

    return [...filtered].sort((a, b) => {
      const an = a.data.name
      const bn = b.data.name
      if (sortBy === 'name') return an.localeCompare(bn)
      if (sortBy === 'nameDesc') return bn.localeCompare(an)
      if (sortBy === 'kind') return a.kind.localeCompare(b.kind) || an.localeCompare(bn)
      return an.localeCompare(bn)
    })
  }, [tiers, lists, segment, textSearch, sortBy])

  const hasActiveFilters = segment !== 'all' || sortBy !== 'name' || textSearch.trim().length > 0
  const activeSeg = PRICING_SEGMENTS.find((s) => s.key === segment) ?? PRICING_SEGMENTS[0]
  const activeTier = tiers.filter((t) => t.isActive !== false).length
  const activeLists = lists.filter((l) => l.isActive !== false).length
  const defaultLists = lists.filter((l) => l.isDefault).length
  const totalItems = lists.reduce((s, l) => s + (l._count?.items ?? 0), 0)

  const clearFilters = () => {
    setSegment('all')
    setSortBy('name')
    setTextSearch('')
  }

  const toggleTierActive = async (t: TierRow) => {
    if (!canEdit) return viewOnlyToast('pricing')
    try {
      await wholesaleApi.updateTier(t.id, { isActive: t.isActive === false })
      toast.success(t.isActive === false ? 'Tier activated' : 'Tier deactivated')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const toggleListActive = async (l: PriceListRow) => {
    if (!canEdit) return viewOnlyToast('pricing')
    try {
      await wholesaleApi.updatePriceList(l.id, { isActive: l.isActive === false })
      toast.success(l.isActive === false ? 'Price list activated' : 'Price list deactivated')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const deleteTier = async (t: TierRow) => {
    if (!canEdit) return viewOnlyToast('pricing')
    if (!window.confirm(`Delete tier “${t.name}”?`)) return
    try {
      await wholesaleApi.deleteTier(t.id)
      toast.success('Tier deleted')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const deleteList = async (l: PriceListRow) => {
    if (!canEdit) return viewOnlyToast('pricing')
    if (!window.confirm(`Delete price list “${l.name}”?`)) return
    try {
      await wholesaleApi.deletePriceList(l.id)
      toast.success('Price list deleted')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const columns = useMemo<ColumnDef<PricingUnifiedRow>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (r) => r.data.name,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => {
          const r = row.original
          const isTier = r.kind === 'tier'
          const name = r.data.name
          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isTier
                    ? 'bg-gradient-to-br from-brand-500/20 to-fuchsia-500/20 border-brand-500/20 text-brand-600 dark:text-brand-300'
                    : 'bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border-sky-500/20 text-sky-600 dark:text-sky-300'
                }`}
              >
                {isTier ? <Users size={14} /> : <Tag size={14} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">
                  {name}
                  {r.kind === 'list' && r.data.isDefault ? (
                    <span className="ml-2 text-[10px] font-semibold text-sky-600">DEFAULT</span>
                  ) : null}
                </p>
                <p className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <Hash size={9} />
                  {r.data.code || (isTier ? 'TIER' : 'LIST')}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
              row.original.kind === 'tier'
                ? 'bg-brand-500/10 border-brand-500/25 text-brand-600 dark:text-brand-400'
                : 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
            }`}
          >
            {row.original.kind === 'tier' ? 'Dealer tier' : 'Price list'}
          </span>
        ),
      },
      {
        id: 'scope',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Scope" />,
        cell: ({ row }) => {
          const r = row.original
          if (r.kind === 'tier') {
            return (
              <span className="text-xs text-gray-600 dark:text-slate-400">
                {r.data._count?.dealers ?? 0} dealers · {r.data._count?.priceLists ?? 0} lists
              </span>
            )
          }
          return (
            <span className="text-xs text-gray-600 dark:text-slate-400">
              {r.data.tier?.name ?? 'All tiers'} · {r.data._count?.items ?? 0} items
            </span>
          )
        },
      },
      {
        id: 'currency',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Currency" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            {row.original.kind === 'list' ? row.original.data.currency || 'LKR' : '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const active = row.original.data.isActive !== false
          return (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                active
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                  : 'bg-slate-500/10 border-slate-500/25 text-slate-500'
              }`}
            >
              {active ? 'Active' : 'Inactive'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          const active = r.data.isActive !== false
          return (
            <div className="flex items-center gap-1 justify-end">
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    void (r.kind === 'tier' ? toggleTierActive(r.data) : toggleListActive(r.data))
                  }
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                    active
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                      : 'bg-emerald-600/15 text-emerald-500 border-emerald-500/25'
                  }`}
                >
                  {active ? 'Deactivate' : 'Activate'}
                </button>
              )}
              <TableActionsRow
                editAction={
                  canEdit
                    ? {
                        action: () => {
                          if (r.kind === 'tier') setEditTier(r.data)
                          else setEditList(r.data)
                        },
                      }
                    : undefined
                }
                deleteAction={
                  canEdit
                    ? {
                        action: () =>
                          void (r.kind === 'tier' ? deleteTier(r.data) : deleteList(r.data)),
                      }
                    : undefined
                }
              />
            </div>
          )
        },
      },
    ],
    [canEdit],
  )

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
        {(showTier || editTier) && (
          <PricingFormModal
            kind="tier"
            initial={editTier ?? undefined}
            onClose={() => {
              setShowTier(false)
              setEditTier(null)
            }}
            onSaved={() => {
              setShowTier(false)
              setEditTier(null)
              load()
            }}
          />
        )}
        {(showList || editList) && (
          <PricingFormModal
            kind="list"
            initial={editList ?? undefined}
            tiers={tiers}
            onClose={() => {
              setShowList(false)
              setEditList(null)
            }}
            onSaved={() => {
              setShowList(false)
              setEditList(null)
              load()
            }}
          />
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="page-title">Wholesale pricing</h1>
            <p className="page-subtitle">
              {hasActiveFilters ? (
                <>
                  {unified.length} of {tiers.length + lists.length} shown ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              ) : (
                <>
                  {activeTier} tiers · {activeLists} lists ·{' '}
                  <span className="text-sky-500">{activeSeg.label}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:ml-auto items-center relative flex-wrap" ref={segmentRef}>
            <Link href="/dashboard/wholesale/dealers" className="btn-secondary text-sm flex items-center gap-2">
              <Building2 size={14} />
              Dealers
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
                  Filter by segment
                </p>
                {PRICING_SEGMENTS.map((s) => (
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
                    {segment === s.key && <ChevronRight size={12} className="text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setShowTier(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Tier
                </button>
                <button
                  type="button"
                  onClick={() => setShowList(true)}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Price list
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dealer tiers', value: activeTier.toString(), icon: Users, color: 'blue' },
            { label: 'Price lists', value: activeLists.toString(), icon: Tag, color: 'sky' },
            { label: 'Default lists', value: defaultLists.toString(), icon: CreditCard, color: 'emerald' },
            { label: 'Priced items', value: totalItems.toString(), icon: FileText, color: 'amber' },
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
            placeholder="Search tier or price list…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
            {PRICING_SEGMENTS.map((s) => (
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
              { value: 'name', label: 'Name (A–Z)' },
              { value: 'nameDesc', label: 'Name (Z–A)' },
              { value: 'kind', label: 'Type' },
            ]}
            icon={ArrowUpDown}
            placeholder="Sort by"
            active={sortBy !== 'name'}
            onClear={() => setSortBy('name')}
          />
          {hasActiveFilters && (
            <>
              <span
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                {unified.length} of {tiers.length + lists.length}
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
        ) : unified.length === 0 ? (
          <WholesaleEmptyState
            title="No pricing setup yet"
            description={
              hasActiveFilters
                ? 'Try clearing filters or search.'
                : 'Create dealer tiers and price lists for B2B unit prices.'
            }
          />
        ) : (
          <ClientSideTable
            columns={columns}
            data={unified}
            searchableColumns={[]}
            showFilter={false}
            pageSize={25}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

function PricingFormModal({
  kind,
  initial,
  tiers = [],
  onClose,
  onSaved,
}: {
  kind: PricingKind
  initial?: TierRow | PriceListRow
  tiers?: TierRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const { canEdit } = useModuleAccess()
  const isEditing = Boolean(initial)
  const isTier = kind === 'tier'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [isDefault, setIsDefault] = useState(
    !isTier && initial ? Boolean((initial as PriceListRow).isDefault) : false,
  )
  const [tierId, setTierId] = useState(
    !isTier && initial ? ((initial as PriceListRow).tier?.id ?? '') : '',
  )
  const [isActive, setIsActive] = useState(initial?.isActive !== false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return viewOnlyToast('pricing')
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isTier) {
        const body = {
          name: name.trim(),
          code: code.trim() || null,
          isActive,
        }
        if (initial) await wholesaleApi.updateTier(initial.id, body)
        else await wholesaleApi.createTier(body)
        toast.success(initial ? 'Tier updated' : 'Tier created')
      } else {
        const body = {
          name: name.trim(),
          code: code.trim() || null,
          isDefault,
          isActive,
          tierId: tierId || null,
        }
        if (initial) await wholesaleApi.updatePriceList(initial.id, body)
        else await wholesaleApi.createPriceList(body)
        toast.success(initial ? 'Price list updated' : 'Price list created')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="rounded-2xl w-full max-w-lg shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isTier
                  ? 'bg-brand-500/10 border-brand-500/20'
                  : 'bg-sky-500/10 border-sky-500/20'
              }`}
            >
              {isEditing ? (
                <Pencil size={18} className={isTier ? 'text-brand-500' : 'text-sky-500'} />
              ) : (
                <Plus size={18} className={isTier ? 'text-brand-500' : 'text-sky-500'} />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {isEditing
                  ? isTier
                    ? 'Edit tier'
                    : 'Edit price list'
                  : isTier
                    ? 'Add dealer tier'
                    : 'Add price list'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isTier
                  ? 'Group dealers for wholesale price lists'
                  : 'B2B unit prices for products / tiers'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="input-field h-11"
              placeholder={isTier ? 'e.g. Gold dealers' : 'e.g. Default wholesale'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Code
            </label>
            <input
              className="input-field h-11"
              placeholder="Optional short code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {!isTier && (
            <>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Linked tier
                </label>
                <select
                  className="input-field h-11"
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value)}
                >
                  <option value="">All tiers</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded"
                />
                <span style={{ color: 'var(--text-muted)' }}>Default price list</span>
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <span style={{ color: 'var(--text-muted)' }}>Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-sm inline-flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Ops pages (tables + actions — Hexalyte UX) ───────────────────────── */

export {
  WholesaleQuotationsPage,
  WholesaleOrdersPage,
  WholesaleWarehousePage,
  WholesaleDeliveryPage,
  WholesaleReturnsPage,
  WholesaleCollectionsPage,
  WholesaleReportsPage,
  WholesaleVanPage,
} from './WholesaleOpsPages'

/* ── Settings ────────────────────────────────────────────────────────── */

export function WholesaleSettingsPage() {
  const { canEdit } = useModuleAccess()
  const [settings, setSettings] = useState<WholesaleSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    wholesaleApi
      .settings()
      .then((res) => setSettings(res.data))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!settings || !canEdit) {
      if (!canEdit) viewOnlyToast('settings')
      return
    }
    setSaving(true)
    try {
      const res = await wholesaleApi.updateSettings(settings)
      setSettings(res.data)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleFeatureGate>
      <div className="space-y-4">
        <WholesalePageHeader
          title="Wholesale settings"
          subtitle="Credit, IMEI hold TTL and fulfilment defaults"
          action={
            <button
              type="button"
              onClick={save}
              disabled={saving || !settings}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
              Save
            </button>
          }
        />

        {loading || !settings ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : (
          <div className="card p-5 grid sm:grid-cols-2 gap-4 max-w-3xl">
            <label className="block text-xs space-y-1">
              <span style={{ color: 'var(--text-muted)' }}>Overdue tolerance (days)</span>
              <input
                type="number"
                min={0}
                className={fieldClass()}
                style={fieldStyle()}
                value={settings.overdueToleranceDays}
                onChange={(e) =>
                  setSettings({ ...settings, overdueToleranceDays: Number(e.target.value) || 0 })
                }
                disabled={!canEdit}
              />
            </label>
            <label className="block text-xs space-y-1">
              <span style={{ color: 'var(--text-muted)' }}>IMEI soft-reserve TTL (ms)</span>
              <input
                type="number"
                min={1000}
                step={1000}
                className={fieldClass()}
                style={fieldStyle()}
                value={settings.imeiSoftReserveTtlMs}
                onChange={(e) =>
                  setSettings({ ...settings, imeiSoftReserveTtlMs: Number(e.target.value) || 0 })
                }
                disabled={!canEdit}
              />
            </label>
            <label className="block text-xs space-y-1">
              <span style={{ color: 'var(--text-muted)' }}>Discount authority %</span>
              <input
                type="number"
                min={0}
                className={fieldClass()}
                style={fieldStyle()}
                value={settings.discountAuthorityPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discountAuthorityPercent: Number(e.target.value) || 0,
                  })
                }
                disabled={!canEdit}
              />
            </label>
            <label className="block text-xs space-y-1">
              <span style={{ color: 'var(--text-muted)' }}>Default hold policy</span>
              <select
                className={fieldClass()}
                style={fieldStyle()}
                value={settings.defaultHoldPolicy}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultHoldPolicy: e.target.value as WholesaleSettings['defaultHoldPolicy'],
                  })
                }
                disabled={!canEdit}
              >
                <option value="PARTIAL_BACKORDER">Partial / backorder</option>
                <option value="HOLD_COMPLETE">Hold complete</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.allowPartialCarton}
                onChange={(e) =>
                  setSettings({ ...settings, allowPartialCarton: e.target.checked })
                }
                disabled={!canEdit}
              />
              <span style={{ color: 'var(--text-muted)' }}>Allow partial carton sales</span>
            </label>
          </div>
        )}
      </div>
    </WholesaleFeatureGate>
  )
}
