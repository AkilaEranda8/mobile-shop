'use client'

import { useMemo, useState } from 'react'
import {
  Wallet, Plus, Loader2, Truck, FileText, CreditCard, CalendarDays, Scale,
} from 'lucide-react'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday, businessMonthStart } from '@/lib/business-date'
import { useSupplierPayments, useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import { RecordPaymentModal } from '@/components/suppliers/suppliers-shared'
import type { PurchaseOrder, Supplier } from '@/types'

export default function SupplierPaymentsPage() {
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null)

  const periodTo = businessToday()
  const periodFrom = businessMonthStart(periodTo)
  const periodParams = { from: periodFrom, to: periodTo }

  const paymentParams = useMemo(() => {
    const p: Record<string, string> = { ...periodParams, limit: '200' }
    if (supplierFilter !== 'all') p.supplierId = supplierFilter
    return p
  }, [periodFrom, periodTo, supplierFilter])

  const { data: payData, loading, refetch } = useSupplierPayments(paymentParams)
  const { data: suppliersData } = useSuppliers()
  const { data: poData, refetch: refetchPOs } = usePurchaseOrders()

  const payments = (payData?.data ?? []) as any[]
  const suppliers = (suppliersData?.data ?? []) as Supplier[]
  const allPOs = (poData?.data ?? []) as PurchaseOrder[]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return payments
    return payments.filter(p =>
      String(p.supplierName ?? '').toLowerCase().includes(q)
      || String(p.purchaseInvoice ?? '').toLowerCase().includes(q)
      || String(p.reference ?? '').toLowerCase().includes(q)
      || String(p.description ?? '').toLowerCase().includes(q),
    )
  }, [payments, search])

  const paidMtd = filtered.reduce((s, p) => s + Number(p.amountPaid ?? 0), 0)
  const outstanding = suppliers.reduce((s, x) => s + Number(x.outstandingDues ?? 0), 0)
  const suppliersWithDue = suppliers.filter(s => Number(s.outstandingDues ?? 0) > 0)

  const openPayFor = (supplierId?: string | null) => {
    const s = suppliers.find(x => x.id === supplierId) ?? suppliersWithDue[0] ?? suppliers[0]
    if (s) setPaySupplier(s)
  }

  return (
    <div className="space-y-6">
      {paySupplier && (
        <RecordPaymentModal
          supplier={paySupplier}
          allPOs={allPOs}
          onClose={() => setPaySupplier(null)}
          onSaved={() => { refetch(); refetchPOs() }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Supplier Payments</h1>
          <p className="page-subtitle">
            Purchase invoice settlements · {periodFrom} → {periodTo}
          </p>
        </div>
        <button
          onClick={() => openPayFor()}
          className="btn-primary flex items-center gap-2 sm:ml-auto"
          disabled={suppliers.length === 0}
        >
          <Plus size={14} /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Paid (MTD)',
            value: formatCurrency(paidMtd),
            icon: <Wallet size={16} />,
            color: '#15803d',
            bg: 'rgba(21,128,61,0.08)',
            border: 'rgba(21,128,61,0.20)',
          },
          {
            label: 'Outstanding Dues',
            value: formatCurrency(outstanding),
            icon: <Scale size={16} />,
            color: '#b91c1c',
            bg: 'rgba(185,28,28,0.08)',
            border: 'rgba(185,28,28,0.20)',
          },
          {
            label: 'Payments (MTD)',
            value: String(filtered.length),
            icon: <CreditCard size={16} />,
            color: 'var(--brand-primary-light)',
            bg: 'var(--brand-glow)',
            border: 'var(--sidebar-active-border)',
          },
          {
            label: 'Suppliers with Due',
            value: String(suppliersWithDue.length),
            icon: <Truck size={16} />,
            color: '#b45309',
            bg: 'rgba(180,83,9,0.08)',
            border: 'rgba(180,83,9,0.20)',
          },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color, background: bg, border: `1px solid ${border}` }}
              >
                {icon}
              </div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <ToolbarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search supplier, invoice, reference…"
          className="flex-1"
        />
        <select
          className="input-field sm:w-56"
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
        >
          <option value="all">All suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
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
                    'Payment Method',
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

      {suppliersWithDue.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Quick pay — open balances
          </p>
          <div className="flex flex-wrap gap-2">
            {suppliersWithDue.slice(0, 8).map(s => (
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
  )
}
