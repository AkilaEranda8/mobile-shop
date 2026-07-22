'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Loader2, Lock, LockOpen, RefreshCw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingKpiCard,
  AccountingPageHeader,
  AccountingPanel,
  AccountingStatusBadge,
  CYAN_ACCENT,
  VIOLET_ACCENT,
} from '@/components/accounting/accounting-ui'
import { useModuleAccess } from '@/lib/module-access'

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

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  OPEN: 'success',
  SOFT_CLOSED: 'warning',
  HARD_CLOSED: 'danger',
}

export default function AccountingPeriodsPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const { canEdit } = useModuleAccess()
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

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Period Closing"
        subtitle="Soft-close locks posting; hard-close transfers P&L to retained earnings"
        icon={Calendar}
        actions={
          <button type="button" onClick={loadPeriods} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-4 w-full">
          <AccountingPanel title="Periods" className="lg:col-span-4">
            <ul className="max-h-[400px] overflow-y-auto">
              {periods.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-white/[0.03] ${selectedId === p.id ? 'bg-violet-500/10' : ''}`}
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      <AccountingStatusBadge tone={STATUS_TONE[p.status]}>{p.status.replace('_', ' ')}</AccountingStatusBadge>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.startDate} → {p.endDate}</p>
                  </button>
                </li>
              ))}
            </ul>
          </AccountingPanel>

          <div className="lg:col-span-8 card p-5 space-y-4">
            {!preview ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a period</p>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{preview.period.name}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{preview.period.startDate} to {preview.period.endDate}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <AccountingKpiCard label="Net Income" value={formatCurrency(preview.profitAndLoss.netIncome)} accent={CYAN_ACCENT} />
                  <AccountingKpiCard label="Journals" value={preview.period.journalCount} accent={VIOLET_ACCENT} />
                </div>

                {preview.pendingOutbox > 0 && (
                  <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{preview.pendingOutbox} outbox item(s) pending — run Sync &amp; Post before closing</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {canEdit && preview.canSoftClose && (
                    <button type="button" disabled={actionLoading} onClick={() => runAction('soft')}
                      className="btn-secondary flex items-center gap-1.5 text-xs">
                      <Lock size={12} /> Soft Close
                    </button>
                  )}
                  {canEdit && preview.canHardClose && (
                    <button type="button" disabled={actionLoading} onClick={() => runAction('hard')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white">
                      {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                      Hard Close
                    </button>
                  )}
                  {canEdit && preview.canReopen && (
                    <button type="button" disabled={actionLoading} onClick={() => runAction('reopen')}
                      className="btn-secondary flex items-center gap-1.5 text-xs text-emerald-400 border-emerald-500/30">
                      <LockOpen size={12} /> Reopen
                    </button>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  <strong>Soft close</strong> blocks new journal entries.
                  <strong> Hard close</strong> posts a closing entry (zeroes income/expense, transfers net to Retained Earnings 3100) and permanently locks the period until reopened.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </AccountingPageShell>
  )
}
