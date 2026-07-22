'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronRight, Loader2, Plus, RefreshCw, RotateCcw,
  FileText, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { downloadCsv } from '@/lib/export-csv'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingModal,
  AccountingPageHeader,
  AccountingPanel,
  AccountingStatusBadge,
  AccountingTable,
  AccountingTd,
  AccountingTh,
} from '@/components/accounting/accounting-ui'
import { useModuleAccess } from '@/lib/module-access'

type GlAccount = { id: string; code: string; name: string; type: string }

type JournalRow = {
  id: string
  entryNo: string
  entryDate: string
  sourceModule: string
  memo: string | null
  status: string
  totalDebit: number
  totalCredit: number
  createdByEmail: string | null
  postedAt: string | null
  reversalOfId: string | null
  lineCount: number
}

type JournalLine = {
  id: string
  lineNo: number
  description: string | null
  debit: number
  credit: number
  account: { id: string; code: string; name: string; type: string }
}

type JournalDetail = {
  id: string
  entryNo: string
  entryDate: string
  sourceModule: string
  memo: string | null
  status: string
  totalDebit: number
  totalCredit: number
  createdByEmail: string | null
  lines: JournalLine[]
  reversal: { id: string; entryNo: string } | null
  reversedBy: { id: string; entryNo: string } | null
  integrationLinks?: Array<{ sourceType: string; sourceId: string; eventType: string }>
}

type DraftLine = {
  key: string
  accountId: string
  description: string
  debit: string
  credit: string
}

