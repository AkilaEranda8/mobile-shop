'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Star, Phone, Mail, MapPin, Eye, Loader2, SlidersHorizontal, X, ShoppingBag, Wrench, CreditCard, Calendar, ChevronRight, Users, User, Hash, MessageSquare, ArrowRight, CheckCircle2, UserPlus, DollarSign, Building2, Wallet, Pencil, Banknote, ClipboardList, CheckCircle, ArrowUpDown, RotateCcw } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCustomers, useFeatureFlag } from '@/lib/hooks'
import { customersApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { useCanEditModule, useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import toast from 'react-hot-toast'
import type { Customer } from '@/types'
import { OpenPosButton } from '@/components/pos/OpenPosButton'
import { usePos } from '@/lib/use-pos'
import { usePaymentMethods, type PaymentMethodKey } from '@/lib/payment-methods'
import { ChequeDetailsFields, ChequePaymentMeta, formatChequeReference, todayChequeDate } from '@/components/payments/ChequeDetailsFields'
import { datetimeLocalMaxNow, clampDatetimeLocalToNow } from '@/lib/business-date'
import { whatsappApi, formatWhatsAppPhone } from '@/lib/whatsapp-api'
import { PageHeader, StatCard, StatGrid, FilterBar, SegmentedControl } from '@/components/design-system'

const repairStatusColors: Record<string, string> = {
  RECEIVED:      'text-blue-400   bg-blue-500/10   border-blue-500/20',
  DIAGNOSING:    'text-brand-400 bg-brand-500/10 border-brand-500/20',
  IN_PROGRESS:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  WAITING_PARTS: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  READY:         'text-teal-400   bg-teal-500/10   border-teal-500/20',
  DELIVERED:     'text-green-400  bg-green-500/10  border-green-500/20',
  CANCELLED:     'text-red-400    bg-red-500/10    border-red-500/20',
}

/* ── Credit Payment Modal (supplier Record Payment layout) ───────────── */
type UnpaidInvoice = {
  id: string
  invoiceNumber: string
  createdAt: string
  total: number
  paidAmount: number
  dueAmount: number
  status: string
}

function CreditPaymentModal({ customerId, customerName, customerPhone, outstanding, onClose, onSuccess }: {
  customerId: string
  customerName: string
  customerPhone?: string
  outstanding: number
  onClose: () => void
  onSuccess: () => void
}) {
  const { canEdit } = useModuleAccess()
  const [invoices, setInvoices] = useState<UnpaidInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [amount, setAmount] = useState('')
  const [discount, setDiscount] = useState('')
  const [reference, setReference] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('CASH')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeDate, setChequeDate] = useState(todayChequeDate)
  const [paymentAt, setPaymentAt] = useState('')
  const payMethods = usePaymentMethods()
  const paymentMethod: PaymentMethodKey = payMethods.find(m => m.id === paymentMethodId)?.key
    ?? payMethods.find(m => m.key === paymentMethodId)?.key
    ?? 'CASH'
  const methodLabel = payMethods.find(m => m.id === paymentMethodId)?.label
    ?? payMethods.find(m => m.key === paymentMethodId)?.label
    ?? paymentMethod.replace(/_/g, ' ')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoadingInvoices(true)
    setLoadError('')
    customersApi.unpaidInvoices(customerId)
      .then((res: any) => {
        if (!alive) return
        const rows = (res?.data?.invoices ?? res?.invoices ?? []) as UnpaidInvoice[]
        setInvoices(rows)
        setSelectedIds(new Set(rows.map(r => r.id)))
      })
      .catch((err: any) => {
        if (!alive) return
        setLoadError(err?.message || 'Failed to load unpaid invoices')
      })
      .finally(() => { if (alive) setLoadingInvoices(false) })
    return () => { alive = false }
  }, [customerId])

  const selectedList = invoices.filter(inv => selectedIds.has(inv.id))
  const totalDue = selectedList.reduce((s, inv) => s + Number(inv.dueAmount ?? 0), 0)
  const totalInvoiceValue = selectedList.reduce((s, inv) => s + Number(inv.total ?? 0), 0)
  const listedOutstanding = totalDue > 0 ? totalDue : Math.max(0, Number(outstanding) || 0)

  useEffect(() => {
    if (totalDue > 0) setAmount(totalDue.toFixed(2))
    else setAmount('')
  }, [totalDue])

  useEffect(() => {
    setPaymentMethodId(prev => payMethods.some(m => m.id === prev || m.key === prev)
      ? (payMethods.find(m => m.id === prev)?.id ?? payMethods.find(m => m.key === prev)?.id ?? 'CASH')
      : 'CASH')
  }, [payMethods])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggleInvoice = (id: string) =>
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const selectAll = () => setSelectedIds(new Set(invoices.map(inv => inv.id)))
  const clearAll = () => setSelectedIds(new Set())

  const settleTarget = parseFloat(amount) || 0
  const discountAmt = parseFloat(discount) || 0
  const cashAmt = Math.max(0, Math.round((settleTarget - discountAmt) * 100) / 100)
  const remainingAfter = Math.max(0, Math.round((listedOutstanding - settleTarget) * 100) / 100)
  const branchId = getActiveBranchId() ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      viewOnlyToast('customers')
      return
    }
    if (selectedIds.size === 0 || totalDue <= 0) {
      setError('Select at least one unpaid invoice')
      return
    }
    if (settleTarget < 0 || discountAmt < 0) { setError('Amount and discount cannot be negative'); return }
    if (settleTarget <= 0) { setError('Enter a payment amount'); return }
    if (discountAmt > settleTarget + 0.001) { setError('Discount cannot exceed payment amount'); return }
    if (settleTarget > totalDue + 0.001) { setError(`Payment cannot exceed ${formatCurrency(totalDue)}`); return }
    if (paymentMethod === 'CHEQUE' && !chequeNumber.trim()) {
      setError('Enter cheque number')
      return
    }
    setLoading(true); setError('')
    try {
      const chequeRef = paymentMethod === 'CHEQUE'
        ? formatChequeReference(chequeNumber, chequeDate)
        : ''
      const res: any = await customersApi.creditPayment(customerId, {
        amount: cashAmt,
        discount: discountAmt > 0 ? discountAmt : undefined,
        note: reference.trim() || undefined,
        reference: chequeRef || (paymentMethod !== 'CHEQUE' ? reference.trim() || undefined : undefined),
        paymentMethod,
        branchId,
        performedBy: authStorage.getUser()?.name || 'Staff',
        saleIds: [...selectedIds],
        ...(paymentAt.trim() ? { paymentAt: paymentAt.trim() } : {}),
      })
      const data = res?.data ?? res
      const refs = [
        ...(data?.allocations?.map((a: { invoiceNumber: string }) => a.invoiceNumber) ?? []),
        ...(data?.collectionInvoice ? [data.collectionInvoice] : []),
      ]
      const parts = [
        refs.length ? `updated: ${refs.join(', ')}` : null,
        data?.discount > 0 ? `discount ${formatCurrency(data.discount)}` : null,
      ].filter(Boolean)
      toast.success(parts.length ? `Payment recorded — ${parts.join(' · ')}` : 'Payment recorded')
      onSuccess(); onClose()
    } catch (err: any) { setError(err.message || 'Payment failed') }
    finally { setLoading(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}
            >
              <Banknote size={16} className="text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Record Payment
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {customerName}
                {customerPhone ? ` · ${customerPhone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                loadingInvoices
                  ? 'bg-slate-500/15 text-slate-500 border-slate-500/25'
                  : totalDue > 0
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
              }`}
            >
              {loadingInvoices ? 'Loading…' : totalDue > 0 ? `${formatCurrency(totalDue)} due` : 'Settled'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={e => {
            // Don't submit on Enter from inputs — user must click Record Payment
            if (e.key !== 'Enter') return
            const tag = (e.target as HTMLElement)?.tagName
            if (tag === 'TEXTAREA' || tag === 'BUTTON') return
            e.preventDefault()
          }}
          className="p-4 sm:p-5 space-y-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 space-y-1.5 text-[12px]">
              <div className="flex items-center gap-1.5">
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{customerName}</span>
              </div>
              {customerPhone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{customerPhone}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <ClipboardList size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Open invoices:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {selectedList.length} selected / {invoices.length} unpaid
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Method:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{methodLabel}</span>
              </div>
            </div>

            <div
              className="rounded-lg border p-3 text-[12px]"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
            >
              <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>LKR</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Invoice value</span>
                  <span className="font-medium">{formatCurrency(totalInvoiceValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Outstanding</span>
                  <span className="font-medium text-red-500">{formatCurrency(totalDue)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold">Paying now</span>
                  <span className="font-semibold accent-text">{formatCurrency(settleTarget)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Cash to collect</span>
                    <span className="font-medium">{formatCurrency(cashAmt)}</span>
                  </div>
                )}
                {settleTarget > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Remaining after</span>
                    <span className="font-semibold" style={{ color: remainingAfter > 0 ? '#ef4444' : '#15803d' }}>
                      {formatCurrency(remainingAfter)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between gap-2">
              <span>Apply to Invoices</span>
              {invoices.length > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-medium normal-case tracking-normal">
                  <button type="button" onClick={selectAll} className="hover:underline opacity-90">Select all</button>
                  <span className="opacity-50">·</span>
                  <button type="button" onClick={clearAll} className="hover:underline opacity-90">Clear</button>
                </div>
              )}
            </div>

            {loadingInvoices ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin" /> Loading unpaid invoices…
              </div>
            ) : loadError ? (
              <div className="px-4 py-6 text-sm text-red-500">{loadError}</div>
            ) : invoices.length > 0 ? (
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                    <tr style={{ color: 'var(--text-secondary)' }}>
                      <th className="px-3 py-2 text-left w-10" />
                      <th className="px-3 py-2 text-left">Invoice</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const selected = selectedIds.has(inv.id)
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => toggleInvoice(inv.id)}
                          className="border-b last:border-0 cursor-pointer transition-colors"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            background: selected ? 'var(--sidebar-active-bg)' : 'transparent',
                          }}
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleInvoice(inv.id)}
                              onClick={e => e.stopPropagation()}
                              className="accent-[var(--brand-primary)]"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-semibold accent-text">{inv.invoiceNumber}</span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                            {inv.createdAt ? formatDate(inv.createdAt) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {formatCurrency(inv.total)}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-red-500">
                            {formatCurrency(inv.dueAmount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-4 py-5">
                <CheckCircle size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <p>No outstanding invoices for this branch. There is no balance to settle.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Amount Paid</label>
                {totalDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(totalDue.toFixed(2))}
                    className="text-[11px] font-semibold accent-text hover:underline"
                  >
                    Fill {formatCurrency(totalDue)}
                  </button>
                )}
              </div>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                className="input-field font-semibold tabular-nums"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {totalDue > 0 && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Balance due on selected invoices: {formatCurrency(Math.max(0, totalDue - settleTarget))}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Discount <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-field tabular-nums"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="Reduces cash to collect"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Payment Date &amp; Time <span style={{ color: 'var(--text-muted)' }}>(optional · past only)</span>
              </label>
              <input
                type="datetime-local"
                className="input-field"
                value={paymentAt}
                max={datetimeLocalMaxNow()}
                onChange={e => setPaymentAt(clampDatetimeLocalToNow(e.target.value))}
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Leave blank to use current date &amp; time. Future dates are not allowed.
              </p>
            </div>

            {paymentMethod !== 'CHEQUE' && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Reference / Note <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  className="input-field"
                  placeholder="Bank ref…"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Payment Method
            </label>
            <div className={`grid gap-1.5 ${payMethods.length <= 3 ? 'grid-cols-3' : payMethods.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {payMethods.map(({ id, label }) => {
                const active = paymentMethodId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethodId(id)}
                    className="py-2 px-2 text-[10px] font-semibold rounded-lg border transition-colors"
                    style={active
                      ? {
                          background: 'var(--sidebar-active-bg)',
                          borderColor: 'var(--sidebar-active-border)',
                          color: 'var(--sidebar-active-text)',
                        }
                      : {
                          background: 'var(--bg-subtle)',
                          borderColor: 'var(--border-default)',
                          color: 'var(--text-muted)',
                        }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {paymentMethod === 'CHEQUE' && (
            <ChequeDetailsFields
              chequeNumber={chequeNumber}
              chequeDate={chequeDate}
              onNumberChange={setChequeNumber}
              onDateChange={setChequeDate}
              description={reference}
              onDescriptionChange={setReference}
            />
          )}

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <div
            className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading
                || loadingInvoices
                || !amount
                || settleTarget <= 0
                || selectedIds.size === 0
                || settleTarget > totalDue + 0.001
              }
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
              {loading ? 'Recording…' : 'Record Payment'}
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
  const { canEdit } = useModuleAccess()
  const hasWhatsApp = useFeatureFlag('WHATSAPP')
  const canEditWhatsApp = useCanEditModule('WHATSAPP')
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [detailTab, setDetailTab] = useState<'overview' | 'hirePurchase'>('overview')
  const [waReminderSending, setWaReminderSending] = useState(false)

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

  const sendCreditWhatsAppReminder = useCallback(async () => {
    if (!hasWhatsApp || !canEditWhatsApp) return
    if (!customer) return
    const phone = formatWhatsAppPhone(customer.phone ?? '')
    const due = Number(customer.totalDue ?? 0)
    if (!phone) { toast.error('Customer phone required for WhatsApp reminder'); return }
    if (!due || due <= 0) { toast.error('No outstanding balance'); return }

    setWaReminderSending(true)
    try {
      const st: any = await whatsappApi.getStatus()
      const wa = st?.data ?? st
      if (wa?.status !== 'connected') {
        toast.error('WhatsApp not connected — open WhatsApp → Connection and scan QR code')
        return
      }
      if (wa?.enabled === false) {
        toast.error('WhatsApp is disabled — turn on the switch in WhatsApp → Connection')
        return
      }

      const custName = customer?.name ? String(customer.name) : 'Customer'
      const message =
        `Dear ${custName}, this is a reminder about your outstanding balance of LKR ${formatCurrency(due)}. ` +
        'Please settle at your earliest. Thank you.'

      await whatsappApi.sendMessage({
        phone,
        message,
        customerName: custName,
        referenceId: `OUTSTANDING-${customer?.id ?? customerId}`,
        type: 'custom',
        amount: due,
      })
      toast.success('WhatsApp reminder sent')
    } catch (e: any) {
      toast.error(e?.message ?? 'WhatsApp reminder send failed')
    } finally {
      setWaReminderSending(false)
    }
  }, [canEditWhatsApp, customer, customerId, hasWhatsApp])

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const sales = customer?.sales ?? []
  const repairs = customer?.repairs ?? []
  const hpAgreements = customer?.hirePurchaseAgreements ?? []
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
            <User size={16} className="text-brand-500 mt-0.5 flex-shrink-0" />
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
            <Loader2 size={24} className="animate-spin text-brand-400" />
          </div>
        )}

        {!loading && !customer && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Failed to load customer</div>
        )}

        {!loading && customer && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <button type="button" onClick={() => setDetailTab('overview')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${detailTab === 'overview' ? 'bg-brand-500/15 text-brand-600' : ''}`}>Overview</button>
              <button type="button" onClick={() => setDetailTab('hirePurchase')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${detailTab === 'hirePurchase' ? 'bg-emerald-500/15 text-emerald-600' : ''}`}>Hire Purchase ({hpAgreements.length})</button>
            </div>
            {/* Top meta row */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-3 ${detailTab !== 'overview' ? 'hidden' : ''}`}>
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
                  {Number(customer.creditBalance ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Store credit</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(customer.creditBalance ?? 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {detailTab === 'hirePurchase' && hpAgreements.length > 0 && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={12} /> Hire Purchase
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-[12px]">
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th className="px-3 py-2 text-left">Agreement</th>
                        <th className="px-3 py-2 text-left">Device / IMEI</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hpAgreements.map((agreement: any) => (
                        <tr key={agreement.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2 font-mono font-semibold text-emerald-600">{agreement.agreementNumber}</td>
                          <td className="px-3 py-2">
                            <p>{agreement.productName}</p>
                            <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{agreement.imei}</p>
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(agreement.totalPayable)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(agreement.paidAmount)}</td>
                          <td className="px-3 py-2 text-right font-bold text-red-500">{formatCurrency(agreement.outstandingBalance)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                              agreement.status === 'ACTIVE' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400'
                              : agreement.status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : agreement.status === 'DEFAULTED' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                              : agreement.status === 'CANCELLED' ? 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}>
                              {agreement.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {detailTab === 'hirePurchase' && hpAgreements.length === 0 && (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No hire purchase agreements for this customer.
              </div>
            )}

            {/* Sales + Repairs + Totals */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${detailTab !== 'overview' ? 'hidden' : ''}`}>
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
                        {sales.map((sale: any, idx: number) => {
                          const settlementPayments = (sale.payments ?? []).filter((p: any) =>
                            typeof p.reference === 'string' && (
                              p.reference.includes('Outstanding settlement')
                              || p.reference.includes('Outstanding discount')
                              || p.reference.includes('Credit settlement')
                            ),
                          )
                          return (
                          <tr key={sale.id ?? idx} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(sale.invoiceNumber)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{safeText(formatDate(sale.createdAt, 'long'))}</td>
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
                              {sale.notes && (
                                <div className="text-[10px] mt-0.5 truncate max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
                                  Note: {sale.notes}
                                </div>
                              )}
                              {settlementPayments.length > 0 && (
                                <div className="mt-1 space-y-1.5">
                                  {settlementPayments.map((p: any) => {
                                    const isDiscount = String(p.reference || '').toLowerCase().includes('discount')
                                    return (
                                      <ChequePaymentMeta
                                        key={p.id}
                                        method={isDiscount ? 'Discount' : (p.method || 'Payment')}
                                        reference={p.reference}
                                        amount={p.amount}
                                        paidAt={p.paidAt ?? sale.createdAt}
                                        formatAmount={formatCurrency}
                                        className="text-[10px] max-w-[280px]"
                                      />
                                    )
                                  })}
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
                              {(sale.discount ?? 0) > 0 && (
                                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                  Disc. {formatCurrency(sale.discount)}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{formatCurrency(sale.total ?? 0)}</td>
                          </tr>
                          )
                        })}
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
                    {canEdit && hasDue && (
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
            <div className={`flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2 flex-wrap ${detailTab !== 'overview' ? 'hidden' : ''}`}>
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
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-brand-500/30 bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold"
              >
                <ShoppingBag size={14} />
                New Sale
              </button>
              {canEdit && hasDue && (
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold"
                >
                  <Wallet size={14} />
                  Pay Outstanding
                </button>
              )}
              {canEdit && hasDue && hasWhatsApp && canEditWhatsApp && customer?.phone && (
                <button
                  type="button"
                  onClick={sendCreditWhatsAppReminder}
                  disabled={waReminderSending}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold disabled:opacity-50"
                  style={{ borderColor: 'rgba(59,130,246,.35)', background: 'rgba(59,130,246,.08)', color: '#60a5fa' }}
                >
                  {waReminderSending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                  {waReminderSending ? 'Sending…' : 'Send WhatsApp Reminder'}
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
          customerPhone={customer.phone ?? ''}
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
  { key: 'all',         label: 'All Customers',     filter: (c: Customer) => c.isActive !== false },
  { key: 'vip',         label: 'VIP (500+ pts)',     filter: (c: Customer) => c.isActive !== false && c.loyaltyPoints >= 500 },
  { key: 'active',      label: 'Active Buyers',      filter: (c: Customer) => c.isActive !== false && c.totalPurchases >= 3 },
  { key: 'repair_only', label: 'Repair Customers',   filter: (c: Customer) => c.isActive !== false && c.totalRepairs > 0 && c.totalPurchases === 0 },
  { key: 'outstanding', label: 'Has Outstanding',    filter: (c: Customer) => c.isActive !== false && c.totalDue > 0 },
  { key: 'inactive',    label: 'Deactivated',        filter: (c: Customer) => c.isActive === false },
  { key: 'new',         label: 'New (≤30 days)',      filter: (c: Customer) => {
    if (c.isActive === false) return false
    const d = new Date(c.createdAt)
    return (Date.now() - d.getTime()) / 86400000 <= 30
  }},
]

const SORT_OPTIONS: { value: string; label: string; compare: (a: Customer, b: Customer) => number }[] = [
  { value: 'recent',    label: 'Newest first',      compare: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() },
  { value: 'oldest',    label: 'Oldest first',      compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() },
  { value: 'name',      label: 'Name (A–Z)',        compare: (a, b) => (a.name ?? '').localeCompare(b.name ?? '') },
  { value: 'due',       label: 'Highest due',       compare: (a, b) => b.totalDue - a.totalDue },
  { value: 'purchases', label: 'Most purchases',    compare: (a, b) => b.totalPurchases - a.totalPurchases },
  { value: 'points',    label: 'Most loyalty pts',  compare: (a, b) => b.loyaltyPoints - a.loyaltyPoints },
]

const DUE_OPTIONS = [
  { id: 'all',  label: 'Any balance' },
  { id: 'due',  label: 'Has due' },
  { id: 'paid', label: 'Settled' },
] as const

type DueFilter = (typeof DUE_OPTIONS)[number]['id']

const DUE_MIN_OPTIONS = [
  { value: 'all',    label: 'Any due amount' },
  { value: '1000',   label: 'Due ≥ Rs. 1,000' },
  { value: '5000',   label: 'Due ≥ Rs. 5,000' },
  { value: '10000',  label: 'Due ≥ Rs. 10,000' },
  { value: '25000',  label: 'Due ≥ Rs. 25,000' },
  { value: '50000',  label: 'Due ≥ Rs. 50,000' },
  { value: '100000', label: 'Due ≥ Rs. 100,000' },
]

/* ── Add / Edit Customer Modal ───────────────────────────────────────── */
function CustomerFormModal({ customer, onClose, onSaved }: {
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}) {
  const { canEdit } = useModuleAccess()
  const isEditing = Boolean(customer)
  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    city: customer?.city ?? '',
    address: customer?.address ?? '',
    openingDue: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      viewOnlyToast('customers')
      return
    }
    setLoading(true); setError('')
    try {
      if (customer) {
        const { openingDue: _od, ...updateBody } = form
        await customersApi.update(customer.id, updateBody)
        toast.success('Customer updated')
      } else {
        const openingDue = hasCustomerCredit ? Math.max(0, Number(form.openingDue) || 0) : 0
        await customersApi.create({
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
          branchId: getActiveBranchId() || undefined,
          ...(openingDue > 0 ? { openingDue } : {}),
        })
        toast.success(openingDue > 0
          ? `Customer created with ${formatCurrency(openingDue)} prior credit`
          : 'Customer created')
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-500/10 border border-brand-500/20">
              {isEditing ? <Pencil size={18} className="text-brand-500" /> : <UserPlus size={18} className="text-brand-500" />}
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

          {!isEditing && hasCustomerCredit && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Prior credit / outstanding (LKR)
                <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <div className="relative">
                <Wallet size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input-field pl-10 h-11"
                  placeholder="0.00"
                  value={form.openingDue}
                  onChange={e => setForm(f => ({ ...f, openingDue: e.target.value }))}
                />
              </div>
              <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Old credit from before Hexalyte — stored as customer outstanding only (not counted as a shop sale)
              </p>
            </div>
          )}

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
  const { canEdit } = useModuleAccess()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [payCustomerId, setPayCustomerId] = useState<string | null>(null)
  const [segment, setSegment] = useState('all')
  const [textSearch, setTextSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')
  const [dueMin, setDueMin] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  const { data: customersData, loading, refetch } = useCustomers({ status: 'all' })
  const customers: Customer[] = (customersData?.data ?? []) as Customer[]

  useEffect(() => {
    const onSale = () => { refetch() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [refetch])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add' || searchParams.get('new') === '1') {
      if (canEdit) setShowAddModal(true)
      else viewOnlyToast('customers')
    }
    const id = searchParams.get('customerId') || searchParams.get('id')
    if (id) setDetailId(id)
    const q = searchParams.get('q')
    if (q) setTextSearch(q)
  }, [searchParams, canEdit])

  const openDetail = useCallback((id: string) => setDetailId(id), [])

  const handleDeactivate = useCallback(async (c: Customer) => {
    if (!canEdit) {
      viewOnlyToast('customers')
      return
    }
    if (!window.confirm(`Deactivate ${c.name}? They will be hidden from POS search and the main customer list.`)) return
    try {
      await customersApi.setActive(c.id, false)
      toast.success('Customer deactivated')
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deactivate')
    }
  }, [canEdit, refetch])

  const handleActivate = useCallback(async (c: Customer) => {
    if (!canEdit) {
      viewOnlyToast('customers')
      return
    }
    try {
      await customersApi.setActive(c.id, true)
      toast.success('Customer activated')
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate')
    }
  }, [canEdit, refetch])

  const handleDelete = useCallback(async (c: Customer) => {
    if (!canEdit) {
      viewOnlyToast('customers')
      return
    }
    if (!window.confirm(`Delete ${c.name} permanently? This only works if they have no sales or repair history.`)) return
    try {
      await customersApi.remove(c.id)
      toast.success('Customer deleted')
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete')
    }
  }, [canEdit, refetch])

  const activeSeg = SEGMENTS.find(s => s.key === segment) ?? SEGMENTS[0]

  const cityOptions = useMemo(() => {
    const cities = new Map<string, string>()
    for (const c of customers) {
      const city = (c.city ?? '').trim()
      if (city) cities.set(city.toLowerCase(), city)
    }
    return [
      { value: 'all', label: 'All cities' },
      ...[...cities.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [customers])

  const segmentFiltered = useMemo(() => {
    let rows = customers.filter(activeSeg.filter)

    if (cityFilter !== 'all') {
      rows = rows.filter(c => (c.city ?? '').trim().toLowerCase() === cityFilter)
    }

    if (hasCustomerCredit && dueFilter !== 'all') {
      rows = rows.filter(c => (dueFilter === 'due' ? c.totalDue > 0 : c.totalDue <= 0))
    }

    if (hasCustomerCredit && dueMin !== 'all') {
      const min = Number(dueMin)
      rows = rows.filter(c => c.totalDue >= min)
    }

    const q = textSearch.trim().toLowerCase()
    if (q) {
      rows = rows.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      )
    }

    const sorter = SORT_OPTIONS.find(s => s.value === sortBy)
    return sorter ? [...rows].sort(sorter.compare) : rows
  }, [customers, activeSeg, cityFilter, dueFilter, dueMin, hasCustomerCredit, textSearch, sortBy])

  const hasActiveFilters =
    segment !== 'all' || cityFilter !== 'all' || dueFilter !== 'all' || dueMin !== 'all' || sortBy !== 'recent' || textSearch.trim().length > 0

  const clearFilters = () => {
    setSegment('all')
    setCityFilter('all')
    setDueFilter('all')
    setDueMin('all')
    setSortBy('recent')
    setTextSearch('')
  }

  const totalDue       = customers.filter(c => c.isActive !== false).reduce((s, c) => s + c.totalDue, 0)
  const totalPurchases = customers.filter(c => c.isActive !== false).reduce((s, c) => s + c.totalPurchases, 0)
  const activeCount    = customers.filter(c => c.isActive !== false).length

  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/20 flex items-center justify-center text-sm font-bold text-brand-300 flex-shrink-0">
            {row.original.name.charAt(0)}
          </div>
          <div>
            <button
              type="button"
              className="text-sm font-bold text-gray-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 text-left transition-colors"
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
      cell: ({ row }) => <span className="text-xs text-brand-400 font-semibold">{row.original.loyaltyPoints} pts</span>,
    },
    {
      accessorKey: 'totalDue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
      cell: ({ row }) => {
        const due = Number(row.original.totalDue ?? 0)
        const credit = Number(row.original.creditBalance ?? 0)
        if (credit > 0) {
          return (
            <div>
              <p className="text-xs font-bold text-emerald-500">{formatCurrency(credit)}</p>
              <p className="text-[10px] text-emerald-600/80">Store credit</p>
              {due > 0 && <p className="text-[10px] text-red-400 mt-0.5">Due {formatCurrency(due)}</p>}
            </div>
          )
        }
        return (
          <span className={`text-xs font-bold ${due > 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {formatCurrency(due)}
          </span>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
      cell: ({ row }) => <span className="text-xs font-medium text-gray-500 dark:text-slate-500">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'status',
      accessorFn: (row) => (row.isActive === false ? 'Inactive' : 'Active'),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
          row.original.isActive === false
            ? 'bg-slate-500/10 border-slate-500/25 text-slate-500'
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
        }`}>
          {row.original.isActive === false ? 'Inactive' : 'Active'}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const c = row.original
        const inactive = c.isActive === false
        return (
          <div className="flex items-center gap-1 justify-end">
            {canEdit && c.totalDue > 0 && !inactive && (
              <button
                type="button"
                onClick={() => setPayCustomerId(c.id)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30"
              >
                Pay
              </button>
            )}
            {canEdit && (inactive ? (
              <button
                type="button"
                onClick={() => handleActivate(c)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/25"
                title="Activate customer"
              >
                Activate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDeactivate(c)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 hover:bg-amber-500/25"
                title="Deactivate customer"
              >
                Deactivate
              </button>
            ))}
            <TableActionsRow
              showAction={{ action: () => openDetail(c.id) }}
              editAction={canEdit ? { action: () => setEditCustomer(c), disabled: inactive } : undefined}
              deleteAction={canEdit ? { action: () => handleDelete(c) } : undefined}
            />
          </div>
        )
      },
    },
  ], [canEdit, openDetail, handleActivate, handleDeactivate, handleDelete])

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
            customerPhone={c.phone}
            outstanding={c.totalDue}
            onClose={() => setPayCustomerId(null)}
            onSuccess={() => { setPayCustomerId(null); refetch() }}
          />
        )
      })()}

      <PageHeader
        title="Customers"
        subtitle={
          hasActiveFilters
            ? <>{segmentFiltered.length} of {customers.length} shown · <span className="text-brand-600 dark:text-brand-400">{activeSeg.label}</span></>
            : <>{activeCount} active · {customers.length} total · <span className="text-brand-600 dark:text-brand-400">{activeSeg.label}</span></>
        }
        actions={
          <div className="flex gap-2 items-center relative" ref={segmentRef}>
            <OpenPosButton label="POS Terminal" variant="secondary" />
            <button
              onClick={() => setShowSegment(v => !v)}
              className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-brand-500/40 text-brand-300' : ''}`}
            >
              <SlidersHorizontal size={14} />Segment
              {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />}
            </button>

            {showSegment && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-[color:var(--bg-card)] border border-[color:var(--border-ui)] rounded-xl shadow-2xl z-30 overflow-hidden">
                <p className="text-[10px] uppercase tracking-wide px-3 pt-3 pb-1.5" style={{ color: 'var(--text-muted)' }}>Filter by segment</p>
                {SEGMENTS.filter(s => hasCustomerCredit || s.key !== 'outstanding').map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setSegment(s.key); setShowSegment(false) }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[color:var(--bg-subtle)] transition-colors ${segment === s.key ? 'text-brand-600 dark:text-brand-300' : ''}`}
                    style={segment !== s.key ? { color: 'var(--text-muted)' } : undefined}
                  >
                    <span>{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{customers.filter(s.filter).length}</span>
                      {segment === s.key && <ChevronRight size={12} className="text-brand-400" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {canEdit && (
              <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
                <Plus size={14} />Add Customer
              </button>
            )}
          </div>
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Total Customers" value={activeCount.toString()} icon={Users} tone="brand" />
        {hasCustomerCredit && (
          <StatCard label="Total Outstanding" value={formatCurrency(totalDue)} icon={CreditCard} tone="danger" />
        )}
        <StatCard label="Total Purchases" value={totalPurchases.toString()} icon={ShoppingBag} tone="info" />
        <StatCard label="VIP Members" value={customers.filter(c => c.loyaltyPoints >= 500).length.toString()} icon={Star} tone="warning" />
      </StatGrid>

      <FilterBar>
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          placeholder="Search name, phone, email…"
          className="w-full sm:w-auto sm:min-w-[220px]"
        />
        <SegmentedControl
          value={segment}
          onChange={setSegment}
          options={SEGMENTS.filter(s => hasCustomerCredit || s.key !== 'outstanding').map(s => ({ id: s.key, label: s.label }))}
        />

        <FilterDropdown
          value={cityFilter}
          onChange={setCityFilter}
          options={cityOptions}
          icon={MapPin}
          placeholder="All cities"
          active={cityFilter !== 'all'}
          onClear={() => setCityFilter('all')}
        />

        <FilterDropdown
          value={sortBy}
          onChange={setSortBy}
          options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))}
          icon={ArrowUpDown}
          placeholder="Sort by"
          active={sortBy !== 'recent'}
          onClear={() => setSortBy('recent')}
        />

        {hasCustomerCredit && (
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {DUE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDueFilter(opt.id)}
                className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
                style={dueFilter === opt.id
                  ? { background: 'var(--brand-primary-light)', color: '#fff' }
                  : { color: 'var(--text-muted)' }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {hasCustomerCredit && (
          <FilterDropdown
            value={dueMin}
            onChange={setDueMin}
            options={DUE_MIN_OPTIONS}
            icon={CreditCard}
            placeholder="Any due amount"
            active={dueMin !== 'all'}
            onClear={() => setDueMin('all')}
          />
        )}

        {hasActiveFilters && (
          <>
            <span className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
              {segmentFiltered.length} of {customers.length}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-colors hover:text-red-400"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              <RotateCcw size={11} />Reset
            </button>
          </>
        )}
      </FilterBar>

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
