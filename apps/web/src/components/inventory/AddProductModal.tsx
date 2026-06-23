'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Plus, Trash2, Upload, Loader2, ChevronDown,
  Info, Image as ImageIcon, GripVertical, ArrowLeft,
  Shield, Bell, Box, Tag,
} from 'lucide-react'
import { productsApi, uploadApi } from '@/lib/api'
import { useCategories } from '@/lib/hooks'
import type { Category } from '@/types'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantRow {
  id: string
  storage: string
  colorName: string
  colorHex: string
  sku: string
  sellingPrice: string
  costPrice: string
}

interface AddProductModalProps {
  onClose: () => void
  onSaved: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 9) }

const STORAGE_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB',
  'Basic', 'Standard', 'Pro', 'Max', 'Plus', 'Lite']

const COLOR_OPTIONS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#f5f5f5' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Gold', hex: '#d4af6e' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Yellow', hex: '#ca8a04' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Titanium', hex: '#8a8a8a' },
  { name: 'Midnight', hex: '#1e1b4b' },
  { name: 'Starlight', hex: '#f0ebe3' },
  { name: 'Graphite', hex: '#374151' },
]

const UNIT_OPTIONS = ['Piece (Pc)', 'Box', 'Set', 'Pair', 'Pack', 'Dozen', 'Kg', 'Gram', 'Litre', 'Meter']
const BARCODE_TYPES = ['Code 128 (C128)', 'Code 39', 'EAN-13', 'EAN-8', 'UPC-A', 'QR Code']
const WARRANTY_OPTIONS = ['None', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years']

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ num, title, subtitle }: { num: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: '#2563eb', color: '#fff' }}>
        {num}
      </div>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#2563eb' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  )
}

function Label({ children, required, info }: { children: React.ReactNode; required?: boolean; info?: string }) {
  return (
    <label className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
      {children}
      {required && <span className="text-red-400">*</span>}
      {info && (
        <span className="group relative cursor-help ml-0.5">
          <Info size={11} className="opacity-50 group-hover:opacity-80 transition-opacity" style={{ color: 'var(--text-muted)' }} />
          <span className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-50 text-[10px] px-2 py-1 rounded-lg whitespace-nowrap"
            style={{ background: '#1e2433', color: '#94a3b8', border: '1px solid var(--border-subtle)', minWidth: 180 }}>
            {info}
          </span>
        </span>
      )}
    </label>
  )
}

function SelectField({ value, onChange, children, placeholder }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        className="input-field appearance-none pr-8 w-full"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-muted)' }} />
    </div>
  )
}

