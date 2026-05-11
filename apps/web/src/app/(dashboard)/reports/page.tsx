'use client'

import { useState } from 'react'
import { FileText, Download, TrendingUp, TrendingDown, Package, Users, Wrench, BarChart3, Calendar, ArrowRight, FileDown } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const salesData = [
  { month: 'Dec', revenue: 312, profit: 78 }, { month: 'Jan', revenue: 445, profit: 112 },
  { month: 'Feb', revenue: 378, profit: 95 }, { month: 'Mar', revenue: 521, profit: 130 },
  { month: 'Apr', revenue: 489, profit: 122 }, { month: 'May', revenue: 634, profit: 158 },
]

const topBrands = [
  { brand: 'Apple', units: 45, revenue: 2812000 },
  { brand: 'Samsung', units: 38, revenue: 1956000 },
  { brand: 'OnePlus', units: 22, revenue: 874000 },
  { brand: 'Google', units: 12, revenue: 720000 },
  { brand: 'Xiaomi', units: 29, revenue: 521000 },
]

const reportTypes = [
  { id: 'daily-sales', icon: TrendingUp, title: 'Daily Sales Report', desc: 'Sales, revenue & transactions for today', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { id: 'monthly-sales', icon: BarChart3, title: 'Monthly Sales Report', desc: 'Monthly performance with trends', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { id: 'profit-loss', icon: TrendingDown, title: 'Profit & Loss', desc: 'Revenue, costs, and net profit summary', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { id: 'inventory', icon: Package, title: 'Inventory Report', desc: 'Stock levels, low stock, dead stock', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { id: 'customer', icon: Users, title: 'Customer Analytics', desc: 'Customer acquisition & retention', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'repair', icon: Wrench, title: 'Repair Performance', desc: 'Technician performance & TAT', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
]

const kpis = [
  { label: 'Total Revenue (May)', value: '₹6,34,000', change: '+18.2%', up: true },
  { label: 'Gross Profit', value: '₹1,58,500', change: '+22.4%', up: true },
  { label: 'Avg. Sale Value', value: '₹8,420', change: '+5.1%', up: true },
  { label: 'Return Rate', value: '2.3%', change: '-0.8%', up: true },
]

export default function ReportsPage() {
  const [period, setPeriod] = useState('monthly')
  const [generating, setGenerating] = useState<string | null>(null)

  const handleGenerate = (id: string) => {
    setGenerating(id)
    setTimeout(() => setGenerating(null), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Generate, export and schedule business reports</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-colors ${period === p ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-2">{k.label}</p>
            <p className="text-xl font-bold text-white">{k.value}</p>
            <span className={`text-xs font-medium flex items-center gap-1 mt-1 ${k.up ? 'text-green-400' : 'text-red-400'}`}>
              {k.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{k.change} vs last period
            </span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Revenue & Profit Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 6 months (₹ thousands)</p>
            </div>
            <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 border border-violet-500/20 px-2.5 py-1.5 rounded-lg hover:bg-violet-500/5 transition-colors">
              <FileDown size={12} />Export
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#rg)" name="Revenue (₹k)" />
              <Area type="monotone" dataKey="profit" stroke="#06b6d4" strokeWidth={2} fill="url(#pg)" name="Profit (₹k)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Brands */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Top Selling Brands</h3>
          </div>
          <div className="space-y-3">
            {topBrands.map((b, i) => (
              <div key={b.brand} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-4 font-bold">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{b.brand}</span>
                    <span className="text-slate-500">{b.units} units</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                      style={{ width: `${(b.units / 45) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Generate Reports</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map(r => (
            <div key={r.id} className={`card p-4 border ${r.border} hover:border-opacity-60 transition-all group`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl ${r.bg} border ${r.border} flex items-center justify-center flex-shrink-0`}>
                  <r.icon size={16} className={r.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleGenerate(r.id)}
                  disabled={generating === r.id}
                  className={`flex-1 text-xs py-1.5 px-3 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${r.border} ${r.bg} ${r.color} hover:opacity-80 disabled:opacity-50`}
                >
                  {generating === r.id ? (
                    <span className="animate-pulse">Generating...</span>
                  ) : (
                    <><FileText size={11} />Preview</>
                  )}
                </button>
                <button className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-1.5">
                  <Download size={11} />Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Scheduled Reports</h3>
          <button className="btn-secondary text-xs flex items-center gap-1.5"><Calendar size={12} />Schedule New</button>
        </div>
        <div className="space-y-3">
          {[
            { name: 'Daily Sales Summary', freq: 'Every day at 9:00 PM', recipients: 'owner@shop.com', next: 'Today 9:00 PM', active: true },
            { name: 'Weekly Inventory Report', freq: 'Every Monday 8:00 AM', recipients: 'manager@shop.com', next: 'Mon, 13 May', active: true },
            { name: 'Monthly P&L Report', freq: '1st of every month', recipients: 'accounts@shop.com', next: '1 Jun 2024', active: false },
          ].map(s => (
            <div key={s.name} className="flex items-center gap-4 p-3 rounded-xl bg-white/2 border border-white/5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.active ? 'bg-green-400' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{s.name}</p>
                <p className="text-xs text-slate-500">{s.freq} · To: {s.recipients}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Next: {s.next}</p>
                <span className={`text-[10px] ${s.active ? 'text-green-400' : 'text-slate-500'}`}>{s.active ? 'Active' : 'Paused'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
