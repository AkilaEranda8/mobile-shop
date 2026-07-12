'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Package, AlertTriangle, Download, Upload, Edit, Trash2, Loader2, X, CheckCircle, AlertCircle, FileText, TrendingUp, Tag, Layers, BarChart2, ShoppingCart, ArrowUpRight, ArrowDownRight, Camera, RotateCcw, ChevronDown, ChevronUp, GripVertical, Smartphone, Shield, Building2, ArrowLeftRight, Copy } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency } from '@/lib/utils'
import { useProducts, useCategories, useProductVariantSettings } from '@/lib/hooks'
import { getVisibleBranches, hasMultipleBranches } from '@/lib/active-branch'
import { authStorage } from '@/lib/auth'
import { DEFAULT_PRODUCT_VARIANT_SETTINGS } from '@/lib/productVariantSettings'
import { productsApi, uploadApi } from '@/lib/api'
import type { Product, Category, ProductVariation } from '@/types'
import toast from 'react-hot-toast'
import { OpenPosButton } from '@/components/pos/OpenPosButton'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { AddProductModal } from '@/components/inventory/AddProductModal'
import { ImeiProductTypeSelector } from '@/components/inventory/ImeiProductTypeSelector'
import { imeiTypeToTrackFlag, trackFlagToImeiType, inferImeiProductType, isImeiHealthBannerDismissed, dismissImeiHealthBanner, type ImeiProductType } from '@/lib/productImei'
import { PRODUCT_CONDITION_OPTS, type ProductCondition, productConditionLabel } from '@/lib/productCondition'
import { compareSkuOrder, formatSkuOrderLabel, parseSkuOrderNumber } from '@/lib/productCodes'
import {
  PRODUCT_CSV_COLUMNS,
  PRODUCT_CSV_TEMPLATE,
  parseProductCsv,
  validateProductCsvRow,
  productCsvRowToPayload,
  productToCsvRow,
  type ProductCsvRow,
} from '@/lib/productCsvImport'
import { findProductByCode, normalizeScanCode, productSearchHaystack } from '@/lib/barcode-scan'
import { effectiveBarcodeValue } from '@/lib/barcode-print'
import { BarcodeLabelPreview } from '@/components/inventory/BarcodeLabelPreview'

