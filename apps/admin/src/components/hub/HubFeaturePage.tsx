'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  RefreshCw,
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageCircle,
  Server,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  fashionPlatform,
  fetchFashionBillingSummary,
  fetchFashionHealth,
  fetchFashionAuditLogs,
  fetchFashionUsers,
  fetchFashionPlatformConfig,
  fetchFashionPlans,
  fetchFashionTenants,
  updateFashionPlatformConfig,
} from '@/lib/fashion-api'
import { salonPlatform, fetchSalonTenants } from '@/lib/salon-api'
import HubSubscriptionsManage from '@/components/hub/HubSubscriptionsManage'

export type HubProductKind = 'fashion' | 'salon'
export type HubFeatureKey =
  | 'subscriptions'
  | 'whatsapp'
  | 'auth-iam'
  | 'system-health'
  | 'analytics'
  | 'activity-logs'
  | 'notifications'
  | 'feature-suggestions'
  | 'announcements'
  | 'release-notes'
  | 'master-catalog'
  | 'support-tools'
  | 'settings'

const TITLES: Record<HubFeatureKey, string> = {
  subscriptions: 'Subscriptions & Billing',
  whatsapp: 'Platform WhatsApp',
  'auth-iam': 'Auth / IAM',
  'system-health': 'System Health',
  analytics: 'Analytics',
  'activity-logs': 'Activity Logs',
  notifications: 'Notifications',
  'feature-suggestions': 'Feature Suggestions',
  announcements: 'Announcements',
  'release-notes': 'Release Notes',
  'master-catalog': 'Master Catalog',
  'support-tools': 'Support Tools',
  settings: 'Settings',
}

/* ── helpers ─────────────────────────────────────────────────── */

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of [
      'data',
      'items',
      'rows',
      'tenants',
      'logs',
      'admins',
      'users',
      'subscriptions',
      'plans',
      'invoices',
      'recentInvoices',
      'notifications',
      'categories',
      'notes',
    ]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[]
    }
  }
  return []
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = '—'): string {
  if (v == null || v === '') return fallback
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

function fmtMoney(n: number) {
  if (Math.abs(n) >= 100000) return `Rs.${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${Math.round(n).toLocaleString()}`
}

function fmtDate(v: unknown) {
  if (!v) return '—'
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return str(v)
  return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}

function badgeClass(raw: string) {
  const s = raw.toUpperCase()
  if (['ACTIVE', 'HEALTHY', 'CONNECTED', 'PUBLISHED', 'SENT', 'SUCCESS', 'PAID', 'OK'].includes(s))
    return 'badge-green'
  if (['TRIAL', 'PENDING', 'DRAFT', 'DEGRADED', 'UNDER_REVIEW', 'QUEUED'].includes(s))
    return 'badge-yellow'
  if (['SUSPENDED', 'DOWN', 'FAILED', 'CANCELLED', 'DISCONNECTED', 'REVOKED', 'REJECTED'].includes(s))
    return 'badge-red'
  if (['ENTERPRISE', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(s)) return 'badge-purple'
  if (['PRO', 'PROFESSIONAL', 'OWNER'].includes(s)) return 'badge-blue'
  return 'badge-gray'
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k]
  }
  return undefined
}

/* ── UI atoms ────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: string | number
  icon: typeof DollarSign
  hint?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <Icon size={16} className="text-gray-400" />
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-gray-400 mt-1">{hint}</p> : null}
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Empty({ text = 'No data yet' }: { text?: string }) {
  return <p className="text-sm text-gray-400 py-8 text-center">{text}</p>
}

function DataTable({
  rows,
  columns,
  empty = 'No rows',
}: {
  rows: Record<string, unknown>[]
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[]
  empty?: string
}) {
  if (!rows.length) return <Empty text={empty} />
  return (
    <div className="overflow-x-auto -mx-4 -mb-4">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2.5 font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.slice(0, 100).map((row, i) => (
            <tr key={String(row.id ?? i)} className="hover:bg-gray-50/80">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 text-gray-700 max-w-[220px] truncate">
                  {c.render ? c.render(row) : str(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ value }: { value: unknown }) {
  const s = str(value, '')
  if (!s || s === '—') return <span className="text-gray-400">—</span>
  return <span className={badgeClass(s)}>{s}</span>
}

function KvGrid({ data, keys }: { data: Record<string, unknown>; keys?: string[] }) {
  const entries = (keys ?? Object.keys(data))
    .filter((k) => data[k] != null && typeof data[k] !== 'object')
    .slice(0, 16)
  if (!entries.length) return <Empty />
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {entries.map((k) => (
        <div key={k} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-gray-400">{k}</dt>
          <dd className="text-sm font-medium text-gray-900 mt-0.5 break-all">{str(data[k])}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ── data loaders ────────────────────────────────────────────── */

