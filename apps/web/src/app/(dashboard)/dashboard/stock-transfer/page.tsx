'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeftRight, Building2, Loader2, Search, RefreshCw,
  CheckCircle, AlertTriangle, Package, ArrowDownRight, ArrowUpRight,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
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

export default function StockTransferPage() {
  const user = authStorage.getUser()
  const activeBranchId = getActiveBranchId() ?? ''
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingTransfers, setLoadingTransfers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [fromBranchId, setFromBranchId] = useState(activeBranchId)
  const [toBranchId, setToBranchId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')

  const canTransfer = user?.role === 'OWNER' || user?.role === 'MANAGER'

  useEffect(() => {
    branchesApi.list()
      .then((r: any) => {
        const list = (r.data ?? r ?? []).filter((b: Branch) => b.isActive !== false)
        setBranches(list)
        if (!fromBranchId && list[0]) setFromBranchId(list[0].id)
        if (!toBranchId && list.length > 1) {
          const other = list.find((b: Branch) => b.id !== (fromBranchId || list[0]?.id))
          if (other) setToBranchId(other.id)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false))
  }, [])

  useEffect(() => {
    if (activeBranchId) setFromBranchId(activeBranchId)
  }, [activeBranchId])

  const loadProducts = () => {
    if (!fromBranchId) return
    setLoadingProducts(true)
    productsApi.list({ branchId: fromBranchId, limit: '500' })
      .then((r: any) => setProducts((r.data?.data ?? r.data ?? []).filter((p: Product) => p.stock > 0)))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProducts(false))
  }

  const loadTransfers = () => {
    setLoadingTransfers(true)
    const params: Record<string, string> = { limit: '50' }
    if (fromBranchId) params.branchId = fromBranchId
    inventoryApi.listTransfers(params)
      .then((r: any) => setTransfers(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingTransfers(false))
  }

  useEffect(() => { loadProducts() }, [fromBranchId])
  useEffect(() => { loadTransfers() }, [fromBranchId])

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

  const destBranches = branches.filter(b => b.id !== fromBranchId)
  const transferIn = transfers.filter(t => t.type === 'TRANSFER_IN').length
  const transferOut = transfers.filter(t => t.type === 'TRANSFER_OUT').length

  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))
  const destOptions = destBranches.map(b => ({ value: b.id, label: b.name }))
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
      toast.success('Stock transferred successfully')
      setProductId('')
      setQuantity('1')
      setNotes('')
      loadProducts()
      loadTransfers()
    } catch (err: any) {
      toast.error(err?.message ?? 'Transfer failed')
    } finally {
      setSaving(false)
    }
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
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.original.product?.name}</p>
          <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{row.original.product?.sku}</p>
        </div>
      ),
    },
    {
      id: 'branch',
      accessorFn: row => row.branch?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Branch" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.original.branch?.name}</span>,
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
  ], [])

  if (branches.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Stock Transfer</h1>
          <p className="page-subtitle">Move inventory between your branch locations</p>
        </div>
        <div className="card p-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Multi-branch required</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Add a second branch under Branches to move stock between locations.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Stock Transfer</h1>
          <p className="page-subtitle">Move stock between branches — use the header for day-to-day branch switching</p>
        </div>
        <button type="button" onClick={() => { loadProducts(); loadTransfers() }}
          className="btn-secondary text-sm flex items-center gap-2 sm:ml-auto">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Products Ready', value: String(products.length), icon: <Package size={16} />, color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
          { label: 'Transfers In', value: String(transferIn), icon: <ArrowDownRight size={16} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.20)' },
          { label: 'Transfers Out', value: String(transferOut), icon: <ArrowUpRight size={16} />, color: '#b45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.20)' },
          { label: 'From Branch', value: branches.find(b => b.id === fromBranchId)?.name ?? '—', icon: <Building2 size={16} />, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.20)' },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <form onSubmit={handleSubmit} className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.25)' }}>
              <ArrowLeftRight size={14} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Transfer</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <button type="submit" disabled={saving || !canTransfer || !toBranchId || loadingBranches}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Transfer Stock
          </button>
        </form>

        <div className="lg:col-span-3 card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Transfers</h2>
            </div>
            {loadingTransfers && <Loader2 size={14} className="animate-spin text-violet-400" />}
          </div>
          <div className="p-2">
            {transfers.length === 0 && !loadingTransfers ? (
              <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No transfers yet for this branch</p>
            ) : (
              <ClientSideTable columns={columns} data={transfers} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
