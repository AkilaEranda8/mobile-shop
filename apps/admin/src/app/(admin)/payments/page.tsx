'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react'
import {
  approveSubscriptionPaymentSlip,
  downloadSubscriptionInvoicePdf,
  fetchBillingSettings,
  fetchSubscriptionPayments,
  rejectSubscriptionPaymentSlip,
  updateBillingSettings,
  updateHelaposSettings,
  type BillingSettings,
  type HelaposAdminSettings,
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
  const [helaposForm, setHelaposForm] = useState<HelaposAdminSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingHelapos, setSavingHelapos] = useState(false)
  const [showAppSecret, setShowAppSecret] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)

  const flash = (kind: 'ok' | 'err', message: string) => {
    if (kind === 'ok') {
      setOk(message)
      setErr(null)
    } else {
      setErr(message)
      setOk(null)
    }
  }

  const downloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingInvoiceId(invoiceId)
    try {
      await downloadSubscriptionInvoicePdf(invoiceId, invoiceNumber)
      flash('ok', `Downloaded ${invoiceNumber}`)
    } catch (e: any) {
      flash('err', e?.message || 'Invoice download failed')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

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
      if (billing) {
        const b = ((billing as any)?.data ?? billing) as BillingSettings
        setSettings(b)
        if (b.helapos) setHelaposForm(b.helapos)
      }
    } catch (e: any) {
      flash('err', e?.message || 'Failed to load payments')
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
      flash('ok', 'Payment approved')
      await load()
    } catch (e: any) {
      flash('err', e?.message || 'Approve failed')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async () => {
    if (!rejectId || rejectReason.trim().length < 3) {
      flash('err', 'Enter a rejection reason')
      return
    }
    setBusyId(rejectId)
    try {
      await rejectSubscriptionPaymentSlip(rejectId, rejectReason.trim())
      flash('ok', 'Payment rejected')
      setRejectId(null)
      setRejectReason('')
      await load()
    } catch (e: any) {
      flash('err', e?.message || 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const updated = await updateBillingSettings(settings)
      const next = ((updated as any)?.data ?? updated) as BillingSettings
      setSettings(next)
      if (next.helapos) setHelaposForm(next.helapos)
      flash('ok', 'Billing settings saved')
    } catch (e: any) {
      flash('err', e?.message || 'Save failed')
    } finally {
      setSavingSettings(false)
    }
  }

  const saveHelapos = async () => {
    if (!helaposForm) return
    setSavingHelapos(true)
    try {
      const updated = await updateHelaposSettings({
        enabled: helaposForm.enabled,
        mock: helaposForm.mock,
        appId: helaposForm.appId,
        appSecret: helaposForm.appSecret,
        merchantId: helaposForm.merchantId,
        baseUrl: helaposForm.baseUrl,
        createQrPath: helaposForm.createQrPath,
        authMode: helaposForm.authMode,
        webhookSecret: helaposForm.webhookSecret,
        allowedIps: helaposForm.allowedIps,
        requireSignature: helaposForm.requireSignature,
        sessionTtlMinutes: helaposForm.sessionTtlMinutes,
      })
      const next = ((updated as any)?.data ?? updated) as HelaposAdminSettings
      setHelaposForm(next)
      setSettings((s) => (s ? { ...s, helapos: next } : s))
      flash('ok', 'HelaPOS keys saved')
    } catch (e: any) {
      flash('err', e?.message || 'HelaPOS save failed')
    } finally {
      setSavingHelapos(false)
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

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
      )}
      {ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{ok}</div>
      )}

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

      {helaposForm && (
        <section className="card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">LankaQR (HelaPOS) keys</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Update App ID / Secret here — stored in platform config (env is fallback). Secrets stay masked until you type a new value.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${
                  helaposForm.enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {helaposForm.enabled
                  ? (helaposForm.mock ? 'Enabled · Mock' : helaposForm.configured ? 'Enabled · Live' : 'Enabled · Needs keys')
                  : 'Disabled'}
              </span>
              <button
                type="button"
                disabled={savingHelapos}
                onClick={() => void saveHelapos()}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {savingHelapos ? 'Saving…' : 'Save HelaPOS'}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1 text-xs">
            <p className="font-semibold text-gray-600">Notify URL (give to HelaPay support)</p>
            <code className="break-all text-gray-900">{helaposForm.notifyUrl}</code>
            <p className="text-gray-500 pt-1">Source: {helaposForm.source}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm sm:col-span-1">
              <input
                type="checkbox"
                checked={helaposForm.enabled}
                onChange={(e) => setHelaposForm({ ...helaposForm, enabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="font-semibold text-gray-700">Enable LankaQR</span>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-1">
              <input
                type="checkbox"
                checked={helaposForm.mock}
                onChange={(e) => setHelaposForm({ ...helaposForm, mock: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="font-semibold text-gray-700">Mock mode (no live settle)</span>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-1">
              <input
                type="checkbox"
                checked={helaposForm.requireSignature}
                onChange={(e) => setHelaposForm({ ...helaposForm, requireSignature: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="font-semibold text-gray-700">Require webhook signature</span>
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">App ID</span>
              <input
                value={helaposForm.appId}
                onChange={(e) => setHelaposForm({ ...helaposForm, appId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="From HelaPay email"
                autoComplete="off"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">
                App Secret {helaposForm.hasAppSecret ? '(set)' : '(empty)'}
              </span>
              <div className="flex gap-1">
                <input
                  type={showAppSecret ? 'text' : 'password'}
                  value={helaposForm.appSecret}
                  onChange={(e) => setHelaposForm({ ...helaposForm, appSecret: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder={helaposForm.hasAppSecret ? '•••••••• leave to keep' : 'Paste App Secret'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowAppSecret((v) => !v)}
                  className="px-2 text-[11px] font-semibold border rounded-lg text-gray-600"
                >
                  {showAppSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Merchant ID</span>
              <input
                value={helaposForm.merchantId}
                onChange={(e) => setHelaposForm({ ...helaposForm, merchantId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="Optional"
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Base URL</span>
              <input
                value={helaposForm.baseUrl}
                onChange={(e) => setHelaposForm({ ...helaposForm, baseUrl: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Create QR path</span>
              <input
                value={helaposForm.createQrPath}
                onChange={(e) => setHelaposForm({ ...helaposForm, createQrPath: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="/qr/create"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Auth mode</span>
              <select
                value={helaposForm.authMode}
                onChange={(e) => setHelaposForm({ ...helaposForm, authMode: e.target.value as HelaposAdminSettings['authMode'] })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="basic">Basic (AppId:Secret)</option>
                <option value="headers">Headers X-App-Id / X-App-Secret</option>
                <option value="bearer">Bearer token</option>
              </select>
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">
                Webhook secret {helaposForm.hasWebhookSecret ? '(set)' : '(empty)'}
              </span>
              <div className="flex gap-1">
                <input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={helaposForm.webhookSecret}
                  onChange={(e) => setHelaposForm({ ...helaposForm, webhookSecret: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder={helaposForm.hasWebhookSecret ? '•••••••• leave to keep' : 'Optional HMAC secret'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret((v) => !v)}
                  className="px-2 text-[11px] font-semibold border rounded-lg text-gray-600"
                >
                  {showWebhookSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Allowed IPs (comma-separated)</span>
              <input
                value={helaposForm.allowedIps}
                onChange={(e) => setHelaposForm({ ...helaposForm, allowedIps: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="Empty = allow all"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="font-semibold text-gray-600">Session TTL (minutes)</span>
              <input
                type="number"
                min={5}
                max={60}
                value={helaposForm.sessionTtlMinutes}
                onChange={(e) => setHelaposForm({ ...helaposForm, sessionTtlMinutes: Number(e.target.value) || 15 })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
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
                      <button
                        type="button"
                        disabled={downloadingInvoiceId === row.invoice.id}
                        onClick={() => void downloadInvoice(row.invoice.id, row.invoice.invoiceNumber)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {downloadingInvoiceId === row.invoice.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        Download PDF
                      </button>
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
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={downloadingInvoiceId === row.invoice.id}
                          onClick={() => void downloadInvoice(row.invoice.id, row.invoice.invoiceNumber)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {downloadingInvoiceId === row.invoice.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                          Invoice
                        </button>
                        {row.status === 'PENDING' ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
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