async function loadFeature(product: HubProductKind, feature: HubFeatureKey): Promise<unknown> {
  if (product === 'fashion') {
    switch (feature) {
      case 'subscriptions':
        return {
          billing: await fetchFashionBillingSummary(),
          plans: await fetchFashionPlans(),
        }
      case 'whatsapp':
        return fashionPlatform.waStatus()
      case 'auth-iam':
        return {
          users: await fetchFashionUsers({ limit: '50' }),
          admins: await fashionPlatform.listAdmins(),
        }
      case 'system-health':
        return fetchFashionHealth()
      case 'analytics':
        return {
          analytics: await fashionPlatform.analytics(),
          mrrChart: await fashionPlatform.mrrChart(),
        }
      case 'activity-logs':
        return fetchFashionAuditLogs({ limit: '50' })
      case 'notifications':
        return fashionPlatform.notifications()
      case 'feature-suggestions':
        return {
          summary: await fashionPlatform.suggestionsSummary(),
          list: await fashionPlatform.listSuggestions({ limit: '50' }),
        }
      case 'announcements':
        return fashionPlatform.listAnnouncements()
      case 'release-notes':
        return fashionPlatform.listReleases()
      case 'master-catalog':
        return {
          message:
            'Fashion ERP has no platform master phone catalog. Tenant product catalogs are managed inside each shop.',
        }
      case 'support-tools':
        return {
          notes: await fashionPlatform.listNotes(),
          tenants: (await fetchFashionTenants()).data.slice(0, 20),
        }
      case 'settings':
        return fetchFashionPlatformConfig()
    }
  }

  switch (feature) {
    case 'subscriptions':
      return {
        subscriptions: await salonPlatform.subscriptions(),
        plans: await salonPlatform.plans(),
        invoices: await salonPlatform.invoices(),
      }
    case 'whatsapp':
      return salonPlatform.waStatus()
    case 'auth-iam':
      return salonPlatform.admins()
    case 'system-health':
      return salonPlatform.monitoring()
    case 'analytics':
      return {
        analytics: await salonPlatform.analytics(),
        mrrChart: await salonPlatform.mrrChart(),
      }
    case 'activity-logs':
      return salonPlatform.activityLogs({ limit: '50' })
    case 'notifications':
      return salonPlatform.notifications()
    case 'feature-suggestions':
      return {
        summary: await salonPlatform.suggestionsSummary(),
        list: await salonPlatform.listSuggestions({ limit: '50' }),
      }
    case 'announcements':
      return salonPlatform.listAnnouncements()
    case 'release-notes':
      return salonPlatform.listReleases()
    case 'master-catalog':
      return salonPlatform.catalog()
    case 'support-tools':
      return {
        tenants: (await fetchSalonTenants({ limit: '20' })).data,
        note: 'Use Impersonate / Revoke sessions actions below.',
      }
    case 'settings':
      return {
        maintenance: await salonPlatform.maintenance(),
        smtpSms: await salonPlatform.smtpSms(),
      }
  }
}

/* ── feature bodies ──────────────────────────────────────────── */

