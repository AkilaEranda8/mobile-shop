'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { AlertTriangle, Filter, Lock, RefreshCw, Smartphone, WifiOff } from 'lucide-react'
import { emiLockerApi, hirePurchaseApi } from '@/lib/api'
import { PageHeader } from '@/components/design-system/PageHeader'
import { StatCard } from '@/components/design-system/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { useRolePermissions } from '@/lib/hooks'

function money(n: number) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === 'object' && 'data' in res) return (res as { data: T }).data
  return res as T
}

function unwrapList<T>(res: unknown): { rows: T[]; total: number; page?: number; limit?: number } {
  const body = res as { data?: T[]; meta?: { total?: number; page?: number; limit?: number } }
  if (Array.isArray(body?.data)) {
    return {
      rows: body.data,
      total: body.meta?.total ?? body.data.length,
      page: body.meta?.page,
      limit: body.meta?.limit,
    }
  }
  const data = unwrap<{ rows?: T[]; total?: number } | T[]>(res)
  if (Array.isArray(data)) return { rows: data, total: data.length }
  return { rows: data.rows ?? [], total: data.total ?? 0 }
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAYMENT_DUE', label: 'Payment due' },
  { value: 'GRACE_PERIOD', label: 'Grace period' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'RESTRICTED', label: 'Restricted' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'PENDING_ENROLLMENT', label: 'Pending enrollment' },
]

