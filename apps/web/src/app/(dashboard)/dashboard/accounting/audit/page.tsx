'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingPageHeader,
  AccountingPanel,
  AccountingTable,
  AccountingTd,
  AccountingTh,
} from '@/components/accounting/accounting-ui'

type AuditRow = {
  id: string
  actorEmail: string
  eventType: string
  entityType: string
  entityId: string
  createdAt: string
}

export default function AccountingAuditPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '50' }
      if (entityFilter) params.entityType = entityFilter
      const res = await accountingApi.auditEvents(params) as { data: AuditRow[] }
      setRows(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit trail')
    } finally {
      setLoading(false)
    }
  }, [entityFilter])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Audit Trail"
        subtitle="Accounting events — journal approvals, period close, initialization"
        icon={Shield}
        actions={
          <button type="button" onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <AccountingPanel
        title="Recent events"
        actions={
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="input-field text-xs py-1.5 w-auto">
            <option value="">All entities</option>
            <option value="JournalEntry">JournalEntry</option>
            <option value="AccountingPeriod">AccountingPeriod</option>
            <option value="AccountingSettings">AccountingSettings</option>
          </select>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No audit events yet</p>
        ) : (
          <AccountingTable>
            <thead>
              <tr>
                <AccountingTh>When</AccountingTh>
                <AccountingTh>Actor</AccountingTh>
                <AccountingTh>Event</AccountingTh>
                <AccountingTh>Entity</AccountingTh>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <AccountingTd className="text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</AccountingTd>
                  <AccountingTd className="text-xs">{r.actorEmail}</AccountingTd>
                  <AccountingTd className="text-violet-400 text-xs">{r.eventType}</AccountingTd>
                  <AccountingTd className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.entityType} · {r.entityId.slice(0, 8)}…</AccountingTd>
                </tr>
              ))}
            </tbody>
          </AccountingTable>
        )}
      </AccountingPanel>
    </AccountingPageShell>
  )
}