function SubscriptionsView({ product, data }: { product: HubProductKind; data: unknown }) {
  const root = asObj(data)

  if (product === 'fashion') {
    const billing = asObj(root.billing)
    const byPlan = asObj(billing.byPlan)
    const planRows = Object.entries(byPlan).map(([plan, raw]) => {
      const p = asObj(raw)
      return {
        plan,
        tenants: num(p.tenants ?? p.count ?? p.total),
        mrr: num(p.mrr ?? p.revenue),
        status: str(p.status, 'ACTIVE'),
      }
    })
    const invoices = asList(billing.recentInvoices ?? billing.invoices)
    const plans = asList(root.plans)

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="MRR" value={fmtMoney(num(billing.mrr))} icon={DollarSign} />
          <StatCard label="ARR" value={fmtMoney(num(billing.arr))} icon={TrendingUp} />
          <StatCard label="Tenants" value={num(billing.totalTenants)} icon={Building2} />
          <StatCard
            label="Plans"
            value={planRows.length || plans.length}
            icon={Users}
            hint="Active plan tiers"
          />
        </div>

        <Section title="Revenue by plan">
          <DataTable
            rows={planRows}
            columns={[
              {
                key: 'plan',
                label: 'Plan',
                render: (r) => <StatusBadge value={r.plan} />,
              },
              { key: 'tenants', label: 'Tenants' },
              {
                key: 'mrr',
                label: 'MRR',
                render: (r) => fmtMoney(num(r.mrr)),
              },
            ]}
            empty="No plan breakdown"
          />
        </Section>

        {plans.length > 0 && (
          <Section title="Subscription plans">
            <DataTable
              rows={plans}
              columns={[
                {
                  key: 'name',
                  label: 'Plan',
                  render: (r) => str(pick(r, ['name', 'code', 'plan', 'id'])),
                },
                {
                  key: 'price',
                  label: 'Price',
                  render: (r) => {
                    const price = pick(r, ['price', 'mrr', 'monthlyPrice', 'amount'])
                    return price != null && typeof price !== 'object' ? fmtMoney(num(price)) : '—'
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge value={pick(r, ['status', 'active'])} />,
                },
              ]}
            />
          </Section>
        )}

        <Section title="Recent invoices">
          <DataTable
            rows={invoices}
            columns={[
              {
                key: 'tenant',
                label: 'Tenant',
                render: (r) =>
                  str(
                    pick(r, ['tenantName', 'tenant', 'shopName', 'name']) ??
                      asObj(r.tenant).name,
                  ),
              },
              {
                key: 'amount',
                label: 'Amount',
                render: (r) => fmtMoney(num(pick(r, ['amount', 'total', 'mrr']))),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge value={pick(r, ['status', 'paymentStatus'])} />,
              },
              {
                key: 'date',
                label: 'Date',
                render: (r) => fmtDate(pick(r, ['createdAt', 'date', 'issuedAt', 'dueDate'])),
              },
            ]}
            empty="No recent invoices"
          />
        </Section>
      </div>
    )
  }

  const subs = asList(root.subscriptions)
  const plans = asList(root.plans)
  const invoices = asList(root.invoices)
  const active = subs.filter((s) => String(s.status || '').toUpperCase() === 'ACTIVE').length
  const mrr = subs.reduce((sum, s) => sum + num(pick(s, ['mrr', 'amount', 'price'])), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Subscriptions" value={subs.length} icon={Users} />
        <StatCard label="Active" value={active} icon={CheckCircle} />
        <StatCard label="Est. MRR" value={fmtMoney(mrr)} icon={DollarSign} />
        <StatCard label="Invoices" value={invoices.length} icon={TrendingUp} />
      </div>

      <Section title="Subscriptions">
        <DataTable
          rows={subs}
          columns={[
            {
              key: 'tenant',
              label: 'Tenant',
              render: (r) =>
                str(pick(r, ['tenantName', 'name', 'slug']) ?? asObj(r.tenant).name),
            },
            {
              key: 'plan',
              label: 'Plan',
              render: (r) => <StatusBadge value={pick(r, ['plan', 'planName', 'plan_id'])} />,
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={r.status} />,
            },
            {
              key: 'mrr',
              label: 'MRR',
              render: (r) => fmtMoney(num(pick(r, ['mrr', 'amount', 'price']))),
            },
            {
              key: 'end',
              label: 'Period end',
              render: (r) =>
                fmtDate(pick(r, ['current_period_end', 'endsAt', 'endDate', 'trial_ends_at'])),
            },
          ]}
        />
      </Section>

      <Section title="Plans">
        <DataTable
          rows={plans}
          columns={[
            {
              key: 'name',
              label: 'Plan',
              render: (r) => str(pick(r, ['name', 'code', 'slug', 'id'])),
            },
            {
              key: 'price',
              label: 'Price',
              render: (r) => fmtMoney(num(pick(r, ['price', 'monthly_price', 'amount', 'mrr']))),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={pick(r, ['status', 'is_active'])} />,
            },
          ]}
        />
      </Section>

      <Section title="Invoices">
        <DataTable
          rows={invoices}
          columns={[
            {
              key: 'tenant',
              label: 'Tenant',
              render: (r) =>
                str(pick(r, ['tenantName', 'name']) ?? asObj(r.tenant).name),
            },
            {
              key: 'amount',
              label: 'Amount',
              render: (r) => fmtMoney(num(pick(r, ['amount', 'total', 'total_amount']))),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={r.status} />,
            },
            {
              key: 'date',
              label: 'Date',
              render: (r) => fmtDate(pick(r, ['createdAt', 'created_at', 'issuedAt', 'date'])),
            },
          ]}
        />
      </Section>
    </div>
  )
}

