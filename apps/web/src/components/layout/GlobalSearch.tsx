'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Package, Users, Wrench, Receipt, Loader2, ArrowRight,
  LayoutDashboard, Settings, BarChart3,
} from 'lucide-react'
import { productsApi, customersApi, repairsApi, salesApi } from '@/lib/api'

type Result = {
  id: string
  type: 'product' | 'customer' | 'repair' | 'sale' | 'page'
  label: string
  sub?: string
  href: string
  icon: typeof Package
}

const QUICK_PAGES: Result[] = [
  { id: 'dashboard', type: 'page', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'inventory', type: 'page', label: 'Inventory', href: '/dashboard/inventory', icon: Package },
  { id: 'sales', type: 'page', label: 'Sales History', href: '/dashboard/sales', icon: Receipt },
  { id: 'customers', type: 'page', label: 'Customers', href: '/dashboard/customers', icon: Users },
  { id: 'repairs', type: 'page', label: 'Repair Jobs', href: '/dashboard/repairs', icon: Wrench },
  { id: 'analytics', type: 'page', label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { id: 'settings', type: 'page', label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

function unwrapList(res: unknown): any[] {
  if (!res) return []
  const r = res as any
  if (Array.isArray(r.data)) return r.data
  if (Array.isArray(r)) return r
  if (Array.isArray(r.data?.data)) return r.data.data
  return []
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[]>(QUICK_PAGES)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const openSearch = useCallback(() => {
    setQuery('')
    setResults(QUICK_PAGES)
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onPointerDown), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults(QUICK_PAGES)
      return
    }

    const qLower = trimmed.toLowerCase()
    const pageHits = QUICK_PAGES.filter(p =>
      p.label.toLowerCase().includes(qLower) || p.href.toLowerCase().includes(qLower),
    )

    setLoading(true)
    try {
      const [productsRes, customersRes, repairsRes, salesRes] = await Promise.allSettled([
        productsApi.list({ search: trimmed, limit: '5' }),
        customersApi.search(trimmed),
        repairsApi.list({ search: trimmed, limit: '5' }),
        salesApi.list({ search: trimmed, limit: '5' }),
      ])

      const items: Result[] = [...pageHits]

      if (productsRes.status === 'fulfilled') {
        for (const p of unwrapList(productsRes.value).slice(0, 5)) {
          items.push({
            id: `product-${p.id}`,
            type: 'product',
            label: p.name,
            sub: p.sku ? `SKU: ${p.sku}` : undefined,
            href: `/dashboard/inventory?q=${encodeURIComponent(trimmed)}`,
            icon: Package,
          })
        }
      }

      if (customersRes.status === 'fulfilled') {
        for (const c of unwrapList(customersRes.value).slice(0, 5)) {
          items.push({
            id: `customer-${c.id}`,
            type: 'customer',
            label: c.name,
            sub: c.phone || c.email,
            href: `/dashboard/customers?customerId=${c.id}`,
            icon: Users,
          })
        }
      }

      if (repairsRes.status === 'fulfilled') {
        for (const r of unwrapList(repairsRes.value).slice(0, 5)) {
          items.push({
            id: `repair-${r.id}`,
            type: 'repair',
            label: r.ticketNumber || 'Repair ticket',
            sub: [r.customerName, r.deviceBrand, r.deviceModel].filter(Boolean).join(' · '),
            href: `/dashboard/repairs?q=${encodeURIComponent(r.ticketNumber || trimmed)}`,
            icon: Wrench,
          })
        }
      }

      if (salesRes.status === 'fulfilled') {
        for (const s of unwrapList(salesRes.value).slice(0, 5)) {
          items.push({
            id: `sale-${s.id}`,
            type: 'sale',
            label: s.invoiceNumber || 'Sale',
            sub: [s.customerName, s.customerPhone].filter(Boolean).join(' · '),
            href: `/dashboard/sales?q=${encodeURIComponent(s.invoiceNumber || trimmed)}`,
            icon: Receipt,
          })
        }
      }

      setResults(items.length ? items : [{ id: 'none', type: 'page', label: 'No results found', href: '#', icon: Search }])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => runSearch(query), 280)
    return () => clearTimeout(t)
  }, [query, open, runSearch])

  const pick = (item: Result) => {
    if (item.href === '#') return
    setOpen(false)
    router.push(item.href)
  }

  const typeLabel: Record<Result['type'], string> = {
    page: 'Pages',
    product: 'Products',
    customer: 'Customers',
    repair: 'Repairs',
    sale: 'Sales',
  }

  const grouped = results.reduce<Record<string, Result[]>>((acc, item) => {
    const key = typeLabel[item.type]
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div ref={rootRef} className="relative w-full max-w-xs z-[200]">
      {!open ? (
        <button
          type="button"
          onClick={openSearch}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all w-full border"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd
            className="ml-auto text-[10px] border rounded px-1.5 py-0.5 hidden sm:inline"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
          >
            ⌘K
          </kbd>
        </button>
      ) : (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products, customers, repairs..."
              className="input-field pl-9 py-2 text-sm w-full"
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter') {
                  const first = results.find(r => r.href !== '#')
                  if (first) pick(first)
                }
              }}
            />
            {loading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-violet-400" />
            )}
          </div>

          <div
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl border shadow-2xl overflow-hidden z-[200]"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {Object.keys(grouped).length === 0 ? (
                <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Type to search…
                </p>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group} className="mb-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
                    {items.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={item.href === '#'}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => pick(item)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/5 disabled:opacity-60"
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <item.icon size={15} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                          {item.sub && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>}
                        </div>
                        {item.href !== '#' && <ArrowRight size={14} className="text-slate-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
