'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, Loader2, Plus, RefreshCw, RotateCcw,
  FileText, X, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { downloadCsv } from '@/lib/export-csv'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'

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

  if (!hasAccess) {
    return <div className="p-6 text-center text-slate-400"><Link href="/settings" className="text-violet-400">Enable Accounting</Link></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/dashboard/accounting" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-violet-400" size={26} />
            Journal Entries
          </h1>
          <p className="text-sm text-slate-400 mt-1">Browse GL journals and post manual adjustments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-slate-900 border border-white/10 text-slate-300" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-slate-900 border border-white/10 text-slate-300" />
          <input type="search" placeholder="Search entry / memo" value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-slate-900 border border-white/10 text-slate-300 w-40" />
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-slate-900 border border-white/10 text-slate-300"
          >
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
          <button type="button" onClick={exportJournals} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300">Export CSV</button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => { setShowCreate(true); resetForm() }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white"
          >
            <Plus size={14} />
            Manual Entry
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-200">{pending.length} journal(s) awaiting approval</p>
          {pending.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm gap-2">
              <span className="font-mono text-violet-300">{p.entryNo}</span>
              <span className="text-slate-400">{formatCurrency(p.totalDebit)}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleApprove(p.id)} className="text-xs text-emerald-400">Approve</button>
                <button type="button" onClick={() => handleReject(p.id)} className="text-xs text-red-400">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">
            Journal entries
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
          ) : journals.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No journals found</p>
          ) : (
            <ul className="max-h-[520px] overflow-y-auto divide-y divide-white/5">
              {journals.map(j => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(j.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] flex items-center gap-2 ${selectedId === j.id ? 'bg-violet-500/10' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-violet-300 truncate">{j.entryNo}</p>
                      <p className="text-xs text-slate-500">{j.entryDate} · {j.sourceModule}</p>
                      {j.status === 'PENDING_APPROVAL' && (
                        <span className="text-[10px] text-amber-400">Pending approval</span>
                      )}
                      {j.memo && <p className="text-xs text-slate-400 truncate mt-0.5">{j.memo}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-slate-300">{formatCurrency(j.totalDebit)}</p>
                      <ChevronRight size={14} className="text-slate-600 ml-auto mt-1" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3 rounded-xl border border-white/10 p-4 min-h-[320px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500 text-sm">
              Select a journal to view lines
            </div>
          ) : detailLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white font-mono">{detail.entryNo}</h2>
                  <p className="text-sm text-slate-400">{detail.entryDate} · {detail.sourceModule}</p>
                  {detail.status === 'PENDING_APPROVAL' && (
                    <span className="inline-block mt-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Pending approval</span>
                  )}
                  {detail.memo && <p className="text-sm text-slate-300 mt-1">{detail.memo}</p>}
                  {detail.reversal && (
                    <p className="text-xs text-amber-400 mt-1">Reverses {detail.reversal.entryNo}</p>
                  )}
                  {detail.reversedBy && (
                    <p className="text-xs text-amber-400 mt-1">Reversed by {detail.reversedBy.entryNo}</p>
                  )}
                </div>
                {detail.sourceModule === 'MANUAL' && !detail.reversedBy && (
                  <button
                    type="button"
                    onClick={handleReverse}
                    disabled={reverseLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                  >
                    {reverseLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Reverse
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 border-b border-white/10">
                  <tr>
                    <th className="py-2 font-medium">Account</th>
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium text-right">Debit</th>
                    <th className="py-2 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map(l => (
                    <tr key={l.id} className="border-t border-white/5">
                      <td className="py-2">
                        <span className="font-mono text-violet-300">{l.account.code}</span>
                        <span className="text-slate-400 ml-2">{l.account.name}</span>
                      </td>
                      <td className="py-2 text-slate-400">{l.description ?? '—'}</td>
                      <td className="py-2 text-right text-slate-200">{l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
                      <td className="py-2 text-right text-slate-200">{l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-white/10 text-xs font-semibold">
                  <tr>
                    <td colSpan={2} className="py-2 text-slate-400">Total</td>
                    <td className="py-2 text-right text-white">{formatCurrency(detail.totalDebit)}</td>
                    <td className="py-2 text-right text-white">{formatCurrency(detail.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
              {detail.createdByEmail && (
                <p className="text-xs text-slate-600">Posted by {detail.createdByEmail}</p>
              )}
              {(detail.integrationLinks?.length ?? 0) > 0 && (
                <div className="text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-400">Source documents</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900">
              <h2 className="text-lg font-bold text-white">New Manual Journal</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-slate-500">Entry date</span>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="text-xs text-slate-500">Memo</span>
                  <input
                    type="text"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="e.g. Month-end adjustment"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Lines</span>
                  <button type="button" onClick={addLine} className="text-xs text-violet-400 hover:text-violet-300">+ Add line</button>
                </div>
                {lines.map((l, i) => (
                  <div key={l.key} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      {i === 0 && <span className="text-[10px] text-slate-600">Account</span>}
                      <select
                        value={l.accountId}
                        onChange={e => updateLine(l.key, { accountId: e.target.value })}
                        className="w-full px-2 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-xs"
                      >
                        <option value="">Select…</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <span className="text-[10px] text-slate-600">Description</span>}
                      <input
                        type="text"
                        value={l.description}
                        onChange={e => updateLine(l.key, { description: e.target.value })}
                        className="w-full px-2 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <span className="text-[10px] text-slate-600">Debit</span>}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.debit}
                        onChange={e => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                        className="w-full px-2 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-xs text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <span className="text-[10px] text-slate-600">Credit</span>}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.credit}
                        onChange={e => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                        className="w-full px-2 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-xs text-right"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pb-2">
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        disabled={lines.length <= 2}
                        className="text-slate-600 hover:text-red-400 disabled:opacity-30"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${totals.balanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                <div className="text-sm">
                  <span className="text-slate-400">Debit </span>
                  <span className="text-white font-medium">{formatCurrency(totals.debit)}</span>
                  <span className="text-slate-600 mx-2">·</span>
                  <span className="text-slate-400">Credit </span>
                  <span className="text-white font-medium">{formatCurrency(totals.credit)}</span>
                </div>
                {totals.balanced ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={14} /> Balanced</span>
                ) : (
                  <span className="text-xs text-amber-400">Out of balance by {formatCurrency(Math.abs(totals.debit - totals.credit))}</span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitLoading || !totals.balanced}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                >
                  {submitLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Post Journal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
