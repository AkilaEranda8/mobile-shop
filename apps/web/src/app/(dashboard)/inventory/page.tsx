'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Package, AlertTriangle, Download, Upload, Edit, Trash2, Loader2, X, CheckCircle, AlertCircle, FileText, TrendingUp, Tag, Layers, BarChart2, ShoppingCart, ArrowUpRight, ArrowDownRight, RotateCcw, Smartphone, Shield, Copy, Hash, Calendar, Route } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useProducts, useCategories, useBrands, useFeatureFlag } from '@/lib/hooks'
import { productsApi } from '@/lib/api'
import type { Product, Category, Brand, ProductVariation } from '@/types'
import toast from 'react-hot-toast'
import { OpenPosButton } from '@/components/pos/OpenPosButton'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { AddProductModal } from '@/components/inventory/AddProductModal'
import { trackFlagToImeiType, isImeiHealthBannerDismissed, dismissImeiHealthBanner } from '@/lib/productImei'
import { productConditionLabel } from '@/lib/productCondition'
import { compareSkuOrder, formatSkuOrderLabel, parseSkuOrderNumber } from '@/lib/productCodes'
import { PERMISSIONS, useHasPermission } from '@/lib/permissions'
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

/* ── Manage Brands Modal ────────────────────────────────────────────── */
function ManageBrandsModal({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Brand | null>(null)
  const [reassignToId, setReassignToId] = useState('')
  const { data: brandsData, refetch } = useBrands()
  const brands: Brand[] = (brandsData ?? []) as Brand[]

  const doDelete = async (brand: Brand, moveToId?: string) => {
    setDeletingId(brand.id)
    try {
      await productsApi.deleteBrand(brand.id, moveToId)
      toast.success(`Brand "${brand.name}" deleted`)
      setPendingDelete(null); setReassignToId('')
      refetch(); onChanged?.()
    } catch (err: any) { toast.error(err.message || 'Failed to delete brand') }
    finally { setDeletingId(null) }
  }

  const handleDeleteClick = (brand: Brand) => {
    const count = brand.productCount ?? 0
    if (count > 0) {
      const others = brands.filter(b => b.id !== brand.id)
      if (others.length === 0) {
        toast.error('Create another brand first — products must be moved before deleting.')
        return
      }
      setPendingDelete(brand)
      setReassignToId(others[0].id)
      return
    }
    if (!confirm(`Delete brand "${brand.name}"? This cannot be undone.`)) return
    doDelete(brand)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-violet-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manage Brands</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>

        <div className="p-5">
          {brands.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No brands yet. Add a brand when creating a product.</p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{brands.length} brand{brands.length === 1 ? '' : 's'}</p>
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {brands.map(brand => (
                  <div key={brand.id} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm truncate flex items-center gap-2 min-w-0" style={{ color: 'var(--text-primary)' }}>
                        <span className="truncate">{brand.name}</span>
                        {(brand.productCount ?? 0) > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 flex-shrink-0 font-medium">
                            {brand.productCount} product{(brand.productCount ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(brand)}
                        disabled={deletingId === brand.id}
                        className="p-1.5 rounded-lg hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}>
                        {deletingId === brand.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                    {pendingDelete?.id === brand.id && (
                      <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-[11px] text-amber-400 font-medium">
                          Move {brand.productCount} product{(brand.productCount ?? 0) > 1 ? 's' : ''} to another brand before deleting.
                        </p>
                        <select
                          className="input-field text-sm w-full"
                          value={reassignToId}
                          onChange={e => setReassignToId(e.target.value)}>
                          {brands.filter(b => b.id !== brand.id).map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
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
                            disabled={!reassignToId || deletingId === brand.id}
                            onClick={() => doDelete(brand, reassignToId)}
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

function warrantyMonthsLabel(months: number): string {
  const map: Record<number, string> = { 0: 'None', 1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year', 24: '2 Years' }
  return map[months] ?? (months > 0 ? `${months} months` : 'None')
}

/* ── Product Detail Modal (Sales Details layout) ─────────────────────── */
function ProductDetailModal({ product, onClose, onEdit, onCopy }: { product: Product; onClose: () => void; onEdit?: () => void; onCopy?: () => void }) {
  const [detail, setDetail] = useState<Product>(product)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const hasWholesalePricing = useFeatureFlag('WHOLESALE_PRICING')
  const hasCreditPricing = useFeatureFlag('CREDIT_PRICING')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setLoadingDetail(true)
    productsApi.getById(product.id)
      .then((res: any) => setDetail(res.data ?? res))
      .catch(() => setDetail(product))
      .finally(() => setLoadingDetail(false))
  }, [product])

  const p = detail as Product & { subCategory?: string; deviceModel?: string }
  const margin = detail.sellingPrice - detail.buyingPrice
  const marginPct = detail.buyingPrice > 0 ? ((margin / detail.buyingPrice) * 100).toFixed(1) : '0'
  const stockValue = detail.buyingPrice * detail.stock
  const isOut = detail.stock === 0
  const isLow = detail.stock < detail.minStock && detail.stock > 0
  const variations = Array.isArray(detail.storageVariations) ? detail.storageVariations : []
  const imeiType = trackFlagToImeiType(detail.trackImei)
  const mrp = detail.mrp ?? detail.sellingPrice
  const barcode = effectiveBarcodeValue(detail)
  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const stockLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'
  const stockBadgeClass = isOut
    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25'
    : isLow
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25'
      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Package size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Product Details ( SKU : <span className="font-mono">{safeText(detail.sku)}</span> )
                {loadingDetail && <Loader2 size={12} className="inline-block ml-2 animate-spin text-slate-400" />}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{safeText(detail.name)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${stockBadgeClass}`}>
              {stockLabel}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25">
              {productConditionLabel(detail.condition)}
            </span>
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-cyan-700 dark:text-cyan-300 border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20"
              >
                <Copy size={12} /> Copy
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-violet-700 dark:text-violet-300 border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20"
              >
                <Edit size={12} /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>SKU:</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(detail.sku)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Barcode:</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(barcode)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Brand:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(p.brandName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Category:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {[p.categoryName, p.subCategory].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Model:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(p.deviceModel)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Warranty:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{warrantyMonthsLabel(detail.warrantyMonths ?? 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>IMEI tracking:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {imeiType === 'device' ? 'Phone / Tablet' : 'Accessory (no IMEI)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(formatDate(detail.createdAt))}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 flex items-center justify-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                  {detail.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.imageUrl} alt={detail.name} className="w-full h-full object-contain" />
                  ) : (
                    <Package size={18} className="text-violet-400 opacity-70" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between border-b pb-1.5 mb-1" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>LKR</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Stock</span>
                    <span className={`font-medium ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : ''}`}>{detail.stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Retail</span>
                    <span className="font-medium">{formatCurrency(detail.sellingPrice)}</span>
                  </div>
                  {(hasWholesalePricing && (detail.wholesalePrice ?? 0) > 0) && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Wholesale</span>
                      <span className="font-medium">{formatCurrency(detail.wholesalePrice ?? 0)}</span>
                    </div>
                  )}
                  {(hasCreditPricing && (detail.creditPrice ?? 0) > 0) && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Credit</span>
                      <span className="font-medium">{formatCurrency(detail.creditPrice ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold">Stock value</span>
                    <span className="font-semibold">{formatCurrency(stockValue)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Product information
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Value</th>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Name</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(detail.name)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Condition</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{productConditionLabel(detail.condition)}</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>SKU</td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(detail.sku)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Barcode</td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(barcode)}</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Brand</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(p.brandName)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Category</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(p.categoryName)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Sub category</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(p.subCategory)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Device model</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(p.deviceModel)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {barcode && (
                  <div className="px-3 py-3 border-t flex justify-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <BarcodeLabelPreview value={barcode} className="rounded-lg bg-white px-3 py-2" />
                  </div>
                )}
              </div>

              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp size={12} /> Pricing
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[560px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left">Buying</th>
                        <th className="px-3 py-2 text-left">Selling</th>
                        <th className="px-3 py-2 text-left">MRP</th>
                        <th className="px-3 py-2 text-right">Profit / unit</th>
                        <th className="px-3 py-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-medium">{formatCurrency(detail.buyingPrice)}</td>
                        <td className="px-3 py-2 font-semibold text-violet-600 dark:text-violet-300">{formatCurrency(detail.sellingPrice)}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(mrp)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatCurrency(margin)}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {marginPct}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {variations.length > 0 && (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Layers size={12} /> Variants ({variations.length})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Storage</th>
                          <th className="px-3 py-2 text-left">Color</th>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-right">Retail</th>
                          {hasWholesalePricing && <th className="px-3 py-2 text-right">Wholesale</th>}
                          {hasCreditPricing && <th className="px-3 py-2 text-right">Credit</th>}
                          <th className="px-3 py-2 text-right">Cost</th>
                          <th className="px-3 py-2 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variations.map((v, i) => (
                          <tr key={v.id ?? i} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(v.storage)}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full border inline-block" style={{ background: v.colorHex, borderColor: 'var(--border-default)' }} />
                                {safeText(v.colorName)}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{safeText(v.sku)}</td>
                            <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(v.sellingPrice)}</td>
                            {hasWholesalePricing && (
                            <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {(v.wholesalePrice ?? 0) > 0 ? formatCurrency(v.wholesalePrice!) : '—'}
                            </td>
                            )}
                            {hasCreditPricing && (
                            <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {(v.creditPrice ?? 0) > 0 ? formatCurrency(v.creditPrice!) : '—'}
                            </td>
                            )}
                            <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatCurrency(v.costPrice)}</td>
                            <td className="px-3 py-2 text-right font-medium">{v.stock ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Description:</p>
                  <p className="text-[12px] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{safeText(detail.description?.trim())}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Warranty note:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(detail.warrantyNote?.trim())}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Summary</p>
                <p className="text-[12px] font-semibold">{formatCurrency(detail.sellingPrice)}</p>
              </div>
              <div className="p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Stock qty:</span>
                  <span className={`font-medium ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : ''}`}>{detail.stock}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Min stock:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{detail.minStock}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Stock value:</span>
                  <span className="font-medium">{formatCurrency(stockValue)}</span>
                </div>
                {detail.trackImei && (
                  <>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>IMEI in stock:</span>
                      <span className="font-medium">{safeText(detail.imeiInStock)}</span>
                    </div>
                    {detail.imeiGap != null && detail.imeiGap > 0 && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>IMEI gap:</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{detail.imeiGap}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Variants:</span>
                  <span className="font-medium">{variations.length}</span>
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Retail price:</span>
                    <span className="font-semibold">{formatCurrency(detail.sellingPrice)}</span>
                  </div>
                  {(hasWholesalePricing && (detail.wholesalePrice ?? 0) > 0) && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Wholesale price:</span>
                      <span className="font-semibold">{formatCurrency(detail.wholesalePrice ?? 0)}</span>
                    </div>
                  )}
                  {(hasCreditPricing && (detail.creditPrice ?? 0) > 0) && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Credit price:</span>
                      <span className="font-semibold">{formatCurrency(detail.creditPrice ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Margin:</span>
                    <span className={`font-medium ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {marginPct}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2 flex-wrap">
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-semibold"
              >
                <Copy size={14} /> Copy product
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold"
              >
                <Edit size={14} /> Edit product
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
            >
              Close
            </button>
          </div>
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
  displayWholesale?: number
  displayCredit?: number
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
  const [showManageBrand, setShowManageBrand] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all')
  const [textSearch, setTextSearch] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)
  const { data: productsData, loading, refetch } = useProducts({ limit: '2000' })
  const { data: catsData, refetch: refetchCats } = useCategories()
  const hasWholesalePricing = useFeatureFlag('WHOLESALE_PRICING')
  const hasCreditPricing = useFeatureFlag('CREDIT_PRICING')
  const canViewTraceability = useHasPermission(PERMISSIONS.PRODUCT_TRACEABILITY_VIEW)
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
          displayWholesale: product.wholesalePrice ?? 0,
          displayCredit: product.creditPrice ?? 0,
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
            displayWholesale: v.wholesalePrice ?? product.wholesalePrice ?? 0,
            displayCredit: v.creditPrice ?? product.creditPrice ?? 0,
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
    const filter = searchParams.get('filter')
    if (filter === 'low-stock' || filter === 'low') setStatusFilter('low')
    else if (filter === 'out-of-stock' || filter === 'out') setStatusFilter('out')
    else if (filter === 'in-stock' || filter === 'in') setStatusFilter('in')
  }, [searchParams])

  const closeAddProduct = useCallback(() => {
    setShowAddProduct(false)
    setCopyProduct(null)
    setEditProduct(null)
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

  const openEdit = useCallback(async (product: Product) => {
    setViewProduct(null)
    setCopyProduct(null)
    setShowAddProduct(false)
    try {
      const res: any = await productsApi.getById(product.id)
      setEditProduct((res?.data ?? res ?? product) as Product)
    } catch {
      setEditProduct(product)
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
      accessorFn: (row) => row.product.sku,
      sortingFn: (a, b) => compareSkuOrder(a.original.product.sku, b.original.product.sku),
      header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
      cell: ({ row, table }) => {
        const sku = row.original.product.sku
        const label = formatSkuOrderLabel(sku)
        if (!label || !parseSkuOrderNumber(sku)) {
          return <span className="text-xs text-[var(--text-muted)]">—</span>
        }
        // Same product variants share one SKU — show # only on the first row
        const productId = row.original.product.id
        const rows = table.getRowModel().rows
        const firstIdx = rows.findIndex(r => r.original.product.id === productId)
        if (firstIdx >= 0 && rows[firstIdx].id !== row.id) {
          return <span className="text-xs text-[var(--text-muted)]">·</span>
        }
        return (
          <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] tabular-nums" title={sku}>
            {label}
          </span>
        )
      },
      size: 72,
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
                onDoubleClick={(e) => { e.preventDefault(); void openEdit(product) }}
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
      cell: ({ row }) => {
        const wholesale = row.original.displayWholesale ?? 0
        const credit = row.original.displayCredit ?? 0
        return (
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(row.original.displayPrice)}</span>
            {hasWholesalePricing && wholesale > 0 && (
              <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-0.5">Wholesale {formatCurrency(wholesale)}</p>
            )}
            {hasCreditPricing && credit > 0 && (
              <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-0.5">Credit {formatCurrency(credit)}</p>
            )}
          </div>
        )
      },
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
            editAction={{ action: () => { void openEdit(row.original.product) } }}
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
          {canViewTraceability && (
            <button
              type="button"
              title="Product Traceability"
              onClick={() => router.push(`/inventory/product-traceability/${row.original.product.id}`)}
              className="p-1.5 rounded-lg transition-colors hover:bg-violet-500/10 text-violet-400"
            >
              <Route size={14} />
            </button>
          )}
        </div>
      ),
    },
  ], [handleDelete, openCopy, openEdit, setViewProduct, hasWholesalePricing, hasCreditPricing, canViewTraceability, router])


  if (showAddProduct || copyProduct || editProduct) {
    return (
      <AddProductModal
        key={editProduct ? `edit-${editProduct.id}` : copyProduct ? `copy-${copyProduct.id}` : showAddProduct ? 'new-product' : 'idle'}
        onClose={closeAddProduct}
        onSaved={() => { refetch(); closeAddProduct() }}
        copyFrom={copyProduct ?? undefined}
        editProduct={editProduct ?? undefined}
      />
    )
  }

  return (
    <div className="space-y-6">
      {showImport  && <ImportModal onClose={() => setShowImport(false)} onSaved={refetch} />}
      {showAddCat    && <AddCategoryModal onClose={() => setShowAddCat(false)} onSaved={() => refetchCats()} />}
      {showManageCat && <ManageCategoriesModal onClose={() => setShowManageCat(false)} onChanged={() => { refetchCats(); refetch() }} />}
      {showManageBrand && <ManageBrandsModal onClose={() => setShowManageBrand(false)} onChanged={() => { refetch() }} />}
      {viewProduct && (
        <ProductDetailModal
          product={viewProduct}
          onClose={() => setViewProduct(null)}
          onEdit={() => { void openEdit(viewProduct) }}
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
          <button onClick={() => setShowManageBrand(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Tag size={14} />Manage Brands
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
        pageSize={100}
        searchableColumns={[]}
        showFilter={false}
        withIndex={false}
        config={{
          features: { sorting: false },
          pagination: { defaultPageSize: 100, pageSizeOptions: [50, 100, 200, 500, 1000] },
        }}
      />
    </div>
  )
}