function AnalyticsView({ data }: { data: unknown }) {
  const root = asObj(data)
  const analytics = asObj(root.analytics)
  const chartRaw = Array.isArray(root.mrrChart) ? root.mrrChart : asList(root.mrrChart)
  const chart = chartRaw.map((p) => ({
    month: str(pick(p, ['month', 'label', 'date']), ''),
    mrr: num(pick(p, ['mrr', 'value', 'amount'])),
  }))

  const kpiKeys = [
    'totalTenants',
    'activeTenants',
    'activePaid',
    'activeTrials',
    'mrr',
    'arr',
    'totalUsers',
    'estimatedMrr',
    'suspended',
    'totalGMV',
  ]
  const kpis = kpiKeys
    .filter((k) => analytics[k] != null)
    .map((k) => ({
      key: k,
      value:
        k === 'mrr' || k === 'arr' || k === 'estimatedMrr' || k === 'totalGMV'
          ? fmtMoney(num(analytics[k]))
          : num(analytics[k]),
    }))

  return (
    <div className="space-y-4">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <StatCard
              key={k.key}
              label={k.key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              value={k.value}
              icon={TrendingUp}
            />
          ))}
        </div>
      )}

      <Section title="MRR trend">
        {chart.length === 0 ? (
          <Empty text="No chart data" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Area type="monotone" dataKey="mrr" stroke="#111827" fill="#e5e7eb" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Breakdown">
        <KvGrid data={analytics} />
      </Section>
    </div>
  )
}

