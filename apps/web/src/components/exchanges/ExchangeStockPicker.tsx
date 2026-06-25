'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Hash, Loader2, Search, Smartphone } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export type ExchangeStockItem = {
  imeiRecordId: string
  imei: string
  productId: string
  productName: string
  brand: string
  model: string
  storage?: string
  color?: string
  sellPrice: number
  variation?: string
}

type ProductGroup = {
  productId: string
  productName: string
  brand: string
  model: string
  items: ExchangeStockItem[]
  minPrice: number
  maxPrice: number
}

function groupByProduct(stock: ExchangeStockItem[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>()
  for (const item of stock) {
    const existing = map.get(item.productId)
    if (existing) {
      existing.items.push(item)
      existing.minPrice = Math.min(existing.minPrice, item.sellPrice)
      existing.maxPrice = Math.max(existing.maxPrice, item.sellPrice)
    } else {
      map.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        brand: item.brand,
        model: item.model,
        items: [item],
        minPrice: item.sellPrice,
        maxPrice: item.sellPrice,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName))
}

function variantKey(storage?: string, color?: string): string {
  return `${storage ?? ''}::${color ?? ''}`
}

function itemVariant(item: ExchangeStockItem): { storage: string; color: string } {
  if (item.storage || item.color) {
    return {
      storage: item.storage?.trim() || 'Standard',
      color: item.color?.trim() || 'Standard',
    }
  }
  if (item.variation?.includes('::')) {
    const [storage, color] = item.variation.split('::').map(s => s.trim())
    return {
      storage: storage || 'Standard',
      color: color || 'Standard',
    }
  }
  return { storage: 'Standard', color: 'Standard' }
}

function itemMatchesVariant(item: ExchangeStockItem, storage: string, color: string): boolean {
  const { storage: iStorage, color: iColor } = itemVariant(item)
  return iStorage === storage && iColor === color
}

function colorDot(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('black')) return '#1a1a1a'
  if (n.includes('white') || n.includes('silver') || n.includes('star')) return '#e2e8f0'
  if (n.includes('gold') || n.includes('yellow')) return '#f59e0b'
  if (n.includes('red') || n.includes('rose')) return '#ef4444'
  if (n.includes('blue') || n.includes('sky') || n.includes('pacific')) return '#3b82f6'
  if (n.includes('green') || n.includes('midnight') || n.includes('alpine')) return '#10b981'
  if (n.includes('purple') || n.includes('violet')) return '#8b5cf6'
  if (n.includes('pink')) return '#ec4899'
  if (n.includes('orange')) return '#f97316'
  return '#6b7280'
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
        active ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : ''
      }`}
      style={!active ? { background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' } : undefined}
    >
      {children}
    </button>
  )
}

function VariantImeiPicker({
  group,
  selected,
  onSelect,
  onBack,
}: {
  group: ProductGroup
  selected: ExchangeStockItem | null
  onSelect: (item: ExchangeStockItem | null) => void
  onBack: () => void
}) {
  const variants = useMemo(() => {
    const keys = new Map<string, { storage: string; color: string; count: number; price: number }>()
    for (const item of group.items) {
      const { storage, color } = itemVariant(item)
      const key = variantKey(storage, color)
      const existing = keys.get(key)
      if (existing) {
        existing.count += 1
        existing.price = item.sellPrice
      } else {
        keys.set(key, { storage, color, count: 1, price: item.sellPrice })
      }
    }
    return Array.from(keys.values())
  }, [group.items])

  const storageOptions = [...new Set(variants.map(v => v.storage))]
  const [selStorage, setSelStorage] = useState(() => {
    if (selected) return itemVariant(selected).storage
    return storageOptions[0] ?? ''
  })
  const colorOptions = variants.filter(v => v.storage === selStorage)
  const [selColor, setSelColor] = useState(() => {
    if (selected) return itemVariant(selected).color
    return colorOptions[0]?.color ?? ''
  })
  const [selImei, setSelImei] = useState(selected?.imei ?? '')
  const [imeiScanValue, setImeiScanValue] = useState('')
  const [imeiScanError, setImeiScanError] = useState('')
  const imeiScanRef = useRef<HTMLInputElement>(null)

  const selectedVariant = variants.find(v => v.storage === selStorage && v.color === selColor)

  const availableImeis = useMemo(() => {
    if (!selStorage || !selColor) return []
    return group.items.filter(i => itemMatchesVariant(i, selStorage, selColor))
  }, [group.items, selStorage, selColor])

  useEffect(() => {
    const colorsForStorage = variants.filter(v => v.storage === selStorage)
    if (!colorsForStorage.some(v => v.color === selColor)) {
      setSelColor(colorsForStorage[0]?.color ?? '')
      setSelImei('')
      onSelect(null)
    }
  }, [selStorage, variants, selColor, onSelect])

  useEffect(() => {
    if (availableImeis.length === 1 && !selImei) {
      const item = availableImeis[0]
      setSelImei(item.imei)
      onSelect(item)
    } else if (selImei && !availableImeis.some(i => i.imei === selImei)) {
      setSelImei('')
      onSelect(null)
    }
  }, [availableImeis, selImei, onSelect])

  const clearImei = () => {
    setSelImei('')
    setImeiScanValue('')
    setImeiScanError('')
    onSelect(null)
  }

  const pickImei = (imei: string) => {
    const item = availableImeis.find(i => i.imei === imei)
    if (!item) return
    setSelImei(imei)
    setImeiScanError('')
    setImeiScanValue('')
    onSelect(item)
  }

  const handleImeiScan = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    const imei = digits.length > 15 ? digits.slice(-15) : digits
    if (imei.length !== 15) {
      setImeiScanError('IMEI must be 15 digits')
      return
    }
    if (availableImeis.some(i => i.imei === imei)) {
      pickImei(imei)
      toast.success('IMEI selected')
    } else {
      setImeiScanError('This IMEI is not in stock for this variant')
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-amber-600 dark:hover:text-amber-400"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={14} /> Back to products
      </button>

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)' }}>
            <Smartphone size={18} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{group.productName}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{group.brand} {group.model}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{group.items.length} unit(s) in stock</p>
          </div>
        </div>
      </div>

      {storageOptions.some(s => s !== 'Standard') && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Storage</p>
          <div className="flex flex-wrap gap-2">
            {storageOptions.filter(s => s !== 'Standard').map(s => (
              <PillButton key={s} active={selStorage === s} onClick={() => { setSelStorage(s); clearImei() }}>
                {s}
              </PillButton>
            ))}
          </div>
        </div>
      )}

      {colorOptions.some(v => v.color !== 'Standard') && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Color</p>
          <div className="flex flex-wrap gap-2">
            {colorOptions.filter(v => v.color !== 'Standard').map(v => (
              <PillButton
                key={variantKey(v.storage, v.color)}
                active={selColor === v.color}
                onClick={() => { setSelColor(v.color); clearImei() }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full border flex-shrink-0"
                    style={{ background: colorDot(v.color), borderColor: 'var(--border-default)' }}
                  />
                  {v.color}
                  <span className="opacity-60">({v.count})</span>
                </span>
              </PillButton>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Select IMEI * {selectedVariant && selectedVariant.storage !== 'Standard'
            ? `(${selectedVariant.storage}${selectedVariant.color !== 'Standard' ? ` / ${selectedVariant.color}` : ''})`
            : ''}
        </p>

        {availableImeis.length === 0 ? (
          <p className="text-xs text-rose-500">No units in stock for this variant.</p>
        ) : (
          <>
            <div className="flex gap-2 items-center px-3 h-10 rounded-xl border"
              style={{ background: 'rgba(217,119,6,0.06)', borderColor: 'rgba(217,119,6,0.25)' }}>
              <Hash size={13} className="text-amber-500 flex-shrink-0" />
              <input
                ref={imeiScanRef}
                className="flex-1 bg-transparent outline-none text-sm font-mono tracking-wide"
                style={{ color: 'var(--text-primary)' }}
                placeholder="Scan or type IMEI for this variant…"
                value={imeiScanValue}
                onChange={e => { setImeiScanValue(e.target.value); setImeiScanError('') }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleImeiScan(imeiScanValue) }
                }}
              />
              {imeiScanValue.replace(/\D/g, '').length === 15 && (
                <span className="text-[10px] text-emerald-500 font-bold flex-shrink-0">✓</span>
              )}
            </div>

            {imeiScanError && <p className="text-xs text-rose-500">{imeiScanError}</p>}

            <select
              value={selImei}
              onChange={e => pickImei(e.target.value)}
              className="input-field w-full font-mono text-sm"
            >
              <option value="">Choose IMEI from stock…</option>
              {availableImeis.map(i => (
                <option key={i.imeiRecordId} value={i.imei}>{i.imei}</option>
              ))}
            </select>

            {selImei && (
              <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-mono"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--text-primary)' }}>
                <span>✓ {selImei}</span>
                <button type="button" onClick={clearImei} className="text-rose-500 hover:underline text-[10px] font-sans">Clear</button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedVariant && (
        <div className="rounded-xl p-3 flex items-center justify-between gap-3 text-sm"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Sell price</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedVariant.price)}</span>
        </div>
      )}
    </div>
  )
}

export function ExchangeStockPicker({
  stock,
  loading,
  search,
  onSearchChange,
  selected,
  onSelect,
}: {
  stock: ExchangeStockItem[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  selected: ExchangeStockItem | null
  onSelect: (item: ExchangeStockItem | null) => void
}) {
  const groups = useMemo(() => groupByProduct(stock), [stock])
  const [activeProductId, setActiveProductId] = useState<string | null>(selected?.productId ?? null)

  useEffect(() => {
    if (selected?.productId) setActiveProductId(selected.productId)
  }, [selected?.productId])

  const activeGroup = groups.find(g => g.productId === activeProductId) ?? null

  const priceLabel = (g: ProductGroup) =>
    g.minPrice === g.maxPrice
      ? formatCurrency(g.minPrice)
      : `${formatCurrency(g.minPrice)} – ${formatCurrency(g.maxPrice)}`

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          className="input-field w-full pl-9"
          placeholder="Search product, model, or IMEI…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500" size={24} /></div>
      ) : stock.length === 0 ? (
        <p className="text-center text-sm py-10" style={{ color: 'var(--text-muted)' }}>No phones in stock</p>
      ) : activeGroup ? (
        <VariantImeiPicker
          group={activeGroup}
          selected={selected?.productId === activeGroup.productId ? selected : null}
          onSelect={onSelect}
          onBack={() => { setActiveProductId(null); onSelect(null) }}
        />
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
          {groups.map(group => {
            const variantCount = new Set(group.items.map(i => {
              const { storage, color } = itemVariant(i)
              return variantKey(storage, color)
            })).size
            return (
              <button
                key={group.productId}
                type="button"
                onClick={() => { setActiveProductId(group.productId); onSelect(null) }}
                className="w-full text-left p-3 rounded-xl border transition-all hover:border-amber-500/30"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{group.productName}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{group.brand} {group.model}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {group.items.length} unit{group.items.length !== 1 ? 's' : ''}
                      {variantCount > 1 ? ` · ${variantCount} variants` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{priceLabel(group)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && !activeGroup && (
        <div className="rounded-xl p-3 text-xs space-y-1"
          style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <p className="font-semibold text-amber-700 dark:text-amber-300">Selected: {selected.productName}</p>
          <p className="font-mono" style={{ color: 'var(--text-muted)' }}>{selected.imei}</p>
        </div>
      )}
    </div>
  )
}
