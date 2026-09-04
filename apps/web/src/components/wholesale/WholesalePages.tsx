'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2, ClipboardList, FileText, Loader2, Plus, ShoppingCart,
  Tag, Wallet, BarChart3, Settings,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency } from '@/lib/utils'
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
  WholesaleModalShell,
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
            <WholesaleKpiCard label="Open orders" value={openOrders} icon={ClipboardList} tone="violet" />
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

/* ── Dealers ─────────────────────────────────────────────────────────── */

export function WholesaleDealersPage() {
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<WholesaleDealer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

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
      setShowCreate(true)
    }
    const id = params.get('id')
    if (id) setDetailId(id)
  }, [])

  useEffect(() => {
    if (!detailId && !showCreate) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailId(null)
        setShowCreate(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId, showCreate])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (d) =>
        d.legalName.toLowerCase().includes(q) ||
        (d.tradingName ?? '').toLowerCase().includes(q) ||
        d.dealerCode.toLowerCase().includes(q) ||
        d.phone.includes(q),
    )
  }, [rows, search])

  const columns = useMemo<ColumnDef<WholesaleDealer>[]>(
    () => [
      {
        accessorKey: 'dealerCode',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setDetailId(row.original.id)}
          >
            {row.original.dealerCode}
          </button>
        ),
      },
      {
        accessorKey: 'legalName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dealer" />,
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => setDetailId(row.original.id)}>
            <p className="text-sm font-semibold text-sky-700 hover:underline">
              {row.original.tradingName || row.original.legalName}
            </p>
            {row.original.tradingName && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {row.original.legalName}
              </p>
            )}
          </button>
        ),
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700">
            {row.original.status}
          </span>
        ),
      },
      {
        accessorKey: 'creditLimit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Credit limit" />,
        cell: ({ row }) => formatCurrency(Number(row.original.creditLimit ?? 0)),
      },
      {
        accessorKey: 'totalDue',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
        cell: ({ row }) => (
          <span className={Number(row.original.totalDue) > 0 ? 'text-amber-600 font-semibold' : ''}>
            {formatCurrency(Number(row.original.totalDue ?? 0))}
          </span>
        ),
      },
      {
        id: 'tier',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tier" />,
        cell: ({ row }) => row.original.tier?.name ?? '—',
      },
      {
        id: 'actions',
        header: () => <span className="text-xs">Actions</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={() => setDetailId(row.original.id)}
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
          title="Dealers"
          subtitle="B2B dealer accounts, credit limits and outstanding balances"
          action={
            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  viewOnlyToast('dealers')
                  return
                }
                setShowCreate(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500"
            >
              <Plus size={15} />
              New dealer
            </button>
          }
        />

        <div className="flex items-center gap-3">
          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder="Search dealers…"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <WholesaleEmptyState
            title="No dealers yet"
            description="Create a dealer to start wholesale counter sales and credit accounts."
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

        {showCreate && (
          <CreateDealerModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}

        {detailId && (
          <DealerDetailModal
            id={detailId}
            onClose={() => setDetailId(null)}
            onChanged={load}
          />
        )}
      </div>
    </WholesaleFeatureGate>
  )
}

function CreateDealerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    legalName: '',
    tradingName: '',
    phone: '',
    email: '',
    creditLimit: '0',
    paymentTermsDays: '0',
    cashOnly: false,
    status: 'ACTIVE',
    notes: '',
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
    if (!form.legalName.trim() || !form.phone.trim()) {
      toast.error('Legal name and phone are required')
      return
    }
    setSaving(true)
    try {
      await wholesaleApi.createDealer({
        legalName: form.legalName.trim(),
        tradingName: form.tradingName.trim() || null,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        creditLimit: Number(form.creditLimit) || 0,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
        cashOnly: form.cashOnly,
        status: form.status,
        notes: form.notes.trim() || null,
      })
      toast.success('Dealer created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create dealer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleModalShell title="New dealer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs space-y-1">
            <span style={{ color: 'var(--text-muted)' }}>Legal name *</span>
            <input
              className={fieldClass()}
              style={fieldStyle()}
              value={form.legalName}
              onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
              autoFocus
              required
            />
          </label>
          <label className="block text-xs space-y-1">
            <span style={{ color: 'var(--text-muted)' }}>Trading name</span>
            <input
              className={fieldClass()}
              style={fieldStyle()}
              value={form.tradingName}
              onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))}
            />
          </label>
          <label className="block text-xs space-y-1">
            <span style={{ color: 'var(--text-muted)' }}>Phone *</span>
            <input
              className={fieldClass()}
              style={fieldStyle()}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
            />
          </label>
          <label className="block text-xs space-y-1">
            <span style={{ color: 'var(--text-muted)' }}>Email</span>
            <input
              type="email"
              className={fieldClass()}
              style={fieldStyle()}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-xs space-y-1">
            <span style={{ color: 'var(--text-muted)' }}>Credit limit</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={fieldClass()}
              style={fieldStyle()}
              value={form.creditLimit}
              onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
            />
          </label>
          <label className="block text-xs space-y-1">
            <span style={{ color: 'var(--text-muted)' }}>Payment terms (days)</span>
            <input
              type="number"
              min={0}
              className={fieldClass()}
              style={fieldStyle()}
              value={form.paymentTermsDays}
              onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.cashOnly}
            onChange={(e) => setForm((f) => ({ ...f, cashOnly: e.target.checked }))}
          />
          <span style={{ color: 'var(--text-muted)' }}>Cash only (no credit)</span>
        </label>
        <label className="block text-xs space-y-1">
          <span style={{ color: 'var(--text-muted)' }}>Notes</span>
          <textarea
            className={fieldClass()}
            style={fieldStyle()}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </WholesaleModalShell>
  )
}