function HealthView({ data }: { data: unknown }) {
  const root = asObj(data)
  const services = Object.entries(root)
    .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
    .map(([key, raw]) => {
      const s = asObj(raw)
      return {
        key,
        status: str(pick(s, ['status', 'state', 'healthy']), 'UNKNOWN'),
        latency: pick(s, ['responseTimeMs', 'latencyMs', 'ms']),
        detail: str(pick(s, ['message', 'detail', 'error']), ''),
      }
    })

  const flat = Object.entries(root).filter(([, v]) => typeof v !== 'object')

  return (
    <div className="space-y-4">
      {services.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => {
            const up = /healthy|ok|up|connected|running/i.test(s.status)
            const Icon = up ? CheckCircle : /degraded|warn/i.test(s.status) ? AlertTriangle : XCircle
            return (
              <div key={s.key} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-900 capitalize">{s.key}</p>
                  </div>
                  <Icon
                    size={16}
                    className={
                      up ? 'text-emerald-500' : /degraded|warn/i.test(s.status) ? 'text-amber-500' : 'text-red-500'
                    }
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge value={s.status} />
                  {s.latency != null ? (
                    <span className="text-xs text-gray-400">{str(s.latency)} ms</span>
                  ) : null}
                </div>
                {s.detail ? <p className="text-xs text-gray-500 mt-2">{s.detail}</p> : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {flat.length > 0 && (
        <Section title="Metrics">
          <KvGrid data={Object.fromEntries(flat)} />
        </Section>
      )}

      {!services.length && !flat.length && <Empty text="No health data" />}
    </div>
  )
}

function WhatsappView({
  data,
  phone,
  setPhone,
  busy,
  onConnect,
  onDisconnect,
  onTest,
}: {
  data: unknown
  phone: string
  setPhone: (v: string) => void
  busy: string
  onConnect: () => void
  onDisconnect: () => void
  onTest: () => void
}) {
  const status = asObj(data)
  const connected = Boolean(
    status.connected ?? status.isConnected ?? status.ready ?? /connected|open/i.test(str(status.status)),
  )
  const qr = str(pick(status, ['qr', 'qrCode', 'qrDataUrl']), '')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Status"
          value={connected ? 'Connected' : str(status.status, 'Disconnected')}
          icon={MessageCircle}
        />
        <StatCard label="Phone" value={str(pick(status, ['phone', 'number', 'wid']), '—')} icon={Users} />
        <StatCard
          label="Session"
          value={str(pick(status, ['session', 'tenantId', 'tenant']), 'Platform')}
          icon={Activity}
        />
      </div>

      <Section title="Actions">
        <div className="flex flex-wrap gap-2 items-end">
          <button type="button" className="btn-primary" disabled={!!busy} onClick={onConnect}>
            {busy === 'connect' ? '…' : 'Connect / QR'}
          </button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={onDisconnect}>
            Disconnect
          </button>
          <input
            className="input w-40"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button type="button" className="btn-secondary" disabled={!!busy || !phone} onClick={onTest}>
            Send test
          </button>
        </div>
      </Section>

      {qr && (
        <Section title="QR code">
          {qr.startsWith('data:image') || qr.startsWith('http') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="WhatsApp QR" className="w-56 h-56 object-contain border border-gray-200 rounded-xl" />
          ) : (
            <p className="text-xs font-mono break-all text-gray-600">{qr.slice(0, 400)}</p>
          )}
        </Section>
      )}

      <Section title="Session details">
        <KvGrid data={status} />
      </Section>
    </div>
  )
}

function AuthIamView({ product, data }: { product: HubProductKind; data: unknown }) {
  const root = asObj(data)
  const admins = product === 'fashion' ? asList(root.admins) : asList(data)
  const usersRaw = product === 'fashion' ? root.users : null
  const users = asList(usersRaw)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Platform admins" value={admins.length} icon={Users} />
        {product === 'fashion' && <StatCard label="Users (sample)" value={users.length} icon={Building2} />}
      </div>

      <Section title="Platform admins">
        <DataTable
          rows={admins}
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (r) =>
                str(
                  pick(r, ['name', 'username']) ??
                    [r.firstName, r.lastName].filter(Boolean).join(' '),
                ),
            },
            {
              key: 'email',
              label: 'Email / username',
              render: (r) => str(pick(r, ['email', 'username'])),
            },
            {
              key: 'role',
              label: 'Role',
              render: (r) => <StatusBadge value={pick(r, ['role', 'roles'])} />,
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={pick(r, ['status', 'is_active', 'active'])} />,
            },
          ]}
        />
      </Section>

      {product === 'fashion' && (
        <Section title="Users across tenants">
          <DataTable
            rows={users}
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (r) =>
                  str(
                    pick(r, ['name', 'email']) ??
                      [r.firstName, r.lastName].filter(Boolean).join(' '),
                  ),
              },
              { key: 'email', label: 'Email', render: (r) => str(r.email) },
              {
                key: 'tenant',
                label: 'Tenant',
                render: (r) => str(pick(r, ['tenantName']) ?? asObj(r.tenant).name),
              },
              {
                key: 'role',
                label: 'Role',
                render: (r) => <StatusBadge value={pick(r, ['role', 'roles'])} />,
              },
            ]}
          />
        </Section>
      )}
    </div>
  )
}

