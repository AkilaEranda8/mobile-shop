'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Star, Phone, Mail, MapPin, Eye, Loader2, SlidersHorizontal, X, ShoppingBag, Wrench, CreditCard, Calendar, ChevronRight, Users, User, Hash, MessageSquare, ArrowRight, CheckCircle2, UserPlus, DollarSign, Building2, Wallet, Pencil } from 'lucide-react'
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

/* ── Customer Detail Modal (Sales Details layout) ────────────────────── */
function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { openPos } = usePos()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    customersApi.getById(customerId)
      .then((r: any) => setCustomer(r.data ?? r))
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false))
  }, [customerId])

  const handlePaymentSuccess = () => {
    customersApi.getById(customerId)
      .then((r: any) => setCustomer(r.data ?? r))
      .catch(() => {})
  }

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const sales = customer?.sales ?? []
  const repairs = customer?.repairs ?? []
  const isVip = (customer?.loyaltyPoints ?? 0) > 500
  const hasDue = (customer?.totalDue ?? 0) > 0
  const salesTotal = sales.reduce((s: number, sale: any) => s + Number(sale.total ?? 0), 0)
  const repairsTotal = repairs.reduce((s: number, r: any) => s + Number(r.totalCost ?? 0), 0)
  const location = [customer?.address, customer?.city].filter(Boolean).join(', ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <User size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Customer Details{customer ? <> ( <span className="font-mono">{safeText(customer.name)}</span> )</> : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : safeText(customer?.phone)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {customer && isVip && (
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25 inline-flex items-center gap-1">
                <Star size={10} className="fill-yellow-400 text-yellow-400" /> VIP
              </span>
            )}
            {customer && (
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                hasDue
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
              }`}>
                {hasDue ? 'Outstanding' : 'Clear'}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-violet-400" />
          </div>
        )}

        {!loading && !customer && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Failed to load customer</div>
        )}

        {!loading && customer && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Top meta row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Since:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(formatDate(customer.createdAt))}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(customer.phone)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{safeText(customer.email)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Customer ID:</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{safeText(customer.id?.slice(0, 8))}</span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <User size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Customer name:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(customer.name)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(location)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Loyalty:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{customer.loyaltyPoints ?? 0} pts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Credit status:</span>
                  <span className="font-medium" style={{ color: hasDue ? '#ef4444' : 'var(--text-primary)' }}>
                    {hasDue ? 'Has outstanding' : 'Clear'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>LKR</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Purchases</span>
                    <span className="font-medium">{customer.totalPurchases ?? sales.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Repairs</span>
                    <span className="font-medium">{customer.totalRepairs ?? repairs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Sales value</span>
                    <span className="font-medium">{formatCurrency(salesTotal)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold">Outstanding</span>
                    <span className={`font-semibold ${hasDue ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                      {formatCurrency(customer.totalDue ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales + Repairs + Totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                {/* Sales history */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingBag size={12} /> Sales history
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Items</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((sale: any, idx: number) => (
                          <tr key={sale.id ?? idx} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(sale.invoiceNumber)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{safeText(formatDate(sale.createdAt))}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {sale.items?.length ?? 0} item{(sale.items?.length ?? 0) !== 1 ? 's' : ''}
                              </div>
                              {sale.items?.length > 0 && (
                                <div className="text-[10px] mt-0.5 truncate max-w-[220px]" style={{ color: 'var(--text-muted)' }}>
                                  {sale.items.slice(0, 2).map((i: any) => i.productName).join(', ')}
                                  {sale.items.length > 2 ? ` +${sale.items.length - 2}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                                sale.status === 'PAID' ? 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
                                  : sale.status === 'RETURNED' ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                                    : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                              }`}>
                                {safeText(sale.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{formatCurrency(sale.total ?? 0)}</td>
                          </tr>
                        ))}
                        {sales.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No sales yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Repairs history */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Wrench size={12} /> Repair history
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Ticket</th>
                          <th className="px-3 py-2 text-left">Device</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairs.map((r: any, idx: number) => (
                          <tr key={r.id ?? idx} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(r.ticketNumber)}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {safeText([r.deviceBrand, r.deviceModel].filter(Boolean).join(' '))}
                              </div>
                              {(r.imei || r.issue) && (
                                <div className="text-[10px] mt-0.5 truncate max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
                                  {r.imei ? `IMEI ${r.imei}` : ''}
                                  {r.imei && r.issue ? ' · ' : ''}
                                  {r.issue ? `Issue: ${r.issue}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{safeText(formatDate(r.createdAt))}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${repairStatusColors[r.status] ?? ''}`}>
                                {safeText(r.status?.replace(/_/g, ' '))}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                              {r.totalCost > 0 ? formatCurrency(r.totalCost) : '—'}
                            </td>
                          </tr>
                        ))}
                        {repairs.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No repairs yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Customer note:</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(customer.notes)}</p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Contact:</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                      {safeText(customer.phone)}
                      {customer.email ? ` · ${customer.email}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right totals */}
              <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Summary</p>
                  <p className={`text-[12px] font-semibold ${hasDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(customer.totalDue ?? 0)}
                  </p>
                </div>
                <div className="p-3 text-[12px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Purchases:</span>
                    <span className="font-medium">{customer.totalPurchases ?? sales.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Sales value:</span>
                    <span className="font-medium">{formatCurrency(salesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Repairs:</span>
                    <span className="font-medium">{customer.totalRepairs ?? repairs.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Repair value:</span>
                    <span className="font-medium">{formatCurrency(repairsTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Loyalty points:</span>
                    <span className="font-medium">{customer.loyaltyPoints ?? 0} pts</span>
                  </div>
                  <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Outstanding:</span>
                      <span className={`font-semibold ${hasDue ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {formatCurrency(customer.totalDue ?? 0)}
                      </span>
                    </div>
                    {hasDue && (
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Wallet size={12} /> Pay now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2 flex-wrap">
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
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold"
              >
                <ShoppingBag size={14} />
                New Sale
              </button>
              {hasDue && (
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold"
                >
                  <Wallet size={14} />
                  Pay Outstanding
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && customer && (
        <CreditPaymentModal
          customerId={customerId}
          customerName={customer.name ?? ''}
          outstanding={customer.totalDue ?? 0}
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

/* ── Add / Edit Customer Modal ───────────────────────────────────────── */
function CustomerFormModal({ customer, onClose, onSaved }: {
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = Boolean(customer)
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    city: customer?.city ?? '',
    address: customer?.address ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (customer) {
        await customersApi.update(customer.id, form)
        toast.success('Customer updated')
      } else {
        await customersApi.create(form)
        toast.success('Customer created')
      }
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} customer`) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
              {isEditing ? <Pencil size={18} className="text-violet-500" /> : <UserPlus size={18} className="text-violet-500" />}
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{isEditing ? 'Edit Customer' : 'Add Customer'}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isEditing ? 'Update customer contact information' : 'Register a new customer profile'}
              </p>
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> {isEditing ? 'Update Customer' : 'Save Customer'}</>}
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
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
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
          <TableActionsRow
            showAction={{ action: () => openDetail(row.original.id) }}
            editAction={{ action: () => setEditCustomer(row.original) }}
          />
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
      {showAddModal && <CustomerFormModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {editCustomer && (
        <CustomerFormModal
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={refetch}
        />
      )}
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
