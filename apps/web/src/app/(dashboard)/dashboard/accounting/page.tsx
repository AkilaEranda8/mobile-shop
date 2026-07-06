'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Loader2, CheckCircle2, AlertTriangle, RefreshCw,
  Layers, FileText, Lock, BarChart3, Play, Database, Calendar, Users,
  Landmark, Receipt, Wallet, Settings,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

type AccountingStatus = {
  enabled: boolean
  initialized: boolean
  initializedAt: string | null
  baseCurrency: string
  autoPostEnabled: boolean
  accountCount: number
  periodCount: number
  journalCount: number
  outboxPending: number
  currentPeriod: { id: string; name: string; status: string } | null
}

type GlAccount = {
  id: string
  code: string
  name: string
  type: string
  subtype: string
  branchId: string | null
  isControlAccount: boolean
  isSystem: boolean
}

export default function AccountingPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [status, setStatus] = useState<AccountingStatus | null>(null)
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [initLoading, setInitLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [ledgerAccount, setLedgerAccount] = useState<GlAccount | null>(null)
  const [ledgerRows, setLedgerRows] = useState<Array<{ entryNo: string; entryDate: string; description: string | null; debit: number; credit: number; runningBalance: number }>>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [editAccount, setEditAccount] = useState<GlAccount | null>(null)
  const [editName, setEditName] = useState('')
  const [outbox, setOutbox] = useState<Array<{ id: string; sourceType: string; eventType: string; status: string; attempts: number; lastError: string | null; createdAt: string }>>([])
  const [outboxStatus, setOutboxStatus] = useState('PENDING')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountingApi.status() as { data: AccountingStatus }
      setStatus(res.data)
      if (res.data.enabled && res.data.initialized) {
        const coa = await accountingApi.coaAccounts() as { data: GlAccount[] }
        setAccounts(coa.data ?? [])
      } else {
        setAccounts([])
        setOutbox([])
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load accounting status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!status?.initialized) return
    accountingApi.outbox({ status: outboxStatus, limit: '20' }).then(res => {
      setOutbox((res as { data: typeof outbox }).data ?? [])
    }).catch(() => {})
  }, [status?.initialized, outboxStatus])

  async function handleSyncProcess() {
    setSyncLoading(true)
    try {
      const sync = await accountingApi.syncIntegration() as { data: { enqueued?: Record<string, number> } }
      const enq = sync.data?.enqueued
      const total = enq ? Object.values(enq).reduce((a, b) => a + b, 0) : 0
      const proc = await accountingApi.processIntegration({ limit: 100 }) as { data: { processed: number; failed: number } }
      toast.success(`Synced ${total} events · Posted ${proc.data?.processed ?? 0} journals`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncLoading(false)
    }
  }

  async function openLedger(account: GlAccount) {
    setLedgerAccount(account)
    setLedgerLoading(true)
    try {
      const res = await accountingApi.accountLedger(account.id) as {
        data: { rows: typeof ledgerRows; openingBalance: number; closingBalance: number }
      }
      setLedgerRows(res.data?.rows ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load ledger')
      setLedgerAccount(null)
    } finally {
      setLedgerLoading(false)
    }
  }

  async function saveCoaEdit() {
    if (!editAccount) return
    try {
      await accountingApi.updateGlAccount(editAccount.id, { name: editName })
      toast.success('Account updated')
      setEditAccount(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function handleInitialize() {
    setInitLoading(true)
    try {
      await accountingApi.initialize()
      toast.success('Accounting initialized — chart of accounts ready')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Initialization failed')
    } finally {
      setInitLoading(false)
    }
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
          <Lock className="text-violet-400" size={28} />
        </div>
        <h1 className="text-xl font-bold text-white">Accounting module disabled</h1>
        <p className="text-sm text-slate-400">
          Enable <strong className="text-slate-300">Accounting (GL)</strong> in Settings → Features,
          or ask your platform admin to enable it for your shop.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white"
        >
          Go to Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-violet-400" size={26} />
            Accounting
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Double-entry general ledger for your mobile shop
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        {status?.initialized && (
          <>
            <button
              type="button"
              onClick={handleSyncProcess}
              disabled={syncLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
            >
              {syncLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Sync & Post
            </button>
            <Link
              href="/dashboard/accounting/reports"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white"
            >
              <BarChart3 size={14} />
              GL Reports
            </Link>
            <Link
              href="/dashboard/accounting/periods"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Calendar size={14} />
              Periods
            </Link>
            <Link
              href="/dashboard/accounting/journals"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <FileText size={14} />
              Journals
            </Link>
            <Link
              href="/dashboard/accounting/ar-ap"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Users size={14} />
              AR / AP
            </Link>
            <Link
              href="/dashboard/accounting/cash-bank"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Landmark size={14} />
              Cash & Bank
            </Link>
            <Link
              href="/dashboard/accounting/tax"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Receipt size={14} />
              VAT
            </Link>
            <Link
              href="/dashboard/accounting/petty-cash"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Wallet size={14} />
              Petty Cash
            </Link>
            <Link
              href="/dashboard/accounting/settings"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Settings size={14} />
              Settings
            </Link>
            <Link
              href="/dashboard/accounting/payroll"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Users size={14} />
              Payroll
            </Link>
          </>
        )}
      </div>

      {loading && !status ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-violet-400" size={32} />
        </div>
      ) : status && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="GL Accounts" value={status.accountCount} />
            <StatCard label="Open Period" value={status.currentPeriod?.name ?? '—'} />
            <StatCard label="Journals" value={status.journalCount} />
            <StatCard label="Outbox Pending" value={status.outboxPending} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-start gap-3">
              {status.initialized ? (
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {status.initialized ? 'Accounting initialized' : 'Setup required'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {status.initialized
                    ? `Chart of accounts ready · Currency ${status.baseCurrency}${status.initializedAt ? ` · Since ${new Date(status.initializedAt).toLocaleDateString()}` : ''}`
                    : 'Initialize to seed the mobile-shop chart of accounts and open the current period.'}
                </p>
              </div>
              {!status.initialized && (
                <button
                  type="button"
                  onClick={handleInitialize}
                  disabled={initLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                >
                  {initLoading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  Initialize
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge ok={status.autoPostEnabled}>Auto-post {status.autoPostEnabled ? 'on' : 'off'}</Badge>
              <Badge ok={status.periodCount > 0}>{status.periodCount} period(s)</Badge>
            </div>
          </div>

          {status.outboxPending > 0 && status.initialized && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
              <Database className="text-amber-400 shrink-0" size={18} />
              <div className="flex-1 text-sm">
                <p className="text-amber-200 font-medium">{status.outboxPending} journal(s) pending</p>
                <p className="text-xs text-amber-400/80 mt-0.5">Run Sync & Post to mirror POS, purchases and repairs into the GL.</p>
              </div>
              <button
                type="button"
                onClick={handleSyncProcess}
                disabled={syncLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              >
                Process
              </button>
            </div>
          )}

          {status.initialized && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 flex-wrap">
                <Database size={16} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-white">Integration outbox</h2>
                <select value={outboxStatus} onChange={e => setOutboxStatus(e.target.value)}
                  className="ml-auto text-xs px-2 py-1 rounded bg-slate-800 border border-white/10 text-slate-300">
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              {outbox.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No {outboxStatus.toLowerCase()} items</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-slate-500 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-2 text-left">Source</th>
                      <th className="px-4 py-2 text-left">Event</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outbox.map(o => (
                      <tr key={o.id} className="border-t border-white/5">
                        <td className="px-4 py-2 text-slate-300">{o.sourceType}</td>
                        <td className="px-4 py-2 text-violet-300">{o.eventType}</td>
                        <td className="px-4 py-2">{o.status}</td>
                        <td className="px-4 py-2 text-red-400 truncate max-w-[200px]">{o.lastError ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {accounts.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <FileText size={16} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-white">Chart of Accounts</h2>
                <span className="text-xs text-slate-500 ml-auto">{accounts.length} accounts</span>
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900/95 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Code</th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Subtype</th>
                      <th className="px-4 py-2 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-mono text-violet-300 cursor-pointer" onClick={() => openLedger(a)}>{a.code}</td>
                        <td className="px-4 py-2 text-slate-200">{a.name}</td>
                        <td className="px-4 py-2 text-slate-400">{a.type}</td>
                        <td className="px-4 py-2 text-slate-500">{a.subtype}</td>
                        <td className="px-4 py-2">
                          {!a.isSystem && (
                            <button type="button" className="text-xs text-violet-400" onClick={() => { setEditAccount(a); setEditName(a.name) }}>Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 text-center">
            Click a COA row to view account ledger. Financial reports are generated from posted GL journals.
          </p>

          {editAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditAccount(null)}>
              <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-white">Edit {editAccount.code}</h3>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditAccount(null)} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
                  <button type="button" onClick={saveCoaEdit} className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white">Save</button>
                </div>
              </div>
            </div>
          )}

          {ledgerAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setLedgerAccount(null)}>
              <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-5" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white font-mono">{ledgerAccount.code} — {ledgerAccount.name}</h3>
                {ledgerLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
                ) : (
                  <table className="w-full text-sm mt-4">
                    <thead className="text-xs text-slate-500 border-b border-white/10">
                      <tr>
                        <th className="py-2 text-left">Date</th>
                        <th className="py-2 text-left">Entry</th>
                        <th className="py-2 text-left">Description</th>
                        <th className="py-2 text-right">Debit</th>
                        <th className="py-2 text-right">Credit</th>
                        <th className="py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerRows.map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-2 text-slate-400">{r.entryDate}</td>
                          <td className="py-2 font-mono text-violet-300">{r.entryNo}</td>
                          <td className="py-2 text-slate-300">{r.description ?? '—'}</td>
                          <td className="py-2 text-right">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</td>
                          <td className="py-2 text-right">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</td>
                          <td className="py-2 text-right text-white">{formatCurrency(r.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}

function Badge({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 text-slate-500'}`}>
      {children}
    </span>
  )
}
