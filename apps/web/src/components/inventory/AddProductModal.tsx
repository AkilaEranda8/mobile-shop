'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Trash2, Upload, Loader2, ChevronDown, Info, GripVertical, ArrowLeft, Box } from 'lucide-react'
import { productsApi, uploadApi } from '@/lib/api'
import { useCategories } from '@/lib/hooks'
import type { Category } from '@/types'
import toast from 'react-hot-toast'

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface VariantRow {
  id: string; storage: string; colorName: string; colorHex: string
  sku: string; sellingPrice: string; costPrice: string
}
interface AddProductModalProps { onClose: () => void; onSaved: () => void }

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
const UNIT_OPTS   = ['Piece (Pc)','Box','Set','Pair','Pack','Dozen','Kg','Gram','Litre','Meter']
const BARCODE_OPTS= ['Code 128 (C128)','Code 39','EAN-13','EAN-8','UPC-A','QR Code']
const WARRANTY_OPTS=['None','1 Month','3 Months','6 Months','1 Year','2 Years']

/* ─── Light-theme tokens ─────────────────────────────────────────────── */
const T = {
  pageBg:     '#f1f5f9',   // slate-100
  cardBg:     '#ffffff',
  subtleBg:   '#f8fafc',   // slate-50
  border:     '#e2e8f0',   // slate-200
  borderMd:   '#cbd5e1',   // slate-300
  textPrimary:'#0f172a',   // slate-900
  textSec:    '#475569',   // slate-600
  textMuted:  '#94a3b8',   // slate-400
  blue:       '#2563eb',
  blueDark:   '#1d4ed8',
  popBg:      '#ffffff',
}

const S = {
  card: {
    background: T.cardBg,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: '24px 28px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  label: {
    fontSize: 12, fontWeight: 600, color: T.textSec,
    marginBottom: 6, display: 'block',
  } as React.CSSProperties,
  input: {
    width: '100%', height: 36, padding: '0 12px', borderRadius: 8,
    fontSize: 13, outline: 'none', background: '#ffffff',
    border: `1px solid ${T.border}`, color: T.textPrimary,
    boxSizing: 'border-box',
  } as React.CSSProperties,
  select: {
    width: '100%', height: 36, padding: '0 32px 0 12px', borderRadius: 8,
    fontSize: 13, outline: 'none', background: '#ffffff',
    border: `1px solid ${T.border}`, color: T.textPrimary,
    appearance: 'none' as const, cursor: 'pointer',
  } as React.CSSProperties,
  btn: {
    height: 36, padding: '0 16px', borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
  } as React.CSSProperties,
  sectionNum: {
    width: 26, height: 26, borderRadius: '50%', background: '#2563eb',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  } as React.CSSProperties,
}

