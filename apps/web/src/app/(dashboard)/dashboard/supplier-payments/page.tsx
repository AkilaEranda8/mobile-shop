'use client'

import { useMemo, useState } from 'react'
import {
  Wallet, Plus, Loader2, Truck, FileText, CreditCard, CalendarDays, Scale,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday, businessMonthStart } from '@/lib/business-date'
import { useSupplierPayments, useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import { RecordPaymentModal } from '@/components/suppliers/suppliers-shared'
import type { PurchaseOrder, Supplier } from '@/types'
import { authStorage } from '@/lib/auth'

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}

export default function SupplierPaymentsPage() {
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null)
  const role = authStorage.getUser()?.role ?? ''
  const canRecordPayment = role === 'OWNER' || role === 'MANAGER'

  const periodTo = businessToday()
  const periodFrom = businessMonthStart(periodTo)

  const paymentParams = useMemo(() => {
    const p: Record<string, string> = { from: periodFrom, to: periodTo, limit: '200' }
    if (supplierFilter !== 'all') p.supplierId = supplierFilter
    return p
  }, [periodFrom, periodTo, supplierFilter])

  const { data: payData, loading, refetch } = useSupplierPayments(paymentParams)
  const { data: suppliersData, refetch: refetchSuppliers } = useSuppliers()
  const { data: poData, refetch: refetchPOs } = usePurchaseOrders()

  const payments = (payData?.data ?? []) as any[]
  const suppliers = (suppliersData?.data ?? []) as Supplier[]
  const allPOs = (poData?.data ?? []) as PurchaseOrder[]

  const methods = useMemo(() => {
    const set = new Set<string>()
    for (const p of payments) if (p.paymentMethod) set.add(String(p.paymentMethod))
    return Array.from(set)
  }, [payments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter(p => {
      if (methodFilter !== 'all' && String(p.paymentMethod) !== methodFilter) return false
      if (!q) return true
      return String(p.supplierName ?? '').toLowerCase().includes(q)
        || String(p.purchaseInvoice ?? '').toLowerCase().includes(q)
        || String(p.reference ?? '').toLowerCase().includes(q)
        || String(p.description ?? '').toLowerCase().includes(q)
    })
  }, [payments, search, methodFilter])

  const paidMtd = payments.reduce((s, p) => s + Number(p.amountPaid ?? 0), 0)
  const outstanding = suppliers.reduce((s, x) => s + Number(x.outstandingDues ?? 0), 0)
  const suppliersWithDue = suppliers.filter(s => Number(s.outstandingDues ?? 0) > 0)

  const supplierTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments) {
      const name = String(p.supplierName ?? 'Unknown')
      map.set(name, (map.get(name) ?? 0) + Number(p.amountPaid ?? 0))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [payments])

  const totalPaidAll = supplierTotals.reduce((s, r) => s + r.total, 0)
  const pieData = supplierTotals.slice(0, 8).map((r, i) => ({
    name: r.name, value: r.total, fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const openPayFor = (supplierId?: string | null) => {
    const s = suppliers.find(x => x.id === supplierId) ?? suppliersWithDue[0] ?? suppliers[0]
    if (s) setPaySupplier(s)
  }

  return (
    <div className="space-y-6">
      {paySupplier && canRecordPayment && (
        <RecordPaymentModal
          supplier={paySupplier}
          allPOs={allPOs}
          onClose={() => setPaySupplier(null)}
          onSaved={() => { refetch(); refetchPOs(); refetchSuppliers() }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Supplier Payments</h1>
          <p className="page-subtitle">Purchase invoice settlements this month ({periodFrom} → {periodTo})</p>
        </div>
        {canRecordPayment && (
          <button
            onClick={() => openPayFor()}
            className="btn-primary flex items-center gap-2 sm:ml-auto"
            disabled={suppliers.length === 0}
          >
            <Plus size={14} /> Record Payment
          </button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Paid (MTD)', value: formatCurrency(paidMtd), icon: <Wallet size={16} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.20)' },
          { label: 'Outstanding Dues', value: formatCurrency(outstanding), icon: <Scale size={16} />, color: '#b91c1c', bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.20)' },
          { label: 'Payments (MTD)', value: String(payments.length), icon: <CreditCard size={16} />, color: 'var(--brand-primary-light)', bg: 'var(--brand-glow)', border: 'var(--sidebar-active-border)' },
          { label: 'Suppliers with Due', value: String(suppliersWithDue.length), icon: <Truck size={16} />, color: '#b45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.20)' },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── By Supplier breakdown ── */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>By Supplier</h3>
          {supplierTotals.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No payment data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {supplierTotals.slice(0, 8).map((r, i) => (
                  <div key={r.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                      </div>
                      <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.total)}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="h-full rounded-full" style={{ width: `${totalPaidAll > 0 ? (r.total / totalPaidAll) * 100 : 0}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {canRecordPayment && suppliersWithDue.length > 0 && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="text-[11px] font-semibold mb-2.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Quick pay — open balances
              </p>
              <div className="flex flex-wrap gap-2">
                {suppliersWithDue.slice(0, 6).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPaySupplier(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    {s.name}
                    <span className="ml-1.5 text-rose-500 font-semibold">{formatCurrency(s.outstandingDues ?? 0)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Payment register ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <ToolbarSearch
              value={search}
              onChange={setSearch}
              placeholder="Search supplier, invoice, reference…"
              className="flex-1"
            />
            <select
              className="input-field sm:w-48"
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
            >
              <option value="all">All suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              className="input-field sm:w-40"
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
            >
              <option value="all">All methods</option>
              {methods.map(m => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="animate-spin text-violet-400" size={22} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Wallet size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No supplier payments this period</p>
                <button onClick={() => openPayFor()} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
                  <Plus size={14} /> Record first payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {[
                        'Supplier',
                        'Purchase Invoice',
                        'Amount Paid',
                        'Method',
                        'Payment Date',
                        'Balance Due',
                      ].map(h => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p: any) => (
                      <tr
                        key={p.id}
                        className="hover:bg-white/2 transition-colors"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                            >
                              <Truck size={14} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {p.supplierName || '—'}
                              </p>
                              {p.reference && (
                                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                  Ref: {p.reference}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                            <FileText size={13} />
                            <span className="font-mono text-xs">{p.purchaseInvoice || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.amountPaid ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                          >
                            <CreditCard size={10} />
                            {String(p.paymentMethod ?? '').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={12} />
                            {formatDate(p.paymentDate)}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 font-medium whitespace-nowrap ${
                            Number(p.balanceDue ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : ''
                          }`}
                          style={Number(p.balanceDue ?? 0) <= 0 ? { color: 'var(--text-muted)' } : undefined}
                        >
                          {formatCurrency(p.balanceDue ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
