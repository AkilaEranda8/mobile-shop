'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Plus, Trash2, Upload, Loader2, Package, ChevronDown,
  Info, Lock, Image as ImageIcon, Check, AlertCircle,
} from 'lucide-react'
import { productsApi, uploadApi } from '@/lib/api'
import { useCategories } from '@/lib/hooks'
import type { Category } from '@/types'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────

interface StorageVariation {
  id: string
  storage: string
  defaultSellingPrice: string
}

interface ColorVariation {
  id: string
  name: string
  hex: string
}

interface AddProductModalProps {
  onClose: () => void
  onSaved: () => void
}

type Tab = 'basic' | 'variations' | 'settings'

// ── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function genBarcode(name: string, sku: string): string {
  if (!sku && !name) return ''
  const base = (sku || name).toUpperCase().replace(/\s/g, '').slice(0, 8)
  const seq = Math.floor(Math.random() * 900000 + 100000)
  return `${base}-${seq}`
}

// Color presets
const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: 'Black Titanium', hex: '#3a3a3c' },
  { name: 'White Titanium', hex: '#f0f0f0' },
  { name: 'Natural Titanium', hex: '#c8b99a' },
  { name: 'Blue Titanium', hex: '#5b6fa6' },
  { name: 'Space Black', hex: '#1c1c1e' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Gold', hex: '#d4af6e' },
  { name: 'Deep Purple', hex: '#4b0082' },
  { name: 'Midnight', hex: '#1a1a2e' },
  { name: 'Starlight', hex: '#f5f0e8' },
  { name: 'Red', hex: '#c0392b' },
  { name: 'Blue', hex: '#2980b9' },
  { name: 'Green', hex: '#27ae60' },
  { name: 'Pink', hex: '#e91e8c' },
  { name: 'Yellow', hex: '#f1c40f' },
]

const STORAGE_PRESETS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB']

// ── Sub-components ──────────────────────────────────────────────────────────

function TabButton({
  active, onClick, step, children,
}: {
  active: boolean
  onClick: () => void
  step: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap"
      style={{
        borderBottomColor: active ? '#7c3aed' : 'transparent',
        color: active ? '#a78bfa' : 'var(--text-muted)',
      }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{
          background: active ? '#7c3aed' : 'var(--bg-subtle)',
          color: active ? '#fff' : 'var(--text-muted)',
          border: active ? 'none' : '1px solid var(--border-subtle)',
        }}
      >
        {step}
      </span>
      {children}
    </button>
  )
}

