'use client'

import { useState } from 'react'
import {
  Building2, Users, CreditCard, Activity, AlertTriangle,
  CheckCircle, XCircle, Server, Database, Cpu, HardDrive, Eye, Ban, RefreshCw
} from 'lucide-react'
import { mockTenants } from '@/lib/mock-data'
import { formatCurrency, formatDate } from '@/lib/utils'

const planColors: Record<string, string> = {
  STARTER: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  PRO: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
}

const statusColors: Record<string, string> = {
  ACTIVE: 'text-green-400',
  TRIAL: 'text-blue-400',
  SUSPENDED: 'text-red-400',
  CANCELLED: 'text-slate-500',
}

const systemMetrics = [
  { label: 'API Server', status: 'healthy', uptime: '99.9%', icon: Server, color: 'text-green-400' },
  { label: 'Database', status: 'healthy', uptime: '99.8%', icon: Database, color: 'text-green-400' },
  { label: 'Redis Cache', status: 'healthy', uptime: '100%', icon: Cpu, color: 'text-green-400' },
  { label: 'Storage (S3)', status: 'healthy', uptime: '100%', icon: HardDrive, color: 'text-green-400' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'tenants' | 'health' | 'billing'>('tenants')
  const [search, setSearch] = useState('')

  const filtered = mockTenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.ownerEmail.toLowerCase().includes(search.toLowerCase())
  )

  const totalMRR = mockTenants.reduce((s, t) => s + t.mrr, 0)
  const activeTenants = mockTenants.filter(t => t.status === 'ACTIVE').length
  const trialTenants = mockTenants.filter(t => t.status === 'TRIAL').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Activity size={15} className="text-red-400" />
        </div>
        <div>
          <h1 className="page-title">Platform Admin Console</h1>
          <p className="page-subtitle">Manage all tenants, system health, and billing</p>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants', value: mockTenants.length, sub: `${activeTenants} active`, color: 'text-violet-400' },
          { label: 'Monthly MRR', value: formatCurrency(totalMRR), sub: '+12.4% MoM', color: 'text-green-400' },
          { label: 'Trial Tenants', value: trialTenants, sub: 'Conversion opportunity', color: 'text-blue-400' },
          { label: 'Suspended', value: mockTenants.filter(t => t.status === 'SUSPENDED').length, sub: 'Needs attention', color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{stat.label}</p>
            <p className="text-[11px] text-slate-600 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 p-1 rounded-xl w-fit">
        {[['tenants', 'Tenants'], ['health', 'System Health'], ['billing', 'Billing']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'tenants' | 'health' | 'billing')}
            className={`px-4 py-1.5 text-xs rounded-lg transition-colors ${activeTab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search tenants..."
              className="input-field pl-4"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="table-header">Tenant</th>
                    <th className="table-header">Owner</th>
                    <th className="table-header text-center">Plan</th>
                    <th className="table-header text-center">Status</th>
                    <th className="table-header text-center">Branches</th>
                    <th className="table-header text-right">MRR</th>
                    <th className="table-header">Created</th>
                    <th className="table-header text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/3">
                  {filtered.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-white/2 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
                            {tenant.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm text-gray-800 dark:text-slate-200">{tenant.name}</p>
                            <p className="text-[10px] text-slate-600 font-mono">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm text-gray-700 dark:text-slate-300">{tenant.ownerName}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">{tenant.ownerEmail}</p>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${planColors[tenant.plan]}`}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          {tenant.status === 'ACTIVE' && <CheckCircle size={11} className="text-green-400" />}
                          {tenant.status === 'SUSPENDED' && <XCircle size={11} className="text-red-400" />}
                          {tenant.status === 'TRIAL' && <AlertTriangle size={11} className="text-blue-400" />}
                          <span className={`text-xs ${statusColors[tenant.status]}`}>{tenant.status}</span>
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <span className="text-xs text-gray-600 dark:text-slate-400">{tenant.branches.length}</span>
                      </td>
                      <td className="table-cell text-right">
                        <span className={`text-sm font-bold ${tenant.mrr > 0 ? 'text-white' : 'text-slate-600'}`}>
                          {tenant.mrr > 0 ? formatCurrency(tenant.mrr) : '—'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-gray-600 dark:text-slate-400">{formatDate(tenant.createdAt)}</span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors" title="View">
                            <Eye size={12} />
                          </button>
                          <button className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Suspend">
                            <Ban size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {systemMetrics.map(metric => (
            <div key={metric.label} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <metric.icon size={15} className={metric.color} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{metric.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 capitalize">{metric.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">Online</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-slate-500">Uptime</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{metric.uptime}</p>
                </div>
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-slate-500">Response</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{Math.floor(Math.random() * 30 + 10)}ms</p>
                </div>
              </div>
              <button className="mt-3 w-full text-xs text-gray-500 dark:text-slate-500 hover:text-violet-400 flex items-center justify-center gap-1.5 py-1.5 transition-colors">
                <RefreshCw size={11} />Refresh
              </button>
            </div>
          ))}

          {/* Recent Events */}
          <div className="sm:col-span-2 card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Platform Events</h3>
            <div className="space-y-2">
              {[
                { time: '2 min ago', event: 'New tenant registered: Tech Repair Hub', level: 'info' },
                { time: '15 min ago', event: 'Tenant Mobile Hub Chennai upgraded to PRO', level: 'success' },
                { time: '1h ago', event: 'Backup completed successfully', level: 'success' },
                { time: '3h ago', event: 'API rate limit reached for tenant: iPhone Specialist', level: 'warning' },
                { time: '6h ago', event: 'Scheduled maintenance completed', level: 'info' },
              ].map((ev, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-white/3 last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${ev.level === 'success' ? 'bg-green-400' : ev.level === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                  <p className="text-xs text-gray-600 dark:text-slate-400 flex-1">{ev.event}</p>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{ev.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { plan: 'STARTER (₹999)', count: mockTenants.filter(t => t.plan === 'STARTER' && t.status === 'ACTIVE').length, mrr: mockTenants.filter(t => t.plan === 'STARTER').reduce((s, t) => s + t.mrr, 0) },
              { plan: 'PRO (₹2,499)', count: mockTenants.filter(t => t.plan === 'PRO' && t.status === 'ACTIVE').length, mrr: mockTenants.filter(t => t.plan === 'PRO').reduce((s, t) => s + t.mrr, 0) },
              { plan: 'ENTERPRISE (₹8,500)', count: mockTenants.filter(t => t.plan === 'ENTERPRISE' && t.status === 'ACTIVE').length, mrr: mockTenants.filter(t => t.plan === 'ENTERPRISE').reduce((s, t) => s + t.mrr, 0) },
            ].map(row => (
              <div key={row.plan} className="card p-4">
                <p className="text-xs text-gray-500 dark:text-slate-500">{row.plan}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{row.count} tenants</p>
                <p className="text-sm text-green-400 mt-0.5">{formatCurrency(row.mrr)} MRR</p>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Billing Events</h3>
            <div className="space-y-2">
              {[
                { tenant: 'Mobile Hub Chennai', event: 'Payment received ₹2,499', date: '2024-05-01', status: 'success' },
                { tenant: 'Galaxy Mobile World', event: 'Payment received ₹8,500', date: '2024-05-01', status: 'success' },
                { tenant: 'Smart Phones Plus', event: 'Payment received ₹999', date: '2024-05-01', status: 'success' },
                { tenant: 'iPhone Specialist', event: 'Payment failed — subscription suspended', date: '2024-04-28', status: 'failed' },
              ].map((ev, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/3 last:border-0">
                  <div>
                    <p className="text-sm text-gray-800 dark:text-slate-200">{ev.tenant}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500">{ev.event}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs ${ev.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {ev.status === 'success' ? '✓ Paid' : '✗ Failed'}
                    </span>
                    <p className="text-[10px] text-slate-600">{ev.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
