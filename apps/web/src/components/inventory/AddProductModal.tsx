'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, Upload, Loader2, ChevronDown, Info, GripVertical, Box, Eye, Lock, ArrowLeft } from 'lucide-react'
import { productsApi, suppliersApi, uploadApi, deviceCatalogApi, tenantApi } from '@/lib/api'
import { useCategories, useBrands, useSuppliers, useProductVariantSettings } from '@/lib/hooks'
import { DEFAULT_PRODUCT_VARIANT_SETTINGS, pushProductVariantSettings } from '@/lib/productVariantSettings'
import { authStorage } from '@/lib/auth'
import { isKasthuriTenant } from '@/lib/invoiceSettings'
import { getTenantSlugFromHost } from '@/lib/tenant-context'
import type { Category } from '@/types'
import toast from 'react-hot-toast'
import { ImeiProductTypeSelector } from './ImeiProductTypeSelector'
import { inferImeiProductType, imeiTypeToTrackFlag, type ImeiProductType } from '@/lib/productImei'
import { PRODUCT_CONDITION_OPTS, type ProductCondition } from '@/lib/productCondition'

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface VariantRow {
  id: string; storage: string; colorName: string; colorHex: string
  sku: string; sellingPrice: string; costPrice: string
}
interface AddProductModalProps { onClose: () => void; onSaved: () => void }
interface Brand { id: string; name: string }
interface Supplier { id: string; name: string }
interface DeviceBrand { id: string; name: string }
interface DeviceModel { id: string; name: string; brandId: string }

/* ─── Constants ─────────────────────────────────────────────────────────── */

const genId = () => Math.random().toString(36).slice(2, 9)

const UNIT_OPTS    = ['Piece (Pc)','Box','Set','Pair','Pack','Dozen','Kg','Gram','Litre','Meter']
const BARCODE_OPTS = ['Code 128 (C128)','Code 39','EAN-13','EAN-8','UPC-A','QR Code']
const WARRANTY_OPTS= ['None','1 Month','3 Months','6 Months','1 Year','2 Years']

function warrantyLabelToMonths(label: string): number {
  const map: Record<string, number> = {
    None: 0, '1 Month': 1, '3 Months': 3, '6 Months': 6, '1 Year': 12, '2 Years': 24,
  }
  return map[label] ?? 0
}
const DEVICE_MODEL_FALLBACK = ['iPhone','iPad','MacBook','Samsung Galaxy','Xiaomi','OnePlus','Google Pixel','Oppo','Vivo','Huawei','Sony','Nokia','Motorola','Laptop','Tablet','Desktop','Smart Watch','Earbuds','Speaker','Other']

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
  width: 28, height: 28, borderRadius: '50%', background: '#2563eb',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, fontWeight: 700, flexShrink: 0,
}

function SectionHeader({ n, title, sub, optional, action }: {
  n: number; title: string; sub?: string; optional?: boolean; action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        <div style={sectionBadge}>{n}</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {title}
            {optional && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}> (Optional)</span>}
          </p>
          {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.45 }}>{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 text-xs border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-right font-medium truncate max-w-[55%]" style={{ color: 'var(--text-primary)' }}>{value || '—'}</span>
    </div>
  )
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
    <div style={{ position: 'relative', width: '100%' }}>
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