function emptyLine(): DraftLine {
  return { key: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' }
}

export default function JournalsPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const { canEdit } = useModuleAccess()
  const branchId = getActiveBranchId() ?? ''

  const [journals, setJournals] = useState<JournalRow[]>([])
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<JournalDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState(() => businessToday().slice(0, 8) + '01')
  const [toDate, setToDate] = useState(businessToday())
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<Array<{ id: string; entryNo: string; entryDate: string; memo: string | null; totalDebit: number }>>([])

  const [entryDate, setEntryDate] = useState(businessToday())
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '50', from: fromDate, to: toDate }
      if (sourceFilter) params.sourceModule = sourceFilter
      if (search.trim()) params.search = search.trim()
      const [jRes, coaRes] = await Promise.all([
        accountingApi.journals(params) as Promise<{ data: JournalRow[] }>,
        accountingApi.coaAccounts() as Promise<{ data: GlAccount[] }>,
      ])
      setJournals(jRes.data ?? [])
      setAccounts(coaRes.data ?? [])
      try {
        const pRes = await accountingApi.pendingJournals() as { data: typeof pending }
        setPending(pRes.data ?? [])
      } catch {
        setPending([])
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load journals')
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, fromDate, toDate, search])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await accountingApi.journal(id) as { data: JournalDetail }
      setDetail(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load journal')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const l of lines) {
      debit += Number(l.debit) || 0
      credit += Number(l.credit) || 0
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 }
  }, [lines])

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines(prev => [...prev, emptyLine()])
  }

  function removeLine(key: string) {
    setLines(prev => (prev.length <= 2 ? prev : prev.filter(l => l.key !== key)))
  }

  function resetForm() {
    setEntryDate(businessToday())
    setMemo('')
    setLines([emptyLine(), emptyLine()])
  }

  async function handleApprove(id: string) {
    try {
      await accountingApi.approveJournal(id)
      toast.success('Journal approved')
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function handleReject(id: string) {
    const reason = prompt('Rejection reason (optional)') ?? undefined
    try {
      await accountingApi.rejectJournal(id, reason ? { reason } : undefined)
      toast.success('Journal rejected')
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  function exportJournals() {
    downloadCsv('journals.csv', ['Entry', 'Date', 'Source', 'Memo', 'Amount'],
      journals.map(j => [j.entryNo, j.entryDate, j.sourceModule, j.memo ?? '', j.totalDebit]))
  }

  async function handleCreate() {
    const payloadLines = lines
      .filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map(l => ({
        accountId: l.accountId,
        description: l.description || undefined,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))

    if (payloadLines.length < 2) {
      toast.error('Add at least two lines with amounts')
      return
    }
    if (!totals.balanced) {
      toast.error('Debits must equal credits')
      return
    }

    setSubmitLoading(true)
    try {
      const res = await accountingApi.createManualJournal({
        entryDate,
        memo: memo || undefined,
        lines: payloadLines,
        ...(branchId ? { branchId } : {}),
      }) as { data: JournalDetail }
      if (res.data.status === 'PENDING_APPROVAL') {
        toast.success(`Submitted ${res.data.entryNo} for approval`)
      } else {
        toast.success(`Posted ${res.data.entryNo}`)
      }
      setShowCreate(false)
      resetForm()
      await load()
      setSelectedId(res.data.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post journal')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleReverse() {
    if (!selectedId || !detail) return
    if (!confirm(`Reverse journal ${detail.entryNo}? This posts an offsetting entry.`)) return
    setReverseLoading(true)
    try {
      const res = await accountingApi.reverseJournal(selectedId) as { data: JournalDetail }
      toast.success(`Reversed — ${res.data.entryNo}`)
      await load()
      setSelectedId(res.data.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reversal failed')
    } finally {
      setReverseLoading(false)
    }
  }

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Journal Entries"
        subtitle="Browse GL journals and post manual adjustments"
        icon={FileText}
        actions={
          <>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input-field w-auto text-sm" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input-field w-auto text-sm" />
            <input type="search" placeholder="Search entry / memo" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field w-40 text-sm" />
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="input-field w-auto text-sm">
              <option value="">All sources</option>
              <option value="MANUAL">Manual</option>
              <option value="SALES">Sales</option>
              <option value="PURCHASE">Purchase</option>
              <option value="REPAIR">Repair</option>
              <option value="EXPENSE">Expense</option>
              <option value="AR">AR</option>
              <option value="AP">AP</option>
              <option value="PERIOD_CLOSE">Period close</option>
              <option value="DAILY_CLOSING">Daily closing</option>
            </select>
            <button type="button" onClick={exportJournals} className="btn-secondary text-sm">Export CSV</button>
            <button type="button" onClick={load} disabled={loading} className="btn-secondary p-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canEdit && (
              <button type="button" onClick={() => { setShowCreate(true); resetForm() }} className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={14} /> Manual Entry
              </button>
            )}
          </>
        }
      />

      {pending.length > 0 && (
        <div className="card p-4 space-y-2 border-amber-500/25 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-200">{pending.length} journal(s) awaiting approval</p>
          {pending.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm gap-2">
              <span className="font-mono text-violet-400">{p.entryNo}</span>
              <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(p.totalDebit)}</span>
              {canEdit && <div className="flex gap-2">
                <button type="button" onClick={() => handleApprove(p.id)} className="text-xs text-emerald-400">Approve</button>
                <button type="button" onClick={() => handleReject(p.id)} className="text-xs text-red-400">Reject</button>
              </div>}
            </div>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-12 gap-4 w-full">
        <AccountingPanel title="Journal entries" className="xl:col-span-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
          ) : journals.length === 0 ? (
            <p className="p-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No journals found</p>
          ) : (
            <ul className="max-h-[520px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {journals.map(j => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(j.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] flex items-center gap-2 transition-colors ${selectedId === j.id ? 'bg-violet-500/10' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-violet-400 truncate">{j.entryNo}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{j.entryDate} · {j.sourceModule}</p>
                      {j.status === 'PENDING_APPROVAL' && (
                        <AccountingStatusBadge tone="warning">Pending approval</AccountingStatusBadge>
                      )}
                      {j.memo && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{j.memo}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(j.totalDebit)}</p>
                      <ChevronRight size={14} className="ml-auto mt-1" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AccountingPanel>

        <div className="xl:col-span-8 card p-4 min-h-[320px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
              Select a journal to view lines
            </div>
          ) : detailLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{detail.entryNo}</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{detail.entryDate} · {detail.sourceModule}</p>
                  {detail.status === 'PENDING_APPROVAL' && (
                    <AccountingStatusBadge tone="warning">Pending approval</AccountingStatusBadge>
                  )}
                  {detail.memo && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{detail.memo}</p>}
                  {detail.reversal && (
                    <p className="text-xs text-amber-400 mt-1">Reverses {detail.reversal.entryNo}</p>
                  )}
                  {detail.reversedBy && (
                    <p className="text-xs text-amber-400 mt-1">Reversed by {detail.reversedBy.entryNo}</p>
                  )}
                </div>
                {canEdit && detail.sourceModule === 'MANUAL' && !detail.reversedBy && (
                  <button type="button" onClick={handleReverse} disabled={reverseLoading}
                    className="btn-secondary flex items-center gap-2 text-xs text-amber-300 border-amber-500/30">
                    {reverseLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Reverse
                  </button>
                )}
              </div>
              <AccountingTable>
                <thead>
                  <tr>
                    <AccountingTh>Account</AccountingTh>
                    <AccountingTh>Description</AccountingTh>
                    <AccountingTh align="right">Debit</AccountingTh>
                    <AccountingTh align="right">Credit</AccountingTh>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map(l => (
                    <tr key={l.id}>
                      <AccountingTd>
                        <span className="font-mono text-violet-400">{l.account.code}</span>
                        <span className="ml-2">{l.account.name}</span>
                      </AccountingTd>
                      <AccountingTd>{l.description ?? '—'}</AccountingTd>
                      <AccountingTd align="right">{l.debit > 0 ? formatCurrency(l.debit) : '—'}</AccountingTd>
                      <AccountingTd align="right">{l.credit > 0 ? formatCurrency(l.credit) : '—'}</AccountingTd>
                    </tr>
                  ))}
                </tbody>
              </AccountingTable>
              <div className="flex justify-between text-xs font-semibold px-4" style={{ color: 'var(--text-muted)' }}>
                <span>Total</span>
                <span>{formatCurrency(detail.totalDebit)} / {formatCurrency(detail.totalCredit)}</span>
              </div>
              {detail.createdByEmail && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Posted by {detail.createdByEmail}</p>
              )}
              {(detail.integrationLinks?.length ?? 0) > 0 && (
                <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Source documents</p>
                  {detail.integrationLinks!.map((l, i) => (
                    <p key={i}>{l.sourceType} · {l.eventType} · {l.sourceId.slice(0, 12)}…</p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showCreate && (
        <AccountingModal title="New Manual Journal" icon={FileText} onClose={() => setShowCreate(false)} wide>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Entry date</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Memo</span>
                <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="e.g. Month-end adjustment" className="input-field text-sm" />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Lines</span>
                <button type="button" onClick={addLine} className="text-xs text-violet-400 hover:text-violet-300">+ Add line</button>
              </div>
              {lines.map((l, i) => (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {i === 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Account</span>}
                    <select value={l.accountId} onChange={e => updateLine(l.key, { accountId: e.target.value })} className="input-field text-xs">
                      <option value="">Select…</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Description</span>}
                    <input type="text" value={l.description} onChange={e => updateLine(l.key, { description: e.target.value })} className="input-field text-xs" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Debit</span>}
                    <input type="number" min="0" step="0.01" value={l.debit}
                      onChange={e => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                      className="input-field text-xs text-right" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Credit</span>}
                    <input type="number" min="0" step="0.01" value={l.credit}
                      onChange={e => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                      className="input-field text-xs text-right" />
                  </div>
                  <div className="col-span-1 flex justify-center pb-2">
                    <button type="button" onClick={() => removeLine(l.key)} disabled={lines.length <= 2}
                      className="text-red-400 opacity-60 hover:opacity-100 disabled:opacity-20 text-sm">×</button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${totals.balanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <div className="text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Debit </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.debit)}</span>
                <span className="mx-2" style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-muted)' }}>Credit </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.credit)}</span>
              </div>
              {totals.balanced ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={14} /> Balanced</span>
              ) : (
                <span className="text-xs text-amber-400">Out of balance by {formatCurrency(Math.abs(totals.debit - totals.credit))}</span>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={submitLoading || !totals.balanced}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                {submitLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Post Journal
              </button>
            </div>
          </div>
        </AccountingModal>
      )}
    </AccountingPageShell>
  )
}
