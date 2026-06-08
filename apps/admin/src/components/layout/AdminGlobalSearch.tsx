'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Building2, Loader2, X, ArrowRight } from 'lucide-react'
import { fetchTenants, type TenantRow } from '@/lib/api'

export default function AdminGlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TenantRow[]>([])
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const data = await fetchTenants({ search: trimmed, limit: '8', page: '1' })
      setResults(data.data ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const goTenant = (id: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/tenants/${id}`)
  }

  const goTenantsList = () => {
    setOpen(false)
    router.push(`/tenants?search=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div ref={wrapRef} className="hidden md:block relative w-64">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) goTenantsList()
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search tenants…"
          className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
        />
        {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      {open && (query.trim().length >= 2 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {results.length === 0 && !loading && query.trim().length >= 2 && (
            <p className="px-3 py-4 text-sm text-gray-500">No tenants found</p>
          )}
          {results.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTenant(t.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 size={14} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">{t.ownerEmail}</p>
              </div>
              <ArrowRight size={14} className="text-gray-400" />
            </button>
          ))}
          {query.trim().length >= 2 && (
            <button type="button" onClick={goTenantsList}
              className="w-full px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 text-left">
              View all results for &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