/* ── Pricing ─────────────────────────────────────────────────────────── */

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

export function WholesalePricingPage() {
  const { canEdit } = useModuleAccess()
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [lists, setLists] = useState<PriceListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showTier, setShowTier] = useState(false)
  const [showList, setShowList] = useState(false)
  const [tierName, setTierName] = useState('')
  const [listName, setListName] = useState('')
  const [listDefault, setListDefault] = useState(false)
  const [saving, setSaving] = useState(false)

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
    if (!showTier && !showList) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTier(false)
        setShowList(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showTier, showList])

  const createTier = async () => {
    if (!tierName.trim()) return
    setSaving(true)
    try {
      await wholesaleApi.createTier({ name: tierName.trim() })
      toast.success('Tier created')
      setShowTier(false)
      setTierName('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const createList = async () => {
    if (!listName.trim()) return
    setSaving(true)
    try {
      await wholesaleApi.createPriceList({
        name: listName.trim(),
        isDefault: listDefault,
      })
      toast.success('Price list created')
      setShowList(false)
      setListName('')
      setListDefault(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WholesaleFeatureGate>
      <div className="space-y-6">
        <WholesalePageHeader
          title="Wholesale pricing"
          subtitle="Dealer tiers and price lists for B2B unit prices"
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!canEdit) return viewOnlyToast('pricing')
                  setShowTier(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <Plus size={14} /> Tier
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canEdit) return viewOnlyToast('pricing')
                  setShowList(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white bg-sky-600"
              >
                <Plus size={14} /> Price list
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sky-500" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Dealer tiers
              </h2>
              {tiers.length === 0 ? (
                <WholesaleEmptyState title="No tiers" description="Create tiers to group dealers for price lists." />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {tiers.map((t) => (
                    <li key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {t.code || '—'} · {t._count?.dealers ?? 0} dealers
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {t.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Price lists
              </h2>
              {lists.length === 0 ? (
                <WholesaleEmptyState
                  title="No price lists"
                  description="Create a default or tier-scoped wholesale price list."
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {lists.map((l) => (
                    <li key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {l.name}
                          {l.isDefault ? (
                            <span className="ml-2 text-[10px] font-semibold text-sky-600">DEFAULT</span>
                          ) : null}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {l.tier?.name ?? 'All tiers'} · {l._count?.items ?? 0} items · {l.currency ?? 'LKR'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {showTier && (
          <WholesaleModalShell title="New dealer tier" onClose={() => setShowTier(false)}>
            <div className="space-y-3">
              <input
                className={fieldClass()}
                style={fieldStyle()}
                placeholder="Tier name"
                value={tierName}
                onChange={(e) => setTierName(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTier(false)} className="text-sm px-3 py-2">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={createTier}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
                >
                  Create
                </button>
              </div>
            </div>
          </WholesaleModalShell>
        )}

        {showList && (
          <WholesaleModalShell title="New price list" onClose={() => setShowList(false)}>
            <div className="space-y-3">
              <input
                className={fieldClass()}
                style={fieldStyle()}
                placeholder="Price list name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                autoFocus
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={listDefault}
                  onChange={(e) => setListDefault(e.target.checked)}
                />
                Default list
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowList(false)} className="text-sm px-3 py-2">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={createList}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-sky-600"
                >
                  Create
                </button>
              </div>
            </div>
          </WholesaleModalShell>
        )}
      </div>
    </WholesaleFeatureGate>
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
