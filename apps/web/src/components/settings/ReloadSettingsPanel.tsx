'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { authStorage } from '@/lib/auth'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import {
  DEFAULT_RELOAD_SETTINGS,
  RELOAD_PROVIDER_IDS,
  fetchReloadSettings,
  normalizeReloadSettings,
  pushReloadSettings,
  type ReloadProviderId,
  type ReloadSettings,
} from '@/lib/reloadSettings'

function clampRate(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

export default function ReloadSettingsPanel() {
  const { canEdit } = useModuleAccess()
  const tenantId = authStorage.getUser()?.tenantId
  const [settings, setSettings] = useState<ReloadSettings>(DEFAULT_RELOAD_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchReloadSettings(tenantId)
      .then((s) => {
        if (!cancelled) setSettings(s)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load reload settings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const setProviderRate = (
    kind: 'commissions' | 'rechargeCardCommissions',
    provider: ReloadProviderId,
    value: string,
  ) => {
    const rate = clampRate(value)
    if (rate === null) return
    setSettings((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [provider]: rate },
    }))
  }

  const save = async () => {
    if (!canEdit) {
      viewOnlyToast()
      return
    }
    if (!tenantId) {
      toast.error('No shop selected')
      return
    }
    setSaving(true)
    try {
      const normalized = normalizeReloadSettings(settings)
      const saved = await pushReloadSettings(tenantId, normalized)
      setSettings(saved)
      toast.success('Reload commission rates saved')
    } catch {
      toast.error('Failed to save reload settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-10 flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading reload settings…</span>
      </div>
    )
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="border-b border-white/5 pb-3 flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand-glow)' }}
        >
          <RefreshCw size={16} className="text-brand-500" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Reload Commission</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Provider rates used when selling reload or recharge cards. Commission is calculated automatically on each sale.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
              <th className="text-left font-medium px-4 py-2.5 text-xs">Provider</th>
              <th className="text-left font-medium px-4 py-2.5 text-xs">Reload %</th>
              <th className="text-left font-medium px-4 py-2.5 text-xs">Recharge Card %</th>
            </tr>
          </thead>
          <tbody>
            {RELOAD_PROVIDER_IDS.map((provider) => (
              <tr key={provider} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {provider}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 max-w-[120px]">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={!canEdit}
                      className="input-field h-9 text-sm tabular-nums"
                      value={settings.commissions[provider] ?? settings.defaultCommission}
                      onChange={(e) => setProviderRate('commissions', provider, e.target.value)}
                    />
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 max-w-[120px]">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={!canEdit}
                      className="input-field h-9 text-sm tabular-nums"
                      value={settings.rechargeCardCommissions[provider] ?? settings.defaultRechargeCardCommission}
                      onChange={(e) => setProviderRate('rechargeCardCommissions', provider, e.target.value)}
                    />
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Example: Dialog Rs 1,000 at {settings.commissions.Dialog ?? 3}% → commission Rs{' '}
          {(((settings.commissions.Dialog ?? 3) / 100) * 1000).toFixed(2)}.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={saving || !tenantId}
            className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={13} />}
            Save Reload Rates
          </button>
        )}
      </div>
    </div>
  )
}
