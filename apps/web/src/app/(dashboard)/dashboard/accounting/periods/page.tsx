'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Loader2, Lock, LockOpen, RefreshCw, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

type PeriodRow = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED'
  closedBy: string | null
  closedAt: string | null
  journalCount: number
}

type PeriodPreview = {
  period: PeriodRow
  profitAndLoss: { netIncome: number; revenue: { total: number }; grossProfit: number }
  pendingOutbox: number
  hasClosingJournal: boolean
  canSoftClose: boolean
  canHardClose: boolean
  canReopen: boolean
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  SOFT_CLOSED: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  HARD_CLOSED: 'text-red-400 bg-red-500/10 border-red-500/30',
}

export default function AccountingPeriodsPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PeriodPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const loadPeriods = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountingApi.periods() as { data: PeriodRow[] }
      setPeriods(res.data ?? [])
      if (res.data?.length && !selectedId) setSelectedId(res.data[0].id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load periods')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  const loadPreview = useCallback(async (id: string) => {
    try {
      const res = await accountingApi.periodPreview(id) as { data: PeriodPreview }
      setPreview(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load preview')
      setPreview(null)
    }
  }, [])

  useEffect(() => { if (hasAccess) loadPeriods() }, [hasAccess, loadPeriods])
  useEffect(() => { if (selectedId) loadPreview(selectedId) }, [selectedId, loadPreview])

  async function runAction(action: 'soft' | 'hard' | 'reopen') {
    if (!selectedId) return
    const labels = { soft: 'soft-close', hard: 'hard-close', reopen: 'reopen' }
    if (!confirm(`${labels[action]} period ${preview?.period.name}?`)) return
    setActionLoading(true)
    try {
      if (action === 'soft') await accountingApi.softClosePeriod(selectedId)
      else if (action === 'hard') await accountingApi.hardClosePeriod(selectedId)
      else await accountingApi.reopenPeriod(selectedId)
      toast.success(`Period ${labels[action]}d`)
      await loadPeriods()
      await loadPreview(selectedId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (!hasAccess) {
    return (
      <div className="p-6 text-center text-slate-400">
        <Link href="/settings" className="text-violet-400">Enable Accounting</Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/accounting" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2">
            <ArrowLeft size={12} /> Accounting
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-violet-400" size={24} />
            Period Closing
          </h1>
          <p className="text-sm text-slate-400 mt-1">Soft-close locks posting; hard-close transfers P&amp;L to retained earnings</p>
        </div>
        <button
          type="button"
          onClick={loadPeriods}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
      ) : (
        <div className="grid md:grid-cols-5 gap-4">
          <div className="md:col-span-2 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 text-xs font-semibold text-slate-400">Periods</div>
            <ul className="max-h-[360px] overflow-y-auto">
              {periods.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] ${selectedId === p.id ? 'bg-violet-500/10' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[p.status]}`}>{p.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.startDate} → {p.endDate}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 rounded-xl border border-white/10 p-5 space-y-4">
            {!preview ? (
              <p className="text-sm text-slate-500">Select a period</p>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-white">{preview.period.name}</h2>
                  <p className="text-xs text-slate-500">{preview.period.startDate} to {preview.period.endDate}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Net Income" value={formatCurrency(preview.profitAndLoss.netIncome)} />
                  <MiniStat label="Journals" value={String(preview.period.journalCount)} />
                </div>

                {preview.pendingOutbox > 0 && (
                  <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{preview.pendingOutbox} outbox item(s) pending — run Sync &amp; Post before closing</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {preview.canSoftClose && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => runAction('soft')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                    >
                      <Lock size={12} /> Soft Close
                    </button>
                  )}
                  {preview.canHardClose && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => runAction('hard')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white"
                    >
                      {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                      Hard Close
                    </button>
                  )}
                  {preview.canReopen && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => runAction('reopen')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <LockOpen size={12} /> Reopen
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong className="text-slate-500">Soft close</strong> blocks new journal entries.
                  <strong className="text-slate-500"> Hard close</strong> posts a closing entry (zeroes income/expense, transfers net to Retained Earnings 3100) and permanently locks the period until reopened.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <p className="text-base font-bold text-white mt-0.5">{value}</p>
    </div>
  )
}
