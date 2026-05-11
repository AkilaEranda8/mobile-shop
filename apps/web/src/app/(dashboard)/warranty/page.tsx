'use client'

import { useState } from 'react'
import { Search, Shield, Plus, AlertTriangle, CheckCircle, Clock, Eye, Loader2 } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useWarranties } from '@/lib/hooks'
import type { Warranty } from '@/types'

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 border-green-500/20 text-green-400',
  EXPIRED: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  VOID: 'bg-red-500/10 border-red-500/20 text-red-400',
  CLAIMED: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}

export default function WarrantyPage() {
  const { data: warrantyData, loading } = useWarranties()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'expiring' | 'claimed'>('all')
  const warranties: Warranty[] = (warrantyData?.data ?? []) as Warranty[]

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringCount = warranties.filter((w: Warranty) => new Date(w.endDate) <= thirtyDays && w.status === 'ACTIVE').length

  const filtered = warranties.filter((w: Warranty) => {
    const matchSearch = w.customerName.toLowerCase().includes(search.toLowerCase()) ||
      w.productName.toLowerCase().includes(search.toLowerCase()) ||
      w.warrantyCode.toLowerCase().includes(search.toLowerCase())
    if (tab === 'expiring') return matchSearch && new Date(w.endDate) <= thirtyDays && w.status === 'ACTIVE'
    if (tab === 'claimed') return matchSearch && w.status === 'CLAIMED'
    return matchSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Warranty Management</h1>
          <p className="page-subtitle">{warranties.length} warranties · {expiringCount} expiring soon</p>
        </div>
        <button className="btn-primary text-sm flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />Issue Warranty
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Warranties', value: warranties.length, color: 'text-violet-400' },
          { label: 'Active', value: warranties.filter((w: Warranty) => w.status === 'ACTIVE').length, color: 'text-green-400' },
          { label: 'Expiring in 30d', value: expiringCount, color: 'text-yellow-400' },
          { label: 'Claimed', value: warranties.filter((w: Warranty) => w.status === 'CLAIMED').length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-white/3 p-1 rounded-xl">
          {[['all', 'All'], ['expiring', `Expiring (${expiringCount})`], ['claimed', 'Claims']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as 'all' | 'expiring' | 'claimed')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md sm:ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search warranty code, customer, product..."
            className="input-field pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Warranty Code</th>
                <th className="table-header">Product</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Sale Date</th>
                <th className="table-header">Expires</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {filtered.map((warranty) => {
                const daysLeft = Math.ceil((new Date(warranty.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const isExpiringSoon = daysLeft <= 30 && daysLeft > 0 && warranty.status === 'ACTIVE'
                return (
                  <tr key={warranty.id} className="hover:bg-white/2 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-violet-400 flex-shrink-0" />
                        <span className="text-xs font-mono text-violet-300">{warranty.warrantyCode}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-slate-200 truncate max-w-[200px]">{warranty.productName}</p>
                      {warranty.imei && <p className="text-xs text-slate-600 font-mono">{warranty.imei}</p>}
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-slate-300">{warranty.customerName}</p>
                      <p className="text-xs text-slate-500">{warranty.customerPhone}</p>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">{formatDate(warranty.startDate)}</span>
                    </td>
                    <td className="table-cell">
                      <div>
                        <span className={`text-xs ${isExpiringSoon ? 'text-yellow-400 font-semibold' : 'text-slate-400'}`}>
                          {formatDate(warranty.endDate)}
                        </span>
                        {isExpiringSoon && (
                          <p className="text-[10px] text-yellow-500 flex items-center gap-0.5">
                            <AlertTriangle size={9} />{daysLeft}d left
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColors[warranty.status] || ''}`}>
                        {warranty.status}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <button className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors">
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-8 text-slate-500 text-sm">
                    No warranties found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
