'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ArrowLeftRight, Building2, Loader2, Search, RefreshCw,
  CheckCircle, AlertTriangle, Package, ArrowDownRight, ArrowUpRight, Plus, X, Layers, Smartphone,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { inventoryApi, productsApi } from '@/lib/api'
import { getActiveBranchId, getVisibleBranches } from '@/lib/active-branch'
import { authStorage } from '@/lib/auth'

import type { ProductVariation } from '@/types'

type Branch = { id: string; name: string; isActive?: boolean }
type Product = {
  id: string
  name: string
  sku: string
  stock: number
  trackImei?: boolean
  imeiInStock?: number
  branchId: string
  storageVariations?: ProductVariation[]
}
function hasTransferableStock(p: Product) {
  return p.stock > 0 || (p.trackImei && (p.imeiInStock ?? 0) > 0)
}
type TransferPreview = {
  catalogReady: boolean
  willMerge: boolean
  willRelocate: boolean
  trackImei: boolean
  requiresVariant?: boolean
  requiresImeiSelection?: boolean
  availableStock?: number
  variants?: Array<{ key: string; label: string; stock: number }>
}
type TransferImei = { id: string; imei: string; variation: string | null }
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
  const [variationKey, setVariationKey] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedImeis, setSelectedImeis] = useState<string[]>([])
  const [transferableImeis, setTransferableImeis] = useState<TransferImei[]>([])
  const [loadingImeis, setLoadingImeis] = useState(false)
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<TransferPreview | null>(null)

  const destBranches = branches.filter(b => b.id !== fromBranchId)
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))
  const destOptions = destBranches.map(b => ({ value: b.id, label: b.name }))

  useEffect(() => {
    if (!fromBranchId) return
    setLoadingProducts(true)
    setProductId('')
    productsApi.list({ branchId: fromBranchId, limit: '500' })
      .then((r: any) => setProducts((r.data?.data ?? r.data ?? []).filter((p: Product) => hasTransferableStock(p))))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProducts(false))
  }, [fromBranchId])

  useEffect(() => {
    if (!toBranchId && destBranches[0]) setToBranchId(destBranches[0].id)
    else if (toBranchId === fromBranchId) setToBranchId(destBranches[0]?.id ?? '')
  }, [fromBranchId, destBranches, toBranchId])

  useEffect(() => {
    if (!productId || !toBranchId || !fromBranchId) { setPreview(null); return }
    inventoryApi.previewTransfer(productId, toBranchId, fromBranchId, variationKey || undefined)
      .then((r: any) => setPreview(r.data ?? r))
      .catch(() => setPreview(null))
  }, [productId, toBranchId, fromBranchId, variationKey])

  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId),
    [products, productId],
  )

  const variantOptions = useMemo(() => {
    const rows = preview?.variants?.length
      ? preview.variants
      : (selectedProduct?.storageVariations ?? [])
          .filter(v => (v.stock ?? 0) > 0)
          .map(v => ({
            key: v.id ?? `${v.storage}::${v.colorName}`,
            label: `${v.storage} · ${v.colorName}`,
            stock: v.stock ?? 0,
          }))
    return rows.map(v => ({
      value: v.key,
      label: `${v.label} · ${v.stock} in stock`,
    }))
  }, [preview?.variants, selectedProduct])

  const requiresVariant = preview ? !!preview.requiresVariant : variantOptions.length > 0
  const isImeiProduct = !!selectedProduct?.trackImei
  const canPickImeis = isImeiProduct && !!productId && !!fromBranchId && (!requiresVariant || !!variationKey)

  useEffect(() => {
    if (!canPickImeis) {
      setTransferableImeis([])
      setSelectedImeis([])
      return
    }
    setLoadingImeis(true)
    setSelectedImeis([])
    inventoryApi.listTransferImeis(productId, fromBranchId, variationKey || undefined)
      .then((r: any) => setTransferableImeis(r.data ?? r ?? []))
      .catch(() => setTransferableImeis([]))
      .finally(() => setLoadingImeis(false))
  }, [canPickImeis, productId, fromBranchId, variationKey])

  useEffect(() => {
    if (isImeiProduct) setQuantity(selectedImeis.length > 0 ? String(selectedImeis.length) : '')
  }, [selectedImeis, isImeiProduct])

  const toggleImei = (imei: string) => {
    setSelectedImeis(prev => (prev.includes(imei) ? prev.filter(x => x !== imei) : [...prev, imei]))
  }

  const availableStock = useMemo(() => {
    if (preview?.availableStock != null) return preview.availableStock
    if (variationKey && selectedProduct?.storageVariations) {
      const v = selectedProduct.storageVariations.find(row =>
        row.id === variationKey ||
        `${row.storage}::${row.colorName}` === variationKey ||
        row.sku === variationKey,
      )
      return v?.stock ?? 0
    }
    return selectedProduct?.stock ?? 0
  }, [preview?.availableStock, variationKey, selectedProduct])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, search])

  const productOptions = filteredProducts.map(p => {
    const qty = p.trackImei ? (p.imeiInStock ?? p.stock) : p.stock
    return {
      value: p.id,
      label: `${p.name} · ${qty} in stock${p.trackImei ? ' · IMEI' : ''}`,
    }
  })

  const handleQuantityChange = (raw: string) => {
    if (raw === '') { setQuantity(''); return }
    const digits = raw.replace(/\D/g, '')
    if (!digits) return
    const n = parseInt(digits, 10)
    const max = availableStock
    if (max > 0 && n > max) {
      setQuantity(String(max))
      return
    }
    setQuantity(digits)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canTransfer) { toast.error('Only Owner or Manager can transfer stock'); return }
    if (!fromBranchId || !toBranchId) { toast.error('Select branches'); return }
    if (!productId) { toast.error('Select a product'); return }
    if (requiresVariant && !variationKey) { toast.error('Select a variant'); return }
    let qty = parseInt(quantity, 10)
    if (isImeiProduct) {
      if (selectedImeis.length === 0) { toast.error('Select at least one IMEI'); return }
      qty = selectedImeis.length
    }
    if (!qty || qty <= 0) { toast.error('Enter valid quantity'); return }
    if (!isImeiProduct && qty > availableStock) {
      toast.error('Quantity exceeds available stock')
      return
    }
    if (isImeiProduct && qty > availableStock) {
      toast.error('Selected IMEIs exceed available stock')
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
        variationKey: variationKey || undefined,
        imeis: isImeiProduct ? selectedImeis : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" data-modal="dark">
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto bg-[#0f1623] border border-white/10 text-white">
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10 bg-[#0f1623] border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/25">
              <ArrowLeftRight size={14} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-white">New Stock Transfer</h3>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-white">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-white">From Branch</label>
              <FilterDropdown
                value={fromBranchId}
                onChange={v => { setFromBranchId(v); setProductId('') }}
                options={branchOptions}
                icon={Building2}
                placeholder="Source branch"
                active={!!fromBranchId}
                tone="dark"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-white">To Branch</label>
              <FilterDropdown
                value={toBranchId}
                onChange={setToBranchId}
                options={destOptions}
                icon={Building2}
                placeholder="Destination"
                active={!!toBranchId}
                onClear={() => setToBranchId('')}
                tone="dark"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-white">Product</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
              <input className="input-field pl-9 text-sm text-white placeholder:text-white/50" placeholder="Search by name or SKU…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <FilterDropdown
              value={productId}
              onChange={v => {
                setProductId(v)
                setVariationKey('')
                setSelectedImeis([])
                const p = products.find(x => x.id === v)
                const hasVars = Array.isArray(p?.storageVariations) && p.storageVariations.some(row => (row.stock ?? 0) > 0)
                if (p && !p.trackImei && !hasVars) setQuantity('1')
                else if (!p?.trackImei) setQuantity('1')
                else setQuantity('')
              }}
              options={productOptions}
              icon={Package}
              placeholder={loadingProducts ? 'Loading products…' : 'Select product'}
              active={!!productId}
              onClear={() => { setProductId(''); setVariationKey(''); setSelectedImeis([]) }}
              tone="dark"
            />
          </div>

          {requiresVariant && productId && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-white">Variant</label>
              <FilterDropdown
                value={variationKey}
                onChange={v => {
                  setVariationKey(v)
                  setSelectedImeis([])
                  if (!selectedProduct?.trackImei) setQuantity('1')
                  else setQuantity('')
                }}
                options={variantOptions}
                icon={Layers}
                placeholder="Select storage / color variant"
                active={!!variationKey}
                onClear={() => setVariationKey('')}
                tone="dark"
              />
            </div>
          )}

          {canPickImeis && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-white">Select IMEI units</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-white hover:text-white/80 disabled:opacity-40"
                    onClick={() => setSelectedImeis(transferableImeis.map(r => r.imei))}
                    disabled={loadingImeis || transferableImeis.length === 0}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-white hover:text-white/80 disabled:opacity-40"
                    onClick={() => setSelectedImeis([])}
                    disabled={selectedImeis.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] max-h-44 overflow-y-auto">
                {loadingImeis ? (
                  <p className="text-xs text-white px-3 py-4 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin" /> Loading IMEIs…
                  </p>
                ) : transferableImeis.length === 0 ? (
                  <p className="text-xs text-white px-3 py-4">No in-stock IMEIs for this selection</p>
                ) : transferableImeis.map(row => {
                  const checked = selectedImeis.includes(row.imei)
                  return (
                    <label
                      key={row.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-white/5 last:border-0 transition-colors ${
                        checked ? 'bg-violet-500/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-white/20 bg-transparent text-violet-500 focus:ring-violet-500/40"
                        checked={checked}
                        onChange={() => toggleImei(row.imei)}
                      />
                      <Smartphone size={12} className="text-white" />
                      <span className="text-xs font-mono text-white">{row.imei}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] text-white mt-1.5">
                {selectedImeis.length} of {transferableImeis.length} IMEI{transferableImeis.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}

          {!isImeiProduct && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-white">Quantity</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input-field text-sm text-white placeholder:text-white/50 caret-white"
                value={quantity}
                onChange={e => handleQuantityChange(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div className="flex items-end pb-2">
              {(selectedProduct && (!requiresVariant || variationKey)) && (
                <p className="text-xs text-white">
                  Available: <span className="font-semibold text-white">{availableStock}</span>
                  {variationKey && variantOptions.find(v => v.value === variationKey) && (
                    <span className="block text-[10px] text-white/80 mt-0.5">
                      {variantOptions.find(v => v.value === variationKey)?.label.split(' · ').slice(0, 2).join(' · ')}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          )}

          {isImeiProduct && canPickImeis && (
            <div className="rounded-lg px-3 py-2 text-xs bg-violet-500/10 border border-violet-500/20 text-white">
              Quantity: <span className="font-semibold text-white">{selectedImeis.length}</span>
              {' '}unit{selectedImeis.length === 1 ? '' : 's'} (from selected IMEIs)
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5 text-white">Notes</label>
            <input className="input-field text-sm text-white placeholder:text-white/50" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional reference or reason" />
          </div>

          {isImeiProduct && canPickImeis && selectedImeis.length === 0 && (
            <div className="rounded-lg px-3 py-2 text-xs text-white flex items-center gap-2 bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle size={13} className="text-white flex-shrink-0" />
              Select one or more IMEI units to transfer
            </div>
          )}

          {selectedProduct && toBranchId && preview && (
            <div className="rounded-lg px-3 py-2.5 text-xs bg-violet-500/10 border border-violet-500/20 text-white">
              {preview.catalogReady ? (
                <p className="text-white flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-white flex-shrink-0" />
                  Catalog already exists at destination — stock will merge into it
                </p>
              ) : preview.willRelocate ? (
                <p className="text-white">
                  No catalog at destination yet — full transfer will move this product row to the destination branch
                </p>
              ) : (
                <p className="text-white">
                  A catalog entry will be created at the destination branch when stock is transferred
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm text-white">Cancel</button>
            <button type="submit"
              disabled={
                saving || !canTransfer || !toBranchId || (requiresVariant && !variationKey)
                || (isImeiProduct && canPickImeis && selectedImeis.length === 0)
              }
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
    const visible = getVisibleBranches()
    setBranches(visible.map(b => ({ id: b.id, name: b.name, isActive: b.isActive })))
    setLoadingBranches(false)
  }, [])

  useEffect(() => {
    if (activeBranchId) setViewBranchId(activeBranchId)
  }, [activeBranchId])

  const loadProducts = useCallback(() => {
    if (!viewBranchId) return
    setLoadingProducts(true)
    productsApi.list({ branchId: viewBranchId, limit: '500' })
      .then((r: any) => setProducts((r.data?.data ?? r.data ?? []).filter((p: Product) => hasTransferableStock(p))))
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
            'Products with variants: select storage/color, then transfer that variant qty.',
            'Step 1: Edit product → copy catalog. Step 2: transfer stock & IMEI here.',
            'IMEI-tracked variants must transfer in full quantity.',
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