/* ── CSV Export ─────────────────────────────────────────────────────── */
function exportProductsCSV(products: Product[]) {
  const csv = [
    PRODUCT_CSV_COLUMNS.join(','),
    ...products.map(p => productToCsvRow({
      name: p.name,
      sku: p.sku,
      brandName: (p as any).brandName,
      categoryName: (p as any).categoryName,
      subCategory: (p as any).subCategory,
      deviceModel: (p as any).deviceModel,
      barcode: (p as any).barcode,
      buyingPrice: p.buyingPrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      minStock: p.minStock,
      condition: (p as any).condition,
      trackImei: (p as any).trackImei,
      warrantyMonths: (p as any).warrantyMonths,
      warrantyNote: (p as any).warrantyNote,
      description: (p as any).description,
    })),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── CSV Import Modal ────────────────────────────────────────────────── */
function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ProductCsvRow[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [done, setDone] = useState(false)
  const [successCount, setSuccessCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const downloadTemplate = () => {
    const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'inventory-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadCsvText = (text: string) => {
    const { rows: parsed, warnings } = parseProductCsv(text)
    setRows(parsed)
    setParseWarnings(warnings)
    setValidationErrors(parsed.flatMap((r, i) => validateProductCsvRow(r, i)))
    setImportErrors([])
    setDone(false)
    setSuccessCount(0)
    setProgress(null)
  }

  const parseFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => loadCsvText(ev.target?.result as string)
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }

  const handleImport = async () => {
    const preErrors = rows.flatMap((r, i) => validateProductCsvRow(r, i))
    if (preErrors.length > 0) {
      setValidationErrors(preErrors)
      toast.error('Fix validation errors before importing')
      return
    }
    setImportErrors([])
    setProgress({ done: 0, total: rows.length })
    const errs: string[] = []
    let ok = 0
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        await productsApi.create(productCsvRowToPayload(r))
        ok++
      } catch (e: any) {
        errs.push(`Row ${i + 2}: ${r.name || '(no name)'} — ${e?.message ?? 'failed'}`)
      }
      setProgress({ done: i + 1, total: rows.length })
    }
    setSuccessCount(ok)
    setImportErrors(errs)
    setDone(true)
    if (ok > 0) onSaved()
    if (errs.length === 0) toast.success(`${ok} product${ok === 1 ? '' : 's'} imported`)
    else toast.error(`${errs.length} row${errs.length === 1 ? '' : 's'} failed`)
  }

  const canImport = rows.length > 0 && validationErrors.length === 0 && !progress

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Import Products (CSV)</h3>
            <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">Same fields as Create Product — brand &amp; category auto-created if missing</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
            <div className="min-w-0">
              <p className="text-sm text-violet-300 font-medium">CSV columns</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                <span className="text-slate-400">Required:</span> name, categoryName &nbsp;·&nbsp;
                <span className="text-slate-400">Optional:</span> sku, brandName, subCategory, deviceModel, barcode, buyingPrice, sellingPrice, stock, minStock, condition, trackImei, warrantyMonths, warrantyNote, description
              </p>
            </div>
            <button onClick={downloadTemplate} className="text-xs text-violet-400 border border-violet-500/20 px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10 flex items-center gap-1.5 flex-shrink-0">
              <FileText size={12} />Template
            </button>
          </div>

          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10 hover:border-violet-500/30 hover:bg-violet-500/3'}`}
          >
            <Upload size={24} className={`mx-auto mb-2 ${dragOver ? 'text-violet-400' : 'text-slate-600'}`} />
            {rows.length > 0
              ? <p className="text-sm text-violet-300">{rows.length} rows loaded — click or drop to change file</p>
              : <><p className="text-sm text-slate-400">Click to select a CSV file</p><p className="text-xs text-slate-600 mt-1">or drag and drop here</p></>}
          </button>

          {parseWarnings.length > 0 && (
            <div className="space-y-1">
              {parseWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-400/90 flex items-start gap-1.5"><AlertCircle size={11} className="mt-0.5 flex-shrink-0" />{w}</p>
              ))}
            </div>
          )}

          {validationErrors.length > 0 && !done && (
            <div className="space-y-1 max-h-20 overflow-y-auto rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
              {validationErrors.slice(0, 8).map((e, i) => (
                <p key={i} className="text-xs text-amber-300">{e}</p>
              ))}
              {validationErrors.length > 8 && <p className="text-[10px] text-amber-400/70">+{validationErrors.length - 8} more</p>}
            </div>
          )}

          {rows.length > 0 && !done && (
            <div className="bg-white/3 rounded-xl border border-white/5 overflow-hidden">
              <p className="text-[10px] text-slate-500 px-3 py-2 border-b border-white/5 uppercase tracking-wide">Preview ({rows.length} products)</p>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/5">
                      <th className="px-3 py-1.5 font-medium">Name</th>
                      <th className="px-3 py-1.5 font-medium">SKU</th>
                      <th className="px-3 py-1.5 font-medium">Brand</th>
                      <th className="px-3 py-1.5 font-medium">Category</th>
                      <th className="px-3 py-1.5 font-medium text-right">Buy</th>
                      <th className="px-3 py-1.5 font-medium text-right">Sell</th>
                      <th className="px-3 py-1.5 font-medium text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0 text-gray-700 dark:text-slate-300">
                        <td className="px-3 py-1.5 max-w-[140px] truncate">{r.name || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.sku || '—'}</td>
                        <td className="px-3 py-1.5">{r.brandName || 'General'}</td>
                        <td className="px-3 py-1.5">{r.categoryName || '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.buyingPrice || '0'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.sellingPrice || '0'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.stock ?? '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 8 && <p className="text-[10px] text-slate-600 px-3 py-1.5">+{rows.length - 8} more rows</p>}
            </div>
          )}

          {progress && (
            <div className="space-y-2">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="text-xs text-gray-600 dark:text-slate-400 text-center">{progress.done} / {progress.total} processed</p>
            </div>
          )}

          {done && importErrors.length === 0 && (
            <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />{successCount} product{successCount === 1 ? '' : 's'} imported successfully</div>
          )}
          {done && importErrors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-slate-400">{successCount} imported · {importErrors.length} failed</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {importErrors.map((e, i) => <p key={i} className="text-xs text-red-400 flex items-start gap-1.5"><AlertCircle size={11} className="mt-0.5 flex-shrink-0" />{e}</p>)}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1 flex-shrink-0">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">{done ? 'Close' : 'Cancel'}</button>
            {!done && (
              <button
                onClick={handleImport}
                disabled={!canImport}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {progress ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Import {rows.length > 0 ? rows.length : ''} Products
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Add Category Modal ─────────────────────────────────────────────── */
function AddCategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: (cat: Category) => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      const res: any = await productsApi.createCategory({ name: name.trim(), icon: icon || undefined })
      toast.success(`Category "${name}" created`)
      onSaved(res.data ?? res)
      onClose()
    } catch (err: any) { setError(err.message || 'Failed to create category') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add Category</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Category Name *</label>
            <input autoFocus required className="input-field" placeholder="e.g. Smartphones" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Icon (optional)</label>
            <input className="input-field text-sm" placeholder="Paste an emoji e.g. 📱" value={icon} onChange={e => setIcon(e.target.value)} maxLength={4} />
          </div>
          {icon && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{name || 'Category name'}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Preview</p>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add Category
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Manage Categories Modal ────────────────────────────────────────── */
function ManageCategoriesModal({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [reassignToId, setReassignToId] = useState('')
  const { data: catsData, refetch } = useCategories()
  const categories: Category[] = (catsData ?? []) as Category[]

  const doDelete = async (cat: Category, moveToId?: string) => {
    setDeletingId(cat.id)
    try {
      await productsApi.deleteCategory(cat.id, moveToId)
      toast.success(`Category "${cat.name}" deleted`)
      setPendingDelete(null); setReassignToId('')
      refetch(); onChanged?.()
    } catch (err: any) { toast.error(err.message || 'Failed to delete category') }
    finally { setDeletingId(null) }
  }

  const handleDeleteClick = (cat: Category) => {
    const count = cat.productCount ?? 0
    if (count > 0) {
      const others = categories.filter(c => c.id !== cat.id)
      if (others.length === 0) {
        toast.error('Create another category first — products must be moved before deleting.')
        return
      }
      setPendingDelete(cat)
      setReassignToId(others[0].id)
      return
    }
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return
    doDelete(cat)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manage Categories</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>

        <div className="p-5">
          {categories.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No categories yet. Use Add Category to create one.</p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {categories.map(cat => (
                  <div key={cat.id} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm truncate flex items-center gap-2 min-w-0" style={{ color: 'var(--text-primary)' }}>
                        {cat.icon && <span>{cat.icon}</span>}
                        <span className="truncate">{cat.name}</span>
                        {(cat.productCount ?? 0) > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 flex-shrink-0 font-medium">
                            {cat.productCount} product{(cat.productCount ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(cat)}
                        disabled={deletingId === cat.id}
                        className="p-1.5 rounded-lg hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}>
                        {deletingId === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                    {pendingDelete?.id === cat.id && (
                      <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-[11px] text-amber-400 font-medium">
                          Move {cat.productCount} product{(cat.productCount ?? 0) > 1 ? 's' : ''} to another category before deleting.
                        </p>
                        <select
                          className="input-field text-sm w-full"
                          value={reassignToId}
                          onChange={e => setReassignToId(e.target.value)}>
                          {categories.filter(c => c.id !== cat.id).map(c => (
                            <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setPendingDelete(null); setReassignToId('') }}
                            className="btn-secondary flex-1 text-xs py-1.5">
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!reassignToId || deletingId === cat.id}
                            onClick={() => doDelete(cat, reassignToId)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                            Move & Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <button type="button" onClick={onClose} className="btn-secondary w-full text-sm mt-4">Close</button>
        </div>
      </div>
    </div>
  )
}

function ProductImagePicker({ imageUrl, onUploaded }: { imageUrl: string; onUploaded: (url: string) => void }) {
  const imgRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadApi.productImage(file)
      onUploaded(url)
      toast.success('Image uploaded')
    } catch (err: any) { toast.error(err?.message ?? 'Upload failed') }
    finally { setUploading(false); if (imgRef.current) imgRef.current.value = '' }
  }

  return (
    <div className="col-span-2">
      <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Product Image</label>
      <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleChange} />
      <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading}
        className="w-full h-28 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-colors hover:border-violet-500/40 hover:bg-violet-500/5 disabled:opacity-50 overflow-hidden"
        style={{ borderColor: 'var(--border-subtle)' }}>
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-violet-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-xs">Uploading…</span>
          </div>
        ) : imageUrl ? (
          <div className="relative w-full h-full group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Product" className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold">
              <Camera size={14} /> Change Image
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Camera size={22} />
            <span className="text-xs">Click to upload product image</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>JPG, PNG, WebP · Max 5 MB</span>
          </div>
        )}
      </button>
    </div>
  )
}

// AddProductModal is imported from @/components/inventory/AddProductModal

const genEditId = () => Math.random().toString(36).slice(2, 9)

interface EditVariantRow {
  id: string; storage: string; colorName: string; colorHex: string
  sku: string; stock: number; sellingPrice: string; costPrice: string
}

function EditProductModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const router = useRouter()
  const { data: cats, refetch: refetchCats } = useCategories()
  const { data: variantSettings } = useProductVariantSettings()
  const branches = useMemo(
    () => getVisibleBranches().map(b => ({ id: b.id, name: b.name })),
    [],
  )
  const showBranchPicker = hasMultipleBranches()
  const stockBranchName = useMemo(() => {
    const pool = authStorage.getUser()?.branches ?? []
    return pool.find(b => b.id === product.branchId)?.name ?? 'Current branch'
  }, [product.branchId])
  const catalogBranchOptions = branches
    .filter(b => b.id !== product.branchId)
    .map(b => ({ value: b.id, label: b.name }))
  const hasInventory = Number(product.stock) > 0 || product.trackImei
  const storageOpts = variantSettings?.storageOptions ?? DEFAULT_PRODUCT_VARIANT_SETTINGS.storageOptions
  const colorOpts = variantSettings?.colorOptions ?? DEFAULT_PRODUCT_VARIANT_SETTINGS.colorOptions
  const categories: Category[] = (cats ?? []) as Category[]
  const [showAddCat, setShowAddCat] = useState(false)
  const [showVariants, setShowVariants] = useState(true)
  const [form, setForm] = useState({
    name: product.name, sku: product.sku,
    categoryName: product.categoryName ?? '',
    brandName: product.brandName ?? '',
    buyingPrice: String(product.buyingPrice), sellingPrice: String(product.sellingPrice),
    stock: String(product.stock), minStock: String(product.minStock),
    imageUrl: product.imageUrl ?? '',
    condition: (product.condition ?? 'BRAND_NEW') as ProductCondition,
  })
  const [imeiType, setImeiType] = useState<ImeiProductType>(trackFlagToImeiType(product.trackImei))
  const [warrantyMonths, setWarrantyMonths] = useState(product.warrantyMonths ?? 12)
  const [warrantyNote, setWarrantyNote] = useState(product.warrantyNote ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [catalogBranchIds, setCatalogBranchIds] = useState<string[]>([])

  const toggleCatalogBranch = (branchId: string) => {
    setCatalogBranchIds(prev =>
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId],
    )
  }

  // Load existing variants into edit state
  const [variants, setVariants] = useState<EditVariantRow[]>(
    (Array.isArray(product.storageVariations) ? product.storageVariations : []).map((v: any) => ({
      id: v.id ?? genEditId(),
      storage: v.storage,
      colorName: v.colorName,
      colorHex: v.colorHex,
      sku: v.sku ?? '',
      stock: v.stock ?? 0,
      sellingPrice: String(v.sellingPrice),
      costPrice: String(v.costPrice),
    }))
  )

  const addVariant = () => setVariants(p => [...p, {
    id: genEditId(),
    storage: storageOpts.find(s => s === '128GB') ?? storageOpts[0] ?? '128GB',
    colorName: colorOpts[0]?.name ?? 'Black',
    colorHex: colorOpts[0]?.hex ?? '#1a1a1a',
    sku: '', stock: 0, sellingPrice: '', costPrice: '',
  }])
  const delVariant = (id: string) => setVariants(p => p.filter(v => v.id !== id))
  const updVariant = (id: string, k: keyof EditVariantRow, val: string) => setVariants(p => p.map(v => v.id === id ? { ...v, [k]: val } : v))
  const updColor = (id: string, name: string, hex: string) => setVariants(p => p.map(v => v.id === id ? { ...v, colorName: name, colorHex: hex } : v))

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await productsApi.update(product.id, {
        ...form,
        buyingPrice: Number(form.buyingPrice), sellingPrice: Number(form.sellingPrice),
        mrp: Number(form.sellingPrice), stock: Number(form.stock), minStock: Number(form.minStock),
        trackImei: imeiTypeToTrackFlag(imeiType),
        warrantyMonths: Number(warrantyMonths) || 0,
        warrantyNote: warrantyNote.trim() || null,
        condition: form.condition,
        imageUrl: form.imageUrl || undefined,
        ...(showBranchPicker && catalogBranchIds.length > 0 ? { catalogBranchIds } : {}),
        storageVariations: variants.map(v => ({
          id: v.id,
          storage: v.storage,
          colorName: v.colorName,
          colorHex: v.colorHex,
          sku: v.sku || undefined,
          stock: v.stock,
          sellingPrice: Number(v.sellingPrice) || 0,
          costPrice: Number(v.costPrice) || 0,
        })),
        colorVariations: variants.map(v => ({ name: v.colorName, hex: v.colorHex })),
      })
      if (showBranchPicker && catalogBranchIds.length > 0) {
        const destNames = catalogBranchIds
          .map(id => branches.find(b => b.id === id)?.name)
          .filter(Boolean)
          .join(', ')
        if (hasInventory) {
          toast((t) => (
            <div className="text-sm">
              <p className="font-medium">Catalog copied to {destNames}</p>
              <p className="text-xs opacity-80 mt-0.5">Stock &amp; IMEI remain at {stockBranchName}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-violet-400 hover:text-violet-300"
                onClick={() => { router.push('/dashboard/stock-transfer'); toast.dismiss(t.id) }}
              >
                Open Stock Transfer →
              </button>
            </div>
          ), { duration: 8000 })
        } else if (catalogBranchIds.length === 1) {
          toast.success(`Product moved to ${destNames}`)
        } else {
          toast.success(`Catalog copied to ${destNames}`)
        }
      } else {
        toast.success('Product updated')
      }
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to update') }
    finally { setLoading(false) }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', height: 30, padding: '0 8px', borderRadius: 6,
    fontSize: 11, outline: 'none',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', boxSizing: 'border-box',
  }
  const selSt: React.CSSProperties = { ...inputSt, paddingRight: 24, appearance: 'none', cursor: 'pointer' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit Product</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-4">
            <ProductImagePicker imageUrl={form.imageUrl} onUploaded={url => setForm(p => ({ ...p, imageUrl: url }))} />
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Product Name *</label>
              <input required className="input-field" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">SKU *</label>
              <input required className="input-field" value={form.sku} onChange={f('sku')} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Brand</label>
              <input className="input-field" value={form.brandName} onChange={f('brandName')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Category</label>
              <div className="flex gap-2">
                <select className="input-field flex-1" value={form.categoryName} onChange={f('categoryName')}>
                  {form.categoryName && !categories.some(c => c.name === form.categoryName) && (
                    <option value={form.categoryName}>{form.categoryName}</option>
                  )}
                  {categories.map(c => <option key={c.id} value={c.name}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddCat(true)}
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-violet-500/10 hover:text-violet-500"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                  title="Add new category">
                  <Plus size={15} />
                </button>
              </div>
            </div>
            {showBranchPicker && (
              <div className="col-span-2 rounded-xl p-3 space-y-2"
                style={{ background: 'var(--brand-glow)', border: '1px solid var(--brand-glow)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Stock location
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                    style={{ background: 'var(--brand-glow)', color: 'var(--brand-light)', border: '1px solid var(--sidebar-active-border)' }}>
                    <Building2 size={10} />
                    {stockBranchName}
                    {hasInventory && (
                      <span className="opacity-70">· {product.stock} units</span>
                    )}
                  </span>
                </div>
                {catalogBranchOptions.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs text-gray-600 dark:text-slate-400">
                        {hasInventory ? 'Assign catalog to branches (optional)' : 'Move or assign to branches'}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-violet-400 hover:text-violet-300"
                          onClick={() => setCatalogBranchIds(catalogBranchOptions.map(b => b.value))}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"
                          onClick={() => setCatalogBranchIds([])}
                          disabled={catalogBranchIds.length === 0}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg border max-h-36 overflow-y-auto"
                      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                      {catalogBranchOptions.map(opt => {
                        const checked = catalogBranchIds.includes(opt.value)
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b last:border-0 transition-colors ${
                              checked ? 'bg-violet-500/10' : 'hover:bg-white/5'
                            }`}
                            style={{ borderColor: 'var(--border-subtle)' }}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-white/20 text-violet-500 focus:ring-violet-500/40"
                              checked={checked}
                              onChange={() => toggleCatalogBranch(opt.value)}
                            />
                            <Building2 size={12} className={checked ? 'text-violet-400' : 'text-slate-500'} />
                            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                          </label>
                        )
                      })}
                    </div>
                    {catalogBranchIds.length > 0 && (
                      <p className="text-[10px] text-violet-400">
                        {catalogBranchIds.length} branch{catalogBranchIds.length === 1 ? '' : 'es'} selected
                      </p>
                    )}
                    <p className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <ArrowLeftRight size={11} className="flex-shrink-0 mt-0.5 opacity-70" />
                      {hasInventory
                        ? 'Copies image & details to selected branches. Move stock and IMEI via Stock Transfer.'
                        : catalogBranchIds.length > 1
                          ? 'Creates catalog entries at selected branches (stock stays 0).'
                          : 'Select one branch to move this product, or multiple to copy catalog.'}
                    </p>
                  </>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Buying Price (LKR)</label>
              <input type="number" min="0" className="input-field" value={form.buyingPrice} onChange={f('buyingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Selling Price (LKR)</label>
              <input type="number" min="0" className="input-field" value={form.sellingPrice} onChange={f('sellingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Stock Qty</label>
              <input type="number" min="0" className="input-field" value={form.stock} onChange={f('stock')} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Min Stock Alert</label>
              <input type="number" min="0" className="input-field" value={form.minStock} onChange={f('minStock')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Condition *</label>
              <select className="input-field" value={form.condition} onChange={f('condition')}>
                {PRODUCT_CONDITION_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <ImeiProductTypeSelector
            value={imeiType}
            onChange={setImeiType}
            categoryName={form.categoryName}
            hasVariants={variants.length > 0}
            compact
          />

          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Warranty Period</label>
            <select className="input-field" value={warrantyMonths}
              onChange={e => setWarrantyMonths(Number(e.target.value))}>
              <option value={0}>None</option>
              <option value={1}>1 Month</option>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>1 Year</option>
              <option value={24}>2 Years</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Warranty note</label>
            <textarea
              className="input-field min-h-[72px] py-2 resize-y"
              placeholder="Optional text printed on the bill under warranty"
              value={warrantyNote}
              onChange={e => setWarrantyNote(e.target.value)}
            />
          </div>

          {/* ── Variants Section ────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setShowVariants(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-violet-400" />
                <span className="text-xs font-semibold text-violet-300">Variant Combinations</span>
                {variants.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">
                    {variants.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); addVariant() }}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                >
                  <Plus size={11} /> Add
                </button>
                {showVariants ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>
            </button>

            {showVariants && (
              <div className="p-3">
                {variants.length === 0 ? (
                  <div className="text-center py-6">
                    <Layers size={18} className="text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-slate-500">No variants yet — click "Add" to create Storage × Color combinations</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          {['#', 'Storage', 'Color', 'SKU', 'Sell Price', 'Cost Price', ''].map((h, i) => (
                            <th key={i} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v, i) => (
                          <tr key={v.id} style={{ borderBottom: i < variants.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)', fontSize: 10 }}>{i + 1}</td>

                            {/* Storage */}
                            <td style={{ padding: '6px 4px' }}>
                              <div style={{ position: 'relative' }}>
                                <select value={v.storage} onChange={e => updVariant(v.id, 'storage', e.target.value)} style={selSt}>
                                  {storageOpts.map(s => <option key={s}>{s}</option>)}
                                  {!storageOpts.includes(v.storage) && <option value={v.storage}>{v.storage}</option>}
                                </select>
                                <ChevronDown size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                              </div>
                            </td>

                            {/* Color */}
                            <td style={{ padding: '6px 4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: v.colorHex, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0, display: 'inline-block' }} />
                                <div style={{ position: 'relative', flex: 1 }}>
                                  <select value={v.colorName} onChange={e => { const found = colorOpts.find(c => c.name === e.target.value); if (found) updColor(v.id, found.name, found.hex) }} style={selSt}>
                                    {colorOpts.map(c => <option key={c.name}>{c.name}</option>)}
                                    {!colorOpts.some(c => c.name === v.colorName) && (
                                      <option value={v.colorName}>{v.colorName}</option>
                                    )}
                                  </select>
                                  <ChevronDown size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                </div>
                              </div>
                            </td>

                            {/* SKU */}
                            <td style={{ padding: '6px 4px' }}>
                              <input style={{ ...inputSt, fontFamily: 'monospace' }}
                                placeholder={`${(form.sku || 'SKU').toUpperCase()}-${v.storage.replace(/\s/g, '')}-${v.colorName.slice(0, 3).toUpperCase()}`}
                                value={v.sku} onChange={e => updVariant(v.id, 'sku', e.target.value)} />
                            </td>

                            {/* Sell Price */}
                            <td style={{ padding: '6px 4px' }}>
                              <input type="number" min={0} style={inputSt} placeholder="0.00"
                                value={v.sellingPrice} onChange={e => updVariant(v.id, 'sellingPrice', e.target.value)} />
                            </td>

                            {/* Cost Price */}
                            <td style={{ padding: '6px 4px' }}>
                              <input type="number" min={0} style={inputSt} placeholder="0.00"
                                value={v.costPrice} onChange={e => updVariant(v.id, 'costPrice', e.target.value)} />
                            </td>

                            {/* Delete */}
                            <td style={{ padding: '6px 8px' }}>
                              <button type="button" onClick={() => delVariant(v.id)}
                                style={{ padding: 5, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}Save Changes
            </button>
          </div>
        </form>
      </div>
      {showAddCat && <AddCategoryModal onClose={() => setShowAddCat(false)} onSaved={cat => { refetchCats(); setForm(p => ({ ...p, categoryName: cat.name })) }} />}
    </div>
  )
}

// AddProductModal is imported from @/components/inventory/AddProductModal

function warrantyMonthsLabel(months: number): string {
  const map: Record<number, string> = { 0: 'None', 1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year', 24: '2 Years' }
  return map[months] ?? (months > 0 ? `${months} months` : 'None')
}

function DetailSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        {icon}
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wide">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function DetailRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm border-b last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}>
      <span className="text-slate-500 text-xs flex-shrink-0 pt-0.5">{label}</span>
      <span className={`font-medium text-xs text-right ${valueClass ?? 'text-gray-800 dark:text-slate-200'} max-w-[72%] break-words`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function ProductDetailModal({ product, onClose, onEdit, onCopy }: { product: Product; onClose: () => void; onEdit?: () => void; onCopy?: () => void }) {
  const [detail, setDetail] = useState<Product>(product)
  const [loadingDetail, setLoadingDetail] = useState(true)

  useEffect(() => {
    setLoadingDetail(true)
    productsApi.getById(product.id)
      .then((res: any) => setDetail(res.data ?? res))
      .catch(() => setDetail(product))
      .finally(() => setLoadingDetail(false))
  }, [product])

  const p = detail as Product & { subCategory?: string; deviceModel?: string }
  const margin     = detail.sellingPrice - detail.buyingPrice
  const marginPct  = detail.buyingPrice > 0 ? ((margin / detail.buyingPrice) * 100).toFixed(1) : '0'
  const stockValue = detail.buyingPrice * detail.stock
  const isOut = detail.stock === 0
  const isLow = detail.stock < detail.minStock && detail.stock > 0
  const variations = Array.isArray(detail.storageVariations) ? detail.storageVariations : []
  const [showVars, setShowVars] = useState(true)
  const imeiType = trackFlagToImeiType(detail.trackImei)
  const mrp = detail.mrp ?? detail.sellingPrice

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623] z-10">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Product Details</h3>
            {loadingDetail && <Loader2 size={13} className="animate-spin text-slate-500" />}
          </div>
          <div className="flex items-center gap-2">
            {onCopy && (
              <button onClick={onCopy} className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 transition-colors">
                <Copy size={11} /> Copy
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1.5 rounded-lg border border-violet-500/20 hover:bg-violet-500/10 transition-colors">
                <Edit size={11} /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Hero banner */}
          <div className="w-full h-36 rounded-2xl overflow-hidden border border-violet-500/15 relative flex items-center justify-center bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-cyan-500/10">
            {detail.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.imageUrl} alt={detail.name} className="h-full w-full object-contain" />
            ) : (
              <>
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, var(--brand-primary) 0%, transparent 60%)' }} />
                <div className="flex flex-col items-center gap-1">
                  <Package size={32} className="text-violet-400 opacity-80" />
                  <p className="text-xs text-violet-300 font-mono">{detail.sku}</p>
                </div>
              </>
            )}
          </div>

          {/* Name + badges */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{detail.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {p.brandName && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">{p.brandName}</span>}
              {p.categoryName && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400">{p.categoryName}</span>}
              {p.subCategory && <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">{p.subCategory}</span>}
              {p.deviceModel && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">{p.deviceModel}</span>}
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">{productConditionLabel(detail.condition)}</span>
              {variations.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  {variations.length} variant{variations.length > 1 ? 's' : ''}
                </span>
              )}
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                isOut ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : isLow ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                : 'bg-green-500/10 border-green-500/20 text-green-400'
              }`}>{isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}</span>
            </div>
          </div>

          {/* Price cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-center gap-1 mb-1"><ArrowDownRight size={11} className="text-slate-500" /><span className="text-[10px] text-slate-500 uppercase tracking-wide">Buying</span></div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(detail.buyingPrice)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)' }}>
              <div className="flex items-center justify-center gap-1 mb-1"><ShoppingCart size={11} className="text-violet-400" /><span className="text-[10px] text-violet-400 uppercase tracking-wide">Selling</span></div>
              <p className="text-sm font-bold text-violet-300">{formatCurrency(detail.sellingPrice)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-center gap-1 mb-1"><Tag size={11} className="text-slate-500" /><span className="text-[10px] text-slate-500 uppercase tracking-wide">MRP</span></div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(mrp)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: margin >= 0 ? 'rgba(21,128,61,0.08)' : 'rgba(185,28,28,0.08)', border: margin >= 0 ? '1px solid rgba(21,128,61,0.2)' : '1px solid rgba(185,28,28,0.2)' }}>
              <div className="flex items-center justify-center gap-1 mb-1"><ArrowUpRight size={11} className={margin >= 0 ? 'text-green-400' : 'text-red-400'} /><span className={`text-[10px] uppercase tracking-wide ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>Margin</span></div>
              <p className={`text-sm font-bold ${margin >= 0 ? 'text-green-300' : 'text-red-300'}`}>{marginPct}%</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Layers size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-500">Stock Qty</p>
                <p className={`text-base font-bold ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}>{detail.stock}</p>
              </div>
            </div>
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <BarChart2 size={14} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-500">Stock Value</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(stockValue)}</p>
              </div>
            </div>
          </div>

          <DetailSection title="Product Information" icon={<Package size={12} className="text-violet-400" />}>
            <DetailRow label="SKU" value={detail.sku} valueClass="font-mono" />
            <DetailRow label="Barcode" value={effectiveBarcodeValue(detail) || '—'} valueClass="font-mono" />
            {effectiveBarcodeValue(detail) && (
              <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02] flex justify-center">
                <BarcodeLabelPreview value={effectiveBarcodeValue(detail)} className="rounded-lg bg-white px-3 py-2" />
              </div>
            )}
            <DetailRow label="Brand" value={p.brandName} />
            <DetailRow label="Category" value={p.categoryName} />
            <DetailRow label="Sub Category" value={p.subCategory || '—'} />
            <DetailRow label="Device Model" value={p.deviceModel || '—'} />
            <DetailRow label="Condition" value={productConditionLabel(detail.condition)} />
          </DetailSection>

          <DetailSection title="Pricing" icon={<TrendingUp size={12} className="text-violet-400" />}>
            <DetailRow label="Buying Price" value={formatCurrency(detail.buyingPrice)} />
            <DetailRow label="Selling Price" value={formatCurrency(detail.sellingPrice)} />
            <DetailRow label="MRP" value={formatCurrency(mrp)} />
            <DetailRow label="Profit / unit" value={formatCurrency(margin)} valueClass={margin >= 0 ? 'text-green-400' : 'text-red-400'} />
            <DetailRow label="Margin" value={`${marginPct}%`} valueClass={margin >= 0 ? 'text-green-400' : 'text-red-400'} />
          </DetailSection>

          <DetailSection title="Inventory" icon={<Layers size={12} className="text-violet-400" />}>
            <DetailRow label="Stock Quantity" value={String(detail.stock)} />
            <DetailRow label="Min Stock Alert" value={String(detail.minStock)} valueClass="text-yellow-400" />
            <DetailRow label="Stock Value" value={formatCurrency(stockValue)} />
            {detail.trackImei && (
              <>
                <DetailRow label="IMEI Units In Stock" value={String(detail.imeiInStock ?? '—')} />
                {detail.imeiGap != null && detail.imeiGap > 0 && (
                  <DetailRow label="IMEI Gap" value={String(detail.imeiGap)} valueClass="text-amber-400" />
                )}
              </>
            )}
          </DetailSection>

          <DetailSection title="Warranty & IMEI" icon={<Shield size={12} className="text-violet-400" />}>
            <DetailRow label="Warranty" value={warrantyMonthsLabel(detail.warrantyMonths ?? 0)} />
            <DetailRow label="Warranty Note" value={detail.warrantyNote?.trim() || '—'} />
            <DetailRow
              label="IMEI Tracking"
              value={imeiType === 'device' ? 'Phone / Tablet' : 'Accessory (no IMEI)'}
              valueClass={detail.trackImei ? 'text-cyan-300' : 'text-slate-400'}
            />
          </DetailSection>

          {(detail.description?.trim()) && (
            <DetailSection title="Description" icon={<FileText size={12} className="text-violet-400" />}>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
              </div>
            </DetailSection>
          )}

          {/* ── Variants Panel ─────────────────────────────────────── */}
          {variations.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setShowVars(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <div className="flex items-center gap-2">
                  <Layers size={13} className="text-violet-400" />
                  <span className="text-xs font-semibold text-violet-300">Variants</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">{variations.length}</span>
                </div>
                {showVars ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {showVars && (
                <div className="p-3 overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {['Storage', 'Color', 'SKU', 'Sell Price', 'Cost', 'Stock'].map((h, i) => (
                          <th key={i} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {variations.map((v, i) => (
                        <tr key={v.id ?? i} style={{ borderBottom: i < variations.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--brand-glow)', color: 'var(--brand-light)' }}>{v.storage}</span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 12, height: 12, borderRadius: '50%', background: v.colorHex, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0, display: 'inline-block' }} />
                              <span style={{ color: 'var(--text-primary)', fontSize: 11 }}>{v.colorName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 10 }}>
                            {v.sku ?? '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--brand-light)' }}>
                            {formatCurrency(v.sellingPrice)}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                            {formatCurrency(v.costPrice)}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>
                            {v.stock ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── IMEI health alerts ─────────────────────────────────────────────── */
function ImeiHealthBanner({ onFixed }: { onFixed: () => void }) {
  const [health, setHealth] = useState<{
    stockMismatches: { id: string; name: string; stock: number; imeiInStock: number; gap: number }[]
    incompletePurchaseOrders: { id: string; poNumber: string; expected: number; registered: number }[]
  } | null>(null)
  const [fixing, setFixing] = useState(false)
  const [hidden, setHidden] = useState(() => isImeiHealthBannerDismissed())

  const load = () => {
    productsApi.imeiHealth().then((r: any) => setHealth(r.data ?? r)).catch(() => {})
  }

  useEffect(() => { if (!hidden) load() }, [hidden])

  const mismatches = health?.stockMismatches ?? []
  const incompletePos = health?.incompletePurchaseOrders ?? []
  if (hidden || (!mismatches.length && !incompletePos.length)) return null

  const handleDismiss = () => {
    dismissImeiHealthBanner()
    setHidden(true)
  }

  const handleBulkFix = async () => {
    setFixing(true)
    try {
      const r: any = await productsApi.bulkInferTrackImei()
      toast.success(`Updated IMEI flags on ${r.data?.updated ?? 0} product(s)`)
      load()
      onFixed()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update IMEI flags')
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/5 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">IMEI attention needed</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleBulkFix} disabled={fixing}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50">
            {fixing ? 'Fixing…' : 'Auto-fix product IMEI flags'}
          </button>
          <button type="button" onClick={handleDismiss} title="Hide this notice"
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5">
            <X size={13} /> Hide
          </button>
        </div>
      </div>
      {mismatches.length > 0 && (
        <div>
          <p className="text-xs text-amber-900 dark:text-amber-300/90 mb-1">{mismatches.length} phone(s) have stock without enough registered IMEIs:</p>
          <ul className="text-[11px] text-gray-700 dark:text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
            {mismatches.slice(0, 8).map(m => (
              <li key={m.id}>• {m.name} — stock {m.stock}, IMEI {m.imeiInStock} <span className="text-amber-700 dark:text-amber-400 font-medium">(missing {m.gap})</span></li>
            ))}
          </ul>
        </div>
      )}
      {incompletePos.length > 0 && (
        <div>
          <p className="text-xs text-amber-900 dark:text-amber-300/90 mb-1">{incompletePos.length} received PO(s) need IMEI registration:</p>
          <ul className="text-[11px] text-gray-700 dark:text-slate-400 space-y-0.5">
            {incompletePos.slice(0, 5).map(po => (
              <li key={po.id}>
                • <a href={`/purchase-invoice?id=${po.id}`} className="text-violet-700 dark:text-violet-400 hover:underline font-medium">{po.poNumber}</a>
                {' '}— {po.registered}/{po.expected} IMEIs
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── Flat row type for the table (product + optional variation) ─────── */
interface FlatRow {
  key: string           // unique row key
  product: Product      // parent product
  variation?: ProductVariation  // undefined = no variants / single product row
  // Computed display fields
  displaySku: string
  displayPrice: number
  displayStock: number
  displayMinStock: number
  displayName: string   // includes Storage / Color label if variant
  categoryName: string
  brandName: string
}

const INV_FILTERS_KEY = 'hexalyte:inventory-filters'

export default function InventoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showImport, setShowImport]   = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [copyProduct, setCopyProduct] = useState<Product | null>(null)
  const [showAddCat, setShowAddCat]   = useState(false)
  const [showManageCat, setShowManageCat] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all')
  const [textSearch, setTextSearch] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)
  const { data: productsData, loading, refetch } = useProducts({ limit: '2000' })
  const { data: catsData, refetch: refetchCats } = useCategories()
  const allCategories: Category[] = (catsData ?? []) as Category[]
  const products: Product[] = (productsData?.data ?? []) as Product[]

  const handleInventoryScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const code = normalizeScanCode(textSearch)
    if (!code) return
    const local = findProductByCode(products, code)
    if (local) {
      e.preventDefault()
      setViewProduct(local.product)
      toast.success(`Found: ${local.product.name}`)
      return
    }
    try {
      const res: any = await productsApi.lookupCode(code)
      const hit = res?.data?.product ?? res?.product
      if (hit) {
        e.preventDefault()
        const full = products.find(p => p.id === hit.id) ?? hit
        setViewProduct(full as Product)
        toast.success(`Found: ${hit.displayName ?? hit.name}`)
      }
    } catch {
      /* keep filtered list */
    }
  }

  const brands = useMemo(
    () => [...new Set(products.map(p => p.brandName).filter(Boolean))].sort() as string[],
    [products],
  )

  const filteredProducts = useMemo(() => products.filter(p => {
    if (categoryFilter !== 'all' && p.categoryName !== categoryFilter) return false
    if (brandFilter !== 'all' && p.brandName !== brandFilter) return false
    if (statusFilter === 'out' && p.stock !== 0) return false
    if (statusFilter === 'low' && !(p.stock > 0 && p.stock < p.minStock)) return false
    if (statusFilter === 'in' && !(p.stock >= p.minStock)) return false
    const q = textSearch.trim().toLowerCase()
    if (q) {
      if (!productSearchHaystack(p).includes(q)) return false
    }
    return true
  }).sort((a, b) => compareSkuOrder(a.sku, b.sku)), [products, categoryFilter, brandFilter, statusFilter, textSearch])

  /* Flatten: each variant becomes its own table row */
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const product of filteredProducts) {
      const vars = Array.isArray(product.storageVariations) ? product.storageVariations : []
      if (vars.length === 0) {
        // No variants — single row
        rows.push({
          key: product.id,
          product,
          displaySku: product.sku,
          displayPrice: product.sellingPrice,
          displayStock: product.stock,
          displayMinStock: product.minStock,
          displayName: product.name,
          categoryName: product.categoryName ?? '',
          brandName: product.brandName ?? '',
        })
      } else {
        // One row per variant
        for (const v of vars) {
          rows.push({
            key: `${product.id}__${v.id ?? v.storage + v.colorName}`,
            product,
            variation: v,
            displaySku: v.sku ?? product.sku,
            displayPrice: v.sellingPrice,
            displayStock: v.stock ?? 0,
            displayMinStock: product.minStock,
            displayName: product.name,
            categoryName: product.categoryName ?? '',
            brandName: product.brandName ?? '',
          })
        }
      }
    }
    return rows.sort((a, b) => compareSkuOrder(a.product.sku, b.product.sku))
  }, [filteredProducts])

  const hasActiveFilters = categoryFilter !== 'all' || brandFilter !== 'all' || statusFilter !== 'all' || textSearch.trim().length > 0

  const clearFilters = () => {
    setCategoryFilter('all')
    setBrandFilter('all')
    setStatusFilter('all')
    setTextSearch('')
  }

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...allCategories.map(c => ({ value: c.name, label: `${c.icon ? `${c.icon} ` : ''}${c.name}` })),
    ],
    [allCategories],
  )

  const brandOptions = useMemo(
    () => [{ value: 'all', label: 'All brands' }, ...brands.map(b => ({ value: b, label: b }))],
    [brands],
  )

  const lowStockCount = filteredProducts.filter(p => p.stock < p.minStock && p.stock > 0).length

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(INV_FILTERS_KEY)
      if (saved) {
        const f = JSON.parse(saved)
        if (typeof f.categoryFilter === 'string') setCategoryFilter(f.categoryFilter)
        if (typeof f.brandFilter === 'string') setBrandFilter(f.brandFilter)
        if (f.statusFilter === 'all' || f.statusFilter === 'in' || f.statusFilter === 'low' || f.statusFilter === 'out') {
          setStatusFilter(f.statusFilter)
        }
        if (typeof f.textSearch === 'string') setTextSearch(f.textSearch)
      }
    } catch { /* ignore */ }
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    sessionStorage.setItem(INV_FILTERS_KEY, JSON.stringify({ categoryFilter, brandFilter, statusFilter, textSearch }))
  }, [filtersReady, categoryFilter, brandFilter, statusFilter, textSearch])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add-product' || action === 'add') setShowAddProduct(true)
    const q = searchParams.get('q')
    if (q) setTextSearch(q)
  }, [searchParams])

  const closeAddProduct = useCallback(() => {
    setShowAddProduct(false)
    setCopyProduct(null)
    if (searchParams.get('action')) {
      const q = searchParams.get('q')
      router.replace(q ? `/inventory?q=${encodeURIComponent(q)}` : '/inventory', { scroll: false })
    }
  }, [router, searchParams])

  const openCopy = useCallback(async (product: Product) => {
    setViewProduct(null)
    setEditProduct(null)
    setShowAddProduct(false)
    try {
      const res: any = await productsApi.getById(product.id)
      setCopyProduct((res?.data ?? res ?? product) as Product)
    } catch {
      setCopyProduct(product)
    }
  }, [])

  useEffect(() => {
    const onSale = () => { refetch() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [refetch])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    await productsApi.delete(id)
    refetch()
  }

  const columns = useMemo<ColumnDef<FlatRow>[]>(() => [
    {
      id: 'orderNum',
      accessorFn: (row) => parseSkuOrderNumber(row.product.sku) ?? 999999,
      sortingFn: (a, b) => compareSkuOrder(a.original.product.sku, b.original.product.sku),
      header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
      cell: ({ row }) => {
        const n = parseSkuOrderNumber(row.original.product.sku)
        if (n == null) return <span className="text-xs text-[var(--text-muted)]">—</span>
        return (
          <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] tabular-nums">
            {formatSkuOrderLabel(row.original.product.sku, n)}
          </span>
        )
      },
      size: 64,
    },
    {
      id: 'name',
      accessorFn: (row) => row.displayName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => {
        const { product, variation } = row.original
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-violet-500/20 flex items-center justify-center flex-shrink-0 bg-violet-500/10">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package size={14} className="text-violet-400" />
              )}
            </div>
            <div className="min-w-0">
              <button
                className="text-sm font-medium text-gray-800 dark:text-slate-200 hover:text-violet-600 dark:hover:text-violet-400 text-left transition-colors leading-tight"
                onClick={() => setViewProduct(product)}
                onDoubleClick={(e) => { e.preventDefault(); setEditProduct(product) }}
              >
                {product.name}
              </button>
              {variation ? (
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--brand-glow)', color: 'var(--brand-light)' }}>
                    {variation.storage}
                  </span>
                  <div className="flex items-center gap-1">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: variation.colorHex, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', flexShrink: 0 }} />
                    <span className="text-[10px] text-slate-500">{variation.colorName}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span>{(product as any).brandName}</span>
                  {product.trackImei ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-semibold">
                      <Smartphone size={8} /> IMEI
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-500">No IMEI</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'sku',
      accessorFn: (row) => row.displaySku,
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => <span className="text-xs font-mono text-slate-400">{row.original.displaySku}</span>,
    },
    {
      id: 'categoryName',
      accessorFn: (row) => (row.product as any).categoryName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-slate-400">{(row.original.product as any).categoryName}</span>,
    },
    {
      id: 'sellingPrice',
      accessorFn: (row) => row.displayPrice,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(row.original.displayPrice)}</span>,
    },
    {
      id: 'stock',
      accessorFn: (row) => row.displayStock,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
      cell: ({ row }) => {
        const stock = row.original.displayStock
        const minStock = row.original.displayMinStock
        const isOut = stock === 0
        const isLow = stock < minStock && stock > 0
        return (
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}>{stock}</span>
            {isLow && <AlertTriangle size={10} className="text-yellow-500" />}
          </div>
        )
      },
    },
    {
      id: 'imeiGap',
      header: ({ column }) => <DataTableColumnHeader column={column} title="IMEI" />,
      cell: ({ row }) => {
        const { product, variation } = row.original
        if (variation || !product.trackImei) return <span className="text-xs text-slate-600">—</span>
        const gap = product.imeiGap ?? 0
        const inStock = product.imeiInStock ?? 0
        if (gap > 0) {
          return (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {inStock}/{product.stock} · -{gap}
            </span>
          )
        }
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
            {inStock} OK
          </span>
        )
      },
    },
    {
      id: 'stockStatus',
      accessorFn: (row) => {
        const stock = row.displayStock; const min = row.displayMinStock
        return stock === 0 ? 'Out of Stock' : stock < min ? 'Low Stock' : 'In Stock'
      },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const stock = row.original.displayStock
        const minStock = row.original.displayMinStock
        const isOut = stock === 0
        const isLow = stock < minStock && stock > 0
        return (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isOut ? 'bg-red-500/10 border-red-500/20 text-red-400' : isLow ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <TableActionsRow
            showAction={{ action: () => setViewProduct(row.original.product) }}
            editAction={{ action: () => setEditProduct(row.original.product) }}
            deleteAction={{ action: () => handleDelete(row.original.product.id, row.original.product.name) }}
          />
          <button
            type="button"
            title="Copy product"
            onClick={() => openCopy(row.original.product)}
            className="p-1.5 rounded-lg transition-colors hover:bg-cyan-500/10 text-cyan-400"
          >
            <Copy size={14} />
          </button>
        </div>
      ),
    },
  ], [handleDelete, openCopy, setViewProduct, setEditProduct])


  if (showAddProduct || copyProduct) {
    return (
      <AddProductModal
        key={copyProduct ? `copy-${copyProduct.id}` : showAddProduct ? 'new-product' : 'idle'}
        onClose={closeAddProduct}
        onSaved={() => { refetch(); closeAddProduct() }}
        copyFrom={copyProduct ?? undefined}
      />
    )
  }

  return (
    <div className="space-y-6">
      {showImport  && <ImportModal onClose={() => setShowImport(false)} onSaved={refetch} />}
      {showAddCat    && <AddCategoryModal onClose={() => setShowAddCat(false)} onSaved={() => refetchCats()} />}
      {showManageCat && <ManageCategoriesModal onClose={() => setShowManageCat(false)} onChanged={() => { refetchCats(); refetch() }} />}
      {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} onSaved={refetch} />}
      {viewProduct && (
        <ProductDetailModal
          product={viewProduct}
          onClose={() => setViewProduct(null)}
          onEdit={() => { setEditProduct(viewProduct); setViewProduct(null) }}
          onCopy={() => openCopy(viewProduct)}
        />
      )}

      <ImeiHealthBanner onFixed={refetch} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            {hasActiveFilters
              ? `${filteredProducts.length} of ${products.length} products shown`
              : `${products.length} products · ${products.filter(p => p.stock < p.minStock).length} low stock alerts`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <OpenPosButton label="Sell in POS" variant="secondary" />
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Upload size={14} />Import
          </button>
          <button onClick={() => exportProductsCSV(filteredProducts)} disabled={filteredProducts.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40">
            <Download size={14} />Export
          </button>
          <button
            onClick={() => {
              setShowAddProduct(true)
              router.replace('/inventory?action=add-product', { scroll: false })
            }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Plus size={14} />Add Product
          </button>
          <button onClick={() => setShowManageCat(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Layers size={14} />Manage Categories
          </button>
          <button onClick={() => setShowAddCat(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Tag size={14} />Add Category
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          onKeyDown={handleInventoryScan}
          placeholder="Search name, SKU, barcode…"
          className="w-full sm:w-auto sm:min-w-[200px]"
        />

        <FilterDropdown
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
          icon={Layers}
          placeholder="All categories"
          active={categoryFilter !== 'all'}
          onClear={() => setCategoryFilter('all')}
        />

        <FilterDropdown
          value={brandFilter}
          onChange={setBrandFilter}
          options={brandOptions}
          icon={Tag}
          placeholder="All brands"
          active={brandFilter !== 'all'}
          onClear={() => setBrandFilter('all')}
        />

        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
          {([
            { id: 'all' as const, label: 'All stock' },
            { id: 'in' as const, label: 'In stock' },
            { id: 'low' as const, label: 'Low' },
            { id: 'out' as const, label: 'Out' },
          ]).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
              style={statusFilter === opt.id
                ? { background: 'var(--brand-primary-light)', color: '#fff' }
                : { color: 'var(--text-muted)' }}>
              {opt.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <>
            <span className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
              {filteredProducts.length} of {products.length}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              <RotateCcw size={11} />Reset
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total SKUs',   value: flatRows.length,                                                                          icon: Package,       color: 'violet' },
          { label: 'Stock Value',  value: formatCurrency(filteredProducts.reduce((s, p) => s + p.buyingPrice * p.stock, 0)),         icon: TrendingUp,    color: 'green'  },
          { label: 'Low Stock',   value: lowStockCount,                                                                               icon: AlertTriangle, color: 'yellow' },
          { label: 'Out of Stock', value: filteredProducts.filter(p => p.stock === 0).length,                                         icon: AlertCircle,   color: 'red'    },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <ClientSideTable
        data={flatRows}
        columns={columns}
        isLoading={loading}
        pageSize={50}
        searchableColumns={[]}
        showFilter={false}
        withIndex={false}
        config={{
          features: { sorting: false },
          pagination: { defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200] },
        }}
      />
    </div>
  )
}
