'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen, Loader2, CheckCircle2, AlertTriangle, RefreshCw,
  Layers, FileText, Play, Database, Calendar, Users,
  Landmark, Receipt, Wallet, Settings, BarChart3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingKpiCard,
  AccountingModal,
  AccountingPanel,
  AccountingQuickLink,
  AccountingStatusBadge,
  AccountingTable,
  AccountingTd,
  AccountingTh,
  AMBER_ACCENT,
  CYAN_ACCENT,
  GREEN_ACCENT,
  VIOLET_ACCENT,
} from '@/components/accounting/accounting-ui'

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

const QUICK_LINKS = [
  { href: '/dashboard/accounting/journals', icon: FileText, label: 'Journals', description: 'Browse & post manual entries' },
  { href: '/dashboard/accounting/reports', icon: BarChart3, label: 'GL Reports', description: 'Trial balance, P&L, balance sheet' },
  { href: '/dashboard/accounting/ar-ap', icon: Users, label: 'AR / AP', description: 'Customer & supplier subledgers' },
  { href: '/dashboard/accounting/cash-bank', icon: Landmark, label: 'Cash & Bank', description: 'Registers, transfers, reconcile' },
  { href: '/dashboard/accounting/tax', icon: Receipt, label: 'VAT / Tax', description: 'Output vs input VAT' },
  { href: '/dashboard/accounting/petty-cash', icon: Wallet, label: 'Petty Cash', description: 'Float expenses & replenish' },
  { href: '/dashboard/accounting/payroll', icon: Users, label: 'Payroll', description: 'Accrual & salary payment' },
  { href: '/dashboard/accounting/periods', icon: Calendar, label: 'Periods', description: 'Soft & hard close' },
  { href: '/dashboard/accounting/settings', icon: Settings, label: 'Settings', description: 'Auto-post, approvals, mappings' },
]

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

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen size={22} className="text-violet-400" />
            Accounting
          </h1>
          <p className="page-subtitle">Double-entry general ledger for your mobile shop</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button type="button" onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {status?.initialized && (
            <button
              type="button"
              onClick={handleSyncProcess}
              disabled={syncLoading}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {syncLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Sync & Post
            </button>
          )}
        </div>
      </div>

      {loading && !status ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-violet-400" size={32} />
        </div>
      ) : status && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AccountingKpiCard label="GL Accounts" value={status.accountCount} accent={VIOLET_ACCENT} />
            <AccountingKpiCard label="Open Period" value={status.currentPeriod?.name ?? '—'} accent={CYAN_ACCENT} />
            <AccountingKpiCard label="Journals" value={status.journalCount} accent={GREEN_ACCENT} />
            <AccountingKpiCard
              label="Outbox Pending"
              value={status.outboxPending}
              accent={status.outboxPending > 0 ? AMBER_ACCENT : GREEN_ACCENT}
            />
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-start gap-3">
              {status.initialized ? (
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {status.initialized ? 'Accounting initialized' : 'Setup required'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
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
                  className="btn-primary flex items-center gap-2 text-sm shrink-0"
                >
                  {initLoading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  Initialize
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <AccountingStatusBadge tone={status.autoPostEnabled ? 'success' : 'neutral'}>
                Auto-post {status.autoPostEnabled ? 'on' : 'off'}
              </AccountingStatusBadge>
              <AccountingStatusBadge tone="violet">{status.periodCount} period(s)</AccountingStatusBadge>
            </div>
          </div>

          {status.outboxPending > 0 && status.initialized && (
            <div className="card p-4 flex items-center gap-3 border-amber-500/25 bg-amber-500/5">
              <Database className="text-amber-400 shrink-0" size={18} />
              <div className="flex-1 text-sm min-w-0">
                <p className="font-medium text-amber-200">{status.outboxPending} journal(s) pending</p>
                <p className="text-xs text-amber-400/80 mt-0.5">Run Sync & Post to mirror POS, purchases and repairs into the GL.</p>
              </div>
              <button
                type="button"
                onClick={handleSyncProcess}
                disabled={syncLoading}
                className="btn-secondary text-xs shrink-0"
              >
                Process
              </button>
            </div>
          )}

          {status.initialized && (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {QUICK_LINKS.map(l => (
                <AccountingQuickLink key={l.href} {...l} />
              ))}
            </div>
          )}

          {status.initialized && (
            <AccountingPanel
              title="Integration outbox"
              icon={Database}
              actions={
                <select
                  value={outboxStatus}
                  onChange={e => setOutboxStatus(e.target.value)}
                  className="input-field text-xs py-1.5 w-auto"
                >
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              }
            >
              {outbox.length === 0 ? (
                <p className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>No {outboxStatus.toLowerCase()} items</p>
              ) : (
                <AccountingTable>
                  <thead>
                    <tr>
                      <AccountingTh>Source</AccountingTh>
                      <AccountingTh>Event</AccountingTh>
                      <AccountingTh>Status</AccountingTh>
                      <AccountingTh>Error</AccountingTh>
                    </tr>
                  </thead>
                  <tbody>
                    {outbox.map(o => (
                      <tr key={o.id}>
                        <AccountingTd>{o.sourceType}</AccountingTd>
                        <AccountingTd className="text-violet-400">{o.eventType}</AccountingTd>
                        <AccountingTd>
                          <AccountingStatusBadge tone={o.status === 'FAILED' ? 'danger' : o.status === 'COMPLETED' ? 'success' : 'warning'}>
                            {o.status}
                          </AccountingStatusBadge>
                        </AccountingTd>
                        <AccountingTd className="text-red-400 truncate">{o.lastError ?? '—'}</AccountingTd>
                      </tr>
                    ))}
                  </tbody>
                </AccountingTable>
              )}
            </AccountingPanel>
          )}

          {accounts.length > 0 && (
            <AccountingPanel
              title="Chart of Accounts"
              icon={FileText}
              actions={<span className="text-xs" style={{ color: 'var(--text-muted)' }}>{accounts.length} accounts</span>}
            >
              <div className="max-h-[420px] overflow-y-auto">
                <AccountingTable>
                  <thead>
                    <tr>
                      <AccountingTh>Code</AccountingTh>
                      <AccountingTh>Name</AccountingTh>
                      <AccountingTh>Type</AccountingTh>
                      <AccountingTh>Subtype</AccountingTh>
                      <AccountingTh className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id} className="cursor-pointer" onClick={() => openLedger(a)}>
                        <AccountingTd mono className="text-violet-400">{a.code}</AccountingTd>
                        <AccountingTd>{a.name}</AccountingTd>
                        <AccountingTd>{a.type}</AccountingTd>
                        <AccountingTd className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.subtype}</AccountingTd>
                        <AccountingTd>
                          {!a.isSystem && (
                            <button
                              type="button"
                              className="text-xs text-violet-400 hover:text-violet-300"
                              onClick={e => { e.stopPropagation(); setEditAccount(a); setEditName(a.name) }}
                            >
                              Edit
                            </button>
                          )}
                        </AccountingTd>
                      </tr>
                    ))}
                  </tbody>
                </AccountingTable>
              </div>
              <p className="px-4 py-3 text-xs border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                Click a row to view account ledger. Reports are generated from posted GL journals.
              </p>
            </AccountingPanel>
          )}

          {editAccount && (
            <AccountingModal title={`Edit ${editAccount.code}`} icon={FileText} onClose={() => setEditAccount(null)}>
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Account name</span>
                  <input className="input-field" value={editName} onChange={e => setEditName(e.target.value)} />
                </label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditAccount(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
                  <button type="button" onClick={saveCoaEdit} className="btn-primary flex-1 text-sm">Save</button>
                </div>
              </div>
            </AccountingModal>
          )}

          {ledgerAccount && (
            <AccountingModal
              title={`${ledgerAccount.code} — ${ledgerAccount.name}`}
              icon={FileText}
              onClose={() => setLedgerAccount(null)}
              wide
            >
              {ledgerLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
              ) : ledgerRows.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No transactions in this period</p>
              ) : (
                <AccountingTable>
                  <thead>
                    <tr>
                      <AccountingTh>Date</AccountingTh>
                      <AccountingTh>Entry</AccountingTh>
                      <AccountingTh>Description</AccountingTh>
                      <AccountingTh align="right">Debit</AccountingTh>
                      <AccountingTh align="right">Credit</AccountingTh>
                      <AccountingTh align="right">Balance</AccountingTh>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((r, i) => (
                      <tr key={i}>
                        <AccountingTd>{r.entryDate}</AccountingTd>
                        <AccountingTd mono className="text-violet-400">{r.entryNo}</AccountingTd>
                        <AccountingTd>{r.description ?? '—'}</AccountingTd>
                        <AccountingTd align="right">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</AccountingTd>
                        <AccountingTd align="right">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</AccountingTd>
                        <AccountingTd align="right" className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(r.runningBalance)}
                        </AccountingTd>
                      </tr>
                    ))}
                  </tbody>
                </AccountingTable>
              )}
            </AccountingModal>
          )}
        </>
      )}
    </AccountingPageShell>
  )
}