function ListFeatureView({
  feature,
  data,
  onMarkReview,
  busy,
}: {
  feature: HubFeatureKey
  data: unknown
  onMarkReview?: (id: string | number) => void
  busy?: string
}) {
  if (feature === 'feature-suggestions') {
    const root = asObj(data)
    const summary = asObj(root.summary)
    const rows = asList(asObj(root.list).data ?? root.list)
    return (
      <div className="space-y-4">
        {Object.keys(summary).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(summary).slice(0, 8).map(([k, v]) => (
              <StatCard key={k} label={k} value={typeof v === 'number' ? v : str(v)} icon={Activity} />
            ))}
          </div>
        )}
        <Section title="Suggestions">
          {rows.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2 -m-4">
              {rows.slice(0, 40).map((row) => (
                <div
                  key={String(row.id)}
                  className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{str(row.title)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <StatusBadge value={row.status} />
                      <span className="ml-2">
                        {str(row.priority, '')} {row.category ? `· ${str(row.category)}` : ''}
                      </span>
                    </p>
                  </div>
                  {onMarkReview && (
                    <button
                      type="button"
                      className="btn-secondary text-xs shrink-0"
                      disabled={!!busy}
                      onClick={() => onMarkReview(row.id as string | number)}
                    >
                      Mark review
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    )
  }

  if (feature === 'notifications') {
    const rows = asList(asObj(data).data ?? data)
    return (
      <Section title="Notifications">
        <DataTable
          rows={rows}
          columns={[
            { key: 'title', label: 'Title', render: (r) => str(pick(r, ['title', 'message', 'type'])) },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={pick(r, ['status', 'read', 'channel'])} />,
            },
            {
              key: 'date',
              label: 'Date',
              render: (r) => fmtDate(pick(r, ['createdAt', 'created_at', 'sentAt'])),
            },
          ]}
        />
      </Section>
    )
  }

  if (feature === 'activity-logs') {
    const rows = asList(data)
    return (
      <Section title="Activity logs">
        <DataTable
          rows={rows}
          columns={[
            {
              key: 'action',
              label: 'Action',
              render: (r) => str(pick(r, ['action', 'event', 'type', 'method'])),
            },
            {
              key: 'actor',
              label: 'Actor',
              render: (r) => str(pick(r, ['actor', 'user', 'email', 'username', 'userId'])),
            },
            {
              key: 'tenant',
              label: 'Tenant',
              render: (r) => str(pick(r, ['tenant', 'tenantName', 'tenantId']) ?? asObj(r.tenant).name),
            },
            {
              key: 'date',
              label: 'When',
              render: (r) => fmtDate(pick(r, ['createdAt', 'created_at', 'timestamp', 'at'])),
            },
          ]}
        />
      </Section>
    )
  }

  if (feature === 'announcements') {
    const rows = asList(data)
    return (
      <Section title="Announcements">
        <DataTable
          rows={rows}
          columns={[
            { key: 'title', label: 'Title', render: (r) => str(r.title) },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={pick(r, ['status', 'sent'])} />,
            },
            {
              key: 'date',
              label: 'Created',
              render: (r) => fmtDate(pick(r, ['createdAt', 'created_at', 'sentAt'])),
            },
          ]}
        />
      </Section>
    )
  }

  if (feature === 'release-notes') {
    const rows = asList(data)
    return (
      <Section title="Releases">
        <DataTable
          rows={rows}
          columns={[
            { key: 'version', label: 'Version', render: (r) => str(pick(r, ['version', 'tag'])) },
            { key: 'title', label: 'Title', render: (r) => str(r.title) },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={r.status} />,
            },
            {
              key: 'date',
              label: 'Published',
              render: (r) => fmtDate(pick(r, ['publishedAt', 'createdAt', 'created_at'])),
            },
          ]}
        />
      </Section>
    )
  }

  if (feature === 'master-catalog') {
    const root = asObj(data)
    if (root.message) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {str(root.message)}
        </div>
      )
    }
    const rows = asList(data)
    return (
      <Section title="Catalog categories">
        <DataTable
          rows={rows}
          columns={[
            { key: 'name', label: 'Name', render: (r) => str(pick(r, ['name', 'title'])) },
            {
              key: 'items',
              label: 'Items',
              render: (r) =>
                str(
                  pick(r, ['itemCount', 'itemsCount']) ??
                    (Array.isArray(r.items) ? r.items.length : undefined),
                ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={pick(r, ['status', 'active'])} />,
            },
          ]}
        />
      </Section>
    )
  }

  return <Empty />
}

function SupportView({
  product,
  data,
  tenantId,
  setTenantId,
  busy,
  onImpersonate,
  onDebug,
  onRevoke,
}: {
  product: HubProductKind
  data: unknown
  tenantId: string
  setTenantId: (v: string) => void
  busy: string
  onImpersonate: () => void
  onDebug: () => void
  onRevoke: () => void
}) {
  const root = asObj(data)
  const tenants = asList(root.tenants)
  const notes = asList(root.notes)

  return (
    <div className="space-y-4">
      <Section title="Quick actions">
        <div className="flex flex-wrap gap-2 items-end">
          <input
            className="input w-56"
            placeholder="Tenant ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
          <button type="button" className="btn-primary" disabled={!!busy || !tenantId} onClick={onImpersonate}>
            Impersonate
          </button>
          {product === 'fashion' && (
            <button type="button" className="btn-secondary" disabled={!!busy || !tenantId} onClick={onDebug}>
              Debug
            </button>
          )}
          <button type="button" className="btn-secondary" disabled={!!busy || !tenantId} onClick={onRevoke}>
            Revoke sessions
          </button>
        </div>
      </Section>

      <Section title="Recent tenants">
        <DataTable
          rows={tenants}
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (r) => str(pick(r, ['name', 'slug', 'subdomain'])),
            },
            {
              key: 'id',
              label: 'ID',
              render: (r) => (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline font-mono"
                  onClick={() => setTenantId(String(r.id))}
                >
                  {str(r.id)}
                </button>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge value={r.status} />,
            },
            {
              key: 'plan',
              label: 'Plan',
              render: (r) => <StatusBadge value={r.plan} />,
            },
          ]}
        />
      </Section>

      {product === 'fashion' && (
        <Section title="Support notes">
          <DataTable
            rows={notes}
            columns={[
              { key: 'note', label: 'Note', render: (r) => str(pick(r, ['note', 'body', 'content', 'text'])) },
              {
                key: 'tenant',
                label: 'Tenant',
                render: (r) => str(pick(r, ['tenantId', 'tenantName'])),
              },
              {
                key: 'date',
                label: 'Created',
                render: (r) => fmtDate(pick(r, ['createdAt', 'created_at'])),
              },
            ]}
          />
        </Section>
      )}
    </div>
  )
}