function FieldLabel({ children, required, info }: { children: React.ReactNode; required?: boolean; info?: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children}
      {required && <span className="text-red-400">*</span>}
      {info && (
        <span className="group relative cursor-help">
          <Info size={11} className="opacity-40 group-hover:opacity-80 transition-opacity" />
          <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-50 text-[10px] font-normal px-2 py-1 rounded-lg whitespace-nowrap max-w-[200px] text-wrap text-center"
            style={{ background: '#1e2433', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            {info}
          </span>
        </span>
      )}
    </label>
  )
}

// ── Product Image Uploader ───────────────────────────────────────────────────

function ProductImageUploader({ imageUrl, onUploaded }: { imageUrl: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) {
      toast.error('Only PNG, JPG, WEBP images allowed')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    setUploading(true)
    try {
      const { url } = await uploadApi.productImage(file)
      onUploaded(url)
      toast.success('Image uploaded')
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <FieldLabel>Product Image</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className="relative cursor-pointer rounded-xl overflow-hidden transition-all"
        style={{
          height: 160,
          border: `2px dashed ${dragOver ? '#7c3aed' : 'var(--border-subtle)'}`,
          background: dragOver ? 'rgba(124,58,237,0.05)' : 'var(--bg-subtle)',
        }}
      >
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-violet-400" />
            <span className="text-xs text-violet-400">Uploading…</span>
          </div>
        ) : imageUrl ? (
          <div className="absolute inset-0 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Product" className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex flex-col items-center gap-1 text-white">
                <Upload size={18} />
                <span className="text-xs font-semibold">Change Image</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
              <Upload size={20} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-violet-400">Click to upload</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>or drag and drop</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>PNG, JPG, WEBP (Max 2MB)</p>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
      >
        <ImageIcon size={11} />
        Choose from library
      </button>
    </div>
  )
}

// ── Add Category Mini Modal ──────────────────────────────────────────────────

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
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute right-0 top-10 z-50 w-56 rounded-xl shadow-2xl p-3 space-y-2"
      style={{ background: '#1a2035', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>New Category</p>
      <input
        autoFocus
        className="input-field text-xs"
        placeholder="Category name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 text-xs py-1.5 rounded-lg"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={!name.trim() || loading}
          className="flex-1 text-xs py-1.5 rounded-lg font-semibold disabled:opacity-50"
          style={{ background: '#7c3aed', color: '#fff' }}>
          {loading ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function AddProductModal({ onClose, onSaved }: AddProductModalProps) {
  const { data: catsData, refetch: refetchCats } = useCategories()
  const categories: Category[] = (catsData ?? []) as Category[]

  const [tab, setTab] = useState<Tab>('basic')
  const [loading, setLoading] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)

  // Basic info
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    brandName: '',
    categoryName: '',
    subCategory: '',
    description: '',
    imageUrl: '',
  })

  // Variations
  const [storageVariations, setStorageVariations] = useState<StorageVariation[]>([])
  const [colorVariations, setColorVariations] = useState<ColorVariation[]>([])
  const [newStorageInput, setNewStorageInput] = useState('')
  const [newStoragePrice, setNewStoragePrice] = useState('')
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#6d28d9')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showStoragePresets, setShowStoragePresets] = useState(false)

  // Settings
  const [settings, setSettings] = useState({
    trackImei: true,
    warrantyTracking: true,
    isActive: true,
    minStockAlert: true,
    minStock: '5',
  })

  // Auto-set category when categories load
  useEffect(() => {
    if (categories.length > 0 && !form.categoryName) {
      setForm(p => ({ ...p, categoryName: categories[0].name }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length])

  const setField = useCallback((k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }))
  }, [])

  // Auto-generate barcode when name/sku changes
  useEffect(() => {
    if ((form.sku || form.name) && !form.barcode) {
      setForm(p => ({ ...p, barcode: genBarcode(p.name, p.sku) }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sku, form.name])

  // Storage variation handlers
  const addStorage = () => {
    if (!newStorageInput.trim()) return
    setStorageVariations(prev => [
      ...prev,
      { id: genId(), storage: newStorageInput.trim(), defaultSellingPrice: newStoragePrice },
    ])
    setNewStorageInput('')
    setNewStoragePrice('')
    setShowStoragePresets(false)
  }

  const removeStorage = (id: string) => setStorageVariations(prev => prev.filter(s => s.id !== id))

  const updateStoragePrice = (id: string, price: string) => {
    setStorageVariations(prev => prev.map(s => s.id === id ? { ...s, defaultSellingPrice: price } : s))
  }

  // Color variation handlers
  const addColor = () => {
    if (!newColorName.trim()) return
    setColorVariations(prev => [
      ...prev,
      { id: genId(), name: newColorName.trim(), hex: newColorHex },
    ])
    setNewColorName('')
    setNewColorHex('#6d28d9')
    setShowColorPicker(false)
  }

  const removeColor = (id: string) => setColorVariations(prev => prev.filter(c => c.id !== id))

  const addPresetColor = (preset: { name: string; hex: string }) => {
    if (colorVariations.some(c => c.name === preset.name)) return
    setColorVariations(prev => [...prev, { id: genId(), ...preset }])
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); setTab('basic'); return }
    if (!form.sku.trim()) { toast.error('SKU is required'); setTab('basic'); return }

    setLoading(true)
    try {
      await productsApi.create({
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode || undefined,
        brandName: form.brandName || undefined,
        categoryName: form.categoryName || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        // default pricing from first storage variation or 0
        buyingPrice: 0,
        sellingPrice: storageVariations[0] ? Number(storageVariations[0].defaultSellingPrice) || 0 : 0,
        stock: 0,
        minStock: settings.minStockAlert ? Number(settings.minStock) || 5 : 0,
        trackImei: settings.trackImei,
        warrantyMonths: settings.warrantyTracking ? 12 : 0,
        isActive: settings.isActive,
        // store variations as JSON in description or as extra fields
        storageVariations: storageVariations.map(s => ({ storage: s.storage, sellingPrice: Number(s.defaultSellingPrice) || 0 })),
        colorVariations: colorVariations.map(c => ({ name: c.name, hex: c.hex })),
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

  const isBasicValid = form.name.trim() && form.sku.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div
        className="relative w-full max-w-5xl my-4 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <Package size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Add Product</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Create a new product with model (storage) and color variations
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

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-0 px-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <TabButton active={tab === 'basic'} onClick={() => setTab('basic')} step={1}>Basic Information</TabButton>
          <TabButton active={tab === 'variations'} onClick={() => setTab('variations')} step={2}>Variations</TabButton>
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} step={3}>Settings</TabButton>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">

          {/* ══ TAB 1: BASIC INFORMATION ══════════════════════════════════ */}
          {tab === 'basic' && (
            <div className="space-y-5">
              {/* Row 1: Image + Name/SKU/Barcode */}
              <div className="grid grid-cols-[220px_1fr] gap-6">
                {/* Image upload */}
                <ProductImageUploader
                  imageUrl={form.imageUrl}
                  onUploaded={url => setField('imageUrl', url)}
                />

                {/* Name / SKU / Barcode */}
                <div className="grid grid-cols-2 gap-4 content-start">
                  <div className="col-span-2">
                    <FieldLabel required>Product Name</FieldLabel>
                    <input
                      className="input-field"
                      placeholder="iPhone 15 Pro Max"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel required>SKU</FieldLabel>
                    <input
                      className="input-field font-mono text-sm"
                      placeholder="IP15PM"
                      value={form.sku}
                      onChange={e => setField('sku', e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel info="Barcode is auto-generated based on SKU. You can scan or edit it later.">
                      Barcode (Auto)
                    </FieldLabel>
                    <div className="relative flex items-center">
                      <Lock size={12} className="absolute left-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                      <input
                        readOnly
                        className="input-field pl-8 font-mono text-xs cursor-default"
                        placeholder="Will be generated automatically"
                        value={form.barcode}
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Brand / Category / SubCategory */}
              <div className="grid grid-cols-3 gap-4">
                {/* Brand */}
                <div>
                  <FieldLabel required>Brand</FieldLabel>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        list="brand-list"
                        className="input-field"
                        placeholder="e.g. Apple"
                        value={form.brandName}
                        onChange={e => setField('brandName', e.target.value)}
                      />
                      <datalist id="brand-list">
                        {['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Google', 'Sony', 'Huawei', 'Oppo', 'Vivo', 'Realme'].map(b => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>
                    <button
                      type="button"
                      className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:text-violet-400 hover:bg-violet-500/10"
                      style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                      title="Add brand"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div className="relative">
                  <FieldLabel required>Category</FieldLabel>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        className="input-field appearance-none pr-8"
                        value={form.categoryName}
                        onChange={e => setField('categoryName', e.target.value)}
                      >
                        <option value="">Select category…</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAddCat(p => !p)}
                        className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:text-violet-400 hover:bg-violet-500/10"
                        style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                        title="Add category"
                      >
                        <Plus size={14} />
                      </button>
                      {showAddCat && (
                        <AddCategoryMini
                          onClose={() => setShowAddCat(false)}
                          onSaved={cat => { refetchCats(); setField('categoryName', cat.name) }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub Category */}
                <div>
                  <FieldLabel>Sub Category</FieldLabel>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        className="input-field appearance-none pr-8"
                        value={form.subCategory}
                        onChange={e => setField('subCategory', e.target.value)}
                      >
                        <option value="">Select sub category</option>
                        <option value="flagship">Flagship</option>
                        <option value="mid-range">Mid Range</option>
                        <option value="budget">Budget</option>
                        <option value="accessories">Accessories</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <button
                      type="button"
                      className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:text-violet-400 hover:bg-violet-500/10"
                      style={{ border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                      title="Add sub category"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Description */}
              <div>
                <FieldLabel>Short Description (Optional)</FieldLabel>
                <div className="relative">
                  <textarea
                    rows={3}
                    maxLength={200}
                    placeholder="Brief description about this product..."
                    className="input-field resize-none"
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                  />
                  <span
                    className="absolute right-3 bottom-2 text-[10px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {form.description.length}/200
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 2: VARIATIONS ════════════════════════════════════════ */}
          {tab === 'variations' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Storage Variations */}
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Storage / Model Variations</p>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Add available storage options with default selling price
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStoragePresets(p => !p)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
                    >
                      <Plus size={12} />
                      Add Storage
                    </button>
                    {showStoragePresets && (
                      <div className="absolute right-0 top-9 z-30 w-48 rounded-xl shadow-2xl p-2 space-y-1"
                        style={{ background: '#1a2035', border: '1px solid var(--border-default)' }}>
                        {STORAGE_PRESETS.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => { setNewStorageInput(s); setShowStoragePresets(false) }}
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add row input */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Storage / Model</label>
                    <input
                      className="input-field text-sm"
                      placeholder="e.g. 128GB"
                      value={newStorageInput}
                      onChange={e => setNewStorageInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addStorage()}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Default Price (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field text-sm"
                      placeholder="0.00"
                      value={newStoragePrice}
                      onChange={e => setNewStoragePrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addStorage()}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addStorage}
                    disabled={!newStorageInput.trim()}
                    className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                    style={{ background: '#7c3aed', color: '#fff' }}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {/* Table */}
                {storageVariations.length > 0 ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>#</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Storage / Model</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Default Selling Price (LKR)</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storageVariations.map((s, i) => (
                          <tr key={s.id} style={{ borderBottom: i < storageVariations.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{s.storage}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                value={s.defaultSellingPrice}
                                onChange={e => updateStoragePrice(s.id, e.target.value)}
                                className="w-full text-xs px-2 py-1 rounded-lg"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeStorage(s.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl py-6 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No storage variations added yet</p>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(99,102,241,0.8)' }}>
                  <Info size={10} />
                  You can add multiple storage options. Prices can be changed later.
                </div>
              </div>

              {/* Right: Color Variations */}
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(236,72,153,0.15)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/>
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Color Variations</p>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Add available color options
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(p => !p)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors"
                    style={{ background: 'rgba(236,72,153,0.12)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.2)' }}
                  >
                    <Plus size={12} />
                    Add Color
                  </button>
                </div>

                {/* Add color input */}
                {showColorPicker && (
                  <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex gap-2 items-end">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Color</label>
                        <input
                          type="color"
                          value={newColorHex}
                          onChange={e => setNewColorHex(e.target.value)}
                          className="w-9 h-9 rounded-lg cursor-pointer p-0.5"
                          style={{ border: '1px solid var(--border-subtle)', background: 'none' }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Color Name</label>
                        <input
                          className="input-field text-sm"
                          placeholder="e.g. Black Titanium"
                          value={newColorName}
                          onChange={e => setNewColorName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addColor()}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addColor}
                        disabled={!newColorName.trim()}
                        className="h-9 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                        style={{ background: '#7c3aed', color: '#fff' }}
                      >
                        Add
                      </button>
                    </div>
                    {/* Quick presets */}
                    <div>
                      <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>Quick add:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_PRESETS.map(preset => {
                          const already = colorVariations.some(c => c.name === preset.name)
                          return (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => addPresetColor(preset)}
                              disabled={already}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] transition-colors disabled:opacity-40"
                              style={{
                                background: already ? 'rgba(124,58,237,0.1)' : 'var(--bg-subtle)',
                                border: `1px solid ${already ? 'rgba(124,58,237,0.3)' : 'var(--border-subtle)'}`,
                                color: already ? '#a78bfa' : 'var(--text-secondary)',
                              }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: preset.hex, border: '1px solid rgba(255,255,255,0.15)' }} />
                              {preset.name}
                              {already && <Check size={8} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Color chips grid */}
                {colorVariations.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {colorVariations.map(c => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex-shrink-0"
                            style={{ background: c.hex, border: '1px solid rgba(255,255,255,0.15)' }}
                          />
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeColor(c.id)}
                          className="p-0.5 rounded-full hover:bg-red-500/10 hover:text-red-400 transition-colors flex-shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl py-6 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No color variations added yet</p>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(236,72,153,0.7)' }}>
                  <Info size={10} />
                  You can add multiple colors. These will be available when adding stock.
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 3: SETTINGS ══════════════════════════════════════════ */}
          {tab === 'settings' && (
            <div
              className="rounded-2xl p-5 space-y-5"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Product Settings</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Track IMEI */}
                <SettingToggle
                  checked={settings.trackImei}
                  onChange={v => setSettings(p => ({ ...p, trackImei: v }))}
                  title="Track IMEI / Serial Number"
                  description="Enable IMEI tracking for this product"
                  info="When enabled, each unit must have an IMEI before it can be sold"
                />

                {/* Warranty Tracking */}
                <SettingToggle
                  checked={settings.warrantyTracking}
                  onChange={v => setSettings(p => ({ ...p, warrantyTracking: v }))}
                  title="Warranty Tracking"
                  description="Enable warranty management for this product"
                  info="Automatically create warranty records when this product is sold"
                />

                {/* Active Product */}
                <SettingToggle
                  checked={settings.isActive}
                  onChange={v => setSettings(p => ({ ...p, isActive: v }))}
                  title="Active Product"
                  description="Product will be available for purchase and stock"
                  info="Inactive products are hidden from POS and reports"
                />

                {/* Min Stock Alert */}
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--bg-card)', border: `1px solid ${settings.minStockAlert ? 'rgba(124,58,237,0.3)' : 'var(--border-subtle)'}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Min Stock Alert</p>
                        <span className="group relative cursor-help">
                          <Info size={10} className="opacity-40" />
                        </span>
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Get notified when stock quantity goes below
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(p => ({ ...p, minStockAlert: !p.minStockAlert }))}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${settings.minStockAlert ? 'bg-violet-600' : ''}`}
                      style={!settings.minStockAlert ? { background: 'var(--bg-subtle-md, #2a3350)' } : {}}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                        style={{ transform: settings.minStockAlert ? 'translateX(17px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </div>
                  {settings.minStockAlert && (
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Min Stock Quantity <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        min={0}
                        className="input-field text-sm text-center"
                        value={settings.minStock}
                        onChange={e => setSettings(p => ({ ...p, minStock: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          {/* Tab nav hints */}
          <div className="flex items-center gap-2">
            {tab !== 'basic' && (
              <button
                type="button"
                onClick={() => setTab(tab === 'settings' ? 'variations' : 'basic')}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                ← Back
              </button>
            )}
            {tab !== 'settings' && (
              <button
                type="button"
                onClick={() => setTab(tab === 'basic' ? 'variations' : 'settings')}
                disabled={tab === 'basic' && !isBasicValid}
                className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40"
              >
                Next →
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isBasicValid && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <AlertCircle size={12} className="text-amber-400" />
                Fill in Product Name & SKU
              </div>
            )}
            <button type="button" onClick={onClose} className="btn-secondary text-sm flex items-center gap-2">
              <X size={14} />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !isBasicValid}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              Save Product
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Setting Toggle Card ──────────────────────────────────────────────────────

function SettingToggle({
  checked, onChange, title, description, info,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  description: string
  info?: string
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-2 transition-all"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${checked ? 'rgba(124,58,237,0.3)' : 'var(--border-subtle)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
            {info && (
              <span className="group relative cursor-help">
                <Info size={10} className="opacity-40 group-hover:opacity-80 transition-opacity" />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-50 text-[10px] font-normal px-2 py-1 rounded-lg whitespace-nowrap"
                  style={{ background: '#1e2433', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {info}
                </span>
              </span>
            )}
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${checked ? 'bg-violet-600' : ''}`}
          style={!checked ? { background: 'var(--bg-subtle-md, #2a3350)' } : {}}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: checked ? 'translateX(17px)' : 'translateX(2px)' }}
          />
        </button>
      </div>
      {checked && (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[10px] text-violet-400 font-medium">Enabled</span>
        </div>
      )}
    </div>
  )
}
