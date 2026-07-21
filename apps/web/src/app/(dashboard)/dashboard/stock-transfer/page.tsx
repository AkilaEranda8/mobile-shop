'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeftRight, Building2, Loader2, RefreshCw,
  CheckCircle, AlertTriangle, Package, ArrowDownRight, ArrowUpRight, Plus, X, Layers, Smartphone,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const labelCls = 'block text-xs font-medium mb-1.5'
  const labelStyle = { color: 'var(--text-secondary)' } as const
  const hintStyle = { color: 'var(--text-muted)' } as const
  const panelStyle = {
    background: 'var(--bg-subtle)',
    borderColor: 'var(--border-subtle)',
    color: 'var(--text-primary)',
  } as const
  const brandPanelStyle = {
    background: 'var(--brand-glow)',
    borderColor: 'var(--sidebar-active-border)',
    color: 'var(--text-primary)',
  } as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 dark:bg-black/65 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New Stock Transfer"
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: 'var(--brand-glow)', borderColor: 'var(--sidebar-active-border)', color: 'var(--brand-primary)' }}
            >
              <ArrowLeftRight size={14} />
            </div>
            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>New Stock Transfer</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:opacity-90"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>From Branch</label>
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
              <label className={labelCls} style={labelStyle}>To Branch</label>
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
            <label className={labelCls} style={labelStyle}>Product</label>
            <ToolbarSearch
              inputId="transfer-product-search"
              value={search}
              onChange={setSearch}
              placeholder="Search by name or SKU…"
              className="max-w-none mb-2"
              autoFocus
            />
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
            />
          </div>

          {requiresVariant && productId && (
            <div>
              <label className={labelCls} style={labelStyle}>Variant</label>
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
              />
            </div>
          )}

          {canPickImeis && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium" style={labelStyle}>Select IMEI units</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] font-semibold disabled:opacity-40"
                    style={{ color: 'var(--brand-primary)' }}
                    onClick={() => setSelectedImeis(transferableImeis.map(r => r.imei))}
                    disabled={loadingImeis || transferableImeis.length === 0}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-[10px] font-semibold disabled:opacity-40"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => setSelectedImeis([])}
                    disabled={selectedImeis.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="rounded-lg border max-h-44 overflow-y-auto" style={panelStyle}>
                {loadingImeis ? (
                  <p className="text-xs px-3 py-4 flex items-center gap-2" style={hintStyle}>
                    <Loader2 size={13} className="animate-spin" /> Loading IMEIs…
                  </p>
                ) : transferableImeis.length === 0 ? (
                  <p className="text-xs px-3 py-4" style={hintStyle}>No in-stock IMEIs for this selection</p>
                ) : transferableImeis.map(row => {
                  const checked = selectedImeis.includes(row.imei)
                  return (
                    <label
                      key={row.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b last:border-0 transition-colors"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: checked ? 'var(--brand-glow)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        className="rounded focus:ring-offset-0"
                        style={{ accentColor: 'var(--brand-primary)' }}
                        checked={checked}
                        onChange={() => toggleImei(row.imei)}
                      />
                      <Smartphone size={12} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{row.imei}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] mt-1.5" style={hintStyle}>
                {selectedImeis.length} of {transferableImeis.length} IMEI{transferableImeis.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}

          {!isImeiProduct && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Quantity</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input-field text-sm"
                value={quantity}
                onChange={e => handleQuantityChange(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div className="flex items-end pb-2">
              {(selectedProduct && (!requiresVariant || variationKey)) && (
                <p className="text-xs" style={hintStyle}>
                  Available:{' '}
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{availableStock}</span>
                  {variationKey && variantOptions.find(v => v.value === variationKey) && (
                    <span className="block text-[10px] mt-0.5">
                      {variantOptions.find(v => v.value === variationKey)?.label.split(' · ').slice(0, 2).join(' · ')}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          )}

          {isImeiProduct && canPickImeis && (
            <div className="rounded-lg px-3 py-2 text-xs border" style={brandPanelStyle}>
              Quantity: <span className="font-semibold">{selectedImeis.length}</span>
              {' '}unit{selectedImeis.length === 1 ? '' : 's'} (from selected IMEIs)
            </div>
          )}

          <div>
            <label className={labelCls} style={labelStyle}>Notes</label>
            <input
              className="input-field text-sm"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional reference or reason"
            />
          </div>

          {isImeiProduct && canPickImeis && selectedImeis.length === 0 && (
            <div
              className="rounded-lg px-3 py-2 text-xs flex items-center gap-2 border"
              style={{ background: 'color-mix(in srgb, var(--status-warn) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--status-warn) 28%, transparent)', color: 'var(--text-primary)' }}
            >
              <AlertTriangle size={13} className="flex-shrink-0" style={{ color: 'var(--status-warn)' }} />
              Select one or more IMEI units to transfer
            </div>
          )}

          {selectedProduct && toBranchId && preview && (
            <div className="rounded-lg px-3 py-2.5 text-xs border" style={brandPanelStyle}>
              {preview.catalogReady ? (
                <p className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                  Catalog already exists at destination — stock will merge into it
                </p>
              ) : preview.willRelocate ? (
                <p>
                  No catalog at destination yet — full transfer will move this product row to the destination branch
                </p>
              ) : (
                <p>
                  A catalog entry will be created at the destination branch when stock is transferred
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button
              type="submit"
              disabled={
                saving || !canTransfer || !toBranchId || (requiresVariant && !variationKey)
                || (isImeiProduct && canPickImeis && selectedImeis.length === 0)
              }
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
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
  const searchParams = useSearchParams()
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
  const [transferSearch, setTransferSearch] = useState('')

  useEffect(() => {
    const visible = getVisibleBranches()
    setBranches(visible.map(b => ({ id: b.id, name: b.name, isActive: b.isActive })))
    setLoadingBranches(false)
  }, [])

  useEffect(() => {
    if (activeBranchId) setViewBranchId(activeBranchId)
  }, [activeBranchId])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new' || action === 'add' || action === 'transfer' || searchParams.get('new') === '1') {
      setShowTransfer(true)
    }
  }, [searchParams])

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

  const filteredTransfers = useMemo(() => {
    const q = transferSearch.trim().toLowerCase()
    if (!q) return transfers
    return transfers.filter(t =>
      t.product?.name?.toLowerCase().includes(q) ||
      t.product?.sku?.toLowerCase().includes(q) ||
      t.branch?.name?.toLowerCase().includes(q) ||
      (t.note ?? t.reference ?? '').toLowerCase().includes(q)
    )
  }, [transfers, transferSearch])

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
            style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)' }}>
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
          style={{ color: row.original.quantity > 0 ? '#4ade80' : 'var(--status-warn)' }}>
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
          { label: 'Products Ready', value: loadingProducts ? '…' : String(products.length), icon: <Package size={15} />, color: 'var(--brand-primary)', bg: 'var(--brand-glow)', border: 'var(--sidebar-active-border)' },
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

      <ToolbarSearch
        value={transferSearch}
        onChange={setTransferSearch}
        placeholder="Search product, branch, notes…"
        className="max-w-md"
      />

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
          data={filteredTransfers}
          columns={columns}
          isLoading={loadingTransfers}
          pageCount={Math.ceil((filteredTransfers.length || 1) / 20)}
          searchableColumns={[]}
          showFilter={false}
        />
      )}
    </div>
  )
}