function SettingsView({
  product,
  data,
  configDraft,
  setConfigDraft,
  busy,
  onSaveConfig,
  onMaintOn,
  onMaintOff,
}: {
  product: HubProductKind
  data: unknown
  configDraft: string
  setConfigDraft: (v: string) => void
  busy: string
  onSaveConfig: () => void
  onMaintOn: () => void
  onMaintOff: () => void
}) {
  if (product === 'fashion') {
    return (
      <Section title="Platform config">
        <textarea
          className="input font-mono text-xs min-h-[240px] w-full"
          value={configDraft}
          onChange={(e) => setConfigDraft(e.target.value)}
        />
        <button type="button" className="btn-primary mt-3" disabled={!!busy} onClick={onSaveConfig}>
          Save platform config
        </button>
      </Section>
    )
  }

  const root = asObj(data)
  const maintenance = asObj(root.maintenance)
  const smtp = asObj(root.smtpSms)

  return (
    <div className="space-y-4">
      <Section
        title="Maintenance"
        action={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" disabled={!!busy} onClick={onMaintOn}>
              Enable
            </button>
            <button type="button" className="btn-secondary text-xs" disabled={!!busy} onClick={onMaintOff}>
              Disable
            </button>
          </div>
        }
      >
        <KvGrid data={maintenance} />
      </Section>
      <Section title="SMTP / SMS">
        <KvGrid data={smtp} />
      </Section>
    </div>
  )
}

/* ── main ────────────────────────────────────────────────────── */

