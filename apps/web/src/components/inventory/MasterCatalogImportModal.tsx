'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, ChevronRight, ChevronLeft, Loader2, Download, CheckSquare, Square } from 'lucide-react'
import { masterCatalogApi, productsApi } from '@/lib/api'
import toast from 'react-hot-toast'

type CatalogKind = 'PHONE' | 'ACCESSORY'

interface Category { id: string; name: string }
interface Brand { id: string; name: string }
interface PhoneModel {
  id: string
  name: string
  brand?: { name: string }
  category?: { name: string }
  variants?: Array<{ id: string; storage: string; colorName: string }>
}
interface Accessory {
  id: string
  name: string
  modelOptional?: string | null
  category?: { name: string }
  brand?: { name: string } | null
}

interface Props {
  onClose: () => void
  onImported: () => void
}

export function MasterCatalogImportModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [kind, setKind] = useState<CatalogKind>('PHONE')
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [search, setSearch] = useState('')
  const [phones, setPhones] = useState<PhoneModel[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [selectedAccessories, setSelectedAccessories] = useState<Set<string>>(new Set())
  const [variantMap, setVariantMap] = useState<Record<string, Set<string>>>({})
  const [defaults, setDefaults] = useState({ buyingPrice: '0', sellingPrice: '0', stock: '0' })
  const [summary, setSummary] = useState<{
    categoriesCreated: number
    brandsCreated: number
    productsCreated: number
    duplicatesSkipped: number
  } | null>(null)

  useEffect(() => {
    setLoading(true)
    masterCatalogApi.listCategories()
      .then((r: unknown) => {
        const list = ((r as { data?: Category[] })?.data ?? r) as Category[]
        setCategories(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadBrands = useCallback(() => {
    masterCatalogApi.listBrands(kind === 'PHONE' ? 'PHONE' : 'ACCESSORY')
      .then((r: unknown) => {
        const list = ((r as { data?: Brand[] })?.data ?? r) as Brand[]
        setBrands(Array.isArray(list) ? list : [])
      })
      .catch(() => setBrands([]))
  }, [kind])

  useEffect(() => { if (step >= 2) loadBrands() }, [step, loadBrands])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      if (kind === 'PHONE') {
        const params: Record<string, string> = {}
        if (brandId) params.brandId = brandId
        if (categoryId) params.categoryId = categoryId
        if (search.trim()) params.search = search.trim()
        const r: unknown = await masterCatalogApi.listPhoneModels(params)
        const list = ((r as { data?: PhoneModel[] })?.data ?? r) as PhoneModel[]
        setPhones(Array.isArray(list) ? list : [])
      } else {
        const params: Record<string, string> = {}
        if (brandId) params.brandId = brandId
        if (categoryId) params.categoryId = categoryId
        if (search.trim()) params.search = search.trim()
        const r: unknown = await masterCatalogApi.listAccessories(params)
        const list = ((r as { data?: Accessory[] })?.data ?? r) as Accessory[]
        setAccessories(Array.isArray(list) ? list : [])
      }
    } catch {
      toast.error('Could not load catalog items')
    } finally {
      setLoading(false)
    }
  }, [kind, brandId, categoryId, search])

  useEffect(() => { if (step >= 3) loadItems() }, [step, loadItems])

  const phoneCategories = useMemo(
    () => categories.filter(c => /mobile|phone|smartphone|handset/i.test(c.name)),
    [categories],
  )
  const accessoryCategories = useMemo(
    () => categories.filter(c => !/mobile|phone|smartphone|handset/i.test(c.name)),
    [categories],
  )

  const toggleModel = (id: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAccessory = (id: string) => {
    setSelectedAccessories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleVariant = (modelId: string, variantId: string) => {
    setVariantMap(prev => {
      const next = { ...prev }
      const set = new Set(next[modelId] ?? [])
      if (set.has(variantId)) set.delete(variantId)
      else set.add(variantId)
      next[modelId] = set
      return next
    })
  }

  const previewRows = useMemo(() => {
    if (kind === 'PHONE') {
      return phones.filter(m => selectedModels.has(m.id)).map(m => ({
        id: m.id,
        label: `${m.brand?.name ?? ''} ${m.name}`.trim(),
        category: m.category?.name ?? '—',
        variants: m.variants?.length ?? 0,
      }))
    }
    return accessories.filter(a => selectedAccessories.has(a.id)).map(a => ({
      id: a.id,
      label: a.modelOptional ? `${a.name} (${a.modelOptional})` : a.name,
      category: a.category?.name ?? '—',
      variants: 0,
    }))
  }, [kind, phones, accessories, selectedModels, selectedAccessories])

  const runImport = async () => {
    setImporting(true)
    try {
      const items = kind === 'PHONE'
        ? [...selectedModels].map(modelId => ({
            type: 'PHONE' as const,
            modelId,
            variantIds: variantMap[modelId]?.size
              ? [...(variantMap[modelId] ?? [])]
              : undefined,
          }))
        : [...selectedAccessories].map(accessoryId => ({
            type: 'ACCESSORY' as const,
            accessoryId,
          }))

      const res: unknown = await productsApi.importFromMaster({
        items,
        defaults: {
          buyingPrice: Number(defaults.buyingPrice) || 0,
          sellingPrice: Number(defaults.sellingPrice) || 0,
          stock: Number(defaults.stock) || 0,
        },
      })
      const data = (res as { data?: typeof summary })?.data ?? res
      setSummary(data as typeof summary)
      setStep(6)
      toast.success('Import complete')
      onImported()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const canNext = () => {
    if (step === 1) return true
    if (step === 2) return !!brandId || kind === 'ACCESSORY'
    if (step === 3) return kind === 'PHONE' ? selectedModels.size > 0 : selectedAccessories.size > 0
    if (step === 4) return true
    if (step === 5) return previewRows.length > 0
    return false
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-[#0f1623] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Import from Master Catalog</p>
            <p className="text-[11px] text-slate-500">Step {Math.min(step, 5)} of 5</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-slate-400">What would you like to import?</p>
              <div className="grid grid-cols-2 gap-3">
                {(['PHONE', 'ACCESSORY'] as CatalogKind[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setKind(k); setCategoryId(''); setBrandId(''); setSelectedModels(new Set()); setSelectedAccessories(new Set()) }}
                    className={`p-4 rounded-xl border text-left transition-colors ${
                      kind === k ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{k === 'PHONE' ? 'Mobile Phones' : 'Accessories'}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {k === 'PHONE' ? 'Brands, models & storage/color variants' : 'Chargers, cases, earbuds & more'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Category</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  <option value="">All categories</option>
                  {(kind === 'PHONE' ? phoneCategories : accessoryCategories).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Brand</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                  value={brandId}
                  onChange={e => setBrandId(e.target.value)}
                >
                  <option value="">Select brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <input
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                placeholder="Search models…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-400" /></div>
              ) : kind === 'PHONE' ? (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {phones.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModel(m.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {selectedModels.has(m.id) ? <CheckSquare size={16} className="text-violet-400 shrink-0" /> : <Square size={16} className="text-slate-500 shrink-0" />}
                      <span className="text-sm text-white">{m.brand?.name} {m.name}</span>
                      <span className="text-[11px] text-slate-500 ml-auto">{m.variants?.length ?? 0} variants</span>
                    </button>
                  ))}
                  {phones.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No models found</p>}
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {accessories.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccessory(a.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {selectedAccessories.has(a.id) ? <CheckSquare size={16} className="text-violet-400 shrink-0" /> : <Square size={16} className="text-slate-500 shrink-0" />}
                      <span className="text-sm text-white">{a.name}</span>
                      <span className="text-[11px] text-slate-500 ml-auto">{a.category?.name}</span>
                    </button>
                  ))}
                  {accessories.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No accessories found</p>}
                </div>
              )}
            </>
          )}

          {step === 4 && kind === 'PHONE' && (
            <>
              <p className="text-sm text-slate-400">Select variants (leave empty to import all)</p>
              {phones.filter(m => selectedModels.has(m.id)).map(m => (
                <div key={m.id} className="rounded-xl border border-white/10 p-3">
                  <p className="text-sm font-semibold text-white mb-2">{m.brand?.name} {m.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {(m.variants ?? []).map(v => {
                      const on = variantMap[m.id]?.has(v.id)
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleVariant(m.id, v.id)}
                          className={`px-2.5 py-1 rounded-md text-xs border ${
                            on ? 'border-violet-500 bg-violet-500/20 text-violet-200' : 'border-white/10 text-slate-400'
                          }`}
                        >
                          {v.storage} · {v.colorName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 4 && kind === 'ACCESSORY' && (
            <p className="text-sm text-slate-400">Accessories import as single products — continue to preview.</p>
          )}

          {step === 5 && !summary && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: 'buyingPrice', label: 'Buy price (LKR)' },
                  { k: 'sellingPrice', label: 'Sell price (LKR)' },
                  { k: 'stock', label: 'Initial stock' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                    <input
                      className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                      value={defaults[f.k as keyof typeof defaults]}
                      onChange={e => setDefaults(p => ({ ...p, [f.k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate-500 border-b border-white/10"><th className="px-3 py-2">Product</th><th>Category</th><th>Variants</th></tr></thead>
                  <tbody>
                    {previewRows.map(r => (
                      <tr key={r.id} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white">{r.label}</td>
                        <td className="text-slate-400">{r.category}</td>
                        <td className="text-slate-400">{r.variants || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 6 && summary && (
            <div className="space-y-3 text-center py-4">
              <Download size={32} className="mx-auto text-emerald-400" />
              <p className="text-lg font-bold text-white">Import complete</p>
              <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto text-sm">
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-500 text-xs">Categories created</p><p className="text-white font-bold">{summary.categoriesCreated}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-500 text-xs">Brands created</p><p className="text-white font-bold">{summary.brandsCreated}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-500 text-xs">Products created</p><p className="text-emerald-400 font-bold">{summary.productsCreated}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-slate-500 text-xs">Duplicates skipped</p><p className="text-amber-400 font-bold">{summary.duplicatesSkipped}</p></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 shrink-0">
          {step > 1 && step < 6 ? (
            <button type="button" onClick={() => setStep(s => Math.max(1, s - 1))} className="btn-secondary text-sm flex items-center gap-1">
              <ChevronLeft size={14} /> Back
            </button>
          ) : <span />}

          {step === 6 ? (
            <button type="button" onClick={onClose} className="btn-primary text-sm ml-auto">Done</button>
          ) : step === 5 ? (
            <button type="button" disabled={importing || !canNext()} onClick={runImport} className="btn-primary text-sm flex items-center gap-2 ml-auto disabled:opacity-50">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Import {previewRows.length} item{previewRows.length !== 1 ? 's' : ''}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext()}
              onClick={() => {
                if (step === 3 && kind === 'ACCESSORY') setStep(5)
                else if (step === 4 && kind === 'ACCESSORY') setStep(5)
                else setStep(s => s + 1)
              }}
              className="btn-primary text-sm flex items-center gap-1 ml-auto disabled:opacity-50"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MasterCatalogImportModal
