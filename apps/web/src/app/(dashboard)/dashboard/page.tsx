'use client'

import { TrendingUp, TrendingDown, ShoppingCart, Users, Wrench, AlertTriangle, Package, Shield, ArrowRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useRevenue, useRepairs, useTransactions, useAnalyticsDashboard, useTopProducts } from '@/lib/hooks'
import type { RepairTicket, Transaction as AppTransaction } from '@/types'
import { formatCurrency, formatRelativeTime, getRepairStatusColor } from '@/lib/utils'

export default function DashboardPage() {
  const { data: rawRevenue } = useRevenue()
  const { data: repairsData } = useRepairs()
  const { data: txData } = useTransactions()
  const { data: stats } = useAnalyticsDashboard()
  const { data: rawTopProducts } = useTopProducts()
  const topProducts: any[] = Array.isArray(rawTopProducts) ? rawTopProducts : []
  const s = stats as any
  const revenueArr: any[] = Array.isArray(rawRevenue) ? rawRevenue : []
  const repairs: RepairTicket[] = ((repairsData?.data ?? []) as RepairTicket[]).filter(r => r.status !== 'DELIVERED' && r.status !== 'CANCELLED').slice(0, 5)
  const transactions: AppTransaction[] = (txData?.data ?? []) as AppTransaction[]
  const chartData = revenueArr.slice(-14).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: Math.round((d.revenue ?? 0) / 1000),
    profit: Math.round((d.profit ?? 0) / 1000),
  }))

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today} · Main Branch</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/dashboard/repairs" className="btn-secondary text-sm flex items-center gap-2"><Wrench size={14} />New Repair</Link>
          <Link href="/dashboard/pos" className="btn-primary text-sm flex items-center gap-2"><ShoppingCart size={15} />New Sale</Link>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/pos', icon: ShoppingCart, label: 'Point of Sale', sub: 'Start a new sale', color: 'from-violet-600/20 to-violet-800/10 border-violet-500/20' },
          { href: '/dashboard/repairs', icon: Wrench, label: 'New Repair', sub: 'Log repair job', color: 'from-blue-600/20 to-blue-800/10 border-blue-500/20' },
          { href: '/dashboard/customers', icon: Users, label: 'Add Customer', sub: 'Register customer', color: 'from-cyan-600/20 to-cyan-800/10 border-cyan-500/20' },
          { href: '/dashboard/inventory', icon: Package, label: 'Add Product', sub: 'Update inventory', color: 'from-green-600/20 to-green-800/10 border-green-500/20' },
        ].map(q => (
          <Link key={q.href} href={q.href} className={`p-3.5 rounded-xl bg-gradient-to-br ${q.color} border hover:opacity-80 transition-opacity flex items-center gap-3`}>
            <q.icon size={18} className="text-slate-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{q.label}</p>
              <p className="text-[11px] text-slate-400 truncate">{q.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: formatCurrency(s?.todayRevenue ?? 0), sub: `${s?.todaySalesCount ?? 0} sales today`, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', href: '/dashboard/finance' },
          { label: 'Active Repairs', value: String(s?.activeRepairs ?? 0), sub: 'Pending completion', icon: Wrench, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', href: '/dashboard/repairs' },
          { label: 'Total Customers', value: String(s?.totalCustomers ?? 0), sub: 'Registered customers', icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', href: '/dashboard/customers' },
          { label: 'Low Stock Items', value: String(s?.lowStockCount ?? 0), sub: 'Need reorder', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', href: '/dashboard/inventory' },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="card p-5 hover:border-violet-500/20 transition-all duration-200 group">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center`}>
                <stat.icon size={17} className={stat.color} />
              </div>
              <ArrowRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-colors mt-1" />
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">{stat.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Revenue & Profit</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 14 days (₹ thousands)</p>
            </div>
            <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">↑ 18.2% vs last period</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#revGrad)" name="Revenue (k)" />
              <Area type="monotone" dataKey="profit" stroke="#06b6d4" strokeWidth={2} fill="url(#profGrad)" name="Profit (k)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Top Products</h3>
            <Link href="/dashboard/inventory" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? topProducts.slice(0, 5).map((p: any, i: number) => (
              <div key={p.productId ?? i} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-4 font-bold">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">{p.productName ?? 'Unknown'}</p>
                  <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" style={{ width: `${Math.min(100, ((p.totalQty ?? 1) / ((topProducts[0] as any)?.totalQty ?? 1)) * 100)}%` }} />
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{p.totalQty ?? 0} sold</span>
              </div>
            )) : (
              <div className="py-6 text-center">
                <Package size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No sales data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Active Repairs</h3>
            <Link href="/dashboard/repairs" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">View all <ArrowRight size={11} /></Link>
          </div>
          <div className="space-y-2.5">
            {repairs.map((repair: RepairTicket) => (
              <div key={repair.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/2 border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Wrench size={14} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{repair.deviceBrand} {repair.deviceModel}</p>
                  <p className="text-xs text-slate-500">{repair.ticketNumber} · {repair.customerName}</p>
                </div>
                <span className={`badge-status border text-[10px] ${getRepairStatusColor(repair.status)}`}>
                  {repair.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
            <Link href="/dashboard/finance" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">View all <ArrowRight size={11} /></Link>
          </div>
          <div className="space-y-2.5">
            {transactions.slice(0, 5).map((tx: AppTransaction) => (
              <div key={tx.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.type === 'INCOME' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {tx.type === 'INCOME' ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{tx.description}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1"><Clock size={10} />{formatRelativeTime(tx.createdAt)}</p>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Low Stock Alert - real data */}
        <div className="card p-4 border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-2.5 mb-2"><Package size={16} className="text-yellow-400" /><span className="text-sm font-semibold text-yellow-300">Low Stock Alert</span></div>
          <p className="text-2xl font-bold text-white mb-1">{s?.lowStockCount ?? 0} {(s?.lowStockCount ?? 0) === 1 ? 'item' : 'items'}</p>
          <p className="text-xs text-slate-500">
            {(s?.lowStockProducts ?? []).length === 0
              ? 'All products are well stocked'
              : (s.lowStockProducts as any[]).slice(0, 2).map((p: any) => p.name).join(', ')
                + ((s.lowStockProducts as any[]).length > 2 ? ` and ${(s.lowStockProducts as any[]).length - 2} more below reorder level` : ' below reorder level')}
          </p>
          <Link href="/dashboard/inventory" className="text-xs text-yellow-400 hover:text-yellow-300 mt-2 inline-flex items-center gap-1">View inventory <ArrowRight size={11} /></Link>
        </div>
        {/* Warranty Expiring - real data */}
        <div className="card p-4 border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center gap-2.5 mb-2"><Shield size={16} className="text-orange-400" /><span className="text-sm font-semibold text-orange-300">Warranty Expiring</span></div>
          <p className="text-2xl font-bold text-white mb-1">{s?.expiringWarranties ?? 0} {(s?.expiringWarranties ?? 0) === 1 ? 'warranty' : 'warranties'}</p>
          <p className="text-xs text-slate-500">
            {(s?.expiringWarranties ?? 0) === 0 ? 'No warranties expiring soon' : 'Expiring within 30 days'}
          </p>
          <Link href="/dashboard/warranty" className="text-xs text-orange-400 hover:text-orange-300 mt-2 inline-flex items-center gap-1">View warranties <ArrowRight size={11} /></Link>
        </div>
        {/* Ready for Pickup - real data */}
        <div className="card p-4 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2.5 mb-2"><Wrench size={16} className="text-blue-400" /><span className="text-sm font-semibold text-blue-300">Ready for Pickup</span></div>
          <p className="text-2xl font-bold text-white mb-1">{s?.readyForPickup ?? 0} {(s?.readyForPickup ?? 0) === 1 ? 'device' : 'devices'}</p>
          <p className="text-xs text-slate-500">
            {(s?.readyForPickup ?? 0) === 0 ? 'No repairs ready for pickup' : 'Repair jobs completed, awaiting pickup'}
          </p>
          <Link href="/dashboard/repairs" className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1">View repairs <ArrowRight size={11} /></Link>
        </div>
      </div>
    </div>
  )
}
