'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  approveSubscriptionPaymentSlip,
  fetchBillingSettings,
  fetchSubscriptionPayments,
  rejectSubscriptionPaymentSlip,
  updateBillingSettings,
  type BillingSettings,
  type SubscriptionPaymentRow,
} from '@/lib/api'

function fmtDate(v?: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function money(n: number) {
  return `Rs. ${Math.round(n).toLocaleString('en-LK')}`
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<SubscriptionPaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [payments, billing] = await Promise.all([
        fetchSubscriptionPayments({
          status: filter === 'ALL' ? undefined : filter,
          search: search.trim() || undefined,
        }),
        fetchBillingSettings().catch(() => null),
      ])
      setRows(Array.isArray(payments) ? payments : (payments as any)?.data ?? [])
      if (billing) setSettings((billing as any)?.data ?? billing)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const approve = async (row: SubscriptionPaymentRow) => {
    if (!window.confirm(`Approve payment for ${row.tenant.name}?\nInvoice ${row.invoice.invoiceNumber} · ${money(row.amount)}\n\nThis will mark the invoice PAID and reactivate the account if no other invoices are outstanding.`)) {
      return
    }
    setBusyId(row.id)
    try {
      await approveSubscriptionPaymentSlip(row.id)
      toast.success('Payment approved')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Approve failed')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async () => {
    if (!rejectId || rejectReason.trim().length < 3) {
      toast.error('Enter a rejection reason')
      return
    }
    setBusyId(rejectId)
    try {
      await rejectSubscriptionPaymentSlip(rejectId, rejectReason.trim())
      toast.success('Payment rejected')
      setRejectId(null)
      setRejectReason('')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const updated = await updateBillingSettings(settings)
      setSettings((updated as any)?.data ?? updated)
      toast.success('Billing settings saved')
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review bank-transfer slips and LankaQR (HelaPOS) payments. Approving marks the invoice paid and reactivates the tenant when nothing else is outstanding.
        </p>
      </div>

      {/* Bank / grace settings */}
      {settings && (
        <section className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Payment Settings</h2>
              <p className="text-xs text-gray-500">Shown to tenants on the Billing page. Not hardcoded.</p>
            </div>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={savingSettings}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Grace days</span>
              <input
                type="number"
                min={0}
                value={settings.graceDays}
                onChange={(e) => setSettings({ ...settings, graceDays: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Due days after issue</span>
              <input
                type="number"
                min={0}
                value={settings.dueDaysAfterIssue}
                onChange={(e) => setSettings({ ...settings, dueDaysAfterIssue: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Bank</span>
              <input
                value={settings.bank.bankName}
                onChange={(e) => setSettings({ ...settings, bank: { ...settings.bank, bankName: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Account name</span>
              <input
                value={settings.bank.accountName}
                onChange={(e) => setSettings({ ...settings, bank: { ...settings.bank, accountName: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Account number</span>
              <input
                value={settings.bank.accountNumber}
                onChange={(e) => setSettings({ ...settings, bank: { ...settings.bank, accountNumber: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Branch</span>
              <input
                value={settings.bank.branch}
                onChange={(e) => setSettings({ ...settings, bank: { ...settings.bank, branch: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">SWIFT</span>
              <input
                value={settings.bank.swift}
                onChange={(e) => setSettings({ ...settings, bank: { ...settings.bank, swift: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="font-semibold text-gray-600">Instructions</span>
              <input
                value={settings.bank.instructions}
                onChange={(e) => setSettings({ ...settings, bank: { ...settings.bank, instructions: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>
      )}

      {settings?.helapos && (
        <section className="card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">LankaQR (HelaPOS)</h2>
              <p className="text-xs text-gray-500">
                Give this Notify URL to HelaPay support when onboarding. QR payments auto-approve invoices.
              </p>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${
                settings.helapos.enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {settings.helapos.enabled
                ? (settings.helapos.mock ? 'Enabled · Mock' : 'Enabled · Live')
                : 'Disabled'}
            </span>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2 text-xs">
            <div>
              <p className="font-semibold text-gray-600 mb-0.5">Primary Notify URL</p>
              <code className="break-all text-gray-900">{settings.helapos.notifyUrl}</code>
            </div>
            {settings.helapos.notifyUrlAlias && (
              <div>
                <p className="font-semibold text-gray-600 mb-0.5">Alias</p>
                <code className="break-all text-gray-900">{settings.helapos.notifyUrlAlias}</code>
              </div>
            )}
            <p className="text-gray-500">
              Env: <code>HELAPOS_ENABLED</code>, <code>HELAPOS_MOCK</code>, <code>HELAPOS_APP_ID</code>, <code>HELAPOS_APP_SECRET</code>
            </p>
          </div>
        </section>
      )}

      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                  filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tenant / invoice / ref"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="p-3">Tenant</th>
                  <th className="p-3">Customer / Paid By</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Slip</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Submitted</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500">No payments found</td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 align-top">
                    <td className="p-3">
                      <p className="font-semibold text-gray-900">{row.tenant.name}</p>
                      <p className="text-[11px] text-gray-500">{row.tenant.ownerEmail}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-gray-900">
                        {(row as any).paidByName || (row as any).submittedByName || row.tenant.ownerName}
                      </p>
                      {(row as any).paidByEmail && (
                        <p className="text-[11px] text-gray-500">{(row as any).paidByEmail}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold">{row.invoice.invoiceNumber}</p>
                      <p className="text-[11px] text-gray-500">Due {fmtDate(row.invoice.dueDate)}</p>
                    </td>
                    <td className="p-3 font-semibold">{money(row.amount)}</td>
                    <td className="p-3">{fmtDate(row.paymentDate)}</td>
                    <td className="p-3 text-xs">{row.channel.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs">{row.transactionRef || '—'}</td>
                    <td className="p-3">
                      {row.slipUrl ? (
                        <a href={row.slipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                          View Slip <ExternalLink size={11} />
                        </a>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_STYLE[row.status]}`}>
                        {row.status}
                      </span>
                      {row.rejectionReason && (
                        <p className="text-[11px] text-red-600 mt-1 max-w-[160px]">{row.rejectionReason}</p>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-500">{fmtDate(row.createdAt)}</td>
                    <td className="p-3">
                      {row.status === 'PENDING' ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void approve(row)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => { setRejectId(row.id); setRejectReason('') }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border border-red-200 text-red-700"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">Reject payment</h3>
            <p className="text-xs text-gray-500">The customer will see this reason on their billing page.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
              placeholder="Reason for rejection"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectId(null)} className="text-xs font-semibold px-3 py-2 rounded-lg border">Cancel</button>
              <button type="button" onClick={() => void reject()} className="text-xs font-bold px-3 py-2 rounded-lg bg-red-600 text-white">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
