'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, Upload, Loader2, ChevronDown, Info, GripVertical, ArrowLeft, Box, ScanLine, Barcode, ListPlus } from 'lucide-react'
import { productsApi, suppliersApi, uploadApi } from '@/lib/api'
import { useCategories, useBrands, useSuppliers } from '@/lib/hooks'
import type { Category } from '@/types'
import toast from 'react-hot-toast'

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface VariantRow {
  id: string; storage: string; colorName: string; colorHex: string
  sku: string; sellingPrice: string; costPrice: string
}
interface QuickProductRow {
  id: string; name: string; sku: string; barcode: string
  buyingPrice: string; sellingPrice: string
  categoryName: string; brandName: string; trackImei: boolean
}
type AddMode = 'scan' | 'full'
interface AddProductModalProps { onClose: () => void; onSaved: () => void }
interface Brand { id: string; name: string }
interface Supplier { id: string; name: string }

/* ─── Constants ─────────────────────────────────────────────────────────── */

const genId = () => Math.random().toString(36).slice(2, 9)

const STORAGE_OPTS = ['16GB','32GB','64GB','128GB','256GB','512GB','1TB','2TB','Basic','Standard','Pro','Max','Plus','Lite']
const COLOR_OPTS = [
  { name:'Black',   hex:'#1a1a1a' }, { name:'White',   hex:'#e5e5e5' },
  { name:'Silver',  hex:'#c0c0c0' }, { name:'Gold',    hex:'#d4af6e' },
  { name:'Blue',    hex:'#2563eb' }, { name:'Red',     hex:'#dc2626' },
  { name:'Green',   hex:'#16a34a' }, { name:'Purple',  hex:'#7c3aed' },
  { name:'Pink',    hex:'#db2777' }, { name:'Yellow',  hex:'#ca8a04' },
  { name:'Orange',  hex:'#ea580c' }, { name:'Titanium',hex:'#8a8a8a' },
  { name:'Midnight',hex:'#1e1b4b' }, { name:'Starlight',hex:'#f0ebe3'},
  { name:'Graphite',hex:'#374151' },
]
const UNIT_OPTS    = ['Piece (Pc)','Box','Set','Pair','Pack','Dozen','Kg','Gram','Litre','Meter']
const BARCODE_OPTS = ['Code 128 (C128)','Code 39','EAN-13','EAN-8','UPC-A','QR Code']
const WARRANTY_OPTS= ['None','1 Month','3 Months','6 Months','1 Year','2 Years']
const SUB_CAT_OPTS = ['Flagship','Mid Range','Budget','Entry Level','Premium','Ultra','Lite','Pro','Plus','Standard']
const DEVICE_MODEL_OPTS = ['iPhone','iPad','MacBook','Samsung Galaxy','Xiaomi','OnePlus','Google Pixel','Oppo','Vivo','Huawei','Sony','Nokia','Motorola','Laptop','Tablet','Desktop','Smart Watch','Earbuds','Speaker','Other']

/* ─── Style helpers ──────────────────────────────────────────────────────── */

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: '24px 28px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 12px', borderRadius: 8,
  fontSize: 13, outline: 'none',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = {
  ...inputStyle, paddingRight: 32, appearance: 'none' as const, cursor: 'pointer',
}
const btn: React.CSSProperties = {
  height: 36, padding: '0 16px', borderRadius: 8, fontSize: 13,
  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 6,
}
const sectionBadge: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', background: '#2563eb',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, fontWeight: 700, flexShrink: 0,
}

/* ─── Small components ───────────────────────────────────────────────────── */

function Lbl({ children, req, tip }: { children: React.ReactNode; req?: boolean; tip?: string }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
      {children}{req && <span style={{ color: '#ef4444' }}> *</span>}
      {tip && (
        <span className="group relative inline-block ml-1 cursor-help">
          <Info size={11} style={{ color: 'var(--text-muted)', verticalAlign: 'middle' }} />
          <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 text-[10px] px-2 py-1 rounded-lg whitespace-nowrap"
            style={{ background: 'var(--bg-tooltip, #1e293b)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>{tip}</span>
        </span>
      )}
    </label>
  )
}

function Sel({ value, onChange, children, placeholder }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
    </div>
  )
}

function PlusBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ ...btn, width: 36, padding: 0, background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', flexShrink: 0 }}>
      <Plus size={14} />
    </button>
  )
}

