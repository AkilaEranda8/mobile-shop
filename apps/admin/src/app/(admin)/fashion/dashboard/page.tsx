'use client'

import { useEffect, useState } from 'react'
import { Building2, Users, AlertTriangle, TrendingUp } from 'lucide-react'
import { fetchFashionOverview, type FashionOverview } from '@/lib/fashion-api'

export default function FashionDashboardPage() {
  const [data, setData] = useState<FashionOverview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFashionOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <p className="text-xs text-red-500 mt-1">
          Check FASHION_API_URL on the admin server and that Fashion ERP API is reachable.
        </p>
      </div>
    )
  }

  const stats = data?.stats
  const cards = [
    { label: 'Total tenants', value: stats?.totalTenants ?? 0, icon: Building2 },
    { label: 'Active', value: stats?.activeTenants ?? 0, icon: TrendingUp },
    { label: 'Trial', value: stats?.trialTenants ?? 0, icon: Users },
    { label: 'Alerts', value: data?.alerts?.length ?? 0, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Fashion ERP</h2>
        <p className="text-sm text-gray-500">Platform overview from Fashion ERP API</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                <Icon size={16} className="text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">{c.value}</p>
            </div>
          )
        })}
      </div>

      {!!data?.recentTenants?.length && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Recent tenants</p>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentTenants.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.plan} · {t.status}</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