export default function HubFeaturePage({
  product,
  feature,
}: {
  product: HubProductKind
  feature: HubFeatureKey
}) {
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [phone, setPhone] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [releaseVersion, setReleaseVersion] = useState('')
  const [releaseTitle, setReleaseTitle] = useState('')
  const [releaseSummary, setReleaseSummary] = useState('')
  const [configDraft, setConfigDraft] = useState('')
  const [msg, setMsg] = useState('')

  const reload = useCallback(() => {
    if (feature === 'subscriptions') {
      setLoading(false)
      setData({})
      return
    }
    setLoading(true)
    setError('')
    loadFeature(product, feature)
      .then((d) => {
        setData(d)
        if (feature === 'settings' && product === 'fashion') {
          setConfigDraft(JSON.stringify(d, null, 2))
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [product, feature])

  useEffect(() => {
    reload()
  }, [reload])

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label)
    setMsg('')
    try {
      const result = await fn()
      if (result && typeof result === 'object') {
        const o = result as Record<string, unknown>
        if (typeof o.loginUrl === 'string') {
          setMsg(`Impersonation ready: ${o.loginUrl}`)
          window.open(o.loginUrl, '_blank', 'noopener,noreferrer')
        } else if (typeof o.message === 'string') {
          setMsg(o.message)
        } else {
          setMsg('Done')
        }
      } else {
        setMsg(String(result ?? 'Done'))
      }
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  const title = TITLES[feature]

  const body = useMemo(() => {
    if (feature === 'subscriptions') return null
    if (loading || data == null) return null
    switch (feature) {
      case 'analytics':
        return <AnalyticsView data={data} />
      case 'system-health':
        return <HealthView data={data} />
      case 'whatsapp':
        return (
          <WhatsappView
            data={data}
            phone={phone}
            setPhone={setPhone}
            busy={busy}
            onConnect={() =>
              run('connect', () =>
                product === 'fashion' ? fashionPlatform.waConnect() : salonPlatform.waConnect(),
              )
            }
            onDisconnect={() =>
              run('disconnect', () =>
                product === 'fashion' ? fashionPlatform.waDisconnect() : salonPlatform.waDisconnect(),
              )
            }
            onTest={() =>
              run('test', () =>
                product === 'fashion' ? fashionPlatform.waTest(phone) : salonPlatform.waTest(phone),
              )
            }
          />
        )
      case 'auth-iam':
        return <AuthIamView product={product} data={data} />
      case 'support-tools':
        return (
          <SupportView
            product={product}
            data={data}
            tenantId={tenantId}
            setTenantId={setTenantId}
            busy={busy}
            onImpersonate={() =>
              run('impersonate', () =>
                product === 'fashion'
                  ? fashionPlatform.impersonate(tenantId)
                  : salonPlatform.impersonate(tenantId),
              )
            }
            onDebug={() => run('debug', () => fashionPlatform.tenantDebug(tenantId))}
            onRevoke={() =>
              run('revoke', () =>
                product === 'fashion'
                  ? fashionPlatform.revokeSessions(tenantId)
                  : salonPlatform.revokeSessions(tenantId),
              )
            }
          />
        )
      case 'settings':
        return (
          <SettingsView
            product={product}
            data={data}
            configDraft={configDraft}
            setConfigDraft={setConfigDraft}
            busy={busy}
            onSaveConfig={() =>
              run('save-config', async () => {
                const parsed = JSON.parse(configDraft) as Record<string, unknown>
                return updateFashionPlatformConfig(parsed)
              })
            }
            onMaintOn={() =>
              run('maint-on', () =>
                salonPlatform.updateMaintenance({ enabled: true, message: 'Maintenance mode' }),
              )
            }
            onMaintOff={() =>
              run('maint-off', () => salonPlatform.updateMaintenance({ enabled: false }))
            }
          />
        )
      default:
        return (
          <ListFeatureView
            feature={feature}
            data={data}
            busy={busy}
            onMarkReview={(id) =>
              run(`sug-${id}`, () =>
                product === 'fashion'
                  ? fashionPlatform.updateSuggestion(String(id), { status: 'UNDER_REVIEW' })
                  : salonPlatform.updateSuggestion(id, { status: 'UNDER_REVIEW' }),
              )
            }
          />
        )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, feature, product, phone, busy, tenantId, configDraft])

  if (feature === 'subscriptions') {
    return <HubSubscriptionsManage product={product} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {product === 'fashion' ? 'Fashion' : 'Salon'} · {title}
          </h2>
          <p className="text-sm text-gray-500">Live data from {product} platform API</p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="btn-secondary inline-flex items-center gap-1.5"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 break-all">
          {msg}
        </div>
      )}

      {feature === 'announcements' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <input
            className="input"
            placeholder="Title"
            value={announceTitle}
            onChange={(e) => setAnnounceTitle(e.target.value)}
          />
          <textarea
            className="input min-h-[80px]"
            placeholder="Body"
            value={announceBody}
            onChange={(e) => setAnnounceBody(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!!busy || !announceTitle || !announceBody}
            onClick={() =>
              run('announce', async () => {
                const bodyPayload = { title: announceTitle, body: announceBody, sendNow: true }
                if (product === 'fashion') return fashionPlatform.createAnnouncement(bodyPayload)
                return salonPlatform.createAnnouncement(bodyPayload)
              })
            }
          >
            Create &amp; send
          </button>
        </div>
      )}

      {feature === 'release-notes' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="input"
              placeholder="Version"
              value={releaseVersion}
              onChange={(e) => setReleaseVersion(e.target.value)}
            />
            <input
              className="input sm:col-span-2"
              placeholder="Title"
              value={releaseTitle}
              onChange={(e) => setReleaseTitle(e.target.value)}
            />
          </div>
          <textarea
            className="input min-h-[70px]"
            placeholder="Summary"
            value={releaseSummary}
            onChange={(e) => setReleaseSummary(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!!busy || !releaseVersion || !releaseTitle || !releaseSummary}
            onClick={() =>
              run('release', async () => {
                const payload = {
                  version: releaseVersion,
                  title: releaseTitle,
                  summary: releaseSummary,
                }
                const created =
                  product === 'fashion'
                    ? ((await fashionPlatform.createRelease(payload)) as { id?: string })
                    : ((await salonPlatform.createRelease(payload)) as { id?: string | number })
                if (created?.id) {
                  if (product === 'fashion') await fashionPlatform.publishRelease(String(created.id))
                  else await salonPlatform.publishRelease(created.id)
                }
                return created
              })
            }
          >
            Create &amp; publish
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        body
      )}
    </div>
  )
}
