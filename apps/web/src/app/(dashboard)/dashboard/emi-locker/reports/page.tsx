'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { emiLockerApi } from '@/lib/api'
import { PageHeader } from '@/components/design-system/PageHeader'
import { StatCard } from '@/components/design-system/StatCard'
import { money, unwrap } from '@/components/emi-locker/EmiLockerPages'

type DeviceRow = {
  id: string
  imei1: string
  deviceStatus: string
  onlineStatus?: string
  customer?: { name: string }
  agreement?: { agreementNumber: string; outstandingBalance: number }
}

export default function EmiLockerReportsPage() {
  const [collections, setCollections] = useState<Record<string, number> | null>(null)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [restricted, setRestricted] = useState<DeviceRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [c, d, r] = await Promise.all([
          unwrap<Record<string, number>>(await emiLockerApi.reportCollections()),
          unwrap<{ total: number; devices: DeviceRow[] }>(await emiLockerApi.reportDevices()),
          unwrap<{ restricted: DeviceRow[]; total: number }>(await emiLockerApi.reportRestrictions()),
        ])
        if (cancelled) return
        setCollections(c)
        setDevices(d.devices ?? [])
        setRestricted(r.restricted ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const counts = {
    active: devices.filter((d) => d.deviceStatus === 'ACTIVE').length,
    restricted: restricted.length || devices.filter((d) => d.deviceStatus === 'RESTRICTED').length,
    released: devices.filter((d) => d.deviceStatus === 'RELEASED').length,
    pending: devices.filter((d) => d.deviceStatus === 'PENDING_ENROLLMENT').length,
    offline: devices.filter((d) => d.onlineStatus === 'OFFLINE').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="EMI locker reports"
        description="Device counts from ManagedDevice; collections from Hire Purchase financial truth."
      />
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active" value={String(counts.active)} />
        <StatCard label="Restricted" value={String(counts.restricted)} />
        <StatCard label="Released" value={String(counts.released)} />
        <StatCard label="Pending enrollment" value={String(counts.pending)} />
        <StatCard label="Offline" value={String(counts.offline)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected" value={collections ? money(Number(collections.collectedAmount || 0)) : '—'} />
        <StatCard label="Outstanding" value={collections ? money(Number(collections.outstandingAmount || 0)) : '—'} />
        <StatCard label="Due today" value={collections ? String(collections.dueToday ?? 0) : '—'} />
        <StatCard label="Overdue accounts" value={collections ? String(collections.overdueAccounts ?? 0) : '—'} />
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Restriction report</h2>
        {!restricted.length ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No restricted devices</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead style={{ color: 'var(--text-secondary)' }}>
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">Customer</th>
                  <th className="px-2 py-2 font-medium">IMEI</th>
                  <th className="px-2 py-2 font-medium">HP</th>
                  <th className="px-2 py-2 font-medium">Outstanding</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {restricted.map((row) => (
                  <tr key={row.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-2 py-2">{row.customer?.name ?? '—'}</td>
                    <td className="px-2 py-2">
                      <Link href={`/dashboard/emi-locker/devices/${row.id}`} className="text-brand-400 hover:underline">{row.imei1}</Link>
                    </td>
                    <td className="px-2 py-2">{row.agreement?.agreementNumber ?? '—'}</td>
                    <td className="px-2 py-2">{money(row.agreement?.outstandingBalance || 0)}</td>
                    <td className="px-2 py-2">{row.deviceStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
