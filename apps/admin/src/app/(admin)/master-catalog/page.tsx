'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Database, Download, Plus, Trash2, Smartphone, Package, Info } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import {
  masterCatalogAdminApi,
  type MasterCatalogCategory,
  type MasterCatalogBrand,
  type MasterCatalogPhoneModel,
  type MasterCatalogAccessory,
} from '@/lib/api'

type Tab = 'categories' | 'brands' | 'phones' | 'accessories'

const BRANDS_WITH_DEFAULT_MODELS = new Set([
  'apple', 'samsung', 'xiaomi', 'redmi', 'poco', 'realme', 'vivo', 'oppo',
  'honor', 'google pixel', 'motorola', 'nothing', 'oneplus', 'nokia', 'huawei',
])

function brandHasDefaultModels(name: string) {
  return BRANDS_WITH_DEFAULT_MODELS.has(name.trim().toLowerCase())
}

export default function MasterCatalogPage() {
  const [tab, setTab] = useState<Tab>('categories')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [loadingFull, setLoadingFull] = useState(false)
  const [seedingBrandId, setSeedingBrandId] = useState<string | null>(null)
  const [phoneBrandFilter, setPhoneBrandFilter] = useState('')
  const [categories, setCategories] = useState<MasterCatalogCategory[]>([])
  const [brands, setBrands] = useState<MasterCatalogBrand[]>([])
  const [phones, setPhones] = useState<MasterCatalogPhoneModel[]>([])
  const [accessories, setAccessories] = useState<MasterCatalogAccessory[]>([])

  const [newCat, setNewCat] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [phoneForm, setPhoneForm] = useState({ brandId: '', categoryId: '', name: '', releaseYear: '2025', trackImei: true })
  const [variantForm, setVariantForm] = useState({ modelId: '', storage: '128GB', colorName: 'Black', colorHex: '#1a1a1a' })
  const [accForm, setAccForm] = useState({ categoryId: '', brandId: '', name: '', modelOptional: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, b, p, a] = await Promise.all([
        masterCatalogAdminApi.listCategories(),
        masterCatalogAdminApi.listBrands(),
        masterCatalogAdminApi.listPhoneModels(),
        masterCatalogAdminApi.listAccessories(),
      ])
      setCategories(c)
      setBrands(b)
      setPhones(p)
      setAccessories(a)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const runSeed = async () => {
    setSeeding(true)
    try {
      await masterCatalogAdminApi.seed()
      await load()
      alert('Minimal defaults loaded.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }

  const runFullLoad = async () => {
    if (!confirm('Load full mobile catalog (all brands, models, variants & accessories)? Safe to re-run — duplicates are skipped.')) return
    setLoadingFull(true)
    try {
      const res = await masterCatalogAdminApi.seedFull()
      await load()
      alert(
        `Full catalog loaded.\n\nAdded: ${res.categoriesAdded} categories, ${res.brandsAdded} brands, ${res.modelsAdded} models, ${res.variantsAdded} variants, ${res.accessoriesAdded} accessories.\n\nTotals: ${res.totals.categories} categories, ${res.totals.brands} brands, ${res.totals.models} phone models, ${res.totals.accessories} accessories.`,
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoadingFull(false)
    }
  }

  const modelCountByBrand = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of phones) {
      counts.set(p.brandId, (counts.get(p.brandId) ?? 0) + 1)
    }
    return counts
  }, [phones])

  const filteredPhones = useMemo(
    () => (phoneBrandFilter ? phones.filter(p => p.brandId === phoneBrandFilter) : phones),
    [phones, phoneBrandFilter],
  )

  const openBrandModels = (brandId: string) => {
    setPhoneBrandFilter(brandId)
    setTab('phones')
  }

  const runBrandSeed = async (brandId: string, brandName: string) => {
    setSeedingBrandId(brandId)
    try {
      const res = await masterCatalogAdminApi.seedBrandModels(brandId)
      await load()
      alert(
        `${brandName}: ${res.modelsAdded} models, ${res.variantsAdded} variants added.\nTotal models for brand: ${res.totalModelsForBrand}`,
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setSeedingBrandId(null)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'categories', label: 'Categories', icon: <Package size={14} /> },
    { id: 'brands', label: 'Brands', icon: <Database size={14} /> },
    { id: 'phones', label: 'Phone Models', icon: <Smartphone size={14} /> },
    { id: 'accessories', label: 'Accessories', icon: <Package size={14} /> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Master Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Global catalog managed here only. Use Load full catalog to populate brands, models and accessories.
            Does not auto-save to tenant shops — untick Active to hide items from tenant import.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" onClick={runFullLoad} disabled={loadingFull || seeding} className="btn-primary text-sm flex items-center gap-2">
            <Download size={14} /> {loadingFull ? 'Loading…' : 'Load full catalog'}
          </button>
          <button type="button" onClick={runSeed} disabled={seeding || loadingFull} className="btn-secondary text-sm flex items-center gap-2">
            <Database size={14} /> {seeding ? 'Seeding…' : 'Quick seed'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex gap-2 text-sm text-blue-900">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>
          <strong>Admin only.</strong> Catalog data (brands, models, accessories) lives in the Master Catalog.
          Tenant inventory is updated only when a shop owner clicks <em>Import from Master Catalog</em> and confirms.
          Deactivate (untick) anything you do not want shops to see yet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 border ${
              tab === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500 text-sm">Loading catalog…</div>
      ) : tab === 'categories' ? (
        <div className="card p-5 space-y-4">
          <form className="flex gap-2" onSubmit={async e => {
            e.preventDefault()
            if (!newCat.trim()) return
            await masterCatalogAdminApi.createCategory({ name: newCat.trim() })
            setNewCat('')
            load()
          }}>
            <input className="input flex-1" placeholder="Category name (e.g. Mobile Phones)" value={newCat} onChange={e => setNewCat(e.target.value)} />
            <button type="submit" className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add</button>
          </form>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Name</th><th>Order</th><th>Active</th><th /></tr></thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td>{c.displayOrder}</td>
                  <td>
                    <Switch
                      checked={c.isActive}
                      onChange={async next => {
                        await masterCatalogAdminApi.updateCategory(c.id, { isActive: next })
                        load()
                      }}
                    />
                  </td>
                  <td className="text-right">
                    <button type="button" className="text-red-500 hover:text-red-700" onClick={async () => { await masterCatalogAdminApi.deleteCategory(c.id); load() }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'brands' ? (
        <div className="card p-5 space-y-4">
          <form className="flex gap-2" onSubmit={async e => {
            e.preventDefault()
            if (!newBrand.trim()) return
            await masterCatalogAdminApi.createBrand({ name: newBrand.trim(), type: 'BOTH' })
            setNewBrand('')
            load()
          }}>
            <input className="input flex-1" placeholder="Brand name (e.g. Samsung)" value={newBrand} onChange={e => setNewBrand(e.target.value)} />
            <button type="submit" className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {brands.map(b => {
              const modelCount = modelCountByBrand.get(b.id) ?? 0
              const canLoadDefaults = brandHasDefaultModels(b.name)
              return (
                <div key={b.id} className={`rounded-lg border p-3 space-y-2 ${b.isActive ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-100 opacity-80'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="text-sm font-semibold text-left hover:text-blue-600 truncate"
                      onClick={() => openBrandModels(b.id)}
                      title="View phone models"
                    >
                      {b.name}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={b.isActive}
                        onChange={async next => {
                          await masterCatalogAdminApi.updateBrand(b.id, { isActive: next })
                          load()
                        }}
                      />
                      <button type="button" className="text-red-400" onClick={async () => { await masterCatalogAdminApi.deleteBrand(b.id); load() }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{modelCount} phone model{modelCount !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => openBrandModels(b.id)}>
                      View models
                    </button>
                    {canLoadDefaults && (
                      <button
                        type="button"
                        className="btn-primary text-xs py-1 px-2"
                        disabled={seedingBrandId === b.id}
                        onClick={() => runBrandSeed(b.id, b.name)}
                      >
                        {seedingBrandId === b.id ? 'Loading…' : 'Load all models'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : tab === 'phones' ? (
        <div className="space-y-4">
          <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Filter by brand</label>
              <select
                className="input max-w-xs"
                value={phoneBrandFilter}
                onChange={e => setPhoneBrandFilter(e.target.value)}
              >
                <option value="">All brands ({phones.length})</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({modelCountByBrand.get(b.id) ?? 0})
                  </option>
                ))}
              </select>
            </div>
            {phoneBrandFilter && brandHasDefaultModels(brands.find(b => b.id === phoneBrandFilter)?.name ?? '') && (
              <button
                type="button"
                className="btn-primary text-sm shrink-0"
                disabled={seedingBrandId === phoneBrandFilter}
                onClick={() => {
                  const b = brands.find(x => x.id === phoneBrandFilter)
                  if (b) runBrandSeed(b.id, b.name)
                }}
              >
                {seedingBrandId === phoneBrandFilter ? 'Loading…' : 'Load all models for this brand'}
              </button>
            )}
          </div>
          <div className="card p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add phone model</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <select className="input" value={phoneForm.brandId} onChange={e => setPhoneForm(p => ({ ...p, brandId: e.target.value }))}>
                <option value="">Brand</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="input" value={phoneForm.categoryId} onChange={e => setPhoneForm(p => ({ ...p, categoryId: e.target.value }))}>
                <option value="">Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input" placeholder="Model name" value={phoneForm.name} onChange={e => setPhoneForm(p => ({ ...p, name: e.target.value }))} />
              <input className="input" placeholder="Release year" value={phoneForm.releaseYear} onChange={e => setPhoneForm(p => ({ ...p, releaseYear: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <Switch
                checked={phoneForm.trackImei}
                onChange={trackImei => setPhoneForm(p => ({ ...p, trackImei }))}
              />
              Track IMEI (untick for non-phone items)
            </label>
            <button type="button" className="btn-primary text-sm" onClick={async () => {
              if (!phoneForm.brandId || !phoneForm.categoryId || !phoneForm.name.trim()) return
              await masterCatalogAdminApi.createPhoneModel({
                brandId: phoneForm.brandId,
                categoryId: phoneForm.categoryId,
                name: phoneForm.name.trim(),
                releaseYear: Number(phoneForm.releaseYear) || undefined,
                trackImei: phoneForm.trackImei,
                defaultWarrantyMonths: phoneForm.trackImei ? 12 : 0,
              })
              setPhoneForm(p => ({ ...p, name: '' }))
              load()
            }}>Add model</button>
          </div>

          <div className="card p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add variant to model</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select className="input" value={variantForm.modelId} onChange={e => setVariantForm(p => ({ ...p, modelId: e.target.value }))}>
                <option value="">Model</option>
                {phones.map(m => <option key={m.id} value={m.id}>{m.brand?.name} {m.name}</option>)}
              </select>
              <input className="input" placeholder="Storage" value={variantForm.storage} onChange={e => setVariantForm(p => ({ ...p, storage: e.target.value }))} />
              <input className="input" placeholder="Color" value={variantForm.colorName} onChange={e => setVariantForm(p => ({ ...p, colorName: e.target.value }))} />
              <input className="input" placeholder="#hex" value={variantForm.colorHex} onChange={e => setVariantForm(p => ({ ...p, colorHex: e.target.value }))} />
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={async () => {
              if (!variantForm.modelId) return
              await masterCatalogAdminApi.createVariant(variantForm.modelId, {
                storage: variantForm.storage,
                colorName: variantForm.colorName,
                colorHex: variantForm.colorHex,
              })
              load()
            }}>Add variant</button>
          </div>

          <div className="card p-5 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Brand</th><th>Model</th><th>Category</th><th>Variants</th><th>Active</th><th>IMEI</th><th /></tr></thead>
              <tbody>
                {filteredPhones.map(m => (
                  <tr key={m.id} className={`border-b border-gray-100 ${!m.isActive ? 'opacity-60' : ''}`}>
                    <td className="py-2">{m.brand?.name}</td>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.category?.name}</td>
                    <td className="text-gray-500">{m.variants?.length ?? 0}</td>
                    <td>
                      <Switch
                        checked={m.isActive}
                        onChange={async next => {
                          await masterCatalogAdminApi.updatePhoneModel(m.id, { isActive: next })
                          load()
                        }}
                      />
                    </td>
                    <td>
                      <Switch
                        checked={m.trackImei ?? true}
                        onChange={async next => {
                          await masterCatalogAdminApi.updatePhoneModel(m.id, { trackImei: next })
                          load()
                        }}
                      />
                    </td>
                    <td className="text-right">
                      <button type="button" className="text-red-500" onClick={async () => { await masterCatalogAdminApi.deletePhoneModel(m.id); load() }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPhones.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500 text-sm">
                      No models for this brand. Use &quot;Load all models&quot; on the Brands tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add accessory</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select className="input" value={accForm.categoryId} onChange={e => setAccForm(p => ({ ...p, categoryId: e.target.value }))}>
              <option value="">Category</option>
              {categories.filter(c => c.name !== 'Mobile Phones').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" value={accForm.brandId} onChange={e => setAccForm(p => ({ ...p, brandId: e.target.value }))}>
              <option value="">Brand (optional)</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input className="input" placeholder="Product name" value={accForm.name} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))} />
            <input className="input" placeholder="Model (optional)" value={accForm.modelOptional} onChange={e => setAccForm(p => ({ ...p, modelOptional: e.target.value }))} />
          </div>
          <button type="button" className="btn-primary text-sm" onClick={async () => {
            if (!accForm.categoryId || !accForm.name.trim()) return
            await masterCatalogAdminApi.createAccessory({
              categoryId: accForm.categoryId,
              brandId: accForm.brandId || null,
              name: accForm.name.trim(),
              modelOptional: accForm.modelOptional || null,
            })
            setAccForm({ categoryId: '', brandId: '', name: '', modelOptional: '' })
            load()
          }}>Add accessory</button>

          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Name</th><th>Category</th><th>Brand</th><th>Active</th><th /></tr></thead>
            <tbody>
              {accessories.map(a => (
                <tr key={a.id} className={`border-b border-gray-100 ${!a.isActive ? 'opacity-60' : ''}`}>
                  <td className="py-2 font-medium">{a.name}{a.modelOptional ? ` (${a.modelOptional})` : ''}</td>
                  <td>{a.category?.name}</td>
                  <td>{a.brand?.name ?? '—'}</td>
                  <td>
                    <Switch
                      checked={a.isActive}
                      onChange={async next => {
                        await masterCatalogAdminApi.updateAccessory(a.id, { isActive: next })
                        load()
                      }}
                    />
                  </td>
                  <td className="text-right">
                    <button type="button" className="text-red-500" onClick={async () => { await masterCatalogAdminApi.deleteAccessory(a.id); load() }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
