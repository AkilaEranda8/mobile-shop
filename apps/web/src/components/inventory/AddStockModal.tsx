'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import {
  X, Plus, Trash2, Edit2, QrCode, Upload, Loader2,
  Package, ShoppingCart, Barcode, ScanLine, ChevronDown,
  AlertCircle, CheckCircle, Cpu,
} from 'lucide-react'
import { productsApi, imeiApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { useProducts, useCategories } from '@/lib/hooks'
import type { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────

interface DeviceEntry {
  id: string
  product: Product | null
  productId: string
  productName: string
  storage: string
  color: string
  imei1: string
  imei2: string
  barcode: string
  buyingPrice: string
  sellingPrice: string
  warranty: string
  condition: 'Brand New' | 'Refurbished' | 'Used - Good' | 'Used - Fair'
  notes: string
  sku?: string
}

interface AddStockModalProps {
  onClose: () => void
  onSaved: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function genBarcode(entry: Partial<DeviceEntry>): string {
  if (!entry.productName) return ''
  const productPart = entry.productName.slice(0, 6).toUpperCase().replace(/\s/g, '')
  const storage = (entry.storage || '').replace(/\s/g, '')
  const color = (entry.color || '').slice(0, 3).toUpperCase().replace(/\s/g, '')
  const seq = Math.floor(Math.random() * 9000 + 1000)
  return `${productPart}-${storage}-${color}-${seq}`.replace(/-+/g, '-').replace(/-$/, '')
}

function emptyEntry(): DeviceEntry {
  return {
    id: genId(),
    product: null,
    productId: '',
    productName: '',
    storage: '',
    color: '',
    imei1: '',
    imei2: '',
    barcode: '',
    buyingPrice: '',
    sellingPrice: '',
    warranty: '12 Months',
    condition: 'Brand New',
    notes: '',
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  )
}

function Field({ children, span2 }: { children: React.ReactNode; span2?: boolean }) {
  return <div className={span2 ? 'col-span-2' : ''}>{children}</div>
}

// ── Device Preview Panel ───────────────────────────────────────────────────

function DevicePreview({ entry }: { entry: DeviceEntry }) {
  const margin = entry.sellingPrice && entry.buyingPrice
    ? Number(entry.sellingPrice) - Number(entry.buyingPrice)
    : null

  const rows: [string, string][] = [
    ['Product', entry.productName || '—'],
    ['Storage', entry.storage || '—'],
    ['Color', entry.color || '—'],
    ['IMEI 1', entry.imei1 || '—'],
    ['IMEI 2', entry.imei2 || '—'],
    ['Buying Price', entry.buyingPrice ? formatCurrency(Number(entry.buyingPrice)) : '—'],
    ['Selling Price', entry.sellingPrice ? formatCurrency(Number(entry.sellingPrice)) : '—'],
    ['Warranty', entry.warranty || '—'],
    ['Condition', entry.condition || '—'],
  ]

  return (
    <div
      className="rounded-2xl p-4 space-y-3 h-full flex flex-col"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Cpu size={12} className="text-violet-400" />
        </div>
        <span className="text-xs font-semibold text-violet-400">Device Preview</span>
      </div>

      {/* Product thumb */}
      <div
        className="w-full h-24 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--bg-subtle-md)', border: '1px solid var(--border-subtle)' }}
      >
        {entry.product?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.product.imageUrl} alt={entry.productName} className="h-full object-contain rounded-xl" />
        ) : (
          <Package size={32} className="text-violet-300 opacity-50" />
        )}
      </div>

      {/* Rows */}
      <div className="space-y-1 flex-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="font-medium text-right truncate max-w-[55%]" style={{ color: 'var(--text-primary)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Profit */}
      {margin !== null && (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: margin >= 0 ? 'rgba(21,128,61,0.10)' : 'rgba(185,28,28,0.10)', border: margin >= 0 ? '1px solid rgba(21,128,61,0.20)' : '1px solid rgba(185,28,28,0.20)' }}
        >
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Profit (per device)
          </span>
          <span className={`text-xs font-bold ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(margin)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── IMEI Input ─────────────────────────────────────────────────────────────

function ImeiInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={17}
          placeholder="Enter 15-digit IMEI"
          className="input-field pr-10 font-mono text-sm"
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 15))}
        />
        <button
          type="button"
          className="absolute right-3 text-slate-500 hover:text-violet-400 transition-colors"
          title="Scan IMEI / Barcode"
          tabIndex={-1}
        >
          <QrCode size={15} />
        </button>
      </div>
      {value && value.length !== 15 && (
        <p className="text-[10px] text-amber-400 mt-1">IMEI must be exactly 15 digits</p>
      )}
    </div>
  )
}

// ── Device Form ────────────────────────────────────────────────────────────

function DeviceForm({
  entry,
  products,
  onChange,
  onAddToList,
  onClear,
}: {
  entry: DeviceEntry
  products: Product[]
  onChange: (patch: Partial<DeviceEntry>) => void
  onAddToList: () => void
  onClear: () => void
}) {
  const f = (k: keyof DeviceEntry) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ [k]: e.target.value })

  // When product changes, auto-fill prices
  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId) ?? null
    onChange({
      productId,
      product: prod,
      productName: prod?.name ?? '',
      buyingPrice: prod ? String(prod.buyingPrice) : '',
      sellingPrice: prod ? String(prod.sellingPrice) : '',
      barcode: '',
    })
  }

  // Auto-generate barcode when fields are present
  const handleGenBarcode = () => {
    onChange({ barcode: genBarcode(entry) })
  }

  const imeiValid = !entry.imei1 || entry.imei1.length === 15
  const canAdd =
    entry.productId &&
    entry.imei1.length === 15 &&
    Number(entry.buyingPrice) > 0 &&
    Number(entry.sellingPrice) > 0

  return (
    <div className="space-y-4">
      {/* Section title */}
      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Device Details</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Product */}
        <Field span2>
          <Label required>Product</Label>
          <div className="relative">
            <select
              className="input-field appearance-none pr-8"
              value={entry.productId}
              onChange={e => handleProductChange(e.target.value)}
            >
              <option value="">Select product…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>
        </Field>

        {/* Storage / Model */}
        <div>
          <Label required>Storage / Model</Label>
          <div className="relative">
            <select className="input-field appearance-none pr-8" value={entry.storage} onChange={f('storage')}>
              <option value="">Select…</option>
              {['64GB', '128GB', '256GB', '512GB', '1TB'].map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>
        </div>

        {/* Color */}
        <div>
          <Label required>Color</Label>
          <div className="relative">
            <select className="input-field appearance-none pr-8" value={entry.color} onChange={f('color')}>
              <option value="">Select…</option>
              {['Black Titanium', 'White Titanium', 'Natural Titanium', 'Blue Titanium', 'Space Black', 'Silver', 'Gold', 'Deep Purple', 'Midnight', 'Starlight'].map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>
        </div>

        {/* IMEI 1 */}
        <ImeiInput label="IMEI 1" value={entry.imei1} onChange={v => onChange({ imei1: v })} required />

        {/* IMEI 2 */}
        <ImeiInput label="IMEI 2" value={entry.imei2} onChange={v => onChange({ imei2: v })} />

        {/* Barcode (Auto) */}
        <div>
          <Label>Barcode (Auto)</Label>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              placeholder="Auto-generated"
              className="input-field pr-10 font-mono text-xs"
              style={{ color: 'var(--text-muted)' }}
              value={entry.barcode}
            />
            <button
              type="button"
              onClick={handleGenBarcode}
              className="absolute right-3 text-slate-500 hover:text-violet-400 transition-colors"
              title="Generate barcode"
              tabIndex={-1}
            >
              <Barcode size={15} />
            </button>
          </div>
        </div>

        {/* Buying Price */}
        <div>
          <Label required>Buying Price (LKR)</Label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>LKR</span>
            <input
              type="number"
              min={0}
              placeholder="0.00"
              className="input-field pl-12"
              value={entry.buyingPrice}
              onChange={f('buyingPrice')}
            />
          </div>
        </div>

        {/* Selling Price */}
        <div>
          <Label required>Selling Price (LKR)</Label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>LKR</span>
            <input
              type="number"
              min={0}
              placeholder="0.00"
              className="input-field pl-12"
              value={entry.sellingPrice}
              onChange={f('sellingPrice')}
            />
          </div>
        </div>

        {/* Warranty */}
        <div>
          <Label required>Warranty</Label>
          <div className="relative">
            <select className="input-field appearance-none pr-8" value={entry.warranty} onChange={f('warranty')}>
              {['No Warranty', '1 Month', '3 Months', '6 Months', '12 Months', '18 Months', '24 Months'].map(w => (
                <option key={w}>{w}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>
        </div>

        {/* Condition */}
        <div>
          <Label required>Condition</Label>
          <div className="relative">
            <select className="input-field appearance-none pr-8" value={entry.condition} onChange={f('condition')}>
              {(['Brand New', 'Refurbished', 'Used - Good', 'Used - Fair'] as const).map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
          </div>
        </div>

        {/* Notes */}
        <Field span2>
          <Label>Notes</Label>
          <textarea
            rows={2}
            placeholder="Enter notes (optional)"
            className="input-field resize-none"
            value={entry.notes}
            onChange={f('notes')}
          />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onAddToList}
          disabled={!canAdd}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40"
        >
          <Plus size={15} />
          Add to List
        </button>
        <button
          type="button"
          onClick={onClear}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          Clear Form
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.xlsx,.xls,.csv'
              input.click()
            }}
          >
            <Upload size={14} />
            Import IMEI (Excel)
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ScanLine size={14} />
            Scan IMEI / Barcode
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Condition Badge ────────────────────────────────────────────────────────

function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    'Brand New': 'bg-green-500/15 text-green-400 border-green-500/20',
    'Refurbished': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    'Used - Good': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    'Used - Fair': 'bg-red-500/15 text-red-400 border-red-500/20',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[condition] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {condition}
    </span>
  )
}

// ── Added Devices Table ────────────────────────────────────────────────────

function AddedDevicesTable({
  devices,
  onEdit,
  onDelete,
}: {
  devices: DeviceEntry[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (devices.length === 0) return null

  const totalBuying  = devices.reduce((s, d) => s + Number(d.buyingPrice  || 0), 0)
  const totalSelling = devices.reduce((s, d) => s + Number(d.sellingPrice || 0), 0)
  const totalProfit  = totalSelling - totalBuying

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          Added Devices ({devices.length})
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['#', 'Product', 'Storage / Model', 'Color', 'IMEI 1', 'IMEI 2', 'Buying Price', 'Selling Price', 'Warranty', 'Condition', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr
                  key={d.id}
                  style={{ borderBottom: i < devices.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  className="hover:bg-white/2 transition-colors"
                >
                  <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                        {d.product?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Package size={12} className="text-violet-400" />
                        )}
                      </div>
                      <span className="font-medium truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>{d.productName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{d.storage || '—'}</td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                      {d.color || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{d.imei1 || '—'}</td>
                  <td className="px-3 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{d.imei2 || '—'}</td>
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {d.buyingPrice ? formatCurrency(Number(d.buyingPrice)) : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {d.sellingPrice ? formatCurrency(Number(d.sellingPrice)) : '—'}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{d.warranty}</td>
                  <td className="px-3 py-2.5"><ConditionBadge condition={d.condition} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(d.id)}
                        className="p-1.5 rounded-lg hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(d.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div
        className="grid grid-cols-4 gap-3 rounded-xl p-3"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Devices</p>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{devices.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Buying</p>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalBuying)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Selling</p>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalSelling)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Profit</p>
          <p className={`text-sm font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(totalProfit)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────

export function AddStockModal({ onClose, onSaved }: AddStockModalProps) {
  const { data: productsData } = useProducts()
  const products: Product[] = useMemo(() => (productsData?.data ?? []) as Product[], [productsData])

  // IMEI-trackable products (trackImei === true)
  const imeiProducts = useMemo(() => products.filter(p => p.trackImei), [products])
  // Fall back to all products if no IMEI-tracked ones
  const deviceProducts = imeiProducts.length > 0 ? imeiProducts : products

  const [form, setForm] = useState<DeviceEntry>(emptyEntry)
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleFormChange = useCallback((patch: Partial<DeviceEntry>) => {
    setForm(prev => ({ ...prev, ...patch }))
  }, [])

  const handleAddToList = () => {
    const entry: DeviceEntry = {
      ...form,
      barcode: form.barcode || genBarcode(form),
      id: editingId ?? genId(),
    }

    if (editingId) {
      setDevices(prev => prev.map(d => d.id === editingId ? entry : d))
      setEditingId(null)
    } else {
      setDevices(prev => [...prev, entry])
    }

    // Keep prices & product, reset IMEI fields
    setForm(prev => ({
      ...emptyEntry(),
      productId: prev.productId,
      product: prev.product,
      productName: prev.productName,
      storage: prev.storage,
      color: prev.color,
      buyingPrice: prev.buyingPrice,
      sellingPrice: prev.sellingPrice,
      warranty: prev.warranty,
      condition: prev.condition,
    }))
  }

  const handleClear = () => {
    setForm(emptyEntry())
    setEditingId(null)
  }

  const handleEdit = (id: string) => {
    const d = devices.find(x => x.id === id)
    if (!d) return
    setForm({ ...d })
    setEditingId(id)
  }

  const handleDelete = (id: string) => {
    setDevices(prev => prev.filter(x => x.id !== id))
    if (editingId === id) { setEditingId(null); setForm(emptyEntry()) }
  }

  const handleSave = async () => {
    if (devices.length === 0) {
      toast.error('Add at least one device to the list')
      return
    }
    setSaving(true)
    try {
      // Group by productId
      const updatesByProduct = new Map<string, { totalQty: number, variationsMap: Map<string, number>, devices: typeof devices }>()

      for (const d of devices) {
        if (!updatesByProduct.has(d.productId)) updatesByProduct.set(d.productId, { totalQty: 0, variationsMap: new Map(), devices: [] })
        const pUpdate = updatesByProduct.get(d.productId)!
        pUpdate.totalQty += 1
        pUpdate.devices.push(d)

        // Identify variant by SKU or storage+color
        const vKey = d.sku || `${d.storage}|${d.color}`
        pUpdate.variationsMap.set(vKey, (pUpdate.variationsMap.get(vKey) || 0) + 1)
      }

      for (const [productId, updateData] of Array.from(updatesByProduct.entries())) {
        const product = products.find(p => p.id === productId)
        if (product) {
          let updatedVariations = product.storageVariations
          if (Array.isArray(updatedVariations)) {
            updatedVariations = updatedVariations.map((v: any) => {
              const vKeySku = v.sku
              const vKeyProps = `${v.storage}|${v.colorName}`
              const addQty = updateData.variationsMap.get(vKeySku) || updateData.variationsMap.get(vKeyProps) || 0
              if (addQty > 0) {
                return { ...v, stock: (v.stock || 0) + addQty }
              }
              return v
            })
          }

          const lastDevice = updateData.devices[updateData.devices.length - 1]
          await productsApi.update(productId, {
            stock: (product.stock || 0) + updateData.totalQty,
            buyingPrice: Number(lastDevice.buyingPrice) || product.buyingPrice,
            sellingPrice: Number(lastDevice.sellingPrice) || product.sellingPrice,
            storageVariations: updatedVariations,
          })

          // Create ImeiRecords for each device entered
          const user = authStorage.getUser()
          const primaryBranchId = user?.branchIds?.[0]
          if (product.trackImei && primaryBranchId) {
            for (const d of updateData.devices) {
              const variationLabel = d.sku || `${d.storage}::${d.color}`
              if (d.imei1 && d.imei1.length === 15) {
                await imeiApi.create({ imei: d.imei1, productId, branchId: primaryBranchId, variation: variationLabel }).catch(() => null)
              }
              if (d.imei2 && d.imei2.length === 15) {
                await imeiApi.create({ imei: d.imei2, productId, branchId: primaryBranchId, variation: variationLabel }).catch(() => null)
              }
            }
          }
        }
      }
      toast.success(`${devices.length} device${devices.length > 1 ? 's' : ''} added to stock!`)
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div
        className="relative w-full max-w-6xl my-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        {/* ── Modal Header ─────────────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Package size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Add Stock / Receive Inventory
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Add new devices / stock to your inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Modal Body ───────────────────────────────────────────── */}
        <div className="p-6 space-y-6 overflow-y-auto">

          {/* ── Device Details + Preview ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
            {/* Left: Device form */}
            <div
              className="rounded-2xl p-5 space-y-1"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
            >
              <DeviceForm
                entry={form}
                products={deviceProducts}
                onChange={handleFormChange}
                onAddToList={handleAddToList}
                onClear={handleClear}
              />
            </div>

            {/* Right: Device preview */}
            <DevicePreview entry={form} />
          </div>

          {/* ── Added Devices Table ───────────────────────────────── */}
          <AddedDevicesTable
            devices={devices}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        {/* ── Modal Footer ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || devices.length === 0}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
            Save Stock
            {devices.length > 0 && ` (${devices.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
