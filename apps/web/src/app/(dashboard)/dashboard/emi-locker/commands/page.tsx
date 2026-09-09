'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Filter } from 'lucide-react'
import { emiLockerApi } from '@/lib/api'
import { PageHeader } from '@/components/design-system/PageHeader'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { unwrapList } from '@/components/emi-locker/EmiLockerPages'
import { ClipboardList } from 'lucide-react'

type CommandRow = {
  id: string
  commandType: string
  status: string
  reason?: string | null
  requestedBy?: string | null
  createdAt: string
  executedAt?: string | null
  device?: { id: string; imei1: string; brand?: string | null; model?: string | null; customer?: { name: string } }
}

const TYPE_OPTS = [
  { value: '', label: 'All commands' },
  { value: 'APPLY_RESTRICTION', label: 'Apply restriction' },
  { value: 'REMOVE_RESTRICTION', label: 'Remove restriction' },
  { value: 'RELEASE_DEVICE', label: 'Release' },
  { value: 'SYNC_POLICY', label: 'Sync policy' },
  { value: 'REFRESH_STATUS', label: 'Refresh status' },
]

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'DRY_RUN', label: 'Dry run' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function EmiLockerCommandsPage() {
  const [rows, setRows] = useState<CommandRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [commandType, setCommandType] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (query.trim()) params.search = query.trim()
      if (commandType) params.commandType = commandType
      if (status) params.status = status
      const list = unwrapList<CommandRow>(await emiLockerApi.listCommands(params))
      setRows(list.rows)
      setTotal(list.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commands')
    } finally {
      setLoading(false)
    }
  }, [page, query, commandType, status])

  useEffect(() => {
    const t = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader title="Device commands" description={`${total} command${total === 1 ? '' : 's'} — includes DRY_RUN simulations`} />
      <div className="flex flex-wrap gap-3">
        <ToolbarSearch value={query} onChange={(v) => { setPage(1); setQuery(v) }} placeholder="Search IMEI, reason, user…" className="max-w-md" />
        <FilterDropdown value={commandType} onChange={(v) => { setPage(1); setCommandType(v) }} options={TYPE_OPTS} icon={Filter} placeholder="Command" active={!!commandType} onClear={() => setCommandType('')} />
        <FilterDropdown value={status} onChange={(v) => { setPage(1); setStatus(v) }} options={STATUS_OPTS} icon={Filter} placeholder="Status" active={!!status} onClear={() => setStatus('')} />
      </div>
      {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {!loading && !rows.length && !error && <EmptyState icon={ClipboardList} title="No commands" description="Restriction, restore and release actions will appear here." />}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ color: 'var(--text-secondary)' }}>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-subtle)' }}>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">Command</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested by</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Executed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3">
                    {row.device ? (
                      <Link href={`/dashboard/emi-locker/devices/${row.device.id}`} className="text-brand-400 hover:underline">
                        {row.device.imei1}
                      </Link>
                    ) : '—'}
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.device?.customer?.name}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{row.commandType}</td>
                  <td className="px-4 py-3">{row.reason || '—'}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.requestedBy || '—'}</td>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.executedAt ? new Date(row.executedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
