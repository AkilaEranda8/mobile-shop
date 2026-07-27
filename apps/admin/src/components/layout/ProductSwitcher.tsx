'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { PRODUCTS, type HubProduct, getProduct } from '@/lib/products'
import { hubSession } from '@/lib/hub-session'

function productFromPath(path: string | null): HubProduct | null {
  if (!path) return null
  if (path.startsWith('/fashion')) return 'fashion'
  if (path.startsWith('/salon')) return 'salon'
  return null
}

export default function ProductSwitcher() {
  const router = useRouter()
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<HubProduct>('enterprise')

  useEffect(() => {
    setActive(productFromPath(path) ?? hubSession.getProduct())
  }, [path])

  const current = getProduct(active)

  function select(product: HubProduct) {
    setOpen(false)
    if (product === active) return
    const result = hubSession.switchProduct(product)
    if (!result.ok) {
      router.push(result.loginPath)
      return
    }
    setActive(product)
    router.push(result.path)
  }

  return (
    <div className="relative px-2 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Product</p>
          <p className="text-xs font-semibold text-gray-900 truncate">{current.shortLabel}</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {PRODUCTS.map((p) => {
            const has = hubSession.hasSession(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 ${
                  p.id === active ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-900">{p.shortLabel}</span>
                  {p.id === active ? (
                    <span className="text-[10px] text-emerald-600 font-medium">Active</span>
                  ) : has ? (
                    <span className="text-[10px] text-gray-400">Signed in</span>
                  ) : (
                    <span className="text-[10px] text-amber-600">Login required</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.description}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