function FieldWithPlus({ select, popup }: { select: React.ReactNode; popup?: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-stretch">
      <div className="flex-1 min-w-0">{select}</div>
      {popup != null && <div className="relative flex-shrink-0">{popup}</div>}
    </div>
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

/* ─── Add Sub Category Popup ──────────────────────────────────────────────── */
function AddSubCatPopup({ settings, onClose, onSaved }: {
  settings: typeof DEFAULT_PRODUCT_VARIANT_SETTINGS; onClose: () => void; onSaved: (name: string) => void
}) {
  const [name, setName] = useState(''); const [loading, setLoading] = useState(false)
  const options = settings.subCategoryOptions
  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (options.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Sub category already exists'); return
    }
    const tenantId = authStorage.getUser()?.tenantId
    if (!tenantId) { toast.error('Not signed in'); return }
    setLoading(true)
    try {
      const next = [...options, trimmed]
      await pushProductVariantSettings(tenantId, { ...settings, subCategoryOptions: next })
      toast.success(`"${trimmed}" added`)
      onSaved(trimmed)
      onClose()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 200, padding: 12, borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>New Sub Category</p>
      <input autoFocus style={{ ...inputStyle, marginBottom: 8 }} placeholder="Sub category name…" value={name}
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

/* ─── Add Device Model Popup ──────────────────────────────────────────────── */
function AddDeviceModelPopup({ brandName, deviceBrands, onBrandsChange, onClose, onSaved }: {
  brandName: string
  deviceBrands: DeviceBrand[]
  onBrandsChange: (brands: DeviceBrand[]) => void
  onClose: () => void
  onSaved: (name: string, brandId: string) => void
}) {
  const [name, setName] = useState(''); const [loading, setLoading] = useState(false)
  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!brandName.trim()) { toast.error('Select a brand first'); return }
    setLoading(true)
    try {
      const existing = deviceBrands.find(b => b.name.toLowerCase() === brandName.trim().toLowerCase())
      let brandId: string
      if (existing) {
        brandId = existing.id
      } else {
        const createdRes: any = await deviceCatalogApi.createBrand(brandName.trim())
        const created: DeviceBrand = createdRes.data ?? createdRes
        onBrandsChange([...deviceBrands, created])
        brandId = created.id
      }
      const r: any = await deviceCatalogApi.createModel(brandId, trimmed)
      const model = r.data ?? r
      toast.success(`"${trimmed}" added`)
      onSaved(model.name ?? trimmed, brandId)
      onClose()
    } catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 200, padding: 12, borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>New Device Model</p>
      <input autoFocus style={{ ...inputStyle, marginBottom: 8 }} placeholder="Model name…" value={name}
        onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onClose} style={{ ...btn, flex: 1, fontSize: 11, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: 'none' }}>Cancel</button>
        <button type="button" onClick={save} disabled={!name.trim() || loading || !brandName.trim()}
          style={{ ...btn, flex: 1, fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', opacity: (!name.trim() || loading || !brandName.trim()) ? 0.5 : 1 }}>
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
          height: 160, borderRadius: 10, cursor: 'pointer', display: 'flex',
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
  const { data: variantSettings, refetch: refetchVariantSettings } = useProductVariantSettings()

  const variantCfg = variantSettings ?? DEFAULT_PRODUCT_VARIANT_SETTINGS
  const storageOpts = variantCfg.storageOptions
  const colorOpts = variantCfg.colorOptions
  const subCatOpts = variantCfg.subCategoryOptions

  const cats: Category[]  = (catsData ?? []) as Category[]
  const brands: Brand[]   = (brandsData ?? []) as Brand[]
  const suppliers: Supplier[] = ((suppliersRaw as any)?.data ?? []) as Supplier[]

  const [loading, setLoading] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [showAddBrand, setShowAddBrand] = useState(false)
  const [showAddSubCat, setShowAddSubCat] = useState(false)
  const [showAddDeviceModel, setShowAddDeviceModel] = useState(false)
  const [extraBrands, setExtraBrands] = useState<Brand[]>([])
  const [deviceBrands, setDeviceBrands] = useState<DeviceBrand[]>([])
  const [deviceModels, setDeviceModels] = useState<DeviceModel[]>([])
  const [tenantSlug, setTenantSlug] = useState<string | null>(() => getTenantSlugFromHost())
  const hideSubCatAndDeviceModel = isKasthuriTenant(tenantSlug)

  const allBrands = [...brands, ...extraBrands.filter(eb => !brands.find(b => b.id === eb.id))]

  const [form, setForm] = useState({
    name: '', sku: '', barcodeValue: '', barcodeType: 'Code 128 (C128)', brandName: '',
    categoryName: '', subCategory: '', unit: 'Piece (Pc)',
    deviceModel: '', description: '', imageUrl: '',
  })
  const [condition,     setCondition]     = useState<ProductCondition>('BRAND_NEW')
  const [imeiType,      setImeiType]      = useState<ImeiProductType>('accessory')
  const [imeiTouched,   setImeiTouched]   = useState(false)
  const [warrantyTrack, setWarrantyTrack] = useState(true)
  const [lowStock,      setLowStock]      = useState(true)
  const [minStock,      setMinStock]      = useState('5')
  const [manageStock,   setManageStock]   = useState('Yes')
  const [initialQty,    setInitialQty]    = useState('0')
  const [pricing, setPricing] = useState({ tax: 'None', taxType: 'Exclusive', purchaseEx: '', purchaseInc: '', sellingEx: '', margin: '' })
  const [extra,   setExtra]   = useState({ supplierId: '', warranty: '1 Year', warrantyNote: '', hsCode: '', tags: '' })
  const [variants, setVariants] = useState<VariantRow[]>([])

  const f = useCallback((k: string, v: string) => setForm(p => ({ ...p, [k]: v })), [])

  useEffect(() => {
    if (cats.length > 0 && !form.categoryName) f('categoryName', cats[0].name)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.length])

  useEffect(() => {
    const tenantId = authStorage.getUser()?.tenantId
    if (!tenantId) return
    tenantApi.get(tenantId).then((res: any) => {
      const slug = (res?.data ?? res)?.slug
      if (slug) setTenantSlug(slug)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (hideSubCatAndDeviceModel) return
    deviceCatalogApi.listBrands().then((res: any) => setDeviceBrands(res.data ?? res)).catch(() => {})
  }, [hideSubCatAndDeviceModel])

  useEffect(() => {
    if (hideSubCatAndDeviceModel) return
    const brand = deviceBrands.find(b => b.name.toLowerCase() === form.brandName.trim().toLowerCase())
    if (!brand) {
      setDeviceModels([])
      return
    }
    deviceCatalogApi.listModels(brand.id).then((res: any) => setDeviceModels(res.data ?? res)).catch(() => setDeviceModels([]))
  }, [form.brandName, deviceBrands, hideSubCatAndDeviceModel])

  const deviceModelOpts = (() => {
    const fromCatalog = deviceModels.map(m => m.name)
    if (fromCatalog.length === 0) return DEVICE_MODEL_FALLBACK
    const seen = new Set<string>()
    return fromCatalog.filter(n => {
      const key = n.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  useEffect(() => {
    if (allBrands.length > 0 && !form.brandName) f('brandName', allBrands[0].name)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBrands.length])

  useEffect(() => {
    if (imeiTouched) return
    const hint = inferImeiProductType({
      categoryName: form.categoryName,
      deviceModel: form.deviceModel,
      hasVariants: variants.length > 0,
    })
    if (hint) setImeiType(hint)
  }, [form.categoryName, form.deviceModel, variants.length, imeiTouched])

  const trackImei = imeiTypeToTrackFlag(imeiType)

  const resolveBuyPrice = () => {
    const ex = Number(pricing.purchaseEx)
    if (ex > 0) return ex
    const inc = Number(pricing.purchaseInc)
    if (inc > 0) {
      const rate = pricing.tax === 'VAT 15%' ? 0.15 : pricing.tax === 'GST 10%' ? 0.10 : 0
      return rate > 0 ? Math.round((inc / (1 + rate)) * 100) / 100 : inc
    }
    return 0
  }

  const resolveSellPrice = () => Number(pricing.sellingEx) || 0

  const buildPayload = useCallback((opts: {
    name: string; sku: string; barcode?: string; brandName: string; categoryName: string
    buyingPrice: number; sellingPrice: number; trackImei: boolean
    subCategory?: string; deviceModel?: string; description?: string; imageUrl?: string
    condition?: ProductCondition
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
      condition:    opts.condition ?? 'BRAND_NEW',
      barcode:      opts.barcode?.trim() || opts.sku.trim() || undefined,
      buyingPrice:  opts.buyingPrice,
      sellingPrice: opts.sellingPrice,
      mrp:          opts.sellingPrice,
      stock:        manageStock === 'Yes' ? Math.max(0, Number(initialQty) || 0) : 0,
      minStock:     lowStock ? Number(minStock) || 5 : 0,
      trackImei:    opts.trackImei,
      warrantyMonths: warrantyTrack ? (warrantyLabelToMonths(extra.warranty) || 12) : 0,
      warrantyNote: warrantyTrack && extra.warrantyNote.trim() ? extra.warrantyNote.trim() : undefined,
      isActive:     true,
      storageVariations: rows.map(v => ({
        storage: v.storage, colorName: v.colorName, colorHex: v.colorHex,
        sku: v.sku || undefined, stock: 0,
        sellingPrice: Number(v.sellingPrice) || 0,
        costPrice:    Number(v.costPrice)    || 0,
      })),
      colorVariations: rows.map(v => ({ name: v.colorName, hex: v.colorHex })),
    }
  }, [lowStock, minStock, warrantyTrack, extra.warranty, extra.warrantyNote, manageStock, initialQty])

  const addVariant = () => setVariants(p => [...p, {
    id: genId(),
    storage: storageOpts.find(s => s === '128GB') ?? storageOpts[0] ?? '128GB',
    colorName: colorOpts[0]?.name ?? 'Black',
    colorHex: colorOpts[0]?.hex ?? '#1a1a1a',
    sku: '', sellingPrice: pricing.sellingEx, costPrice: pricing.purchaseEx,
  }])
  const delVariant = (id: string) => setVariants(p => p.filter(v => v.id !== id))
  const updVariant = (id: string, k: keyof VariantRow, val: string) => setVariants(p => p.map(v => v.id === id ? { ...v, [k]: val } : v))
  const updColor   = (id: string, name: string, hex: string) => setVariants(p => p.map(v => v.id === id ? { ...v, colorName: name, colorHex: hex } : v))

  const taxRate = pricing.tax === 'VAT 15%' ? 0.15 : pricing.tax === 'GST 10%' ? 0.10 : 0

  const setPurchaseEx = (val: string) => {
    const ex = val
    const inc = ex && taxRate ? String(Math.round(Number(ex) * (1 + taxRate) * 100) / 100) : ex
    const sell = pricing.sellingEx
    const margin = ex && sell && Number(ex) > 0
      ? String(Math.round(((Number(sell) - Number(ex)) / Number(ex)) * 10000) / 100)
      : pricing.margin
    setPricing(p => ({ ...p, purchaseEx: ex, purchaseInc: inc, margin }))
  }

  const setSellingEx = (val: string) => {
    const sell = val
    const buy = pricing.purchaseEx
    const margin = buy && sell && Number(buy) > 0
      ? String(Math.round(((Number(sell) - Number(buy)) / Number(buy)) * 10000) / 100)
      : pricing.margin
    setPricing(p => ({ ...p, sellingEx: sell, margin }))
  }

  const setPurchaseInc = (val: string) => {
    const inc = val
    const ex = inc && taxRate ? String(Math.round(Number(inc) / (1 + taxRate) * 100) / 100) : inc
    const sell = pricing.sellingEx
    const margin = ex && sell && Number(ex) > 0
      ? String(Math.round(((Number(sell) - Number(ex)) / Number(ex)) * 10000) / 100)
      : pricing.margin
    setPricing(p => ({ ...p, purchaseInc: inc, purchaseEx: ex, margin }))
  }

  const applyTaxToPricing = (tax: string) => {
    setPricing(p => {
      const rate = tax === 'VAT 15%' ? 0.15 : tax === 'GST 10%' ? 0.10 : 0
      const inc = p.purchaseEx && rate ? String(Math.round(Number(p.purchaseEx) * (1 + rate) * 100) / 100) : p.purchaseInc
      return { ...p, tax, purchaseInc: inc }
    })
  }

  const submit = async () => {
    if (!form.name.trim())         { toast.error('Product name required'); return }
    if (!form.sku.trim())          { toast.error('SKU required'); return }
    if (!form.categoryName.trim()) { toast.error('Category required'); return }

    const defaultBuy  = resolveBuyPrice()
    const defaultSell = resolveSellPrice()

    const resolvedVariants = variants.map(v => ({
      ...v,
      costPrice:    v.costPrice    || (defaultBuy  ? String(defaultBuy)  : ''),
      sellingPrice: v.sellingPrice || (defaultSell ? String(defaultSell) : ''),
    }))

    const buyingPrice  = variants.length > 0
      ? Number(resolvedVariants[0]?.costPrice)    || defaultBuy
      : defaultBuy
    const sellingPrice = variants.length > 0
      ? Number(resolvedVariants[0]?.sellingPrice) || defaultSell
      : defaultSell

    if (!buyingPrice)  { toast.error('Buying price required'); return }
    if (!sellingPrice) { toast.error('Selling price required'); return }
    if (variants.length > 0) {
      const bad = resolvedVariants.some(v => !Number(v.costPrice) || !Number(v.sellingPrice))
      if (bad) { toast.error('Each variant needs buy & sell price (or set defaults below)'); return }
    }

    setLoading(true)
    try {
      await productsApi.create(buildPayload({
        name: form.name, sku: form.sku, barcode: form.barcodeValue || form.sku,
        brandName: form.brandName, categoryName: form.categoryName,
        buyingPrice, sellingPrice, trackImei,
        subCategory: form.subCategory, deviceModel: form.deviceModel,
        description: form.description, imageUrl: form.imageUrl,
        condition,
        variantRows: resolvedVariants,
      }))
      toast.success(`"${form.name}" created!`)
      onSaved(); onClose()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
    finally { setLoading(false) }
  }

  const supplierName = suppliers.find(s => s.id === extra.supplierId)?.name ?? ''

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={onClose} className="btn-ghost p-2 shrink-0 mt-1" aria-label="Back to inventory">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="page-title">Create New Product</h1>
            <p className="page-subtitle">Add a new product to your inventory.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto pl-11 sm:pl-0">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="button" onClick={submit} disabled={loading || !form.name.trim() || !form.sku.trim()}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Create Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

            {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
            <div className="space-y-5 min-w-0">

              {/* 1. Basic Information */}
              <div style={card}>
                <SectionHeader n={1} title="Basic Information" />

                <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-5 lg:gap-6">
                  <ImageUploader imageUrl={form.imageUrl} onUploaded={url => f('imageUrl', url)} />

                  <div className="flex flex-col gap-3.5 min-w-0">
                    <div>
                      <Lbl req>Product Name</Lbl>
                      <input style={inputStyle} placeholder="Enter product name" value={form.name} onChange={e => f('name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <Lbl req>SKU</Lbl>
                        <input style={inputStyle} placeholder="Enter SKU" value={form.sku} onChange={e => f('sku', e.target.value)} />
                      </div>
                      <div>
                        <Lbl tip="Scanned barcode number stored for POS lookup">Barcode</Lbl>
                        <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="Scan or enter barcode"
                          value={form.barcodeValue} onChange={e => f('barcodeValue', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Lbl tip="Barcode format for label printing">Barcode Type</Lbl>
                      <Sel value={form.barcodeType} onChange={v => f('barcodeType', v)}>
                        {BARCODE_OPTS.map(b => <option key={b}>{b}</option>)}
                      </Sel>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="relative">
                        <Lbl req>Brand</Lbl>
                        <FieldWithPlus
                          select={
                            <Sel value={form.brandName} onChange={v => f('brandName', v)} placeholder="Select brand">
                              {allBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                            </Sel>
                          }
                          popup={(
                            <>
                              <PlusBtn onClick={() => setShowAddBrand(p => !p)} />
                              {showAddBrand && (
                                <AddBrandPopup onClose={() => setShowAddBrand(false)}
                                  onSaved={b => { setExtraBrands(p => [...p, b]); refetchBrands(); f('brandName', b.name) }} />
                              )}
                            </>
                          )}
                        />
                      </div>
                      <div className="relative">
                        <Lbl req>Category</Lbl>
                        <FieldWithPlus
                          select={
                            <Sel value={form.categoryName} onChange={v => f('categoryName', v)} placeholder="Select category">
                              {cats.map(c => <option key={c.id} value={c.name}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                            </Sel>
                          }
                          popup={(
                            <>
                              <PlusBtn onClick={() => setShowAddCat(p => !p)} />
                              {showAddCat && <AddCatPopup onClose={() => setShowAddCat(false)} onSaved={c => { refetchCats(); f('categoryName', c.name) }} />}
                            </>
                          )}
                        />
                      </div>
                      {!hideSubCatAndDeviceModel && (
                        <>
                          <div className="relative">
                            <Lbl>Sub Category</Lbl>
                            <FieldWithPlus
                              select={
                                <Sel value={form.subCategory} onChange={v => f('subCategory', v)} placeholder="Select sub category">
                                  {subCatOpts.map(s => <option key={s} value={s}>{s}</option>)}
                                </Sel>
                              }
                              popup={(
                                <>
                                  <PlusBtn onClick={() => setShowAddSubCat(p => !p)} />
                                  {showAddSubCat && (
                                    <AddSubCatPopup settings={variantCfg} onClose={() => setShowAddSubCat(false)}
                                      onSaved={name => { refetchVariantSettings(); f('subCategory', name) }} />
                                  )}
                                </>
                              )}
                            />
                          </div>
                          <div className="relative">
                            <Lbl>Device Model</Lbl>
                            <FieldWithPlus
                              select={
                                <Sel value={form.deviceModel} onChange={v => f('deviceModel', v)} placeholder="Select device model">
                                  {deviceModelOpts.map(m => <option key={m} value={m}>{m}</option>)}
                                </Sel>
                              }
                              popup={(
                                <>
                                  <PlusBtn onClick={() => setShowAddDeviceModel(p => !p)} />
                                  {showAddDeviceModel && (
                                    <AddDeviceModelPopup
                                      brandName={form.brandName}
                                      deviceBrands={deviceBrands}
                                      onBrandsChange={setDeviceBrands}
                                      onClose={() => setShowAddDeviceModel(false)}
                                      onSaved={(name, brandId) => {
                                        deviceCatalogApi.listModels(brandId)
                                          .then((res: any) => setDeviceModels(res.data ?? res))
                                          .catch(() => {})
                                        f('deviceModel', name)
                                      }}
                                    />
                                  )}
                                </>
                              )}
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <Lbl req>Unit</Lbl>
                        <Sel value={form.unit} onChange={v => f('unit', v)}>
                          {UNIT_OPTS.map(u => <option key={u}>{u}</option>)}
                        </Sel>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <Lbl>Description</Lbl>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px',
                      background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                      {['B', 'I', 'U'].map(l => (
                        <button key={l} type="button" style={{ padding: '3px 7px', fontSize: 12, fontWeight: 700, borderRadius: 4,
                          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>{l}</button>
                      ))}
                      <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 4px' }} />
                      {['≡', '⁝', '⊞'].map((s, i) => (
                        <button key={i} type="button" style={{ padding: '3px 6px', fontSize: 13, borderRadius: 4,
                          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>{s}</button>
                      ))}
                    </div>
                    <textarea rows={5} maxLength={2000} placeholder="Write product description…"
                      style={{ ...inputStyle, height: 'auto', padding: '12px', resize: 'none', border: 'none',
                        borderRadius: 0, fontFamily: 'inherit', lineHeight: 1.6 }}
                      value={form.description} onChange={e => f('description', e.target.value)} />
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{form.description.length}/2000</p>
                </div>
              </div>

              {/* Product Condition */}
              <div style={card}>
                <SectionHeader n={2} title="Product Condition" sub="Whether this item is brand new or pre-owned." />
                <div className="max-w-xs">
                  <Lbl req>Condition</Lbl>
                  <Sel value={condition} onChange={v => setCondition(v as ProductCondition)}>
                    {PRODUCT_CONDITION_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Sel>
                </div>
              </div>

              {/* 5. Variant Combinations */}
              <div style={card}>
                <SectionHeader n={5} title="Variant Combinations" optional
                  sub="For phones/tablets with storage & color. Skip for simple barcode products."
                  action={(
                    <button type="button" onClick={addVariant}
                      style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <Plus size={13} /> Add Variant
                    </button>
                  )}
                />

                {variants.length > 0 ? (
                  <>
                    <div className="overflow-x-auto -mx-1 px-1 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                      <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-subtle)' }}>
                            {['#', '', 'Storage (Model) *', 'Color *', 'SKU (Optional)', 'Selling Price (LKR) *', 'Cost Price (LKR)', 'Action'].map((h, i) => (
                              <th key={i} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                                color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
                                width: i === 0 ? 28 : i === 1 ? 24 : i === 7 ? 48 : 'auto' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, i) => (
                            <tr key={v.id} style={{ borderBottom: i < variants.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</td>
                              <td style={{ padding: '8px 4px' }}><GripVertical size={12} style={{ color: 'var(--text-muted)' }} /></td>
                              <td style={{ padding: '8px 6px' }}>
                                <div style={{ position: 'relative' }}>
                                  <select value={v.storage} onChange={e => updVariant(v.id, 'storage', e.target.value)}
                                    style={{ ...selectStyle, height: 32, fontSize: 12 }}>
                                    {storageOpts.map(s => <option key={s} value={s}>{s}</option>)}
                                    {!storageOpts.includes(v.storage) && <option value={v.storage}>{v.storage}</option>}
                                  </select>
                                  <ChevronDown size={11} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                </div>
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ColorDot hex={v.colorHex} />
                                  <div style={{ position: 'relative', flex: 1 }}>
                                    <select value={v.colorName} onChange={e => {
                                      const found = colorOpts.find(c => c.name === e.target.value)
                                      if (found) updColor(v.id, found.name, found.hex)
                                    }} style={{ ...selectStyle, height: 32, fontSize: 12 }}>
                                      {colorOpts.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                      {!colorOpts.some(c => c.name === v.colorName) && (
                                        <option value={v.colorName}>{v.colorName}</option>
                                      )}
                                    </select>
                                    <ChevronDown size={11} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <input style={{ ...inputStyle, height: 32, fontFamily: 'monospace', fontSize: 11 }}
                                  placeholder={`${(form.sku || 'PROD').toUpperCase()}-${v.storage.replace(/\s/g, '')}-${v.colorName.slice(0, 3).toUpperCase()}`}
                                  value={v.sku} onChange={e => updVariant(v.id, 'sku', e.target.value)} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <input type="number" min={0} style={{ ...inputStyle, height: 32 }} placeholder="0.00"
                                  value={v.sellingPrice} onChange={e => updVariant(v.id, 'sellingPrice', e.target.value)} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <input type="number" min={0} style={{ ...inputStyle, height: 32 }} placeholder="0.00"
                                  value={v.costPrice} onChange={e => updVariant(v.id, 'costPrice', e.target.value)} />
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
                      <Info size={10} /> Each variant is a unique storage + color combination.
                    </p>
                  </>
                ) : (
                  <div style={{ borderRadius: 8, padding: '36px 16px', textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                    <Box size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No variants — simple product</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Enter buy &amp; sell price in Pricing &amp; Stock, or add variants for phones</p>
                  </div>
                )}
              </div>

              {/* 6. Additional Information */}
              <div style={card}>
                <SectionHeader n={6} title="Additional Information" optional />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Lbl>Supplier</Lbl>
                    <Sel value={extra.supplierId} onChange={v => setExtra(p => ({ ...p, supplierId: v }))} placeholder="Select supplier">
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Sel>
                  </div>
                  <div>
                    <Lbl tip="Harmonized System code for customs">HS Code</Lbl>
                    <input style={inputStyle} placeholder="Enter HS code" value={extra.hsCode} onChange={e => setExtra(p => ({ ...p, hsCode: e.target.value }))} />
                  </div>
                  <div>
                    <Lbl>Tags</Lbl>
                    <input style={inputStyle} placeholder="Enter tags" value={extra.tags} onChange={e => setExtra(p => ({ ...p, tags: e.target.value }))} />
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Press enter to add</p>
                  </div>
                </div>
              </div>

              {/* 7. Preview Summary */}
              <div style={card}>
                <SectionHeader n={7} title="Preview Summary" />
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(220px,320px)] gap-5 items-start">
                  <div>
                    <PreviewRow label="Product Name" value={form.name} />
                    <PreviewRow label="SKU" value={form.sku} />
                    <PreviewRow label="Brand" value={form.brandName} />
                    <PreviewRow label="Category" value={form.categoryName} />
                    <PreviewRow label="Condition" value={PRODUCT_CONDITION_OPTS.find(o => o.value === condition)?.label} />
                    <PreviewRow label="Buying Price" value={pricing.purchaseEx ? `LKR ${pricing.purchaseEx}` : undefined} />
                    <PreviewRow label="Selling Price" value={pricing.sellingEx ? `LKR ${pricing.sellingEx}` : undefined} />
                    <PreviewRow label="IMEI Type" value={trackImei ? 'Phone / Tablet' : 'No IMEI'} />
                    <PreviewRow label="Warranty" value={warrantyTrack ? extra.warranty : 'None'} />
                    {warrantyTrack && extra.warrantyNote.trim() && (
                      <PreviewRow label="Warranty note" value={extra.warrantyNote.trim()} />
                    )}
                    <PreviewRow label="Stock" value={manageStock === 'Yes' ? initialQty || '0' : '0'} />
                    <PreviewRow label="Variants" value={variants.length ? String(variants.length) : 'None'} />
                    <PreviewRow label="Supplier" value={supplierName} />
                  </div>
                  <div
                    className="relative w-full aspect-[4/3] rounded-xl border overflow-hidden flex flex-col items-center justify-center"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    {form.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.imageUrl}
                        alt={form.name || 'Product preview'}
                        className="absolute inset-0 w-full h-full object-contain p-3"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center px-4 py-6 text-center">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                          style={{ background: 'rgba(37,99,235,0.1)' }}
                        >
                          <Eye size={24} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No image selected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ══ RIGHT COLUMN ═════════════════════════════════════════ */}
            <div className="space-y-5 xl:sticky xl:top-0">

              {/* 2. Pricing & Stock */}
              <div style={card}>
                <SectionHeader n={2} title="Pricing & Stock" />
                <div className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3.5">
                    <div>
                      <Lbl req>Buying Price (LKR)</Lbl>
                      <input type="number" min={0} style={inputStyle} placeholder="0.00"
                        value={pricing.purchaseEx} onChange={e => setPurchaseEx(e.target.value)} />
                    </div>
                    <div>
                      <Lbl req>Selling Price (LKR)</Lbl>
                      <input type="number" min={0} style={inputStyle} placeholder="0.00"
                        value={pricing.sellingEx} onChange={e => setSellingEx(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Lbl>Profit Margin (%)</Lbl>
                    <div style={{ position: 'relative' }}>
                      <input type="number" min={0} readOnly placeholder="0.00" value={pricing.margin}
                        style={{ ...inputStyle, paddingRight: 32, color: 'var(--text-muted)' }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                    <Checkbox checked={lowStock} onChange={setLowStock} label="Low Stock Alert"
                      desc="Get notified when stock goes below minimum" />
                    {lowStock && (
                      <div style={{ paddingLeft: 26, marginBottom: 10 }}>
                        <Lbl req>Min Stock Quantity</Lbl>
                        <input type="number" min={0} style={inputStyle} value={minStock} onChange={e => setMinStock(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div>
                    <Lbl>Manage Stock</Lbl>
                    <Sel value={manageStock} onChange={setManageStock}>
                      <option>Yes</option><option>No</option>
                    </Sel>
                  </div>
                  {manageStock === 'Yes' && (
                    <div>
                      <Lbl>Initial Quantity</Lbl>
                      <input type="number" min={0} style={inputStyle} placeholder="0"
                        value={initialQty} onChange={e => setInitialQty(e.target.value)} />
                    </div>
                  )}
                  {variants.length > 0 && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Default prices for variants</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Ex. Tax (buy)</p>
                            <input type="number" min={0} style={{ ...inputStyle, height: 32 }} placeholder="0.00"
                              value={pricing.purchaseEx} onChange={e => setPurchaseEx(e.target.value)} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Inc. Tax (buy)</p>
                            <input type="number" min={0} style={{ ...inputStyle, height: 32 }} placeholder="0.00"
                              value={pricing.purchaseInc} onChange={e => setPurchaseInc(e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Lbl>Applicable Tax</Lbl>
                          <Sel value={pricing.tax} onChange={applyTaxToPricing}>
                            <option>None</option><option>VAT 15%</option><option>GST 10%</option>
                          </Sel>
                        </div>
                        <div>
                          <Lbl>Tax Type</Lbl>
                          <Sel value={pricing.taxType} onChange={v => setPricing(p => ({ ...p, taxType: v }))}>
                            <option>Exclusive</option><option>Inclusive</option>
                          </Sel>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Warranty Tracking */}
              <div style={card}>
                <SectionHeader n={3} title="Warranty Tracking" />
                <Checkbox checked={warrantyTrack} onChange={checked => {
                  setWarrantyTrack(checked)
                  if (checked && extra.warranty === 'None') setExtra(p => ({ ...p, warranty: '1 Year' }))
                }} label="Enable warranty tracking"
                  desc="Auto-create warranty certificate on sale" />
                {warrantyTrack && (
                  <div style={{ paddingLeft: 26 }} className="space-y-3">
                    <div>
                      <Lbl req>Warranty Period</Lbl>
                      <Sel value={extra.warranty} onChange={v => setExtra(p => ({ ...p, warranty: v }))}>
                        {WARRANTY_OPTS.filter(w => w !== 'None').map(w => <option key={w}>{w}</option>)}
                      </Sel>
                    </div>
                    <div>
                      <Lbl>Warranty note</Lbl>
                      <textarea
                        rows={3}
                        placeholder="e.g. 3 months phone-to-phone warranty; software updates included"
                        value={extra.warrantyNote}
                        onChange={e => setExtra(p => ({ ...p, warrantyNote: e.target.value }))}
                        style={{
                          ...inputStyle,
                          height: 'auto',
                          minHeight: 72,
                          padding: '8px 12px',
                          resize: 'vertical',
                          lineHeight: 1.45,
                        }}
                      />
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
                        Optional text for this product — prints on the bill under warranty. Shop-wide policy lines: Settings → Invoice → Warranty &amp; Service Terms.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. IMEI Tracking */}
              <div style={card}>
                <SectionHeader n={4} title="IMEI Tracking" optional />
                <ImeiProductTypeSelector
                  value={imeiType}
                  onChange={type => { setImeiTouched(true); setImeiType(type) }}
                  categoryName={form.categoryName}
                  deviceModel={form.deviceModel}
                  hasVariants={variants.length > 0}
                  compact
                  hideIntro
                />
              </div>
            </div>
          </div>
    </div>
  )
}
