'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ArrowLeftRight, Building2, Loader2, Search, RefreshCw,
  CheckCircle, AlertTriangle, Package, ArrowDownRight, ArrowUpRight, Plus, X,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { inventoryApi, productsApi, branchesApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import { authStorage } from '@/lib/auth'

type Branch = { id: string; name: string; isActive?: boolean }
type Product = { id: string; name: string; sku: string; stock: number; trackImei?: boolean; branchId: string }
type TransferRow = {
  id: string
  type: string
  quantity: number
  reference: string | null
  note: string | null
  createdAt: string
  product: { id: string; name: string; sku: string }
  branch: { id: string; name: string }
}

function TransferModal({
  branches,
  defaultFromBranchId,
  onClose,
  onSaved,
}: {
  branches: Branch[]
  defaultFromBranchId: string
  onClose: () => void
  onSaved: () => void
}) {
  const user = authStorage.getUser()
  const canTransfer = user?.role === 'OWNER' || user?.role === 'MANAGER'

  const [fromBranchId, setFromBranchId] = useState(defaultFromBranchId)
  const [toBranchId, setToBranchId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<{
    catalogReady: boolean
    willMerge: boolean
    willRelocate: boolean
    trackImei: boolean
  } | null>(null)

  const destBranches = branches.filter(b => b.id !== fromBranchId)
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))
  const destOptions = destBranches.map(b => ({ value: b.id, label: b.name }))

  useEffect(() => {
    if (!fromBranchId) return
    setLoadingProducts(true)
    setProductId('')
    productsApi.list({ branchId: fromBranchId, limit: '500' })
      .then((r: any) => setProducts((r.data?.data ?? r.data ?? []).filter((p: Product) => p.stock > 0)))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProducts(false))
  }, [fromBranchId])

  useEffect(() => {
    if (!toBranchId && destBranches[0]) setToBranchId(destBranches[0].id)
    else if (toBranchId === fromBranchId) setToBranchId(destBranches[0]?.id ?? '')
  }, [fromBranchId, destBranches, toBranchId])

  useEffect(() => {
    if (!productId || !toBranchId) { setPreview(null); return }
    inventoryApi.previewTransfer(productId, toBranchId)
      .then((r: any) => setPreview(r.data ?? r))
      .catch(() => setPreview(null))
  }, [productId, toBranchId])

  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId),
    [products, productId],
  )

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, search])

  const productOptions = filteredProducts.map(p => ({
    value: p.id,
    label: `${p.name} · ${p.stock} in stock${p.trackImei ? ' · IMEI' : ''}`,
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canTransfer) { toast.error('Only Owner or Manager can transfer stock'); return }
    if (!fromBranchId || !toBranchId) { toast.error('Select branches'); return }
    if (!productId) { toast.error('Select a product'); return }
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) { toast.error('Enter valid quantity'); return }
    if (selectedProduct?.trackImei && qty !== selectedProduct.stock) {
      toast.error('IMEI products must transfer full quantity')
      return
    }
    if (selectedProduct && qty > selectedProduct.stock) {
      toast.error('Quantity exceeds available stock')
      return
    }

    setSaving(true)
    try {
      await inventoryApi.transfer({
        productId,
        fromBranchId,
        toBranchId,
        quantity: qty,
        notes: notes.trim() || undefined,
      })
      toast.success(
        preview?.willMerge
          ? 'Stock merged into destination catalog'
          : preview?.willRelocate
            ? 'Stock relocated to destination branch'
            : 'Stock transferred successfully',
      )
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Transfer failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.25)' }}>
              <ArrowLeftRight size={14} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Stock Transfer</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>From Branch</label>
              <FilterDropdown
                value={fromBranchId}
                onChange={v => { setFromBranchId(v); setProductId('') }}
                options={branchOptions}
                icon={Building2}
                placeholder="Source branch"
                active={!!fromBranchId}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>To Branch</label>
              <FilterDropdown
                value={toBranchId}
                onChange={setToBranchId}
                options={destOptions}
                icon={Building2}
                placeholder="Destination"
                active={!!toBranchId}
                onClear={() => setToBranchId('')}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Product</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input className="input-field pl-9 text-sm" placeholder="Search by name or SKU…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <FilterDropdown
              value={productId}
              onChange={v => {
                setProductId(v)
                const p = products.find(x => x.id === v)
                if (p?.trackImei) setQuantity(String(p.stock))
              }}
              options={productOptions}
              icon={Package}
              placeholder={loadingProducts ? 'Loading products…' : 'Select product'}
              active={!!productId}
              onClear={() => setProductId('')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Quantity</label>
              <input type="number" min={1} className="input-field text-sm" value={quantity}
                onChange={e => setQuantity(e.target.value)}
                disabled={!!selectedProduct?.trackImei} />
            </div>
            <div className="flex items-end pb-2">
              {selectedProduct && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Available: <span className="font-semibold text-violet-400">{selectedProduct.stock}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <input className="input-field text-sm" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional reference or reason" />
          </div>

          {selectedProduct?.trackImei && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={12} /> IMEI devices transfer in full with all in-stock units
            </p>
          )}

          {selectedProduct && toBranchId && preview && (
            <div className="rounded-xl p-3 text-xs space-y-1"
              style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.18)' }}>
              {preview.catalogReady ? (
                <p className="text-blue-300 flex items-center gap-1.5">
                  <CheckCircle size={12} /> Catalog already exists at destination — stock will merge into it
                </p>
              ) : preview.willRelocate ? (
                <p style={{ color: 'var(--text-muted)' }}>
                  No catalog at destination yet — full transfer will move this product row to the destination branch
                </p>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>
                  A catalog entry will be created at the destination branch when stock is transferred
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={saving || !canTransfer || !toBranchId}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Transfer Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StockTransferPage() {
  const user = authStorage.getUser()
  const activeBranchId = getActiveBranchId() ?? ''
  const canTransfer = user?.role === 'OWNER' || user?.role === 'MANAGER'

  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingTransfers, setLoadingTransfers] = useState(true)
  const [showTransfer, setShowTransfer] = useState(false)
  const [viewBranchId, setViewBranchId] = useState(activeBranchId)

  useEffect(() => {
    branchesApi.list()
      .then((r: any) => {
        const list = (r.data ?? r ?? []).filter((b: Branch) => b.isActive !== false)
        setBranches(list)
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false))
  }, [])

  useEffect(() => {
    if (activeBranchId) setViewBranchId(activeBranchId)
  }, [activeBranchId])

  const loadProducts = useCallback(() => {
    if (!viewBranchId) return
    setLoadingProducts(true)
    productsApi.list({ branchId: viewBranchId, limit: '500' })
      .then((r: any) => setProducts((r.data?.data ?? r.data ?? []).filter((p: Product) => p.stock > 0)))
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [viewBranchId])

  const loadTransfers = useCallback(() => {
    setLoadingTransfers(true)
    const params: Record<string, string> = { limit: '100' }
    if (viewBranchId) params.branchId = viewBranchId
    inventoryApi.listTransfers(params)
      .then((r: any) => setTransfers(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error('Failed to load transfers'))
      .finally(() => setLoadingTransfers(false))
  }, [viewBranchId])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadTransfers() }, [loadTransfers])

  const transferIn = transfers.filter(t => t.type === 'TRANSFER_IN').length
  const transferOut = transfers.filter(t => t.type === 'TRANSFER_OUT').length
  const totalQty = transfers.reduce((s, t) => s + Math.abs(t.quantity), 0)

  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))

  const handleRefresh = () => {
    loadProducts()
    loadTransfers()
  }

  const handleSaved = () => {
    loadProducts()
    loadTransfers()
  }

  const columns = useMemo<ColumnDef<TransferRow>[]>(() => [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'product',
      accessorFn: row => row.product?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.20)' }}>
            <Package size={13} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.original.product?.name}</p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{row.original.product?.sku}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'branch',
      accessorFn: row => row.branch?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Branch" />,
      cell: ({ row }) => (
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          <Building2 size={11} className="opacity-60" />
          {row.original.branch?.name}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
          row.original.type === 'TRANSFER_IN'
            ? 'text-green-400 bg-green-500/10 border-green-500/20'
            : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        }`}>
          {row.original.type === 'TRANSFER_IN' ? 'Transfer In' : 'Transfer Out'}
        </span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Qty" />,
      cell: ({ row }) => (
        <span className="text-sm font-mono font-semibold"
          style={{ color: row.original.quantity > 0 ? '#4ade80' : '#fbbf24' }}>
          {row.original.quantity > 0 ? `+${row.original.quantity}` : row.original.quantity}
        </span>
      ),
    },
    {
      id: 'note',
      accessorFn: row => row.note ?? row.reference ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Notes" />,
      cell: ({ row }) => {
        const text = row.original.note ?? row.original.reference
        return text
          ? <span className="text-xs truncate max-w-[160px] block" style={{ color: 'var(--text-muted)' }}>{text}</span>
          : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
      },
    },
  ], [])

  if (!loadingBranches && branches.length < 2) {
    const isOwner = user?.role === 'OWNER'
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Stock Transfer</h1>
          <p className="page-subtitle">Move inventory between your branch locations</p>
        </div>
        <EmptyState
          icon={Building2}
          title="Multi-branch required"
          description="Add at least two branches to move stock between locations. Use the header branch selector for day-to-day operations."
          accentColor="amber"
          actions={isOwner ? [{ label: 'Manage Branches', href: '/dashboard/branches', primary: true }] : []}
          hints={[
            'Stock moves from one branch and appears in the destination branch.',
            'IMEI-tracked products transfer all in-stock units together.',
            'Only Owner and Manager roles can initiate transfers.',
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showTransfer && (
        <TransferModal
          branches={branches}
          defaultFromBranchId={viewBranchId || branches[0]?.id || ''}
          onClose={() => setShowTransfer(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Two-step flow */}
      <div className="rounded-2xl p-4 grid sm:grid-cols-2 gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-violet-400"
            style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.22)' }}>
            <Package size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>1. Product Edit — Catalog</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Copy image, prices &amp; details to another branch. Stock stays at the source branch.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-400"
            style={{ background: 'rgba(29,78,216,0.10)', border: '1px solid rgba(29,78,216,0.22)' }}>
            <ArrowLeftRight size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>2. Stock Transfer — Inventory</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Move physical stock &amp; IMEI units between branches. Merges into existing catalog when ready.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Stock Transfer</h1>
          <p className="page-subtitle">Move stock between branches — use the header for day-to-day branch switching</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button type="button" onClick={handleRefresh} disabled={loadingTransfers || loadingProducts}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={loadingTransfers ? 'animate-spin' : ''} />
            Refresh
          </button>
          {canTransfer && (
            <button type="button" onClick={() => setShowTransfer(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus size={14} />New Transfer
            </button>
          )}
        </div>
      </div>

      {/* Branch filter + KPI */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {branches.length > 1 && (
          <div className="sm:max-w-[220px]">
            <FilterDropdown
              value={viewBranchId}
              onChange={setViewBranchId}
              options={branchOptions}
              icon={Building2}
              placeholder="View branch"
              active={!!viewBranchId}
            />
          </div>
        )}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Showing transfer history for <strong style={{ color: 'var(--text-secondary)' }}>{branches.find(b => b.id === viewBranchId)?.name ?? 'selected branch'}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Products Ready', value: loadingProducts ? '…' : String(products.length), icon: <Package size={15} />, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.22)' },
          { label: 'Transfers In', value: String(transferIn), icon: <ArrowDownRight size={15} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.22)' },
          { label: 'Transfers Out', value: String(transferOut), icon: <ArrowUpRight size={15} />, color: '#b45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.22)' },
          { label: 'Units Moved', value: String(totalQty), icon: <ArrowLeftRight size={15} />, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.22)' },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>
                {icon}
              </div>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table or Empty */}
      {!loadingTransfers && transfers.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transfers yet"
          description="Move products from one branch to another. Stock is deducted at the source and added at the destination automatically."
          accentColor="violet"
          actions={canTransfer ? [{ label: 'Create First Transfer', onClick: () => setShowTransfer(true), primary: true }] : []}
          hints={[
            'Step 1: Edit product → copy catalog to another branch (details only).',
            'Step 2: Stock Transfer → move units and IMEI to the destination.',
            'IMEI-tracked devices must transfer in full quantity.',
          ]}
        />
      ) : (
        <ClientSideTable
          data={transfers}
          columns={columns}
          isLoading={loadingTransfers}
          pageCount={Math.ceil((transfers.length || 1) / 20)}
          searchableColumns={[
            { id: 'product', title: 'Product' },
            { id: 'branch', title: 'Branch' },
            { id: 'note', title: 'Notes' },
          ]}
          filterableColumns={[{
            id: 'type',
            title: 'Type',
            options: [
              { label: 'Transfer In', value: 'TRANSFER_IN' },
              { label: 'Transfer Out', value: 'TRANSFER_OUT' },
            ],
          }]}
        />
      )}
    </div>
  )
}
