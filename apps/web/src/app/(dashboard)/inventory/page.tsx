'use client'

import { useState, useRef, useMemo } from 'react'
import { Plus, Package, AlertTriangle, Download, Upload, QrCode, Edit, Trash2, Loader2, X, CheckCircle, AlertCircle, FileText, TrendingUp, Tag, Layers, BarChart2, ShoppingCart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency } from '@/lib/utils'
import { useProducts } from '@/lib/hooks'
import { productsApi } from '@/lib/api'
import type { Product } from '@/types'

const categories = ['All', 'Smartphones', 'Accessories', 'Tablets', 'Batteries', 'Screens', 'Chargers']

/* ── CSV Export ─────────────────────────────────────────────────────── */
function exportProductsCSV(products: Product[]) {
  const headers = ['name','sku','brandName','categoryName','buyingPrice','sellingPrice','stock','minStock']
  const rows = products.map(p => [
    `"${p.name}"`, p.sku,
    `"${(p as any).brandName ?? ''}"`,
    `"${(p as any).categoryName ?? ''}"`,
    p.buyingPrice, p.sellingPrice, p.stock, p.minStock,
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
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
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [done, setDone] = useState(false)

  const TEMPLATE = 'name,sku,brandName,categoryName,buyingPrice,sellingPrice,stock,minStock'
  const SAMPLE   = 'iPhone 15 Pro,IP15P-256,Apple,Smartphones,75000,89999,5,2'

  const COL_ALIASES: Record<string, string> = {
    'product name': 'name', 'product': 'name', 'item name': 'name', 'item': 'name',
    'sku': 'sku', 'sku code': 'sku', 'product code': 'sku',
    'category': 'categoryName', 'category name': 'categoryName',
    'brand': 'brandName', 'brand name': 'brandName',
    'cost price': 'buyingPrice', 'buying price': 'buyingPrice', 'cost': 'buyingPrice', 'purchase price': 'buyingPrice',
    'selling price': 'sellingPrice', 'sale price': 'sellingPrice', 'price': 'sellingPrice', 'retail price': 'sellingPrice',
    'stock qty': 'stock', 'stock quantity': 'stock', 'qty': 'stock', 'quantity': 'stock', 'stock': 'stock',
    'min stock': 'minStock', 'minimum stock': 'minStock', 'min stock alert': 'minStock', 'min qty': 'minStock',
  }

  const downloadTemplate = () => {
    const blob = new Blob([[TEMPLATE, SAMPLE].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'inventory-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text   = ev.target?.result as string
      const lines  = text.trim().split('\n').filter(Boolean)
      const rawHeader = lines[0].split(',')
      const header = rawHeader.map(h => {
        const norm = h.trim().toLowerCase().replace(/^"|"$/g, '')
        return COL_ALIASES[norm] ?? h.trim().replace(/^"|"$/g, '')
      })
      const parsed = lines.slice(1).map(line => {
        const vals: Record<string, string> = {}
        line.split(',').forEach((v, i) => { vals[header[i]] = v.trim().replace(/^"|"$/g, '') })
        return vals
      })
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setErrors([])
    setProgress({ done: 0, total: rows.length })
    const errs: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        await productsApi.create({
          name: r.name, sku: r.sku, brandName: r.brandName, categoryName: r.categoryName,
          buyingPrice: Number(r.buyingPrice), sellingPrice: Number(r.sellingPrice),
          stock: Number(r.stock), minStock: Number(r.minStock ?? 3),
        })
      } catch (e: any) {
        errs.push(`Row ${i + 2}: ${r.name} — ${e?.message ?? 'failed'}`)
      }
      setProgress({ done: i + 1, total: rows.length })
    }
    setErrors(errs)
    setDone(true)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Import Products (CSV)</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Template */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
            <div>
              <p className="text-sm text-violet-300 font-medium">Required columns</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">name, sku, brandName, categoryName, buyingPrice, sellingPrice, stock, minStock</p>
            </div>
            <button onClick={downloadTemplate} className="text-xs text-violet-400 border border-violet-500/20 px-2.5 py-1.5 rounded-lg hover:bg-violet-500/10 flex items-center gap-1.5 flex-shrink-0 ml-3">
              <FileText size={12} />Template
            </button>
          </div>

          {/* File picker */}
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-violet-500/30 hover:bg-violet-500/3 transition-colors"
          >
            <Upload size={24} className="text-slate-600 mx-auto mb-2" />
            {rows.length > 0
              ? <p className="text-sm text-violet-300">{rows.length} rows loaded — click to change file</p>
              : <><p className="text-sm text-slate-400">Click to select a CSV file</p><p className="text-xs text-slate-600 mt-1">or drag and drop</p></>}
          </button>

          {/* Preview */}
          {rows.length > 0 && !done && (
            <div className="bg-white/3 rounded-xl p-3 border border-white/5 max-h-40 overflow-y-auto">
              <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Preview ({rows.length} products)</p>
              {rows.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                  <span className="text-xs text-slate-400 truncate flex-1">{r.name}</span>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{r.sku}</span>
                </div>
              ))}
              {rows.length > 5 && <p className="text-[10px] text-slate-600 mt-1">+{rows.length - 5} more</p>}
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="space-y-2">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-400 text-center">{progress.done} / {progress.total} imported</p>
            </div>
          )}

          {/* Errors */}
          {done && errors.length === 0 && (
            <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />All {rows.length} products imported successfully!</div>
          )}
          {errors.length > 0 && (
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-400 flex items-start gap-1.5"><AlertCircle size={11} className="mt-0.5 flex-shrink-0" />{e}</p>)}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">{done ? 'Close' : 'Cancel'}</button>
            {!done && (
              <button
                onClick={handleImport}
                disabled={rows.length === 0 || !!progress}
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

function AddProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', sku: '', categoryName: 'Smartphones', brandName: '', buyingPrice: '', sellingPrice: '', stock: '', minStock: '5', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await productsApi.create({
        ...form,
        buyingPrice: Number(form.buyingPrice),
        sellingPrice: Number(form.sellingPrice),
        stock: Number(form.stock),
        minStock: Number(form.minStock),
      })
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create product') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-white">Add Product</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Product Name *</label>
              <input required className="input-field" placeholder="iPhone 15 Pro Max 256GB" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">SKU *</label>
              <input required className="input-field" placeholder="IP15PM-256-BLK" value={form.sku} onChange={f('sku')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Brand</label>
              <input className="input-field" placeholder="Apple" value={form.brandName} onChange={f('brandName')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <select className="input-field" value={form.categoryName} onChange={f('categoryName')}>
                {['Smartphones','Accessories','Tablets','Batteries','Screens','Chargers','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Buying Price (₹) *</label>
              <input required type="number" min="0" className="input-field" placeholder="75000" value={form.buyingPrice} onChange={f('buyingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Selling Price (₹) *</label>
              <input required type="number" min="0" className="input-field" placeholder="89999" value={form.sellingPrice} onChange={f('sellingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Stock Qty *</label>
              <input required type="number" min="0" className="input-field" placeholder="10" value={form.stock} onChange={f('stock')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Min Stock Alert</label>
              <input type="number" min="0" className="input-field" placeholder="5" value={form.minStock} onChange={f('minStock')} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditProductModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product.name, sku: product.sku,
    categoryName: (product as any).categoryName ?? '',
    brandName: (product as any).brandName ?? '',
    buyingPrice: String(product.buyingPrice), sellingPrice: String(product.sellingPrice),
    stock: String(product.stock), minStock: String(product.minStock),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await productsApi.update(product.id, {
        ...form,
        buyingPrice: Number(form.buyingPrice), sellingPrice: Number(form.sellingPrice),
        mrp: Number(form.sellingPrice), stock: Number(form.stock), minStock: Number(form.minStock),
      })
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to update') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-white">Edit Product</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Product Name *</label>
              <input required className="input-field" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">SKU *</label>
              <input required className="input-field" value={form.sku} onChange={f('sku')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Brand</label>
              <input className="input-field" value={form.brandName} onChange={f('brandName')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <select className="input-field" value={form.categoryName} onChange={f('categoryName')}>
                {['Smartphones','Accessories','Tablets','Batteries','Screens','Chargers','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Buying Price (₹)</label>
              <input type="number" min="0" className="input-field" value={form.buyingPrice} onChange={f('buyingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Selling Price (₹)</label>
              <input type="number" min="0" className="input-field" value={form.sellingPrice} onChange={f('sellingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Stock Qty</label>
              <input type="number" min="0" className="input-field" value={form.stock} onChange={f('stock')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Min Stock Alert</label>
              <input type="number" min="0" className="input-field" value={form.minStock} onChange={f('minStock')} />
            </div>
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
    </div>
  )
}

function ProductDetailModal({ product, onClose, onEdit }: { product: Product; onClose: () => void; onEdit?: () => void }) {
  const p = product as any
  const margin     = product.sellingPrice - product.buyingPrice
  const marginPct  = product.buyingPrice > 0 ? ((margin / product.buyingPrice) * 100).toFixed(1) : '0'
  const stockValue = product.buyingPrice * product.stock
  const isOut = product.stock === 0
  const isLow = product.stock < product.minStock && product.stock > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Product Details</h3>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1.5 rounded-lg border border-violet-500/20 hover:bg-violet-500/10 transition-colors">
                <Edit size={11} /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Hero banner */}
          <div className="w-full h-28 bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-cyan-500/10 rounded-2xl flex flex-col items-center justify-center border border-violet-500/15 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #7c3aed 0%, transparent 60%)' }} />
            <Package size={32} className="text-violet-400 mb-1.5 opacity-80" />
            <p className="text-xs text-violet-300 font-mono">{product.sku}</p>
          </div>

          {/* Name + brand */}
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{product.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              {p.brandName && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">{p.brandName}</span>}
              {p.categoryName && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400">{p.categoryName}</span>}
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                isOut ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : isLow ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                : 'bg-green-500/10 border-green-500/20 text-green-400'
              }`}>{isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}</span>
            </div>
          </div>

          {/* Price cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-center gap-1 mb-1"><ArrowDownRight size={11} className="text-slate-500" /><span className="text-[10px] text-slate-500 uppercase tracking-wide">Buying</span></div>
              <p className="text-sm font-bold text-white">{formatCurrency(product.buyingPrice)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div className="flex items-center justify-center gap-1 mb-1"><ShoppingCart size={11} className="text-violet-400" /><span className="text-[10px] text-violet-400 uppercase tracking-wide">Selling</span></div>
              <p className="text-sm font-bold text-violet-300">{formatCurrency(product.sellingPrice)}</p>
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
                <p className="text-xs text-slate-500">Stock Qty</p>
                <p className={`text-base font-bold ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}>{product.stock}</p>
              </div>
            </div>
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <BarChart2 size={14} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Stock Value</p>
                <p className="text-sm font-bold text-white">{formatCurrency(stockValue)}</p>
              </div>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-0 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {([
              ['SKU',           product.sku,              'font-mono text-xs'],
              ['Profit / unit', formatCurrency(margin),   margin >= 0 ? 'text-green-400' : 'text-red-400'],
              ['Min Stock Alert', String(product.minStock), 'text-yellow-400'],
              ['Description',   p.description ?? '—',    ''],
            ] as [string, string, string][]).map(([label, value, cls], i, arr) => (
              <div key={label} className={`flex items-center justify-between px-4 py-2.5 text-sm ${ i < arr.length - 1 ? 'border-b' : '' }`} style={{ borderColor: 'var(--border-subtle)', background: i % 2 === 0 ? 'var(--bg-subtle)' : 'transparent' }}>
                <span className="text-slate-500 text-xs">{label}</span>
                <span className={`font-medium text-xs ${cls || 'text-slate-200'} max-w-[60%] text-right truncate`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const { data: productsData, loading, refetch } = useProducts({ limit: '5000' })
  const products: Product[] = (productsData?.data ?? []) as Product[]

  const lowStockCount = products.filter(p => p.stock < p.minStock).length

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    await productsApi.delete(id)
    refetch()
  }

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Package size={14} className="text-violet-400" />
          </div>
          <div>
            <button className="text-sm font-medium text-slate-200 hover:text-violet-400 text-left transition-colors" onClick={() => setViewProduct(row.original)}>{row.original.name}</button>
            <p className="text-xs text-slate-500">{(row.original as any).brandName}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'sku',
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => <span className="text-xs font-mono text-slate-400">{row.original.sku}</span>,
    },
    {
      id: 'categoryName',
      accessorFn: (row) => (row as any).categoryName ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{(row.original as any).categoryName}</span>,
    },
    {
      accessorKey: 'sellingPrice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-white">{formatCurrency(row.original.sellingPrice)}</span>,
    },
    {
      accessorKey: 'stock',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
      cell: ({ row }) => {
        const isOut = row.original.stock === 0
        const isLow = row.original.stock < row.original.minStock && row.original.stock > 0
        return (
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}>{row.original.stock}</span>
            {isLow && <AlertTriangle size={10} className="text-yellow-500" />}
          </div>
        )
      },
    },
    {
      id: 'stockStatus',
      accessorFn: (row) => row.stock === 0 ? 'Out of Stock' : row.stock < row.minStock ? 'Low Stock' : 'In Stock',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const isOut = row.original.stock === 0
        const isLow = row.original.stock < row.original.minStock && row.original.stock > 0
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
        <TableActionsRow
          showAction={{ action: () => setViewProduct(row.original) }}
          editAction={{ action: () => setEditProduct(row.original) }}
          deleteAction={{ action: () => handleDelete(row.original.id, row.original.name) }}
        />
      ),
    },
  ], [handleDelete, setViewProduct, setEditProduct])

  return (
    <div className="space-y-6">
      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {showImport  && <ImportModal onClose={() => setShowImport(false)} onSaved={refetch} />}
      {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} onSaved={refetch} />}
      {viewProduct && <ProductDetailModal product={viewProduct} onClose={() => setViewProduct(null)} onEdit={() => { setEditProduct(viewProduct); setViewProduct(null) }} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{products.length} products · {lowStockCount} low stock alerts</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Upload size={14} />Import
          </button>
          <button onClick={() => exportProductsCSV(products)} disabled={products.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40">
            <Download size={14} />Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total SKUs',       value: products.length,                                                         icon: Package,       color: 'violet' },
          { label: 'Stock Value',      value: formatCurrency(products.reduce((s, p) => s + p.buyingPrice * p.stock, 0)), icon: TrendingUp,    color: 'green'  },
          { label: 'Low Stock',        value: lowStockCount,                                                            icon: AlertTriangle, color: 'yellow' },
          { label: 'Out of Stock',     value: products.filter(p => p.stock === 0).length,                               icon: AlertCircle,   color: 'red'    },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <ClientSideTable
        data={products}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((products.length || 1) / 20)}
        searchableColumns={[
          { id: 'name', title: 'Name' },
          { id: 'sku',  title: 'SKU'  },
        ]}
        filterableColumns={[
          {
            id: 'categoryName',
            title: 'Category',
            options: [
              { label: 'Smartphones', value: 'Smartphones' },
              { label: 'Accessories', value: 'Accessories' },
              { label: 'Tablets',     value: 'Tablets'     },
              { label: 'Batteries',   value: 'Batteries'   },
              { label: 'Screens',     value: 'Screens'     },
              { label: 'Chargers',    value: 'Chargers'    },
            ],
          },
          {
            id: 'stockStatus' as any,
            title: 'Stock Status',
            options: [
              { label: 'In Stock',     value: 'In Stock'     },
              { label: 'Low Stock',    value: 'Low Stock'    },
              { label: 'Out of Stock', value: 'Out of Stock' },
            ],
          },
        ]}
      />
    </div>
  )
}
