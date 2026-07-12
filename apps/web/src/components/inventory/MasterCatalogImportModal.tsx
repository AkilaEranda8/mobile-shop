'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, ChevronRight, ChevronLeft, Loader2, FileInput, CheckSquare, Square } from 'lucide-react'
import { masterCatalogApi } from '@/lib/api'
import {
  buildMasterCatalogAccessorySku,
  buildMasterCatalogSku,
  buildAccessoryCatalogDescription,
  buildPhoneCatalogDescription,
  type MasterCatalogFormDraft,
} from '@/lib/masterCatalogFormDraft'
import toast from 'react-hot-toast'

type CatalogKind = 'PHONE' | 'ACCESSORY'

interface Category { id: string; name: string }
interface Brand { id: string; name: string }
interface PhoneVariant {
  id: string
  storage: string
  colorName: string
  colorHex?: string | null
}
interface PhoneModel {
  id: string
  name: string
  releaseYear?: number | null
  brand?: { name: string }
  category?: { name: string }
  trackImei?: boolean
  defaultWarrantyMonths?: number
  variants?: PhoneVariant[]
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
  onApplyToForm: (draft: MasterCatalogFormDraft) => void
}

export function MasterCatalogImportModal({ onClose, onApplyToForm }: Props) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [kind, setKind] = useState<CatalogKind>('PHONE')
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<string>>(new Set())
  const [brandId, setBrandId] = useState('')
  const [search, setSearch] = useState('')
  const [phones, setPhones] = useState<PhoneModel[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedAccessoryId, setSelectedAccessoryId] = useState('')
  const [variantMap, setVariantMap] = useState<Record<string, Set<string>>>({})

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
    masterCatalogApi.listBrands(
      kind === 'PHONE' ? 'PHONE' : 'ACCESSORY',
      kind === 'PHONE' ? { withPhoneModels: true } : { withAccessories: true },
    )
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
        if (selectedBrandIds.size) params.brandIds = [...selectedBrandIds].join(',')
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
  }, [kind, selectedBrandIds, brandId, categoryId, search])

  useEffect(() => { if (step >= 3) loadItems() }, [step, loadItems])

  const accessoryCategories = useMemo(
    () => categories.filter(c => !/mobile|phone|smartphone|handset/i.test(c.name)),
    [categories],
  )

  const toggleBrand = (id: string) => {
    setSelectedBrandIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectedModelId('')
    setVariantMap({})
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

  const selectedPhone = phones.find(m => m.id === selectedModelId)
  const selectedAccessory = accessories.find(a => a.id === selectedAccessoryId)

  const previewLabel = kind === 'PHONE'
    ? selectedPhone ? `${selectedPhone.brand?.name ?? ''} ${selectedPhone.name}`.trim() : ''
    : selectedAccessory
      ? (selectedAccessory.modelOptional ? `${selectedAccessory.name} (${selectedAccessory.modelOptional})` : selectedAccessory.name)
      : ''

  const selectedVariantCount = useMemo(() => {
    if (!selectedPhone) return 0
    const picked = variantMap[selectedPhone.id]
    if (picked?.size) return picked.size
    return selectedPhone.variants?.length ?? 0
  }, [selectedPhone, variantMap])

  const applyToForm = async () => {
    setApplying(true)
    try {
      if (kind === 'PHONE') {
        if (!selectedModelId) {
          toast.error('Select a phone model')
          return
        }
        const r: unknown = await masterCatalogApi.getPhoneModel(selectedModelId)
        const model = ((r as { data?: PhoneModel })?.data ?? r) as PhoneModel
        const brandName = model.brand?.name ?? 'General'
        const categoryName = model.category?.name ?? 'Mobile Phones'
        const productName = `${brandName} ${model.name}`.trim()
        const sku = buildMasterCatalogSku(brandName, model.name)
        const allVariants = model.variants ?? []
        const pickedIds = variantMap[model.id]
        const variants = (pickedIds?.size
          ? allVariants.filter(v => pickedIds.has(v.id))
          : allVariants
        ).map(v => ({
          storage: v.storage,
          colorName: v.colorName,
          colorHex: v.colorHex ?? '#1a1a1a',
        }))

        onApplyToForm({
          name: productName,
          sku,
          brandName,
          categoryName,
          deviceModel: model.name,
          description: buildPhoneCatalogDescription({
            brandName,
            modelName: model.name,
            categoryName,
            releaseYear: model.releaseYear,
            variants,
          }),
          trackImei: model.trackImei ?? true,
          warrantyMonths: model.defaultWarrantyMonths ?? 12,
          variants,
        })
      } else {
        if (!selectedAccessoryId || !selectedAccessory) {
          toast.error('Select an accessory')
          return
        }
        const a = selectedAccessory
        const brandName = a.brand?.name ?? 'General'
        const categoryName = a.category?.name ?? 'Accessories'
        const productName = a.modelOptional ? `${a.name} (${a.modelOptional})` : a.name
        onApplyToForm({
          name: productName,
          sku: buildMasterCatalogAccessorySku(categoryName, a.name, a.brand?.name),
          brandName,
          categoryName,
          deviceModel: a.modelOptional ?? undefined,
          description: buildAccessoryCatalogDescription({
            name: a.name,
            brandName,
            categoryName,
            modelOptional: a.modelOptional,
          }),
          trackImei: false,
          warrantyMonths: 0,
          variants: [],
        })
      }
      onClose()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Could not load product details')
    } finally {
      setApplying(false)
    }
  }

  const canNext = () => {
    if (step === 1) return true
    if (step === 2) return kind === 'PHONE' ? selectedBrandIds.size > 0 : true
    if (step === 3) return kind === 'PHONE' ? !!selectedModelId : !!selectedAccessoryId
    if (step === 4) return true
    if (step === 5) return !!previewLabel
    return false
  }

  const totalSteps = kind === 'PHONE' ? 5 : 4

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-[#0f1623] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Import from Master Catalog</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-500">
              Step {Math.min(step, totalSteps)} of {totalSteps} · fills Create Product form (you save manually)
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-slate-400">Pick one catalog item — it will fill the product form. Set prices there, then click Create Product.</p>
              <div className="grid grid-cols-2 gap-3">
                {(['PHONE', 'ACCESSORY'] as CatalogKind[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setKind(k)
                      setCategoryId('')
                      setBrandId('')
                      setSelectedBrandIds(new Set())
                      setSelectedModelId('')
                      setSelectedAccessoryId('')
                      setVariantMap({})
                    }}
                    className={`p-4 rounded-xl border text-left transition-colors ${
                      kind === k ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{k === 'PHONE' ? 'Mobile Phones' : 'Accessories'}</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                      {k === 'PHONE' ? 'Brand → model → variants' : 'Category → accessory'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && kind === 'PHONE' && (
            <>
              <p className="text-sm text-slate-400">Select phone brand(s) to browse models</p>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-400" /></div>
              ) : brands.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No phone brands in catalog yet. Ask admin to load the Master Catalog.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {brands.map(b => {
                    const on = selectedBrandIds.has(b.id)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBrand(b.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          on
                            ? 'border-violet-500 bg-violet-500/20 text-violet-100'
                            : 'border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        {on ? '✓ ' : ''}{b.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {step === 2 && kind === 'ACCESSORY' && (
            <>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-500 block mb-1">Category</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  <option value="">All categories</option>
                  {accessoryCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-500 block mb-1">Brand (optional)</label>
                <select
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                  value={brandId}
                  onChange={e => setBrandId(e.target.value)}
                >
                  <option value="">All brands</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-slate-400">
                {kind === 'PHONE' ? 'Select one phone model' : 'Select one accessory'}
              </p>
              <input
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                placeholder="Search…"
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
                      onClick={() => { setSelectedModelId(m.id); setVariantMap({}) }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {selectedModelId === m.id ? <CheckSquare size={16} className="text-violet-400 shrink-0" /> : <Square size={16} className="text-slate-500 shrink-0" />}
                      <span className="text-sm text-white">{m.brand?.name} {m.name}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-500 ml-auto">{m.variants?.length ?? 0} variants</span>
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
                      onClick={() => setSelectedAccessoryId(a.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {selectedAccessoryId === a.id ? <CheckSquare size={16} className="text-violet-400 shrink-0" /> : <Square size={16} className="text-slate-500 shrink-0" />}
                      <span className="text-sm text-white">{a.name}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-500 ml-auto">{a.category?.name}</span>
                    </button>
                  ))}
                  {accessories.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No accessories found</p>}
                </div>
              )}
            </>
          )}

          {step === 4 && kind === 'PHONE' && selectedPhone && (
            <>
              <p className="text-sm text-slate-400">Select variants (leave empty = all). Prices you set on the product form.</p>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{selectedPhone.brand?.name} {selectedPhone.name}</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedPhone.variants ?? []).map(v => {
                    const on = variantMap[selectedPhone.id]?.has(v.id)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleVariant(selectedPhone.id, v.id)}
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
            </>
          )}

          {step === 5 && kind === 'PHONE' && (
            <div className="rounded-xl border border-white/10 p-4 space-y-2 text-sm">
              <p className="text-white font-semibold">{previewLabel}</p>
              <p className="text-slate-400">Category: {selectedPhone?.category?.name ?? '—'}</p>
              <p className="text-slate-400">Variants: {selectedVariantCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-500 pt-2">
                Next: form opens with name, brand, category, SKU &amp; variants filled. Enter buy/sell prices, then Create Product.
              </p>
            </div>
          )}

          {step === 4 && kind === 'ACCESSORY' && (
            <div className="rounded-xl border border-white/10 p-4 space-y-2 text-sm">
              <p className="text-white font-semibold">{previewLabel}</p>
              <p className="text-slate-400">Category: {selectedAccessory?.category?.name ?? '—'}</p>
              <p className="text-slate-400">Brand: {selectedAccessory?.brand?.name ?? 'General'}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-500 pt-2">
                Form will be filled — set prices on Create Product, then save.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 shrink-0">
          {step > 1 ? (
            <button type="button" onClick={() => setStep(s => Math.max(1, s - 1))} className="btn-secondary text-sm flex items-center gap-1">
              <ChevronLeft size={14} /> Back
            </button>
          ) : <span />}

          {(kind === 'PHONE' && step === 5) || (kind === 'ACCESSORY' && step === 4) ? (
            <button type="button" disabled={applying || !canNext()} onClick={applyToForm} className="btn-primary text-sm flex items-center gap-2 ml-auto disabled:opacity-50">
              {applying ? <Loader2 size={14} className="animate-spin" /> : <FileInput size={14} />}
              Fill product form
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext()}
              onClick={() => {
                if (step === 3 && kind === 'ACCESSORY') setStep(4)
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
