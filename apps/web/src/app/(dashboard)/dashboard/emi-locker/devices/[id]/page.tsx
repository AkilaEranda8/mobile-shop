'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { emiLockerApi } from '@/lib/api'
import { PageHeader } from '@/components/design-system/PageHeader'
import { ConfirmModal, DryRunBanner, money, unwrap } from '@/components/emi-locker/EmiLockerPages'
import { useRolePermissions } from '@/lib/hooks'

type DeviceDetail = {
  id: string
  imei1: string
  imei2?: string | null
  serialNumber?: string | null
  brand?: string | null
  model?: string | null
  androidVersion?: string | null
  deviceStatus: string
  enrollmentStatus: string
  managementStatus?: string | null
  onlineStatus: string
  lastSeenAt?: string | null
  enrolledAt?: string | null
  restrictedAt?: string | null
  restoredAt?: string | null
  releasedAt?: string | null
  customer?: { name: string; phone: string; email?: string | null }
  agreement?: {
    id: string
    agreementNumber: string
    outstandingBalance: number
    status: string
    firstDueDate?: string
    installments?: Array<{ sequence: number; dueDate: string; outstanding: number; status: string }>
  }
  activePolicy?: { name: string; kind: string } | null
  commands?: Array<{
    id: string
    commandType: string
    status: string
    reason?: string | null
    requestedBy?: string | null
    createdAt: string
    executedAt?: string | null
    failureReason?: string | null
  }>
  events?: Array<{ id: string; eventType: string; createdAt: string; source?: string }>
  enrollments?: Array<{ id: string; enrollmentCode: string; status: string; expiresAt: string }>
  auditEvents?: Array<{
    id: string
    eventType: string
    entityType: string
    actorEmail: string
    createdAt: string
  }>
}