function AddCategoryMini({ onClose, onSaved }: { onClose: () => void; onSaved: (cat: Category) => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res: any = await productsApi.createCategory({ name: name.trim() })
      toast.success(`Category "${name}" created`)
      onSaved(res.data ?? res)
      onClose()
    } catch (err: any) { toast.error(err.message || 'Failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="absolute right-0 top-10 z-50 w-52 rounded-xl shadow-2xl p-3 space-y-2"
      style={{ background: '#1a2035', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>New Category</p>
      <input autoFocus className="input-field text-xs" placeholder="Category name…" value={name}
        onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 text-xs py-1.5 rounded-lg"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>Cancel</button>
        <button type="button" onClick={handleSave} disabled={!name.trim() || loading}
          className="flex-1 text-xs py-1.5 rounded-lg font-semibold disabled:opacity-50"
          style={{ background: '#2563eb', color: '#fff' }}>
          {loading ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ─── Image Uploader ───────────────────────────────────────────────────────────

function ImageUploader({ imageUrl, onUploaded }: { imageUrl: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) { toast.error('PNG, JPG, JPEG only'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return }
    setUploading(true)
    try {
      const { url } = await uploadApi.productImage(file)
      onUploaded(url)
    } catch (err: any) { toast.error(err?.message ?? 'Upload failed') }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = '' }
  }

  return (
    <div>
      <Label>Product Image</Label>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
        className="cursor-pointer rounded-xl flex flex-col items-center justify-center transition-all"
        style={{
          height: 170,
          border: `2px dashed ${dragOver ? '#2563eb' : 'var(--border-subtle)'}`,
          background: dragOver ? 'rgba(37,99,235,0.04)' : 'var(--bg-subtle)',
        }}
      >
        {uploading ? (
          <Loader2 size={22} className="animate-spin text-blue-400" />
        ) : imageUrl ? (
          <div className="relative w-full h-full group rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Product" className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
              <Upload size={18} className="text-white" />
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(37,99,235,0.1)' }}>
              <Upload size={20} className="text-blue-500" />
            </div>
            <p className="text-xs font-semibold text-blue-500">Click to upload</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>or drag and drop</p>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>PNG, JPG, JPEG (Max 2MB)</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Checkbox Setting ─────────────────────────────────────────────────────────

function CheckSetting({ checked, onChange, icon: Icon, title, desc, info }: {
  checked: boolean; onChange: (v: boolean) => void
  icon: React.ElementType; title: string; desc: string; info?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2">
      <div className="relative mt-0.5 flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <div
          className="w-4 h-4 rounded flex items-center justify-center transition-colors"
          style={{ background: checked ? '#2563eb' : 'transparent', border: `2px solid ${checked ? '#2563eb' : 'var(--border-default)'}` }}
        >
          {checked && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {info && (
            <span className="group relative cursor-help">
              <Info size={10} className="opacity-40" style={{ color: 'var(--text-muted)' }} />
              <span className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-50 text-[10px] px-2 py-1 rounded-lg"
                style={{ background: '#1e2433', color: '#94a3b8', border: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                {info}
              </span>
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
    </label>
  )
}

// ─── Color Dot ────────────────────────────────────────────────────────────────

function ColorDot({ hex }: { hex: string }) {
  return <span className="w-4 h-4 rounded-full flex-shrink-0 inline-block" style={{ background: hex, border: '1px solid rgba(255,255,255,0.15)' }} />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AddProductModal({ onClose, onSaved }: AddProductModalProps) {
  const { data: catsData, refetch: refetchCats } = useCategories()
  const categories: Category[] = (catsData ?? []) as Category[]

  const [loading, setLoading] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)

  // Basic Info
  const [form, setForm] = useState({
    name: '', sku: '', barcodeType: 'Code 128 (C128)', brandName: '',
    categoryName: '', subCategory: '', unit: 'Piece (Pc)', deviceModel: '',
    description: '', imageUrl: '',
  })

  // Settings
  const [trackImei, setTrackImei] = useState(true)
  const [warrantyTracking, setWarrantyTracking] = useState(true)
  const [lowStockAlert, setLowStockAlert] = useState(true)
  const [minStock, setMinStock] = useState('5')

  // Pricing & Tax
  const [pricing, setPricing] = useState({
    tax: 'None', taxType: 'Exclusive',
    purchaseExTax: '', purchaseIncTax: '',
    sellingExTax: '', margin: '',
  })

  // Additional
  const [additional, setAdditional] = useState({
    supplier: '', warrantyPeriod: 'None', hsCode: '', tags: '',
  })

  // Variants
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [showColorDropdown, setShowColorDropdown] = useState<string | null>(null)
  const [showStorageDropdown, setShowStorageDropdown] = useState<string | null>(null)

  useEffect(() => {
    if (categories.length > 0 && !form.categoryName) {
      setForm(p => ({ ...p, categoryName: categories[0].name }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length])

  const setField = useCallback((k: string, v: string) => setForm(p => ({ ...p, [k]: v })), [])

  // Variant handlers
  const addVariant = () => {
    setVariants(prev => [...prev, {
      id: genId(), storage: '128GB',
      colorName: 'Black', colorHex: '#1a1a1a',
      sku: '', sellingPrice: '', costPrice: '',
    }])
  }

  const removeVariant = (id: string) => setVariants(prev => prev.filter(v => v.id !== id))

  const updateVariant = (id: string, key: keyof VariantRow, val: string) =>
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [key]: val } : v))

  const updateVariantColor = (id: string, name: string, hex: string) =>
    setVariants(prev => prev.map(v => v.id === id ? { ...v, colorName: name, colorHex: hex } : v))

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.sku.trim()) { toast.error('SKU is required'); return }
    if (!form.categoryName.trim()) { toast.error('Category is required'); return }

    const firstVariant = variants[0]
    setLoading(true)
    try {
      await productsApi.create({
        name: form.name.trim(),
        sku: form.sku.trim(),
        brandName: form.brandName || undefined,
        categoryName: form.categoryName || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        buyingPrice: firstVariant ? Number(firstVariant.costPrice) || 0 : 0,
        sellingPrice: firstVariant ? Number(firstVariant.sellingPrice) || 0 : 0,
        mrp: firstVariant ? Number(firstVariant.sellingPrice) || 0 : 0,
        stock: 0,
        minStock: lowStockAlert ? Number(minStock) || 5 : 0,
        trackImei,
        warrantyMonths: warrantyTracking ? 12 : 0,
        isActive: true,
        storageVariations: variants.map(v => ({ storage: v.storage, sellingPrice: Number(v.sellingPrice) || 0 })),
        colorVariations: variants.map(v => ({ name: v.colorName, hex: v.colorHex })),
      })
      toast.success(`Product "${form.name}" created!`)
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'var(--bg-page, #0f1629)' }}>
      <div className="min-h-screen">
        {/* ── Top Header ── */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Add New Product</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Create a new product with model (storage) and color variations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary text-sm px-5">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={loading || !form.name.trim() || !form.sku.trim()}
              className="btn-primary text-sm px-5 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
                </svg>
              )}
              Save Product
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

          {/* ══ SECTION 1: Basic Information ══════════════════════════════ */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <SectionHeader num={1} title="Basic Information" />

            <div className="grid grid-cols-[180px_1fr] gap-6">
              {/* Image */}
              <ImageUploader imageUrl={form.imageUrl} onUploaded={url => setField('imageUrl', url)} />

              {/* Fields grid */}
              <div className="space-y-4">
                {/* Row 1: Name + SKU + Barcode */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <Label required>Product Name</Label>
                    <input className="input-field" placeholder="Enter product name"
                      value={form.name} onChange={e => setField('name', e.target.value)} />
                  </div>
                  <div>
                    <Label required>SKU</Label>
                    <input className="input-field" placeholder="Enter SKU"
                      value={form.sku} onChange={e => setField('sku', e.target.value)} />
                  </div>
                  <div>
                    <Label info="Barcode format used when printing labels">Barcode Type</Label>
                    <SelectField value={form.barcodeType} onChange={v => setField('barcodeType', v)}>
                      {BARCODE_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                    </SelectField>
                  </div>
                </div>

                {/* Row 2: Brand + Category + Sub Category */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label required>Brand</Label>
                    <div className="flex gap-2">
                      <input className="input-field flex-1" placeholder="Select brand"
                        list="brand-datalist" value={form.brandName}
                        onChange={e => setField('brandName', e.target.value)} />
                      <datalist id="brand-datalist">
                        {['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Google', 'Sony', 'Huawei', 'Oppo', 'Vivo', 'Realme'].map(b => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                      <button type="button" className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                        style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Label required>Category</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <SelectField value={form.categoryName} onChange={v => setField('categoryName', v)} placeholder="Select category">
                          {categories.map(c => <option key={c.id} value={c.name}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                        </SelectField>
                      </div>
                      <div className="relative">
                        <button type="button" onClick={() => setShowAddCat(p => !p)}
                          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                          style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                          <Plus size={14} />
                        </button>
                        {showAddCat && <AddCategoryMini onClose={() => setShowAddCat(false)}
                          onSaved={cat => { refetchCats(); setField('categoryName', cat.name) }} />}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Sub Category</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <SelectField value={form.subCategory} onChange={v => setField('subCategory', v)} placeholder="Select sub category">
                          <option value="flagship">Flagship</option>
                          <option value="mid-range">Mid Range</option>
                          <option value="budget">Budget</option>
                          <option value="accessories">Accessories</option>
                        </SelectField>
                      </div>
                      <button type="button" className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                        style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Unit + Device Model */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label required>Unit</Label>
                    <SelectField value={form.unit} onChange={v => setField('unit', v)}>
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <Label>Device Model</Label>
                    <SelectField value={form.deviceModel} onChange={v => setField('deviceModel', v)} placeholder="Select device model">
                      <option value="iphone">iPhone</option>
                      <option value="ipad">iPad</option>
                      <option value="macbook">MacBook</option>
                      <option value="android">Android</option>
                      <option value="tablet">Tablet</option>
                      <option value="laptop">Laptop</option>
                    </SelectField>
                  </div>
                </div>
              </div>
            </div>

            {/* Description + Settings row */}
            <div className="grid grid-cols-[1fr_300px] gap-6 mt-5">
              {/* Description */}
              <div>
                <Label>Description</Label>
                {/* Toolbar */}
                <div className="rounded-t-lg flex items-center gap-1 px-2 py-1.5 flex-wrap"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderBottom: 'none' }}>
                  {['B', 'I', 'U'].map(fmt => (
                    <button key={fmt} type="button" className="px-2 py-0.5 text-xs font-bold rounded hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--text-secondary)', fontStyle: fmt === 'I' ? 'italic' : 'normal', textDecoration: fmt === 'U' ? 'underline' : 'none' }}>
                      {fmt}
                    </button>
                  ))}
                  <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
                  {['≡', '≣', '⊞'].map((sym, i) => (
                    <button key={i} type="button" className="px-2 py-0.5 text-xs rounded hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}>{sym}</button>
                  ))}
                  <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
                  <button type="button" className="px-2 py-0.5 text-xs rounded hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>🔗</button>
                  <button type="button" className="px-2 py-0.5 text-xs rounded hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>🖼</button>
                  <div className="ml-auto flex items-center gap-2">
                    <select className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option>
                    </select>
                  </div>
                </div>
                <textarea
                  rows={5}
                  maxLength={2000}
                  placeholder="Write product description..."
                  className="w-full px-3 py-2.5 text-sm resize-none rounded-b-lg"
                  style={{
                    background: 'var(--bg-subtle)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    outline: 'none',
                  }}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                />
                <p className="text-right text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {form.description.length}/2000
                </p>
              </div>

              {/* Settings */}
              <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <CheckSetting checked={trackImei} onChange={setTrackImei} icon={Shield}
                  title="Track IMEI / Serial Number"
                  desc="Enable IMEI or Serial number tracking for this product"
                  info="Each unit must have a unique IMEI/Serial" />
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />
                <CheckSetting checked={warrantyTracking} onChange={setWarrantyTracking} icon={Shield}
                  title="Warranty Tracking"
                  desc="Enable warranty tracking for this product"
                  info="Automatically create warranty records on sale" />
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />
                <CheckSetting checked={lowStockAlert} onChange={setLowStockAlert} icon={Bell}
                  title="Low Stock Alert"
                  desc="Get notified when stock quantity goes below" />
                {lowStockAlert && (
                  <div className="pl-7">
                    <Label required>Min Stock Quantity</Label>
                    <input type="number" min={0} className="input-field text-sm" value={minStock}
                      onChange={e => setMinStock(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ SECTIONS 2 + 3 side by side ════════════════════════════════ */}
          <div className="grid grid-cols-[1fr_320px] gap-6">

            {/* SECTION 2: Variant Combinations */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between mb-5">
                <SectionHeader num={2} title="Variant Combinations"
                  subtitle="Add all available combinations of storage (model) and color." />
                <button type="button" onClick={addVariant}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold flex-shrink-0 transition-colors hover:brightness-110"
                  style={{ background: '#2563eb', color: '#fff' }}>
                  <Plus size={13} /> Add Variant
                </button>
              </div>

              {variants.length > 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="px-2 py-2.5 text-left font-semibold uppercase tracking-wider w-6" style={{ color: 'var(--text-muted)' }}>#</th>
                        <th className="px-2 py-2.5 text-left font-semibold uppercase tracking-wider w-6" style={{ color: 'var(--text-muted)' }}></th>
                        <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Storage (Model) <span className="text-red-400">*</span></th>
                        <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Color <span className="text-red-400">*</span></th>
                        <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>SKU (Optional)</th>
                        <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Default Selling Price (LKR) <span className="text-red-400">*</span></th>
                        <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cost Price (LKR) Optional</th>
                        <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider w-12" style={{ color: 'var(--text-muted)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, i) => (
                        <tr key={v.id}
                          style={{ borderBottom: i < variants.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          {/* # */}
                          <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          {/* Drag */}
                          <td className="px-1 py-2">
                            <GripVertical size={13} style={{ color: 'var(--text-muted)' }} />
                          </td>
                          {/* Storage */}
                          <td className="px-2 py-2">
                            <div className="relative">
                              <div
                                className="input-field text-xs flex items-center justify-between cursor-pointer"
                                onClick={() => setShowStorageDropdown(showStorageDropdown === v.id ? null : v.id)}
                              >
                                <span>{v.storage}</span>
                                <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
                              </div>
                              {showStorageDropdown === v.id && (
                                <div className="absolute left-0 top-full mt-1 z-30 w-36 rounded-xl shadow-2xl py-1 max-h-48 overflow-y-auto"
                                  style={{ background: '#1a2035', border: '1px solid var(--border-default)' }}>
                                  {STORAGE_OPTIONS.map(s => (
                                    <button key={s} type="button"
                                      onClick={() => { updateVariant(v.id, 'storage', s); setShowStorageDropdown(null) }}
                                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                                      style={{ color: v.storage === s ? '#60a5fa' : 'var(--text-secondary)' }}>
                                      {s}
                                    </button>
                                  ))}
                                  {/* Custom input */}
                                  <div className="px-2 py-1 border-t mt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <input
                                      className="w-full text-xs px-2 py-1 rounded"
                                      placeholder="Custom..."
                                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          updateVariant(v.id, 'storage', (e.target as HTMLInputElement).value)
                                          setShowStorageDropdown(null)
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Color */}
                          <td className="px-2 py-2">
                            <div className="relative">
                              <div
                                className="input-field text-xs flex items-center gap-2 cursor-pointer"
                                onClick={() => setShowColorDropdown(showColorDropdown === v.id ? null : v.id)}
                              >
                                <ColorDot hex={v.colorHex} />
                                <span className="flex-1">{v.colorName}</span>
                                <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
                              </div>
                              {showColorDropdown === v.id && (
                                <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-xl shadow-2xl py-1 max-h-52 overflow-y-auto"
                                  style={{ background: '#1a2035', border: '1px solid var(--border-default)' }}>
                                  {COLOR_OPTIONS.map(c => (
                                    <button key={c.name} type="button"
                                      onClick={() => { updateVariantColor(v.id, c.name, c.hex); setShowColorDropdown(null) }}
                                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-blue-500/10 transition-colors"
                                      style={{ color: v.colorName === c.name ? '#60a5fa' : 'var(--text-secondary)' }}>
                                      <ColorDot hex={c.hex} />
                                      {c.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          {/* SKU */}
                          <td className="px-2 py-2">
                            <input
                              className="input-field text-xs font-mono"
                              placeholder={`${form.sku ? form.sku.toUpperCase() : 'IP12P'}-${v.storage.replace(/\s/g, '')}-${v.colorName.slice(0, 3).toUpperCase()}`}
                              value={v.sku}
                              onChange={e => updateVariant(v.id, 'sku', e.target.value)}
                            />
                          </td>
                          {/* Selling Price */}
                          <td className="px-2 py-2">
                            <input type="number" min={0}
                              className="input-field text-xs"
                              placeholder="0.00"
                              value={v.sellingPrice}
                              onChange={e => updateVariant(v.id, 'sellingPrice', e.target.value)}
                            />
                          </td>
                          {/* Cost Price */}
                          <td className="px-2 py-2">
                            <input type="number" min={0}
                              className="input-field text-xs"
                              placeholder="0.00"
                              value={v.costPrice}
                              onChange={e => updateVariant(v.id, 'costPrice', e.target.value)}
                            />
                          </td>
                          {/* Action */}
                          <td className="px-2 py-2">
                            <button type="button" onClick={() => removeVariant(v.id)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                              style={{ color: 'var(--text-muted)' }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl py-10 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
                  <Box size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No variants yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Click "+ Add Variant" to add storage and color combinations</p>
                </div>
              )}

              {variants.length > 0 && (
                <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <Info size={10} />
                  Each variant represents a unique combination of storage (model) and color.
                </p>
              )}
            </div>

            {/* SECTION 3: Pricing & Tax */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <SectionHeader num={3} title="Pricing & Tax" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Applicable Tax</Label>
                    <SelectField value={pricing.tax} onChange={v => setPricing(p => ({ ...p, tax: v }))}>
                      <option value="None">None</option>
                      <option value="VAT 15%">VAT 15%</option>
                      <option value="GST 10%">GST 10%</option>
                      <option value="Custom">Custom</option>
                    </SelectField>
                  </div>
                  <div>
                    <Label>Selling Price Tax Type <span className="text-red-400">*</span></Label>
                    <SelectField value={pricing.taxType} onChange={v => setPricing(p => ({ ...p, taxType: v }))}>
                      <option value="Exclusive">Exclusive</option>
                      <option value="Inclusive">Inclusive</option>
                    </SelectField>
                  </div>
                </div>

                {/* Purchase Price */}
                <div>
                  <Label>Default Purchase Price (LKR)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Ex. Tax</p>
                      <input type="number" min={0} className="input-field text-sm" placeholder="0.00"
                        value={pricing.purchaseExTax} onChange={e => setPricing(p => ({ ...p, purchaseExTax: e.target.value }))} />
                    </div>
                    <div>
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inc. Tax</p>
                      <input type="number" min={0} className="input-field text-sm" placeholder="0.00"
                        value={pricing.purchaseIncTax} onChange={e => setPricing(p => ({ ...p, purchaseIncTax: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Selling Price */}
                <div>
                  <Label>Default Selling Price (LKR)</Label>
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Ex. Tax</p>
                    <input type="number" min={0} className="input-field text-sm" placeholder="0.00"
                      value={pricing.sellingExTax} onChange={e => setPricing(p => ({ ...p, sellingExTax: e.target.value }))} />
                  </div>
                </div>

                {/* Margin */}
                <div>
                  <Label>Margin (%)</Label>
                  <div className="relative">
                    <input type="number" min={0} className="input-field text-sm pr-8" placeholder="0.00"
                      value={pricing.margin} onChange={e => setPricing(p => ({ ...p, margin: e.target.value }))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                      style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ SECTION 4: Additional Information ═════════════════════════ */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <SectionHeader num={4} title="Additional Information (Optional)" />
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Supplier</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SelectField value={additional.supplier} onChange={v => setAdditional(p => ({ ...p, supplier: v }))} placeholder="Select supplier">
                      <option value="general">General Supplier</option>
                    </SelectField>
                  </div>
                  <button type="button" className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                    style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div>
                <Label>Warranty Period</Label>
                <SelectField value={additional.warrantyPeriod} onChange={v => setAdditional(p => ({ ...p, warrantyPeriod: v }))}>
                  {WARRANTY_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                </SelectField>
              </div>
              <div>
                <Label>HS Code</Label>
                <input className="input-field" placeholder="Enter HS code"
                  value={additional.hsCode} onChange={e => setAdditional(p => ({ ...p, hsCode: e.target.value }))} />
              </div>
              <div>
                <Label>Tags</Label>
                <input className="input-field" placeholder="Enter tags"
                  value={additional.tags} onChange={e => setAdditional(p => ({ ...p, tags: e.target.value }))} />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Press enter to add</p>
              </div>
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </div>

      {/* Click outside dropdowns to close */}
      {(showColorDropdown || showStorageDropdown) && (
        <div className="fixed inset-0 z-20" onClick={() => { setShowColorDropdown(null); setShowStorageDropdown(null) }} />
      )}
    </div>
  )
}