function ColorDot({ hex }: { hex: string }) {
  return <span style={{ width: 14, height: 14, borderRadius: '50%', background: hex, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0, display: 'inline-block' }} />
}

function Checkbox({ checked, onChange, label, desc, tip }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc: string; tip?: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', paddingBottom: 10 }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 16, height: 16, borderRadius: 4, marginTop: 2, flexShrink: 0,
        background: checked ? '#2563eb' : 'transparent',
        border: `2px solid ${checked ? '#2563eb' : 'var(--border-default)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
          {tip && (
            <span className="group relative cursor-help">
              <Info size={10} style={{ color: 'var(--text-muted)' }} />
              <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 text-[10px] px-2 py-1 rounded-lg whitespace-nowrap"
                style={{ background: 'var(--bg-tooltip, #1e293b)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>{tip}</span>
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</p>
      </div>
    </label>
  )
}

/* ─── Add Category Popup ─────────────────────────────────────────────────── */
function AddCatPopup({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Category) => void }) {
  const [name, setName] = useState(''); const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!name.trim()) return; setLoading(true)
    try { const r: any = await productsApi.createCategory({ name: name.trim() }); toast.success(`"${name}" added`); onSaved(r.data ?? r); onClose() }
    catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 200, padding: 12, borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>New Category</p>
      <input autoFocus style={{ ...inputStyle, marginBottom: 8 }} placeholder="Category name…" value={name}
        onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onClose} style={{ ...btn, flex: 1, fontSize: 11, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: 'none' }}>Cancel</button>
        <button type="button" onClick={save} disabled={!name.trim() || loading}
          style={{ ...btn, flex: 1, fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', opacity: (!name.trim() || loading) ? 0.5 : 1 }}>
          {loading ? <Loader2 size={11} className="animate-spin" /> : 'Add'}
        </button>
      </div>
    </div>
  )
}

/* ─── Add Brand Popup ─────────────────────────────────────────────────────── */
function AddBrandPopup({ onClose, onSaved }: { onClose: () => void; onSaved: (b: Brand) => void }) {
  const [name, setName] = useState(''); const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!name.trim()) return; setLoading(true)
    try { const r: any = await productsApi.createBrand({ name: name.trim() }); toast.success(`"${name}" added`); onSaved(r.data ?? r); onClose() }
    catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 200, padding: 12, borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>New Brand</p>
      <input autoFocus style={{ ...inputStyle, marginBottom: 8 }} placeholder="Brand name…" value={name}
        onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onClose} style={{ ...btn, flex: 1, fontSize: 11, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: 'none' }}>Cancel</button>
        <button type="button" onClick={save} disabled={!name.trim() || loading}
          style={{ ...btn, flex: 1, fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', opacity: (!name.trim() || loading) ? 0.5 : 1 }}>
          {loading ? <Loader2 size={11} className="animate-spin" /> : 'Add'}
        </button>
      </div>
    </div>
  )
}

/* ─── Image Uploader ──────────────────────────────────────────────────────── */
function ImageUploader({ imageUrl, onUploaded }: { imageUrl: string; onUploaded: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)

  const handle = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) { toast.error('PNG, JPG only'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return }
    setUploading(true)
    try { const { url } = await uploadApi.productImage(file); onUploaded(url) }
    catch (e: any) { toast.error(e?.message ?? 'Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <div>
      <Lbl req>Product Image</Lbl>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handle(e.target.files[0])} />
      <div
        onClick={() => !uploading && ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]) }}
        style={{
          height: 190, borderRadius: 10, cursor: 'pointer', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${drag ? '#2563eb' : 'var(--border-subtle)'}`,
          background: drag ? 'rgba(37,99,235,0.06)' : 'var(--bg-subtle)',
          transition: 'border-color 0.15s',
        }}
      >
        {uploading ? <Loader2 size={22} className="animate-spin" style={{ color: '#60a5fa' }} />
          : imageUrl ? (
            <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 10, overflow: 'hidden' }} className="group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div className="group-hover:flex" style={{ display: 'none', position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                <Upload size={20} style={{ color: '#fff' }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Upload size={20} style={{ color: '#2563eb' }} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>Click to upload</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>or drag and drop</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>PNG, JPG, JPEG (Max 2MB)</p>
            </>
          )}
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function AddProductModal({ onClose, onSaved }: AddProductModalProps) {
  const { data: catsData, refetch: refetchCats } = useCategories()
  const { data: brandsData, refetch: refetchBrands } = useBrands()
  const { data: suppliersRaw } = useSuppliers()

  const cats: Category[]  = (catsData ?? []) as Category[]
  const brands: Brand[]   = (brandsData ?? []) as Brand[]
  const suppliers: Supplier[] = ((suppliersRaw as any)?.data ?? []) as Supplier[]

  const [loading, setLoading] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [showAddBrand, setShowAddBrand] = useState(false)
  const [extraBrands, setExtraBrands] = useState<Brand[]>([])

  const allBrands = [...brands, ...extraBrands.filter(eb => !brands.find(b => b.id === eb.id))]

  const [mode, setMode] = useState<AddMode>('scan')
  const [scanValue, setScanValue] = useState('')
  const [queue, setQueue] = useState<QuickProductRow[]>([])
  const [quickDraft, setQuickDraft] = useState({
    name: '', sku: '', barcode: '', buyingPrice: '', sellingPrice: '',
    categoryName: '', brandName: 'General', trackImei: false,
  })
  const scanRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '', sku: '', barcodeValue: '', barcodeType: 'Code 128 (C128)', brandName: '',
    categoryName: '', subCategory: '', unit: 'Piece (Pc)',
    deviceModel: '', description: '', imageUrl: '',
  })
  const [trackImei,     setTrackImei]     = useState(true)
  const [warrantyTrack, setWarrantyTrack] = useState(true)
  const [lowStock,      setLowStock]      = useState(true)
  const [minStock,      setMinStock]      = useState('5')
  const [pricing, setPricing] = useState({ tax: 'None', taxType: 'Exclusive', purchaseEx: '', purchaseInc: '', sellingEx: '', margin: '' })
  const [extra,   setExtra]   = useState({ supplierId: '', warranty: 'None', hsCode: '', tags: '' })
  const [variants, setVariants] = useState<VariantRow[]>([])

  const f = useCallback((k: string, v: string) => setForm(p => ({ ...p, [k]: v })), [])

  useEffect(() => {
    if (cats.length > 0 && !form.categoryName) {
      f('categoryName', cats[0].name)
      setQuickDraft(p => ({ ...p, categoryName: p.categoryName || cats[0].name }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.length])

  useEffect(() => {
    if (mode === 'scan') scanRef.current?.focus()
  }, [mode])

  const buildPayload = useCallback((opts: {
    name: string; sku: string; barcode?: string; brandName: string; categoryName: string
    buyingPrice: number; sellingPrice: number; trackImei: boolean
    subCategory?: string; deviceModel?: string; description?: string; imageUrl?: string
    variantRows?: VariantRow[]
  }) => {
    const rows = opts.variantRows ?? []
    return {
      name:         opts.name.trim(),
      sku:          opts.sku.trim(),
      brandName:    opts.brandName || 'General',
      categoryName: opts.categoryName,
      subCategory:  opts.subCategory  || undefined,
      deviceModel:  opts.deviceModel  || undefined,
      description:  opts.description  || undefined,
      imageUrl:     opts.imageUrl     || undefined,
      barcode:      opts.barcode?.trim() || opts.sku.trim() || undefined,
      buyingPrice:  opts.buyingPrice,
      sellingPrice: opts.sellingPrice,
      mrp:          opts.sellingPrice,
      stock:        0,
      minStock:     lowStock ? Number(minStock) || 5 : 0,
      trackImei:    opts.trackImei,
      warrantyMonths: warrantyTrack ? 12 : 0,
      isActive:     true,
      storageVariations: rows.map(v => ({
        storage: v.storage, colorName: v.colorName, colorHex: v.colorHex,
        sku: v.sku || undefined, stock: 0,
        sellingPrice: Number(v.sellingPrice) || 0,
        costPrice:    Number(v.costPrice)    || 0,
      })),
      colorVariations: rows.map(v => ({ name: v.colorName, hex: v.colorHex })),
    }
  }, [lowStock, minStock, warrantyTrack])

  const handleScan = (raw: string) => {
    const code = raw.trim()
    if (!code) return
    const isImei = /^\d{15}$/.test(code)
    setQuickDraft(p => ({
      ...p,
      sku: code,
      barcode: code,
      trackImei: isImei,
      categoryName: p.categoryName || form.categoryName || cats[0]?.name || '',
    }))
    setScanValue('')
    toast.success(isImei ? 'IMEI scanned — fill name & prices' : 'Barcode scanned — fill name & prices')
    nameRef.current?.focus()
  }

  const addQuickToQueue = () => {
    const cat = quickDraft.categoryName || form.categoryName
    if (!quickDraft.name.trim())  { toast.error('Product name required'); return }
    if (!quickDraft.sku.trim())   { toast.error('SKU / barcode required'); return }
    if (!cat.trim())              { toast.error('Category required'); return }
    if (!Number(quickDraft.buyingPrice))  { toast.error('Buying price required'); return }
    if (!Number(quickDraft.sellingPrice)) { toast.error('Selling price required'); return }
    if (queue.some(q => q.sku === quickDraft.sku.trim())) {
      toast.error('This SKU is already in the list'); return
    }
    setQueue(p => [...p, {
      id: genId(),
      name: quickDraft.name.trim(),
      sku: quickDraft.sku.trim(),
      barcode: quickDraft.barcode.trim() || quickDraft.sku.trim(),
      buyingPrice: quickDraft.buyingPrice,
      sellingPrice: quickDraft.sellingPrice,
      categoryName: cat,
      brandName: quickDraft.brandName || 'General',
      trackImei: quickDraft.trackImei,
    }])
    setQuickDraft(p => ({
      name: '', sku: '', barcode: '', buyingPrice: '', sellingPrice: '',
      categoryName: p.categoryName, brandName: p.brandName, trackImei: false,
    }))
    scanRef.current?.focus()
    toast.success('Added to list')
  }

  const saveQueue = async () => {
    if (queue.length === 0) { toast.error('Scan and add at least one product'); return }
    setLoading(true)
    let ok = 0
    try {
      for (const row of queue) {
        await productsApi.create(buildPayload({
          name: row.name, sku: row.sku, barcode: row.barcode,
          brandName: row.brandName, categoryName: row.categoryName,
          buyingPrice: Number(row.buyingPrice), sellingPrice: Number(row.sellingPrice),
          trackImei: row.trackImei,
        }))
        ok++
      }
      toast.success(`${ok} product${ok > 1 ? 's' : ''} saved!`)
      onSaved(); onClose()
    } catch (e: any) { toast.error(e?.message ?? `Saved ${ok} of ${queue.length}`) }
    finally { setLoading(false) }
  }

  const addVariant = () => setVariants(p => [...p, { id: genId(), storage: '128GB', colorName: 'Black', colorHex: '#1a1a1a', sku: '', sellingPrice: '', costPrice: '' }])
  const delVariant = (id: string) => setVariants(p => p.filter(v => v.id !== id))
  const updVariant = (id: string, k: keyof VariantRow, val: string) => setVariants(p => p.map(v => v.id === id ? { ...v, [k]: val } : v))
  const updColor   = (id: string, name: string, hex: string) => setVariants(p => p.map(v => v.id === id ? { ...v, colorName: name, colorHex: hex } : v))

  const submit = async () => {
    if (!form.name.trim())         { toast.error('Product name required'); return }
    if (!form.sku.trim())          { toast.error('SKU required'); return }
    if (!form.categoryName.trim()) { toast.error('Category required'); return }

    const fv = variants[0]
    const buyingPrice  = fv ? Number(fv.costPrice)    || 0 : Number(pricing.purchaseEx) || 0
    const sellingPrice = fv ? Number(fv.sellingPrice) || 0 : Number(pricing.sellingEx)  || 0

    if (variants.length === 0) {
      if (!buyingPrice)  { toast.error('Buying price required'); return }
      if (!sellingPrice) { toast.error('Selling price required'); return }
    }

    setLoading(true)
    try {
      await productsApi.create(buildPayload({
        name: form.name, sku: form.sku, barcode: form.barcodeValue || form.sku,
        brandName: form.brandName, categoryName: form.categoryName,
        buyingPrice, sellingPrice, trackImei,
        subCategory: form.subCategory, deviceModel: form.deviceModel,
        description: form.description, imageUrl: form.imageUrl,
        variantRows: variants,
      }))
      toast.success(`"${form.name}" created!`)
      onSaved(); onClose()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
    finally { setLoading(false) }
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">Add New Product</h1>
            <p className="page-subtitle">Scan barcodes to add quickly, or use full form for variants</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          {mode === 'scan' ? (
            <button onClick={saveQueue} disabled={loading || queue.length === 0}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />}
              Save All ({queue.length})
            </button>
          ) : (
            <button onClick={submit} disabled={loading || !form.name.trim() || !form.sku.trim()}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
                </svg>
              )}
              Save Product
            </button>
          )}
        </div>
      </div>

      {/* ── Mode tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
        {([['scan', 'Quick Scan', ScanLine], ['full', 'Full Form', Box]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setMode(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: mode === id ? '#2563eb' : 'transparent',
              color: mode === id ? '#fff' : 'var(--text-muted)',
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══ Quick Scan mode ══════════════════════════════════════════ */}
      {mode === 'scan' && (
        <div className="flex flex-col gap-5">
          {/* Scan bar */}
          <div className="flex gap-3 items-center p-4 rounded-xl border border-violet-500/25"
            style={{ background: 'rgba(139,92,246,0.06)' }}>
            <ScanLine size={18} className="text-violet-400 shrink-0" />
            <input
              ref={scanRef}
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm font-mono tracking-wide"
              style={{ color: 'var(--text-primary)' }}
              placeholder="Scan barcode / SKU / IMEI — press Enter..."
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScan(scanValue) } }}
            />
            {quickDraft.sku && (
              <span className="text-[10px] font-bold text-green-400 shrink-0 hidden sm:inline">✓ SCANNED</span>
            )}
          </div>

          {/* Quick entry */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={sectionBadge}><Barcode size={13} /></div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', margin: 0 }}>Product Details</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>No variants — buy &amp; sell price only</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Lbl req>Product Name</Lbl>
                <input ref={nameRef} style={inputStyle} placeholder="Enter product name"
                  value={quickDraft.name} onChange={e => setQuickDraft(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuickToQueue() } }} />
              </div>
              <div>
                <Lbl req>SKU / Barcode</Lbl>
                <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="Scan or type..."
                  value={quickDraft.sku} onChange={e => setQuickDraft(p => ({ ...p, sku: e.target.value, barcode: e.target.value }))} />
              </div>
              <div>
                <Lbl req>Category</Lbl>
                <Sel value={quickDraft.categoryName || form.categoryName} onChange={v => setQuickDraft(p => ({ ...p, categoryName: v }))}>
                  {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </Sel>
              </div>
              <div>
                <Lbl>Brand</Lbl>
                <Sel value={quickDraft.brandName} onChange={v => setQuickDraft(p => ({ ...p, brandName: v }))}>
                  {allBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </Sel>
              </div>
              <div>
                <Lbl req>Buying Price (LKR)</Lbl>
                <input type="number" min={0} style={inputStyle} placeholder="0.00"
                  value={quickDraft.buyingPrice} onChange={e => setQuickDraft(p => ({ ...p, buyingPrice: e.target.value }))} />
              </div>
              <div>
                <Lbl req>Selling Price (LKR)</Lbl>
                <input type="number" min={0} style={inputStyle} placeholder="0.00"
                  value={quickDraft.sellingPrice} onChange={e => setQuickDraft(p => ({ ...p, sellingPrice: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={quickDraft.trackImei}
                  onChange={e => setQuickDraft(p => ({ ...p, trackImei: e.target.checked }))}
                  style={{ width: 14, height: 14, accentColor: '#2563eb' }} />
                Track IMEI (15-digit scan)
              </label>
              <button type="button" onClick={addQuickToQueue}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                <Plus size={14} /> Add to List
              </button>
            </div>
          </div>

          {/* Queue table */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', margin: 0 }}>
                Scanned Products ({queue.length})
              </p>
              {queue.length > 0 && (
                <button type="button" onClick={() => setQueue([])}
                  style={{ ...btn, fontSize: 11, background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                  Clear all
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <div style={{ borderRadius: 8, padding: '32px 0', textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                <ScanLine size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Scan a barcode to start</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Products appear here before saving</p>
              </div>
            ) : (
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)' }}>
                      {['#', 'Name', 'SKU / Barcode', 'Buy', 'Sell', 'Category', ''].map((h, i) => (
                        <th key={i} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((row, i) => (
                      <tr key={row.id} style={{ borderBottom: i < queue.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.name}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>{row.sku}</td>
                        <td style={{ padding: '8px 10px' }}>{Number(row.buyingPrice).toLocaleString()}</td>
                        <td style={{ padding: '8px 10px' }}>{Number(row.sellingPrice).toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{row.categoryName}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button type="button" onClick={() => setQueue(p => p.filter(q => q.id !== row.id))}
                            style={{ padding: 6, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'full' && (
      <div className="flex flex-col gap-6">

        {/* ══ 1. Basic Information ══════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={sectionBadge}>1</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', margin: 0 }}>Basic Information</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '185px 1fr', gap: 28 }}>
            <ImageUploader imageUrl={form.imageUrl} onUploaded={url => f('imageUrl', url)} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <Lbl req>Product Name</Lbl>
                  <input style={inputStyle} placeholder="Enter product name" value={form.name} onChange={e => f('name', e.target.value)} />
                </div>
                <div>
                  <Lbl req>SKU</Lbl>
                  <input style={inputStyle} placeholder="Enter SKU" value={form.sku} onChange={e => f('sku', e.target.value)} />
                </div>
                <div>
                  <Lbl tip="Scanned barcode number stored for POS lookup">Barcode</Lbl>
                  <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="Scan or enter barcode"
                    value={form.barcodeValue} onChange={e => f('barcodeValue', e.target.value)} />
                </div>
                <div>
                  <Lbl tip="Barcode format for label printing">Barcode Type</Lbl>
                  <Sel value={form.barcodeType} onChange={v => f('barcodeType', v)}>
                    {BARCODE_OPTS.map(b => <option key={b}>{b}</option>)}
                  </Sel>
                </div>
              </div>

              {/* Row 2 — Brand, Category, Sub Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {/* Brand — real dropdown from DB */}
                <div style={{ position: 'relative' }}>
                  <Lbl req>Brand</Lbl>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Sel value={form.brandName} onChange={v => f('brandName', v)} placeholder="Select brand">
                      {allBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </Sel>
                    <div style={{ position: 'relative' }}>
                      <PlusBtn onClick={() => setShowAddBrand(p => !p)} />
                      {showAddBrand && (
                        <AddBrandPopup
                          onClose={() => setShowAddBrand(false)}
                          onSaved={b => { setExtraBrands(p => [...p, b]); refetchBrands(); f('brandName', b.name) }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div style={{ position: 'relative' }}>
                  <Lbl req>Category</Lbl>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Sel value={form.categoryName} onChange={v => f('categoryName', v)} placeholder="Select category">
                      {cats.map(c => <option key={c.id} value={c.name}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                    </Sel>
                    <div style={{ position: 'relative' }}>
                      <PlusBtn onClick={() => setShowAddCat(p => !p)} />
                      {showAddCat && <AddCatPopup onClose={() => setShowAddCat(false)} onSaved={c => { refetchCats(); f('categoryName', c.name) }} />}
                    </div>
                  </div>
                </div>

                {/* Sub Category */}
                <div>
                  <Lbl>Sub Category</Lbl>
                  <Sel value={form.subCategory} onChange={v => f('subCategory', v)} placeholder="Select sub category">
                    {SUB_CAT_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </Sel>
                </div>
              </div>

              {/* Row 3 — Unit, Device Model */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Lbl req>Unit</Lbl>
                  <Sel value={form.unit} onChange={v => f('unit', v)}>
                    {UNIT_OPTS.map(u => <option key={u}>{u}</option>)}
                  </Sel>
                </div>
                <div>
                  <Lbl>Device Model</Lbl>
                  <Sel value={form.deviceModel} onChange={v => f('deviceModel', v)} placeholder="Select device model">
                    {DEVICE_MODEL_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
                  </Sel>
                </div>
              </div>
            </div>
          </div>

          {/* Description + Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 24, marginTop: 20 }}>
            <div>
              <Lbl>Description</Lbl>
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px',
                  background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                  {[['B'],['I'],['U']].map(([l]) => (
                    <button key={l} type="button" style={{ padding: '3px 7px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                      background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>{l}</button>
                  ))}
                  <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 4px' }} />
                  {['≡','⁝','⊞'].map((s,i) => (
                    <button key={i} type="button" style={{ padding: '3px 6px', fontSize: 13, borderRadius: 4,
                      background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>{s}</button>
                  ))}
                </div>
                <textarea rows={6} maxLength={2000} placeholder="Write product description…"
                  style={{ ...inputStyle, height: 'auto', padding: '12px', resize: 'none', border: 'none',
                    borderRadius: 0, fontFamily: 'inherit', lineHeight: 1.6 }}
                  value={form.description} onChange={e => f('description', e.target.value)} />
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{form.description.length}/2000</p>
            </div>

            {/* Settings panel */}
            <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px' }}>
              <Checkbox checked={trackImei} onChange={setTrackImei} label="Track IMEI / Serial Number"
                desc="Enable IMEI or Serial number tracking for this product" tip="Each unit must have a unique IMEI/Serial" />
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginBottom: 10 }} />
              <Checkbox checked={warrantyTrack} onChange={setWarrantyTrack} label="Warranty Tracking"
                desc="Enable warranty tracking for this product" tip="Auto-create warranty on sale" />
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginBottom: 10 }} />
              <Checkbox checked={lowStock} onChange={setLowStock} label="Low Stock Alert"
                desc="Get notified when stock quantity goes below" />
              {lowStock && (
                <div style={{ paddingLeft: 26 }}>
                  <Lbl req>Min Stock Quantity</Lbl>
                  <input type="number" min={0} style={inputStyle} value={minStock} onChange={e => setMinStock(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ 2 + 3 ════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20 }}>

          {/* 2. Variant Combinations */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={sectionBadge}>2</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', margin: 0 }}>Variant Combinations <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(Optional)</span></p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>For phones/tablets with storage &amp; color. Skip for simple barcode products.</p>
                </div>
              </div>
              <button type="button" onClick={addVariant}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', fontSize: 12, whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Add Variant
              </button>
            </div>

            {variants.length > 0 ? (
              <>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)' }}>
                        {['#','','Storage (Model) *','Color *','SKU (Optional)','Default Selling Price (LKR) *','Cost Price (LKR) Optional','Action'].map((h,i) => (
                          <th key={i} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                            color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
                            width: i===0?28:i===1?24:i===7?48:'auto' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, i) => (
                        <tr key={v.id} style={{ borderBottom: i < variants.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'center' }}>{i+1}</td>
                          <td style={{ padding: '8px 4px' }}><GripVertical size={12} style={{ color: 'var(--text-muted)' }} /></td>

                          {/* Storage — native select to avoid overflow clipping */}
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ position: 'relative' }}>
                              <select
                                value={v.storage}
                                onChange={e => updVariant(v.id, 'storage', e.target.value)}
                                style={{ ...selectStyle, height: 32, fontSize: 12 }}
                              >
                                {STORAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                                {!STORAGE_OPTS.includes(v.storage) && <option value={v.storage}>{v.storage}</option>}
                              </select>
                              <ChevronDown size={11} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                          </td>

                          {/* Color — native select with color dot preview */}
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ColorDot hex={v.colorHex} />
                              <div style={{ position: 'relative', flex: 1 }}>
                                <select
                                  value={v.colorName}
                                  onChange={e => {
                                    const found = COLOR_OPTS.find(c => c.name === e.target.value)
                                    if (found) updColor(v.id, found.name, found.hex)
                                  }}
                                  style={{ ...selectStyle, height: 32, fontSize: 12 }}
                                >
                                  {COLOR_OPTS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                                <ChevronDown size={11} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '8px 6px' }}>
                            <input style={{ ...inputStyle, height: 32, fontFamily: 'monospace', fontSize: 11 }}
                              placeholder={`${(form.sku||'PROD').toUpperCase()}-${v.storage.replace(/\s/g,'')}-${v.colorName.slice(0,3).toUpperCase()}`}
                              value={v.sku} onChange={e => updVariant(v.id,'sku',e.target.value)} />
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <input type="number" min={0} style={{ ...inputStyle, height: 32 }} placeholder="0.00"
                              value={v.sellingPrice} onChange={e => updVariant(v.id,'sellingPrice',e.target.value)} />
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <input type="number" min={0} style={{ ...inputStyle, height: 32 }} placeholder="0.00"
                              value={v.costPrice} onChange={e => updVariant(v.id,'costPrice',e.target.value)} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button type="button" onClick={() => delVariant(v.id)}
                              style={{ padding: 6, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Info size={10} /> Each variant represents a unique combination of storage (model) and color.
                </p>
              </>
            ) : (
              <div style={{ borderRadius: 8, padding: '40px 0', textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                <Box size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No variants — simple product</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Enter buy &amp; sell price in Pricing below, or add variants for phones</p>
              </div>
            )}
          </div>

          {/* 3. Pricing & Tax */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={sectionBadge}>3</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', margin: 0 }}>Pricing &amp; Tax</p>
                {variants.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Buy &amp; sell price for products without variants</p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {variants.length > 0 ? (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  Prices are set per variant in the table above.
                </p>
              ) : (
                <>
                  <div>
                    <Lbl req>Buying Price (LKR)</Lbl>
                    <input type="number" min={0} style={inputStyle} placeholder="0.00"
                      value={pricing.purchaseEx} onChange={e => setPricing(p => ({ ...p, purchaseEx: e.target.value }))} />
                  </div>
                  <div>
                    <Lbl req>Selling Price (LKR)</Lbl>
                    <input type="number" min={0} style={inputStyle} placeholder="0.00"
                      value={pricing.sellingEx} onChange={e => setPricing(p => ({ ...p, sellingEx: e.target.value }))} />
                  </div>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <Lbl>Applicable Tax</Lbl>
                  <Sel value={pricing.tax} onChange={v => setPricing(p => ({ ...p, tax: v }))}>
                    <option>None</option><option>VAT 15%</option><option>GST 10%</option>
                  </Sel>
                </div>
                <div>
                  <Lbl>Selling Price Tax Type</Lbl>
                  <Sel value={pricing.taxType} onChange={v => setPricing(p => ({ ...p, taxType: v }))}>
                    <option>Exclusive</option><option>Inclusive</option>
                  </Sel>
                </div>
              </div>
              {variants.length > 0 && (
                <>
                  <div>
                    <Lbl>Default Purchase Price (LKR)</Lbl>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Ex. Tax</p>
                        <input type="number" min={0} style={inputStyle} placeholder="0.00"
                          value={pricing.purchaseEx} onChange={e => setPricing(p => ({ ...p, purchaseEx: e.target.value }))} />
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Inc. Tax</p>
                        <input type="number" min={0} style={inputStyle} placeholder="0.00"
                          value={pricing.purchaseInc} onChange={e => setPricing(p => ({ ...p, purchaseInc: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Lbl>Default Selling Price (LKR)</Lbl>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Ex. Tax</p>
                    <input type="number" min={0} style={inputStyle} placeholder="0.00"
                      value={pricing.sellingEx} onChange={e => setPricing(p => ({ ...p, sellingEx: e.target.value }))} />
                  </div>
                </>
              )}
              <div>
                <Lbl>Margin (%)</Lbl>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={0} style={{ ...inputStyle, paddingRight: 32 }} placeholder="0.00"
                    value={pricing.margin} onChange={e => setPricing(p => ({ ...p, margin: e.target.value }))} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ 4. Additional Information ═════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={sectionBadge}>4</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', margin: 0 }}>
              Additional Information <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(Optional)</span>
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <Lbl>Supplier</Lbl>
              <Sel value={extra.supplierId} onChange={v => setExtra(p => ({ ...p, supplierId: v }))} placeholder="Select supplier">
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Sel>
            </div>
            <div>
              <Lbl>Warranty Period</Lbl>
              <Sel value={extra.warranty} onChange={v => setExtra(p => ({ ...p, warranty: v }))}>
                {WARRANTY_OPTS.map(w => <option key={w}>{w}</option>)}
              </Sel>
            </div>
            <div>
              <Lbl>HS Code</Lbl>
              <input style={inputStyle} placeholder="Enter HS code" value={extra.hsCode} onChange={e => setExtra(p => ({ ...p, hsCode: e.target.value }))} />
            </div>
            <div>
              <Lbl>Tags</Lbl>
              <input style={inputStyle} placeholder="Enter tags" value={extra.tags} onChange={e => setExtra(p => ({ ...p, tags: e.target.value }))} />
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Press enter to add</p>
            </div>
          </div>
        </div>

      </div>
      )}

    </div>
  )
}