function Lbl({ children, req, tip }: { children: React.ReactNode; req?: boolean; tip?: string }) {
  return (
    <label style={S.label}>
      {children}{req && <span style={{ color: '#ef4444' }}> *</span>}
      {tip && (
        <span className="group relative inline-block ml-1 cursor-help">
          <Info size={11} style={{ color: T.textMuted, verticalAlign: 'middle' }} />
          <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 text-[10px] px-2 py-1 rounded-lg whitespace-nowrap"
            style={{ background: '#1e293b', color: '#e2e8f0', border: `1px solid ${T.borderMd}` }}>{tip}</span>
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
      <select style={S.select} value={value} onChange={e => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }} />
    </div>
  )
}

function PlusBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ ...S.btn, width: 36, padding: 0, background: '#fff', border: `1px solid ${T.border}`, color: T.textMuted, flexShrink: 0 }}>
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
        background: checked ? T.blue : 'transparent',
        border: `2px solid ${checked ? T.blue : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{label}</span>
          {tip && (
            <span className="group relative cursor-help">
              <Info size={10} style={{ color: T.textMuted }} />
              <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 text-[10px] px-2 py-1 rounded-lg whitespace-nowrap"
                style={{ background: '#1e293b', color: '#e2e8f0', border: `1px solid ${T.borderMd}` }}>{tip}</span>
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{desc}</p>
      </div>
    </label>
  )
}

function AddCatPopup({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Category) => void }) {
  const [name, setName] = useState(''); const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!name.trim()) return; setLoading(true)
    try { const r: any = await productsApi.createCategory({ name: name.trim() }); toast.success(`Category "${name}" added`); onSaved(r.data ?? r); onClose() }
    catch (e: any) { toast.error(e.message || 'Failed') } finally { setLoading(false) }
  }
  return (
    <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 200, padding: 12, borderRadius: 10, background: T.popBg, border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, marginBottom: 8 }}>New Category</p>
      <input autoFocus style={{ ...S.input, marginBottom: 8 }} placeholder="Category name…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onClose} style={{ ...S.btn, flex: 1, fontSize: 11, background: T.subtleBg, color: T.textMuted, border: `1px solid ${T.border}` }}>Cancel</button>
        <button type="button" onClick={save} disabled={!name.trim() || loading} style={{ ...S.btn, flex: 1, fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', opacity: (!name.trim() || loading) ? 0.5 : 1 }}>
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
      <Lbl>Product Image</Lbl>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handle(e.target.files[0])} />
      <div
        onClick={() => !uploading && ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]) }}
        style={{
          height: 200, borderRadius: 10, cursor: 'pointer', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${drag ? T.blue : T.borderMd}`,
          background: drag ? 'rgba(37,99,235,0.04)' : T.subtleBg,
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
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Upload size={20} style={{ color: '#2563eb' }} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>Click to upload</p>
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>or drag and drop</p>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 6 }}>PNG, JPG, JPEG (Max 2MB)</p>
            </>
          )}
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function AddProductModal({ onClose, onSaved }: AddProductModalProps) {
  const { data: catsData, refetch: refetchCats } = useCategories()
  const cats: Category[] = (catsData ?? []) as Category[]
  const [loading, setLoading] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)

  const [form, setForm] = useState({
    name: '', sku: '', barcodeType: 'Code 128 (C128)', brandName: '',
    categoryName: '', subCategory: '', unit: 'Piece (Pc)', deviceModel: '', description: '', imageUrl: '',
  })
  const [trackImei,       setTrackImei]       = useState(true)
  const [warrantyTrack,   setWarrantyTrack]   = useState(true)
  const [lowStock,        setLowStock]        = useState(true)
  const [minStock,        setMinStock]        = useState('5')
  const [pricing, setPricing] = useState({ tax: 'None', taxType: 'Exclusive', purchaseEx: '', purchaseInc: '', sellingEx: '', margin: '' })
  const [extra,   setExtra]   = useState({ supplier: '', warranty: 'None', hsCode: '', tags: '' })
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [colorDd,   setColorDd]   = useState<string|null>(null)
  const [storageDd, setStorageDd] = useState<string|null>(null)

  const f = useCallback((k: string, v: string) => setForm(p => ({ ...p, [k]: v })), [])

  useEffect(() => {
    if (cats.length > 0 && !form.categoryName) f('categoryName', cats[0].name)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.length])

  const addVariant = () => setVariants(p => [...p, { id: genId(), storage: '128GB', colorName: 'Black', colorHex: '#1a1a1a', sku: '', sellingPrice: '', costPrice: '' }])
  const delVariant = (id: string) => setVariants(p => p.filter(v => v.id !== id))
  const updVariant = (id: string, k: keyof VariantRow, val: string) => setVariants(p => p.map(v => v.id === id ? { ...v, [k]: val } : v))
  const updColor   = (id: string, name: string, hex: string) => setVariants(p => p.map(v => v.id === id ? { ...v, colorName: name, colorHex: hex } : v))

  const submit = async () => {
    if (!form.name.trim())         { toast.error('Product name required'); return }
    if (!form.sku.trim())          { toast.error('SKU required'); return }
    if (!form.categoryName.trim()) { toast.error('Category required'); return }
    const fv = variants[0]
    setLoading(true)
    try {
      await productsApi.create({
        name: form.name.trim(), sku: form.sku.trim(),
        brandName: form.brandName || undefined,
        categoryName: form.categoryName || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        buyingPrice: fv ? Number(fv.costPrice) || 0 : 0,
        sellingPrice: fv ? Number(fv.sellingPrice) || 0 : 0,
        mrp: fv ? Number(fv.sellingPrice) || 0 : 0,
        stock: 0, minStock: lowStock ? Number(minStock) || 5 : 0,
        trackImei, warrantyMonths: warrantyTrack ? 12 : 0, isActive: true,
        storageVariations: variants.map(v => ({ storage: v.storage, sellingPrice: Number(v.sellingPrice) || 0 })),
        colorVariations: variants.map(v => ({ name: v.colorName, hex: v.colorHex })),
      })
      toast.success(`"${form.name}" created!`)
      onSaved(); onClose()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
    finally { setLoading(false) }
  }

  /* close dropdowns on outside click */
  const closeDds = () => { setColorDd(null); setStorageDd(null) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: T.pageBg }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 28px', background: T.cardBg, borderBottom: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: 0 }}>Add New Product</h1>
            <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Create a new product with model (storage) and color variations</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...S.btn, background: T.subtleBg, border: `1px solid ${T.border}`, color: T.textSec }}>Cancel</button>
          <button onClick={submit} disabled={loading || !form.name.trim() || !form.sku.trim()}
            style={{ ...S.btn, background: '#2563eb', color: '#fff', border: 'none', opacity: (loading || !form.name.trim() || !form.sku.trim()) ? 0.6 : 1 }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
              </svg>
            )}
            Save Product
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ══ 1. Basic Information ══════════════════════════════════════ */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={S.sectionNum}>1</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', margin: 0 }}>Basic Information</p>
            </div>
          </div>

          {/* Image + Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 28 }}>
            <ImageUploader imageUrl={form.imageUrl} onUploaded={url => f('imageUrl', url)} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <Lbl req>Product Name</Lbl>
                  <input style={S.input} placeholder="Enter product name" value={form.name} onChange={e => f('name', e.target.value)} />
                </div>
                <div>
                  <Lbl req>SKU</Lbl>
                  <input style={S.input} placeholder="Enter SKU" value={form.sku} onChange={e => f('sku', e.target.value)} />
                </div>
                <div>
                  <Lbl tip="Barcode format used for printing labels">Barcode Type</Lbl>
                  <Sel value={form.barcodeType} onChange={v => f('barcodeType', v)}>
                    {BARCODE_OPTS.map(b => <option key={b}>{b}</option>)}
                  </Sel>
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <Lbl req>Brand</Lbl>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input style={S.input} placeholder="Select brand" list="brand-dl" value={form.brandName} onChange={e => f('brandName', e.target.value)} />
                      <datalist id="brand-dl">{['Apple','Samsung','Xiaomi','OnePlus','Google','Sony'].map(b => <option key={b} value={b} />)}</datalist>
                    </div>
                    <PlusBtn onClick={() => {}} />
                  </div>
                </div>
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
                <div>
                  <Lbl>Sub Category</Lbl>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Sel value={form.subCategory} onChange={v => f('subCategory', v)} placeholder="Select sub category">
                      <option value="flagship">Flagship</option>
                      <option value="mid-range">Mid Range</option>
                      <option value="budget">Budget</option>
                    </Sel>
                    <PlusBtn onClick={() => {}} />
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <Lbl req>Unit</Lbl>
                  <Sel value={form.unit} onChange={v => f('unit', v)}>
                    {UNIT_OPTS.map(u => <option key={u}>{u}</option>)}
                  </Sel>
                </div>
                <div>
                  <Lbl>Device Model</Lbl>
                  <Sel value={form.deviceModel} onChange={v => f('deviceModel', v)} placeholder="Select device model">
                    <option value="iphone">iPhone</option>
                    <option value="ipad">iPad</option>
                    <option value="android">Android</option>
                    <option value="laptop">Laptop</option>
                    <option value="tablet">Tablet</option>
                  </Sel>
                </div>
              </div>
            </div>
          </div>

          {/* Description + Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, marginTop: 20 }}>
            <div>
              <Lbl>Description</Lbl>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderBottom: 'none', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
                {['B', 'I', 'U'].map((f, i) => (
                  <button key={f} type="button" style={{ padding: '3px 7px', fontSize: 12, fontWeight: 700, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontStyle: i === 1 ? 'italic' : 'normal', textDecoration: i === 2 ? 'underline' : 'none' }}>{f}</button>
                ))}
                <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 4px' }} />
                {['≡', '⁝', '⊞'].map((s, i) => (
                  <button key={i} type="button" style={{ padding: '3px 6px', fontSize: 13, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>{s}</button>
                ))}
                <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 4px' }} />
                <button type="button" style={{ padding: '3px 6px', fontSize: 12, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>🔗</button>
                <button type="button" style={{ padding: '3px 6px', fontSize: 12, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>🖼</button>
                <div style={{ marginLeft: 'auto' }}>
                  <select style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option>
                  </select>
                </div>
              </div>
              <textarea rows={6} maxLength={2000} placeholder="Write product description..."
                style={{ ...S.input, height: 'auto', padding: '12px', resize: 'none', borderRadius: '0 0 8px 8px', fontFamily: 'inherit', lineHeight: 1.5 }}
                value={form.description} onChange={e => f('description', e.target.value)} />
              <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{form.description.length}/2000</p>
            </div>

            {/* Settings */}
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
                  <input type="number" min={0} style={S.input} value={minStock} onChange={e => setMinStock(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ 2 + 3 side by side ═══════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

          {/* 2. Variant Combinations */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={S.sectionNum}>2</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', margin: 0 }}>Variant Combinations</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Add all available combinations of storage (model) and color.</p>
                </div>
              </div>
              <button type="button" onClick={addVariant}
                style={{ ...S.btn, background: '#2563eb', color: '#fff', border: 'none', fontSize: 12, whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Add Variant
              </button>
            </div>

            {variants.length > 0 ? (
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)' }}>
                      {['#', '', 'Storage (Model) *', 'Color *', 'SKU (Optional)', 'Default Selling Price (LKR) *', 'Cost Price (LKR) Optional', 'Action'].map((h, i) => (
                        <th key={i} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', width: i === 0 ? 28 : i === 1 ? 24 : i === 7 ? 48 : 'auto' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={v.id} style={{ borderBottom: i < variants.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ padding: '8px 4px' }}><GripVertical size={12} style={{ color: 'var(--text-muted)' }} /></td>

                        {/* Storage dropdown */}
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ position: 'relative' }}>
                            <div onClick={() => { closeDds(); setStorageDd(storageDd === v.id ? null : v.id) }}
                              style={{ ...S.input, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
                              <span>{v.storage}</span>
                              <ChevronDown size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </div>
                            {storageDd === v.id && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, width: 140, borderRadius: 10, background: '#1a2035', border: '1px solid var(--border-default)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                                {STORAGE_OPTS.map(s => (
                                  <button key={s} type="button" onClick={() => { updVariant(v.id, 'storage', s); setStorageDd(null) }}
                                    style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: v.storage === s ? '#60a5fa' : 'var(--text-secondary)' }}>
                                    {s}
                                  </button>
                                ))}
                                <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-subtle)' }}>
                                  <input style={{ ...S.input, height: 28, fontSize: 11 }} placeholder="Custom…"
                                    onKeyDown={e => { if (e.key === 'Enter') { updVariant(v.id, 'storage', (e.target as HTMLInputElement).value); setStorageDd(null) } }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Color dropdown */}
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ position: 'relative' }}>
                            <div onClick={() => { closeDds(); setColorDd(colorDd === v.id ? null : v.id) }}
                              style={{ ...S.input, height: 32, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                              <ColorDot hex={v.colorHex} />
                              <span style={{ flex: 1 }}>{v.colorName}</span>
                              <ChevronDown size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </div>
                            {colorDd === v.id && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, width: 160, borderRadius: 10, background: '#1a2035', border: '1px solid var(--border-default)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
                                {COLOR_OPTS.map(c => (
                                  <button key={c.name} type="button" onClick={() => { updColor(v.id, c.name, c.hex); setColorDd(null) }}
                                    style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: v.colorName === c.name ? '#60a5fa' : 'var(--text-secondary)' }}>
                                    <ColorDot hex={c.hex} />{c.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '8px 6px' }}>
                          <input style={{ ...S.input, height: 32, fontFamily: 'monospace', fontSize: 11 }}
                            placeholder={`${(form.sku || 'IP12P').toUpperCase()}-${v.storage.replace(/\s/g,'')}-${v.colorName.slice(0,3).toUpperCase()}`}
                            value={v.sku} onChange={e => updVariant(v.id, 'sku', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <input type="number" min={0} style={{ ...S.input, height: 32 }} placeholder="0.00"
                            value={v.sellingPrice} onChange={e => updVariant(v.id, 'sellingPrice', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <input type="number" min={0} style={{ ...S.input, height: 32 }} placeholder="0.00"
                            value={v.costPrice} onChange={e => updVariant(v.id, 'costPrice', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <button type="button" onClick={() => delVariant(v.id)}
                            style={{ padding: 6, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ borderRadius: 8, padding: '40px 0', textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                <Box size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No variants yet</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Click &quot;+ Add Variant&quot; to add storage and color combinations</p>
              </div>
            )}
            {variants.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Info size={10} /> Each variant represents a unique combination of storage (model) and color.
              </p>
            )}
          </div>

          {/* 3. Pricing & Tax */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={S.sectionNum}>3</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', margin: 0 }}>Pricing &amp; Tax</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <Lbl>Applicable Tax</Lbl>
                  <Sel value={pricing.tax} onChange={v => setPricing(p => ({ ...p, tax: v }))}>
                    <option>None</option><option>VAT 15%</option><option>GST 10%</option>
                  </Sel>
                </div>
                <div>
                  <Lbl req>Selling Price Tax Type</Lbl>
                  <Sel value={pricing.taxType} onChange={v => setPricing(p => ({ ...p, taxType: v }))}>
                    <option>Exclusive</option><option>Inclusive</option>
                  </Sel>
                </div>
              </div>
              <div>
                <Lbl>Default Purchase Price (LKR)</Lbl>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Ex. Tax</p>
                    <input type="number" min={0} style={S.input} placeholder="0.00" value={pricing.purchaseEx} onChange={e => setPricing(p => ({ ...p, purchaseEx: e.target.value }))} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Inc. Tax</p>
                    <input type="number" min={0} style={S.input} placeholder="0.00" value={pricing.purchaseInc} onChange={e => setPricing(p => ({ ...p, purchaseInc: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div>
                <Lbl>Default Selling Price (LKR)</Lbl>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Ex. Tax</p>
                <input type="number" min={0} style={S.input} placeholder="0.00" value={pricing.sellingEx} onChange={e => setPricing(p => ({ ...p, sellingEx: e.target.value }))} />
              </div>
              <div>
                <Lbl>Margin (%)</Lbl>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={0} style={{ ...S.input, paddingRight: 32 }} placeholder="0.00" value={pricing.margin} onChange={e => setPricing(p => ({ ...p, margin: e.target.value }))} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ 4. Additional Information ═════════════════════════════════ */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={S.sectionNum}>4</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', margin: 0 }}>
              Additional Information <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(Optional)</span>
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <Lbl>Supplier</Lbl>
              <div style={{ display: 'flex', gap: 6 }}>
                <Sel value={extra.supplier} onChange={v => setExtra(p => ({ ...p, supplier: v }))} placeholder="Select supplier">
                  <option value="general">General Supplier</option>
                </Sel>
                <PlusBtn onClick={() => {}} />
              </div>
            </div>
            <div>
              <Lbl>Warranty Period</Lbl>
              <Sel value={extra.warranty} onChange={v => setExtra(p => ({ ...p, warranty: v }))}>
                {WARRANTY_OPTS.map(w => <option key={w}>{w}</option>)}
              </Sel>
            </div>
            <div>
              <Lbl>HS Code</Lbl>
              <input style={S.input} placeholder="Enter HS code" value={extra.hsCode} onChange={e => setExtra(p => ({ ...p, hsCode: e.target.value }))} />
            </div>
            <div>
              <Lbl>Tags</Lbl>
              <input style={S.input} placeholder="Enter tags" value={extra.tags} onChange={e => setExtra(p => ({ ...p, tags: e.target.value }))} />
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Press enter to add</p>
            </div>
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>

      {/* backdrop click to close dropdowns */}
      {(colorDd || storageDd) && <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={closeDds} />}
    </div>
  )
}
