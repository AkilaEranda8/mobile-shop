'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Star, Phone, Mail, MapPin, Eye, Loader2, SlidersHorizontal, X, ShoppingBag, Wrench, CreditCard, Calendar, ChevronRight, Users, User, Hash, MessageSquare, ArrowRight, CheckCircle2, UserPlus, DollarSign, Building2, Wallet } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCustomers, useFeatureFlag } from '@/lib/hooks'
import { customersApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import toast from 'react-hot-toast'
import type { Customer } from '@/types'
import { OpenPosButton } from '@/components/pos/OpenPosButton'
import { usePos } from '@/lib/use-pos'

const repairStatusColors: Record<string, string> = {
  RECEIVED:      'text-blue-400   bg-blue-500/10   border-blue-500/20',
  DIAGNOSING:    'text-purple-400 bg-purple-500/10 border-purple-500/20',
  IN_PROGRESS:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  WAITING_PARTS: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  READY:         'text-teal-400   bg-teal-500/10   border-teal-500/20',
  DELIVERED:     'text-green-400  bg-green-500/10  border-green-500/20',
  CANCELLED:     'text-red-400    bg-red-500/10    border-red-500/20',
}

/* ── Credit Payment Modal ───────────────────────────────────────────── */
function CreditPaymentModal({ customerId, customerName, outstanding, onClose, onSuccess }: {
  customerId: string; customerName: string; outstanding: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (outstanding > 0) setAmount(String(outstanding))
  }, [outstanding])

  const branchId = getActiveBranchId() ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    if (amt > outstanding) { setError('Amount cannot exceed outstanding balance'); return }
    setLoading(true); setError('')
    try {
      const res: any = await customersApi.creditPayment(customerId, {
        amount: amt,
        paymentMethod,
        branchId,
        performedBy: authStorage.getUser()?.name || 'Staff',
      })
      const data = res?.data ?? res
      const refs = [
        ...(data?.allocations?.map((a: { invoiceNumber: string }) => a.invoiceNumber) ?? []),
        ...(data?.collectionInvoice ? [data.collectionInvoice] : []),
      ]
      toast.success(
        refs.length
          ? `Payment recorded — updated: ${refs.join(', ')}`
          : 'Payment recorded',
      )
      onSuccess(); onClose()
    } catch (err: any) { setError(err.message || 'Payment failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-md shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <DollarSign size={14} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pay Outstanding</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Outstanding Balance</label>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(outstanding)}</div>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Payment Amount</label>
            <input
              type="number" step="0.01" min="0" max={outstanding}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:border-violet-500 transition-colors"
              style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['CASH', 'CARD', 'BANK_TRANSFER', 'WALLET'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    paymentMethod === m
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                      : 'hover:bg-violet-500/5'
                  }`}
                  style={paymentMethod !== m ? { borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' } : {}}
                >
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-colors" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <><Loader2 size={12} className="animate-spin" /> Processing</> : <><DollarSign size={12} /> Pay</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Customer Detail Modal ───────────────────────────────────────────── */
function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { openPos } = usePos()
  const [customer,  setCustomer]  = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<'info' | 'history'>('info')
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    customersApi.getById(customerId)
      .then((r: any) => setCustomer(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  const handlePaymentSuccess = () => {
    customersApi.getById(customerId)
      .then((r: any) => setCustomer(r.data ?? r))
      .catch(() => {})
  }

  const sales   = customer?.sales   ?? []
  const repairs = customer?.repairs ?? []

  const history = [
    ...sales.map((s: any)  => ({ ...s, _type: 'sale'   as const, _date: s.createdAt })),
    ...repairs.map((r: any) => ({ ...r, _type: 'repair' as const, _date: r.createdAt })),
  ].sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime())

  const TABS = [
    { key: 'info',    label: 'Profile', icon: Users,    count: null },
    { key: 'history', label: 'History', icon: Calendar, count: history.length },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Customer Profile</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-violet-400" />
          </div>
        )}

        {!loading && customer && (
          <>
            {/* Tab Bar */}
            <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.key
                      ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                      : 'hover:bg-violet-500/5'
                  }`}
                  style={tab !== t.key ? { color: 'var(--text-muted)' } : {}}>
                  <t.icon size={11} />
                  {t.label}
                  {t.count !== null && (
                    <span className={`text-[10px] px-1.5 rounded-full ${tab === t.key ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-slate-600'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-5 space-y-4 flex-1">

              {/* ── Profile Tab ── */}
              {tab === 'info' && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border border-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-300 flex-shrink-0">
                      {customer.name?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-gray-900 dark:text-white">{customer.name}</p>
                        {customer.loyaltyPoints > 500 && (
                          <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">
                            <Star size={8} className="fill-yellow-400" />VIP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Customer since {formatDate(customer.createdAt)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 mb-1"><Phone size={12} className="text-violet-500" /><span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Phone</span></div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{customer.phone}</p>
                    </div>
                    <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 mb-1"><Mail size={12} className="text-violet-500" /><span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Email</span></div>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{customer.email || '—'}</p>
                    </div>
                    <div className="rounded-xl p-3 border col-span-2" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 mb-1"><MapPin size={12} className="text-violet-500" /><span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Location</span></div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{[customer.address, customer.city].filter(Boolean).join(', ') || '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: ShoppingBag, label: 'Purchases',   value: customer.totalPurchases,            color: 'text-green-500',  clickable: false },
                      { icon: Wrench,      label: 'Repairs',     value: customer.totalRepairs,               color: 'text-cyan-500',   clickable: false },
                      { icon: Star,        label: 'Points',      value: `${customer.loyaltyPoints} pts`,     color: 'text-yellow-500', clickable: false },
                      { icon: CreditCard,  label: 'Outstanding', value: formatCurrency(customer.totalDue),   color: 'text-red-500',    clickable: customer.totalDue > 0 },
                    ].map(s => (
                      <button
                        key={s.label}
                        type="button"
                        disabled={!s.clickable}
                        onClick={() => s.clickable && setShowPaymentModal(true)}
                        className={`rounded-xl p-3 border text-center transition-colors ${
                          s.clickable ? 'cursor-pointer hover:border-green-500/50 hover:bg-green-500/5 ring-1 ring-transparent hover:ring-green-500/30' : 'cursor-default'
                        }`}
                        style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                      >
                        <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
                        <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {s.label}{s.clickable ? ' · Tap to pay' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      openPos({
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                        totalDue: customer.totalDue,
                      })
                      onClose()
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors"
                    style={{ background: 'var(--brand-gradient)' }}
                  >
                    <ShoppingBag size={12} /> New Sale for {customer.name?.split(' ')[0]}
                  </button>
                  {customer.totalDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                      <Wallet size={12} /> Pay Outstanding ({formatCurrency(customer.totalDue)})
                    </button>
                  )}
                  {customer.notes && (
                    <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{customer.notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── History Tab (Sales + Repairs combined) ── */}
              {tab === 'history' && (
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">No history found</div>
                  ) : history.map((entry: any) => (
                    entry._type === 'sale' ? (
                      <div key={`s-${entry.id}`} className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag size={10} className="text-violet-400" />
                            </div>
                            <span className="text-xs font-mono text-violet-400">{entry.invoiceNumber}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                            entry.status === 'PAID'     ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                            entry.status === 'RETURNED' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'   :
                            'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                          }`}>{entry.status}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-slate-400">{entry.items?.length ?? 0} item{(entry.items?.length ?? 0) !== 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5"><Calendar size={9} />{formatDate(entry.createdAt)}</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(entry.total)}</p>
                        </div>
                        {entry.items?.length > 0 && (
                          <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            {entry.items.map((item: any) => (
                              <p key={item.id} className="text-[10px] text-slate-500 flex justify-between">
                                <span>{item.productName} × {item.quantity}</span>
                                <span>{formatCurrency(item.total)}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key={`r-${entry.id}`} className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                              <Wrench size={10} className="text-cyan-400" />
                            </div>
                            <span className="text-xs font-mono text-cyan-400">{entry.ticketNumber}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${repairStatusColors[entry.status] ?? ''}`}>
                            {entry.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{entry.deviceBrand} {entry.deviceModel}</p>
                        {entry.imei && <p className="text-[10px] font-mono text-slate-500">IMEI: {entry.imei}</p>}
                        {entry.issue && <p className="text-[10px] text-slate-500 mt-0.5 truncate">Issue: {entry.issue}</p>}
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] text-slate-600 flex items-center gap-1"><Calendar size={9} />{formatDate(entry.createdAt)}</p>
                          {entry.totalCost > 0 && <p className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(entry.totalCost)}</p>}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

            </div>
          </>
        )}

        {!loading && !customer && (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Failed to load customer</div>
        )}
      </div>
      {showPaymentModal && (
        <CreditPaymentModal
          customerId={customerId}
          customerName={customer?.name ?? ''}
          outstanding={customer?.totalDue ?? 0}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}

/* ── Segment Dropdown ────────────────────────────────────────────────── */
const SEGMENTS = [
  { key: 'all',         label: 'All Customers',     filter: (_: Customer) => true },
  { key: 'vip',         label: 'VIP (500+ pts)',     filter: (c: Customer) => c.loyaltyPoints >= 500 },
  { key: 'active',      label: 'Active Buyers',      filter: (c: Customer) => c.totalPurchases >= 3 },
  { key: 'repair_only', label: 'Repair Customers',   filter: (c: Customer) => c.totalRepairs > 0 && c.totalPurchases === 0 },
  { key: 'outstanding', label: 'Has Outstanding',    filter: (c: Customer) => c.totalDue > 0 },
  { key: 'new',         label: 'New (≤30 days)',      filter: (c: Customer) => {
    const d = new Date(c.createdAt)
    return (Date.now() - d.getTime()) / 86400000 <= 30
  }},
]

/* ── Add Customer Modal ──────────────────────────────────────────────── */
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await customersApi.create(form)
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create customer') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
              <UserPlus size={18} className="text-violet-500" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Add Customer</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Register a new customer profile</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Full Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required className="input-field pl-10 h-11" placeholder="Enter full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Phone <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input required className="input-field pl-10 h-11" placeholder="077 123 4567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input-field pl-10 h-11" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* City + Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>City</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input-field pl-10 h-11" placeholder="Colombo" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Address</label>
              <input className="input-field h-11" placeholder="Street address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-xl border text-sm font-semibold transition-colors" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'var(--brand-gradient)' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Save Customer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function CustomersPage() {
  const searchParams = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [payCustomerId, setPayCustomerId] = useState<string | null>(null)
  const [segment, setSegment] = useState('all')
  const [textSearch, setTextSearch] = useState('')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  const { data: customersData, loading, refetch } = useCustomers()
  const customers: Customer[] = (customersData?.data ?? []) as Customer[]

  useEffect(() => {
    const onSale = () => { refetch() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [refetch])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add' || searchParams.get('new') === '1') setShowAddModal(true)
    const id = searchParams.get('customerId') || searchParams.get('id')
    if (id) setDetailId(id)
    const q = searchParams.get('q')
    if (q) setTextSearch(q)
  }, [searchParams])

  const openDetail = useCallback((id: string) => setDetailId(id), [])

  const activeSeg = SEGMENTS.find(s => s.key === segment) ?? SEGMENTS[0]
  const segmentFiltered = useMemo(() => {
    let rows = customers.filter(activeSeg.filter)
    const q = textSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q)
    )
  }, [customers, activeSeg, textSearch])

  const totalDue       = customers.reduce((s, c) => s + c.totalDue, 0)
  const totalPurchases = customers.reduce((s, c) => s + c.totalPurchases, 0)

  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
            {row.original.name.charAt(0)}
          </div>
          <div>
            <button
              type="button"
              className="text-sm font-bold text-gray-800 dark:text-slate-200 hover:text-violet-600 dark:hover:text-violet-400 text-left transition-colors"
              onClick={() => openDetail(row.original.id)}
            >
              {row.original.name}
            </button>
            {row.original.loyaltyPoints >= 500 && (
              <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                <Star size={9} className="fill-yellow-400" />VIP
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-slate-400"><Phone size={10} />{row.original.phone}</span>
          {row.original.email && <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-500"><Mail size={10} />{row.original.email}</span>}
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
      cell: ({ row }) => <span className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-slate-400"><MapPin size={10} />{row.original.city || '—'}</span>,
    },
    {
      accessorKey: 'totalPurchases',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Purchases" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-green-400">{row.original.totalPurchases}</span>,
    },
    {
      accessorKey: 'loyaltyPoints',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Points" />,
      cell: ({ row }) => <span className="text-xs text-violet-400 font-semibold">{row.original.loyaltyPoints} pts</span>,
    },
    {
      accessorKey: 'totalDue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
      cell: ({ row }) => (
        <span className={`text-xs font-bold ${row.original.totalDue > 0 ? 'text-red-400' : 'text-slate-500'}`}>
          {formatCurrency(row.original.totalDue)}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
      cell: ({ row }) => <span className="text-xs font-medium text-gray-500 dark:text-slate-500">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {row.original.totalDue > 0 && (
            <button
              type="button"
              onClick={() => setPayCustomerId(row.original.id)}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30"
            >
              Pay
            </button>
          )}
          <TableActionsRow showAction={{ action: () => openDetail(row.original.id) }} />
        </div>
      ),
    },
  ], [openDetail])

  /* close segment dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="space-y-6">
      {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {detailId     && <CustomerDetailModal customerId={detailId} onClose={() => setDetailId(null)} />}
      {payCustomerId && (() => {
        const c = customers.find(x => x.id === payCustomerId)
        if (!c || c.totalDue <= 0) return null
        return (
          <CreditPaymentModal
            customerId={c.id}
            customerName={c.name}
            outstanding={c.totalDue}
            onClose={() => setPayCustomerId(null)}
            onSuccess={() => { setPayCustomerId(null); refetch() }}
          />
        )
      })()}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered · <span className="text-violet-400">{activeSeg.label}</span></p>
        </div>
        <div className="flex gap-2 sm:ml-auto items-center relative" ref={segmentRef}>
          <OpenPosButton label="POS Terminal" variant="secondary" />
          <button
            onClick={() => setShowSegment(v => !v)}
            className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-violet-500/40 text-violet-300' : ''}`}
          >
            <SlidersHorizontal size={14} />Segment
            {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
          </button>

          {showSegment && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">Filter by segment</p>
              {SEGMENTS.filter(s => hasCustomerCredit || s.key !== 'outstanding').map(s => (
                <button
                  key={s.key}
                  onClick={() => { setSegment(s.key); setShowSegment(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${segment === s.key ? 'text-violet-300' : 'text-slate-400'}`}
                >
                  <span>{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">{customers.filter(s.filter).length}</span>
                    {segment === s.key && <ChevronRight size={12} className="text-violet-400" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers',   value: customers.length.toString(),                                     icon: Users,       color: 'violet' },
          ...(hasCustomerCredit ? [{ label: 'Total Outstanding', value: formatCurrency(totalDue), icon: CreditCard, color: 'red' as const }] : []),
          { label: 'Total Purchases',   value: totalPurchases.toString(),                                       icon: ShoppingBag, color: 'blue'   },
          { label: 'VIP Members',       value: customers.filter(c => c.loyaltyPoints >= 500).length.toString(), icon: Star,        color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          placeholder="Search name, phone, email…"
          className="w-full sm:w-auto sm:min-w-[220px]"
        />
        <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
          {SEGMENTS.filter(s => hasCustomerCredit || s.key !== 'outstanding').map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
              style={segment === s.key
                ? { background: 'var(--brand-primary-light)', color: '#fff' }
                : { color: 'var(--text-muted)' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <ClientSideTable
        data={segmentFiltered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((segmentFiltered.length || 1) / 20)}
        searchableColumns={[]}
      />
    </div>
  )
}
