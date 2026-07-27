'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
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
import {
  salonPlatform,
  fetchSalonTenants,
} from '@/lib/salon-api'

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

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['data', 'items', 'rows', 'tenants', 'logs', 'admins']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[]
    }
  }
  return []
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-[480px] text-gray-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No rows</p>
  }
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object').slice(0, 8)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              {keys.map((k) => (
                <th key={k} className="px-3 py-2 font-medium">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.slice(0, 100).map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/80">
                {keys.map((k) => (
                  <td key={k} className="px-3 py-2 text-gray-700 truncate max-w-[180px]">
                    {row[k] == null ? '—' : String(row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
      setMsg(typeof result === 'object' ? JSON.stringify(result) : String(result ?? 'OK'))
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  const title = TITLES[feature]
  const rows = asList(
    feature === 'notifications'
      ? (data as { data?: unknown })?.data
      : feature === 'feature-suggestions'
        ? (data as { list?: { data?: unknown } })?.list?.data
        : data,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {product === 'fashion' ? 'Fashion' : 'Salon'} · {title}
          </h2>
          <p className="text-sm text-gray-500">Live data from {product} platform API via hub proxy</p>
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

      {/* Feature actions */}
      {feature === 'whatsapp' && (
        <div className="flex flex-wrap gap-2 items-end bg-white border border-gray-200 rounded-xl p-4">
          <button
            type="button"
            className="btn-primary"
            disabled={!!busy}
            onClick={() =>
              run('connect', () =>
                product === 'fashion' ? fashionPlatform.waConnect() : salonPlatform.waConnect(),
              )
            }
          >
            {busy === 'connect' ? '…' : 'Connect / QR'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              run('disconnect', () =>
                product === 'fashion'
                  ? fashionPlatform.waDisconnect()
                  : salonPlatform.waDisconnect(),
              )
            }
          >
            Disconnect
          </button>
          <input
            className="input w-40"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!!busy || !phone}
            onClick={() =>
              run('test', () =>
                product === 'fashion'
                  ? fashionPlatform.waTest(phone)
                  : salonPlatform.waTest(phone),
              )
            }
          >
            Send test
          </button>
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
                const body = { title: announceTitle, body: announceBody, sendNow: true }
                if (product === 'fashion') return fashionPlatform.createAnnouncement(body)
                return salonPlatform.createAnnouncement(body)
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
                const body = {
                  version: releaseVersion,
                  title: releaseTitle,
                  summary: releaseSummary,
                }
                const created =
                  product === 'fashion'
                    ? ((await fashionPlatform.createRelease(body)) as { id?: string })
                    : ((await salonPlatform.createRelease(body)) as { id?: string | number })
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

      {feature === 'support-tools' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-2 items-end">
          <input
            className="input w-56"
            placeholder="Tenant ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
          {product === 'fashion' && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={!!busy || !tenantId}
                onClick={() =>
                  run('impersonate', () => fashionPlatform.impersonate(tenantId))
                }
              >
                Impersonate
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!!busy || !tenantId}
                onClick={() =>
                  run('debug', () => fashionPlatform.tenantDebug(tenantId))
                }
              >
                Debug
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!!busy || !tenantId}
                onClick={() =>
                  run('revoke', () => fashionPlatform.revokeSessions(tenantId))
                }
              >
                Revoke sessions
              </button>
            </>
          )}
          {product === 'salon' && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={!!busy || !tenantId}
                onClick={() => run('impersonate', () => salonPlatform.impersonate(tenantId))}
              >
                Impersonate
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!!busy || !tenantId}
                onClick={() => run('revoke', () => salonPlatform.revokeSessions(tenantId))}
              >
                Revoke sessions
              </button>
            </>
          )}
        </div>
      )}

      {feature === 'settings' && product === 'fashion' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <textarea
            className="input font-mono text-xs min-h-[200px]"
            value={configDraft}
            onChange={(e) => setConfigDraft(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!!busy}
            onClick={() =>
              run('save-config', async () => {
                const parsed = JSON.parse(configDraft) as Record<string, unknown>
                return updateFashionPlatformConfig(parsed)
              })
            }
          >
            Save platform config
          </button>
        </div>
      )}

      {feature === 'settings' && product === 'salon' && (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              run('maint-on', () =>
                salonPlatform.updateMaintenance({ enabled: true, message: 'Maintenance mode' }),
              )
            }
          >
            Enable maintenance
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              run('maint-off', () => salonPlatform.updateMaintenance({ enabled: false }))
            }
          >
            Disable maintenance
          </button>
        </div>
      )}

      {feature === 'feature-suggestions' && rows.length > 0 && (
        <div className="space-y-2">
          {rows.slice(0, 30).map((row) => (
            <div
              key={String(row.id)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{String(row.title)}</p>
                <p className="text-xs text-gray-400">
                  {String(row.status)} · {String(row.priority || '')} · {String(row.category || '')}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!!busy}
                onClick={() =>
                  run(`sug-${row.id}`, () =>
                    product === 'fashion'
                      ? fashionPlatform.updateSuggestion(String(row.id), { status: 'UNDER_REVIEW' })
                      : salonPlatform.updateSuggestion(row.id as string | number, {
                          status: 'UNDER_REVIEW',
                        }),
                  )
                }
              >
                Mark review
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length > 0 &&
        !['analytics', 'subscriptions', 'system-health', 'settings', 'whatsapp', 'support-tools', 'auth-iam'].includes(
          feature,
        ) ? (
        <DataTable rows={rows} />
      ) : (
        <JsonBlock value={data} />
      )}
    </div>
  )
}
