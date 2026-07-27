'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchFashionTenants, type FashionTenantRow } from '@/lib/fashion-api'

export default function FashionTenantsPage() {
  const [rows, setRows] = useState<FashionTenantRow[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(q?: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchFashionTenants(q ? { search: q } : undefined)
      setRows(res.data)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Fashion tenants</h2>
          <p className="text-sm text-gray-500">{total} shops</p>
        </div>
        <form
          className="relative w-full sm:w-72"
          onSubmit={(e) => {
            e.preventDefault()
            load(search.trim() || undefined)
          }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search name, subdomain, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    No tenants found
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {t.subdomain}
                        {t.email ? ` · ${t.email}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{t.plan}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{t._count?.users ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