export default function EmiLockerDeviceDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const perms = useRolePermissions()
  const canEdit = perms.canEdit('EMI_LOCKER')
  const [device, setDevice] = useState<DeviceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [modal, setModal] = useState<'restrict' | 'restore' | 'release' | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      const [d, dash] = await Promise.all([
        unwrap<DeviceDetail>(await emiLockerApi.device(id)),
        unwrap<{ dryRunMode?: boolean }>(await emiLockerApi.dashboard()),
      ])
      setDevice(d)
      setDryRun(dash.dryRunMode !== false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load device')
    }
  }, [id])

  useEffect(() => {
    if (id) void load()
  }, [id, load])

  async function run(action: 'sync' | 'restrict' | 'restore' | 'release') {
    setBusy(true)
    try {
      if (action === 'sync') await emiLockerApi.syncDevice(id)
      if (action === 'restrict') await emiLockerApi.restrictDevice(id, { reason: reason || 'Manual restriction' })
      if (action === 'restore') await emiLockerApi.restoreDevice(id, { reason: reason || 'Manual restore' })
      if (action === 'release') await emiLockerApi.releaseDevice(id, { reason: reason || 'Manual release' })
      toast.success(
        dryRun && action !== 'sync'
          ? `${action} simulated (DRY_RUN)`
          : `${action} completed`,
      )
      setModal(null)
      setReason('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const status = device?.deviceStatus
  const hpStatus = device?.agreement?.status
  const nextInstallment = device?.agreement?.installments?.find((i) =>
    ['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device detail"
        description={device ? `${device.imei1} · ${device.deviceStatus}` : id}
        actions={
          <Link href="/dashboard/emi-locker/devices" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
            Back
          </Link>
        }
      />
      <DryRunBanner dryRun={dryRun} />
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {!device && !error && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {device && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Device information">
              <Row label="Brand / model" value={[device.brand, device.model].filter(Boolean).join(' ') || '—'} />
              <Row label="IMEI 1" value={device.imei1} />
              <Row label="IMEI 2" value={device.imei2 || '—'} />
              <Row label="Serial" value={device.serialNumber || '—'} />
              <Row label="Android" value={device.androidVersion || '—'} />
            </Section>
            <Section title="Customer">
              <Row label="Name" value={device.customer?.name || '—'} />
              <Row label="Phone" value={device.customer?.phone || '—'} />
              <Row label="Email" value={device.customer?.email || '—'} />
            </Section>
            <Section title="Hire purchase">
              <Row
                label="Agreement"
                value={
                  device.agreement ? (
                    <Link href={`/dashboard/hire-purchase/agreements?id=${device.agreement.id}`} className="text-brand-400 hover:underline">
                      {device.agreement.agreementNumber}
                    </Link>
                  ) : '—'
                }
              />
              <Row label="Status" value={device.agreement?.status || '—'} />
              <Row label="Outstanding" value={money(device.agreement?.outstandingBalance || 0)} />
              <Row label="Next due" value={nextInstallment ? new Date(nextInstallment.dueDate).toLocaleDateString() : '—'} />
            </Section>
            <Section title="Management">
              <Row label="Device status" value={device.deviceStatus} />
              <Row label="Enrollment" value={device.enrollmentStatus} />
              <Row label="Management" value={device.managementStatus || '—'} />
              <Row label="Online" value={device.onlineStatus} />
              <Row label="Last seen" value={device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '—'} />
              <Row label="Restricted at" value={device.restrictedAt ? new Date(device.restrictedAt).toLocaleString() : '—'} />
              <Row label="Restored at" value={device.restoredAt ? new Date(device.restoredAt).toLocaleString() : '—'} />
              <Row label="Released at" value={device.releasedAt ? new Date(device.releasedAt).toLocaleString() : '—'} />
              <Row label="Policy" value={device.activePolicy ? `${device.activePolicy.name} (${device.activePolicy.kind})` : '—'} />
            </Section>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void run('sync')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" style={{ borderColor: 'var(--border-subtle)' }}>Sync</button>
              <Link href="/dashboard/emi-locker/enrollment" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>Generate enrollment</Link>
              {status !== 'RESTRICTED' && status !== 'RELEASED' && (
                <button type="button" disabled={busy} onClick={() => setModal('restrict')} className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-300 disabled:opacity-40">Apply restriction</button>
              )}
              {status === 'RESTRICTED' && (
                <button type="button" disabled={busy} onClick={() => setModal('restore')} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Restore</button>
              )}
              {hpStatus === 'COMPLETED' && status !== 'RELEASED' && (
                <button type="button" disabled={busy} onClick={() => setModal('release')} className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 disabled:opacity-40">Release</button>
              )}
            </div>
          )}

          <Section title="Commands">
            <SimpleTable
              headers={['Command', 'Status', 'Requested by', 'Created', 'Executed', 'Failure']}
              rows={(device.commands || []).map((c) => [
                c.commandType,
                c.status,
                c.requestedBy || '—',
                new Date(c.createdAt).toLocaleString(),
                c.executedAt ? new Date(c.executedAt).toLocaleString() : '—',
                c.failureReason || '—',
              ])}
            />
          </Section>
          <Section title="Events">
            <SimpleTable
              headers={['Event', 'Source', 'When']}
              rows={(device.events || []).map((e) => [
                e.eventType,
                e.source || '—',
                new Date(e.createdAt).toLocaleString(),
              ])}
            />
          </Section>
          <Section title="Enrollment history">
            <SimpleTable
              headers={['Code', 'Status', 'Expires']}
              rows={(device.enrollments || []).map((e) => [
                e.enrollmentCode,
                e.status,
                new Date(e.expiresAt).toLocaleString(),
              ])}
            />
          </Section>
          <Section title="Audit">
            <SimpleTable
              headers={['Event', 'Entity', 'Actor', 'When']}
              rows={(device.auditEvents || []).map((a) => [
                a.eventType,
                a.entityType,
                a.actorEmail || '—',
                new Date(a.createdAt).toLocaleString(),
              ])}
            />
          </Section>
        </>
      )}

      <ConfirmModal
        open={modal === 'restrict'}
        title="Restrict device?"
        dryRun={dryRun}
        confirmLabel={dryRun ? 'Confirm (dry run)' : 'Confirm restriction'}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => void run('restrict')}
      >
        <p>Customer: {device?.customer?.name}</p>
        <p>IMEI: {device?.imei1}</p>
        <p>Outstanding: {money(device?.agreement?.outstandingBalance || 0)}</p>
        <label className="block space-y-1">
          <span>Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} />
        </label>
      </ConfirmModal>

      <ConfirmModal
        open={modal === 'restore'}
        title="Restore device?"
        dryRun={dryRun}
        confirmLabel={dryRun ? 'Restore (dry run)' : 'Restore'}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => void run('restore')}
      >
        <p>Outstanding: {money(device?.agreement?.outstandingBalance || 0)}</p>
        <p>HP status: {device?.agreement?.status}</p>
        <p>Backend will re-check restore eligibility from Hire Purchase.</p>
      </ConfirmModal>

      <ConfirmModal
        open={modal === 'release'}
        title="Release device"
        dryRun={dryRun}
        confirmLabel={dryRun ? 'Release (dry run)' : 'Release device'}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => void run('release')}
      >
        <p>Allowed only when Hire Purchase is fully completed.</p>
        <p>Agreement: {device?.agreement?.agreementNumber}</p>
        <p>Outstanding: {money(device?.agreement?.outstandingBalance || 0)}</p>
        <p>Status: {device?.agreement?.status}</p>
      </ConfirmModal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 text-sm space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4" style={{ color: 'var(--text-secondary)' }}>
      <span>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) {
    return <p style={{ color: 'var(--text-secondary)' }}>No records</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead style={{ color: 'var(--text-secondary)' }}>
          <tr>
            {headers.map((h) => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {r.map((c, j) => <td key={j} className="px-2 py-2" style={{ color: 'var(--text-primary)' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