const ENROLLMENT_OPTIONS = [
  { value: '', label: 'All enrollment' },
  { value: 'ENROLLMENT_PENDING', label: 'Pending' },
  { value: 'QR_GENERATED', label: 'QR generated' },
  { value: 'ENROLLED', label: 'Enrolled' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ENROLLMENT_FAILED', label: 'Failed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const ONLINE_OPTIONS = [
  { value: '', label: 'All online' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

type DashboardData = {
  activeAgreements: number
  financedAmount: number
  collectedAmount: number
  outstandingAmount: number
  collectionPercentage: number
  dueToday: number
  overdueAccounts: number
  restrictedDevices: number
  activeDevices: number
  paymentDueDevices?: number
  gracePeriodDevices?: number
  releasedDevices?: number
  offlineDevices: number
  dryRunMode?: boolean
  androidManagementEnabled?: boolean
  androidManagementMode: string
}

type DeviceRow = {
  id: string
  imei1: string
  brand?: string | null
  model?: string | null
  deviceStatus: string
  enrollmentStatus?: string
  onlineStatus: string
  managementStatus?: string | null
  lastSeenAt?: string | null
  customer?: { name: string; phone: string }
  branch?: { name: string }
  agreement?: { id: string; agreementNumber: string; outstandingBalance: number; status: string }
}

function DryRunBanner({ dryRun, amapiEnabled }: { dryRun?: boolean; amapiEnabled?: boolean }) {
  if (dryRun === false && amapiEnabled) return null
  return (
    <div className="space-y-2">
      {(dryRun !== false) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          DRY RUN MODE — commands are recorded as <strong>DRY_RUN</strong>. No live Google Android Management policy is applied.
        </div>
      )}
      {!amapiEnabled && (
        <div className="rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }} role="status">
          ANDROID MANAGEMENT API — Status: <strong style={{ color: 'var(--text-primary)' }}>DISABLED</strong>
        </div>
      )}
    </div>
  )
}

function ConfirmModal({
  open,
  title,
  dryRun,
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean
  title: string
  dryRun?: boolean
  children: React.ReactNode
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {dryRun && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            DRY RUN MODE — confirming will simulate the action only.
          </div>
        )}
        <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>{children}</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EmiLockerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(unwrap<DashboardData>(await emiLockerApi.dashboard()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="EMI Device Locker"
        description="Managed devices linked to Hire Purchase. Restriction uses dry-run until AMAPI is approved."
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm inline-flex items-center gap-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <Link href="/dashboard/emi-locker/devices" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>Devices</Link>
            <Link href="/dashboard/emi-locker/enrollment" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">Enroll</Link>
          </div>
        }
      />
      {data && <DryRunBanner dryRun={data.dryRunMode} amapiEnabled={data.androidManagementEnabled} />}
      {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading dashboard…</p>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active devices" value={String(data.activeDevices)} icon={Smartphone} />
            <StatCard label="Payment due" value={String(data.paymentDueDevices ?? data.dueToday)} icon={AlertTriangle} />
            <StatCard label="Grace period" value={String(data.gracePeriodDevices ?? 0)} />
            <StatCard label="Restricted" value={String(data.restrictedDevices)} icon={Lock} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Overdue (HP)" value={String(data.overdueAccounts)} />
            <StatCard label="Released" value={String(data.releasedDevices ?? 0)} />
            <StatCard label="Offline" value={String(data.offlineDevices)} icon={WifiOff} />
            <StatCard label="Active EMI" value={String(data.activeAgreements)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Outstanding" value={money(data.outstandingAmount)} />
            <StatCard label="Collected" value={money(data.collectedAmount)} />
            <StatCard label="Due today" value={String(data.dueToday)} />
            <StatCard label="Collection %" value={`${data.collectionPercentage}%`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Device status distribution</h3>
              {(
                [
                  ['Active', data.activeDevices],
                  ['Payment due', data.paymentDueDevices ?? 0],
                  ['Grace', data.gracePeriodDevices ?? 0],
                  ['Restricted', data.restrictedDevices],
                  ['Released', data.releasedDevices ?? 0],
                  ['Offline', data.offlineDevices],
                ] as const
              ).map(([label, value]) => {
                const max = Math.max(
                  1,
                  data.activeDevices,
                  data.paymentDueDevices ?? 0,
                  data.gracePeriodDevices ?? 0,
                  data.restrictedDevices,
                  data.releasedDevices ?? 0,
                  data.offlineDevices,
                )
                return (
                  <div key={label} className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex justify-between"><span>{label}</span><span>{value}</span></div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted, rgba(255,255,255,0.06))' }}>
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round((value / max) * 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="rounded-xl border p-4 text-sm space-y-2" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Collection snapshot (Hire Purchase)</h3>
              <p>Outstanding {money(data.outstandingAmount)} · Collected {money(data.collectedAmount)} · Rate {data.collectionPercentage}%</p>
              <p>Due today {data.dueToday} · Overdue installments {data.overdueAccounts}</p>
              <p>AMAPI mode: <strong style={{ color: 'var(--text-primary)' }}>{data.androidManagementMode}</strong></p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function EmiLockerDevicesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<DeviceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [enrollmentStatus, setEnrollmentStatus] = useState(searchParams.get('enrollmentStatus') || '')
  const [onlineStatus, setOnlineStatus] = useState(searchParams.get('onlineStatus') || '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const limit = 20

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { page: String(page), limit: String(limit) }
      if (query.trim()) params.search = query.trim()
      if (status) params.status = status
      if (enrollmentStatus) params.enrollmentStatus = enrollmentStatus
      if (onlineStatus) params.onlineStatus = onlineStatus
      const res = await emiLockerApi.devices(params)
      const list = unwrapList<DeviceRow>(res)
      setRows(list.rows)
      setTotal(list.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [page, query, status, enrollmentStatus, onlineStatus])

  useEffect(() => {
    const t = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(t)
  }, [load])

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Managed devices"
        description={`${total} device${total === 1 ? '' : 's'} in EMI locker`}
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>Refresh</button>
            <Link href="/dashboard/emi-locker/enrollment" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">Add / enroll</Link>
          </div>
        }
      />
      <div className="flex flex-wrap gap-3">
        <ToolbarSearch
          value={query}
          onChange={(v) => { setPage(1); setQuery(v) }}
          placeholder="Search customer, IMEI, serial, HP agreement…"
          className="w-full max-w-none sm:max-w-md"
        />
        <FilterDropdown
          value={status}
          onChange={(v) => { setPage(1); setStatus(v) }}
          options={STATUS_OPTIONS}
          icon={Filter}
          placeholder="Status"
          active={!!status}
          onClear={() => setStatus('')}
        />
        <FilterDropdown
          value={enrollmentStatus}
          onChange={(v) => { setPage(1); setEnrollmentStatus(v) }}
          options={ENROLLMENT_OPTIONS}
          icon={Filter}
          placeholder="Enrollment"
          active={!!enrollmentStatus}
          onClear={() => setEnrollmentStatus('')}
        />
        <FilterDropdown
          value={onlineStatus}
          onChange={(v) => { setPage(1); setOnlineStatus(v) }}
          options={ONLINE_OPTIONS}
          icon={Filter}
          placeholder="Online"
          active={!!onlineStatus}
          onClear={() => setOnlineStatus('')}
        />
      </div>
      {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {!loading && !rows.length && !error && (
        <EmptyState icon={Smartphone} title="No managed devices" description="Register a device against an active hire-purchase agreement to begin enrollment." />
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ color: 'var(--text-secondary)' }}>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-subtle)' }}>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">IMEI</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Hire Purchase</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Enrollment</th>
                <th className="px-4 py-3 font-medium">Management</th>
                <th className="px-4 py-3 font-medium">Online</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b cursor-pointer hover:bg-white/5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onClick={() => router.push(`/dashboard/emi-locker/devices/${row.id}`)}
                >
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {[row.brand, row.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-brand-400">{row.imei1}</td>
                  <td className="px-4 py-3">{row.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.agreement?.agreementNumber ?? '—'}
                    {row.agreement ? (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {money(row.agreement.outstandingBalance)} · {row.agreement.status}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.branch?.name ?? '—'}</td>
                  <td className="px-4 py-3">{row.deviceStatus}</td>
                  <td className="px-4 py-3">{row.enrollmentStatus ?? '—'}</td>
                  <td className="px-4 py-3">{row.managementStatus ?? '—'}</td>
                  <td className="px-4 py-3">{row.onlineStatus}</td>
                  <td className="px-4 py-3">{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40" style={{ borderColor: 'var(--border-subtle)' }}>Prev</button>
          <span style={{ color: 'var(--text-secondary)' }}>Page {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40" style={{ borderColor: 'var(--border-subtle)' }}>Next</button>
        </div>
      )}
    </div>
  )
}

type HpAgreementOption = {
  id: string
  agreementNumber: string
  imei?: string
  imeiRecordId?: string | null
  brandName?: string | null
  modelName?: string | null
  status: string
  customer?: { id: string; name: string; phone: string }
  outstandingBalance?: number
}

export function EmiLockerEnrollmentPage() {
  const [agreements, setAgreements] = useState<HpAgreementOption[]>([])
  const [agreementId, setAgreementId] = useState('')
  const [consented, setConsented] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [amapiDisabled, setAmapiDisabled] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [enrollmentMeta, setEnrollmentMeta] = useState<{ code: string; expiresAt: string; status: string } | null>(null)
  const [expiresIn, setExpiresIn] = useState<string>('')

  const selected = useMemo(() => agreements.find((a) => a.id === agreementId), [agreements, agreementId])

  useEffect(() => {
    void (async () => {
      try {
        const res = await hirePurchaseApi.agreements({ limit: '100', status: 'ACTIVE' })
        const list = unwrapList<HpAgreementOption>(res)
        const rows = list.rows.length ? list.rows : (unwrap<HpAgreementOption[]>(res) || [])
        setAgreements(Array.isArray(rows) ? rows : [])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load agreements')
      }
    })()
  }, [])

  useEffect(() => {
    if (!enrollmentMeta?.expiresAt) return
    const tick = () => {
      const ms = new Date(enrollmentMeta.expiresAt).getTime() - Date.now()
      if (ms <= 0) {
        setExpiresIn('Expired')
        return
      }
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setExpiresIn(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [enrollmentMeta])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setMessage(null)
    setQrDataUrl(null)
    setEnrollmentMeta(null)
    try {
      const registered = unwrap<{ device: { id: string } }>(await emiLockerApi.registerDevice({
        agreementId: selected.id,
        customerId: selected.customer?.id,
        imei1: selected.imei || '',
        imeiRecordId: selected.imeiRecordId || null,
        brand: selected.brandName,
        model: selected.modelName,
        consented,
        consentVersion: 'v1',
      }))
      const deviceId = registered.device?.id
      if (!deviceId) throw new Error('Device registration failed')

      const enrollment = unwrap<{
        enrollment: { enrollmentCode: string; expiresAt: string; status: string; amapiDisabled?: boolean; message?: string }
        qr: { enrollmentToken?: string; provisioningQr?: string | null; amapiDisabled?: boolean; dryRun?: boolean }
        amapiDisabled?: boolean
        dryRun?: boolean
      }>(await emiLockerApi.createEnrollment(deviceId, {
        consented: true,
        consentVersion: 'v1',
        ttlMinutes: 15,
      }))

      setAmapiDisabled(Boolean(enrollment.amapiDisabled || enrollment.enrollment.amapiDisabled || enrollment.qr?.amapiDisabled))
      setDryRun(enrollment.dryRun !== false)
      setEnrollmentMeta({
        code: enrollment.enrollment.enrollmentCode,
        expiresAt: enrollment.enrollment.expiresAt,
        status: enrollment.enrollment.status,
      })
      setMessage(enrollment.enrollment.message || 'Enrollment created')

      const qrSource = enrollment.qr?.provisioningQr || enrollment.qr?.enrollmentToken
      if (qrSource && !enrollment.amapiDisabled) {
        setQrDataUrl(await QRCode.toDataURL(qrSource, { width: 280, margin: 1 }))
      } else {
        setQrDataUrl(null)
      }
      toast.success('Enrollment created')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Enrollment failed'
      setMessage(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Device enrollment"
        description="Select an existing Hire Purchase agreement, confirm consent, then generate a short-lived enrollment."
      />
      <DryRunBanner dryRun={dryRun} amapiEnabled={!amapiDisabled} />
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <label className="block space-y-1 text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Hire purchase agreement</span>
          <select
            required
            value={agreementId}
            onChange={(e) => setAgreementId(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="">Select agreement…</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.agreementNumber} — {a.customer?.name ?? 'Customer'} — {a.imei || 'no IMEI'}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="rounded-lg border px-3 py-2 text-sm space-y-1" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <div>Customer: <strong style={{ color: 'var(--text-primary)' }}>{selected.customer?.name}</strong> {selected.customer?.phone}</div>
            <div>IMEI: <strong style={{ color: 'var(--text-primary)' }}>{selected.imei || '—'}</strong></div>
            <div>Device: {[selected.brandName, selected.modelName].filter(Boolean).join(' ') || '—'}</div>
            <div>Outstanding: {money(selected.outstandingBalance || 0)}</div>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-1" />
          <span>
            Customer agrees to device management under the EMI / hire-purchase agreement. Restriction may apply after grace periods.
            Legal wording must be reviewed for the jurisdiction before production.
          </span>
        </label>
        <button
          type="submit"
          disabled={!consented || !agreementId || busy || !selected?.imei}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Working…' : 'Register & generate enrollment'}
        </button>
      </form>

      {enrollmentMeta && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enrollment <strong style={{ color: 'var(--text-primary)' }}>{enrollmentMeta.code}</strong> · {enrollmentMeta.status}
          </div>
          <div className="text-sm">Expires: <strong>{expiresIn || enrollmentMeta.expiresAt}</strong></div>
          {amapiDisabled ? (
            <div className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              AMAPI DISABLED — no Google enrollment QR was issued. Hexalyte enrollment record exists for dry-run workflow testing only.
            </div>
          ) : qrDataUrl ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Enrollment QR" className="rounded-lg bg-white p-2" width={280} height={280} />
              {dryRun && <p className="text-xs text-amber-200">DRY RUN QR — not a live Google Enterprise provisioning code.</p>}
            </div>
          ) : null}
          {message && <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{message}</p>}
        </div>
      )}
    </div>
  )
}

export function EmiLockerSettingsPage() {
  const perms = useRolePermissions()
  const canEdit = perms.canEdit('EMI_LOCKER')
  const [form, setForm] = useState({
    enabled: true,
    dryRunEnabled: true,
    automaticRestriction: true,
    manualApprovalRequired: false,
    autoRestoreEnabled: true,
    autoReleaseEnabled: true,
    gracePeriodDays: 0,
    warningDays: 3,
    restrictionExtraGraceDays: 0,
    consentText: '',
    supportPhone: '',
    supportEmail: '',
    paymentInfoText: '',
  })
  const [amapiEnabled, setAmapiEnabled] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const [settings, dash] = await Promise.all([
          unwrap<Record<string, unknown>>(await emiLockerApi.settings()),
          unwrap<DashboardData>(await emiLockerApi.dashboard()),
        ])
        setAmapiEnabled(Boolean(dash.androidManagementEnabled))
        setForm((f) => ({
          ...f,
          enabled: settings.enabled !== false,
          dryRunEnabled: settings.dryRunEnabled !== false,
          automaticRestriction: settings.automaticRestriction !== false,
          manualApprovalRequired: Boolean(settings.manualApprovalRequired),
          autoRestoreEnabled: settings.autoRestoreEnabled !== false,
          autoReleaseEnabled: settings.autoReleaseEnabled !== false,
          gracePeriodDays: Number(settings.gracePeriodDays ?? 0),
          warningDays: Number(settings.warningDays ?? 3),
          restrictionExtraGraceDays: Number(settings.restrictionExtraGraceDays ?? 0),
          consentText: String(settings.consentText ?? ''),
          supportPhone: String(settings.supportPhone ?? ''),
          supportEmail: String(settings.supportEmail ?? ''),
          paymentInfoText: String(settings.paymentInfoText ?? ''),
        }))
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function save() {
    if (!canEdit) return
    setMessage(null)
    try {
      await emiLockerApi.updateSettings(form)
      setMessage('Settings saved')
      toast.success('Settings saved')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setMessage(msg)
      toast.error(msg)
    }
  }

  const toggle = (key: keyof typeof form) => setForm((f) => ({ ...f, [key]: !f[key] }))

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="EMI locker settings" description="Branch-scoped locker behaviour. Shop users cannot enable live AMAPI." />
      <DryRunBanner dryRun={form.dryRunEnabled} amapiEnabled={amapiEnabled} />
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)' }}>
          {([
            ['enabled', 'EMI locker enabled'],
            ['dryRunEnabled', 'Dry run'],
            ['automaticRestriction', 'Automatic restriction'],
            ['manualApprovalRequired', 'Manual approval required'],
            ['autoRestoreEnabled', 'Automatic restore'],
            ['autoReleaseEnabled', 'Automatic release'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm" style={{ color: 'var(--text-primary)' }}>
              {label}
              <input type="checkbox" checked={Boolean(form[key])} disabled={!canEdit} onChange={() => toggle(key)} />
            </label>
          ))}
          <label className="block space-y-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Grace period days (extra)</span>
            <input type="number" min={0} value={form.gracePeriodDays} disabled={!canEdit} onChange={(e) => setForm({ ...form, gracePeriodDays: Number(e.target.value) })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} />
          </label>
          <label className="block space-y-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Warning days</span>
            <input type="number" min={0} value={form.warningDays} disabled={!canEdit} onChange={(e) => setForm({ ...form, warningDays: Number(e.target.value) })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} />
          </label>
          <label className="block space-y-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Consent text</span>
            <textarea value={form.consentText} disabled={!canEdit} onChange={(e) => setForm({ ...form, consentText: e.target.value })} rows={4} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} />
          </label>
          <label className="block space-y-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Support phone</span>
            <input value={form.supportPhone} disabled={!canEdit} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} />
          </label>
          <label className="block space-y-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Payment info text</span>
            <textarea value={form.paymentInfoText} disabled={!canEdit} onChange={(e) => setForm({ ...form, paymentInfoText: e.target.value })} rows={3} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} />
          </label>
          {canEdit && (
            <button type="button" onClick={() => void save()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Save</button>
          )}
          {message && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>}
        </div>
      )}
    </div>
  )
}

export { ConfirmModal, DryRunBanner, money, unwrap, unwrapList }
