'use client'

import { useState } from 'react'
import { TrendingUp, Users, Wrench, ShoppingCart, Star, Download, Calendar, Loader2 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useRevenue, useTopProducts } from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'


const repairByCategory = [
  { category: 'Screen Repair', count: 145, revenue: 812000 },
  { category: 'Battery', count: 98, revenue: 196000 },
  { category: 'Charging Port', count: 64, revenue: 89600 },
  { category: 'Speaker/Mic', count: 41, revenue: 143500 },
  { category: 'Water Damage', count: 28, revenue: 168000 },
  { category: 'Others', count: 22, revenue: 55000 },
]

const customerGrowth = [
  { month: 'Jan', new: 42, returning: 128 },
  { month: 'Feb', new: 55, returning: 145 },
  { month: 'Mar', new: 61, returning: 162 },
  { month: 'Apr', new: 48, returning: 178 },
  { month: 'May', new: 72, returning: 195 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('14d')
  const { data: rawRevenue } = useRevenue({ days: period === '7d' ? '7' : period === '14d' ? '14' : '30' })
  const { data: topProductsData } = useTopProducts({ limit: '10' })

  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []
  const displayData = revenueArr.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    Revenue: Math.round((d.revenue ?? 0) / 1000),
    Profit: Math.round((d.profit ?? 0) / 1000),
    Expenses: Math.round(((d.revenue ?? 0) - (d.profit ?? 0)) / 1000),
  }))

  const totalRevenue = revenueArr.reduce((s: number, d: any) => s + (d.revenue ?? 0), 0)
  const totalProfit = revenueArr.reduce((s: number, d: any) => s + (d.profit ?? 0), 0)
  const avgDaily = revenueArr.length > 0 ? Math.round(totalRevenue / revenueArr.length) : 0
  const topProducts: any[] = Array.isArray(topProductsData) ? topProductsData : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Business performance insights</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="flex gap-1 bg-white/3 p-1 rounded-xl">
            {(['7d', '14d', '30d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${period === p ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn-secondary text-xs flex items-center gap-1.5">
            <Download size={12} />Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '30d Revenue', value: formatCurrency(totalRevenue), sub: `Avg ${formatCurrency(avgDaily)}/day`, icon: TrendingUp, color: 'text-violet-400', bg: 'from-violet-500/10' },
          { label: '30d Profit', value: formatCurrency(totalProfit), sub: `Margin ${Math.round((totalProfit / totalRevenue) * 100)}%`, icon: Star, color: 'text-green-400', bg: 'from-green-500/10' },
          { label: 'Repair Jobs', value: repairByCategory.reduce((s, r) => s + r.count, 0).toString(), sub: 'Last 30 days', icon: Wrench, color: 'text-cyan-400', bg: 'from-cyan-500/10' },
          { label: 'Total Customers', value: '1,842', sub: '+72 new this month', icon: Users, color: 'text-yellow-400', bg: 'from-yellow-500/10' },
        ].map(kpi => (
          <div key={kpi.label} className={`card p-5 bg-gradient-to-br ${kpi.bg} to-transparent`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">{kpi.label}</span>
              <kpi.icon size={15} className={kpi.color} />
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[11px] text-slate-600 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Revenue vs Profit (₹k)</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Revenue</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Profit</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={displayData}>
            <defs>
              <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="Revenue" stroke="#7c3aed" fill="url(#gradRev)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Profit" stroke="#10b981" fill="url(#gradProfit)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Products by Revenue</h3>
          <div className="space-y-3">
            {topProducts.map((product: any, i: number) => (
              <div key={product.productId ?? i} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{product.productName}</p>
                  <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                      style={{ width: `${topProducts[0]?.revenue ? Math.round((product.revenue / topProducts[0].revenue) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-white">{formatCurrency(product.revenue ?? 0)}</p>
                  <p className="text-[10px] text-slate-500">{product.quantitySold ?? 0} sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Repair by Category */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Repairs by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={repairByCategory} layout="vertical" barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Customer Growth */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Customer Growth</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={customerGrowth} barSize={18} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="new" fill="#7c3aed" name="New" radius={[4, 4, 0, 0]} />
              <Bar dataKey="returning" fill="#06b6d4" name="Returning" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Technician Performance */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Technician Performance</h3>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Technician KPI data will appear here from the API.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
