'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  X,
  Loader2,
  Save,
  Send,
  RotateCcw,
  Bell,
  MessageSquare,
  Settings2,
  LayoutDashboard,
  Users,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { customersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { viewOnlyToast } from '@/lib/module-access'
import { Switch } from '@/components/ui/Switch'
import {
  SegmentedControl,
  StatCard,
  StatGrid,
  StatusBadge,
} from '@/components/design-system'
import {
  DEFAULT_SMS_CREDIT_REMINDER_BODY,
  previewSmsTemplate,
  smsSegmentCount,
  fetchSmsConfig,
  saveSmsConfig,
  type SmsConfig,
} from '@/lib/sms-api'

const DEFAULT_WA_BODY =
  'Dear {{customerName}}, reminder: outstanding LKR {{dueAmount}} ({{invoiceCount}} invoice(s), oldest {{oldestDueDate}}). Please settle soon. Thank you — {{shopName}}'

const CREDIT_VARS = [
  '{{customerName}}',
  '{{dueAmount}}',
  '{{shopName}}',
  '{{invoiceCount}}',
  '{{oldestDueDate}}',
] as const

type TabId = 'overview' | 'templates' | 'automation' | 'send'

type CreditSettings = {
  reminder: {
    enabled: boolean
    minDaysOverdue: number
    cooldownDays: number
    channels: { sms: boolean; whatsapp: boolean }
  }
  whatsappTemplate: { enabled: boolean; body: string }
}

type CreditSummary = {
  customersWithDue: number
  totalOutstanding: number
  overdueCount: number
  smsReady: boolean
  whatsappReady: boolean
}

type DueCustomer = {
  id: string
  name: string
  phone: string
  totalDue: number
  city?: string | null
  overdue: boolean
  invoiceCount: number | null
  oldestDueDate: string | null
}

type CreditControlData = {
  settings: CreditSettings
  summary: CreditSummary
  customers: DueCustomer[]
}

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'templates', label: 'Templates', icon: MessageSquare },
  { id: 'automation', label: 'Automation', icon: Settings2 },
  { id: 'send', label: 'Send', icon: Send },
]

function emptySettings(): CreditSettings {
  return {
    reminder: {
      enabled: false,
      minDaysOverdue: 3,
      cooldownDays: 3,
      channels: { sms: true, whatsapp: true },
    },
    whatsappTemplate: { enabled: true, body: DEFAULT_WA_BODY },
  }
}

export default function CreditControlPanel({
  open,
  onClose,
  canEdit,
}: {
  open: boolean
  onClose: () => void
  canEdit: boolean
}) {
  const [tab, setTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bulkSending, setBulkSending] = useState(false)
  const [rowSending, setRowSending] = useState<string | null>(null)
  const [data, setData] = useState<CreditControlData | null>(null)
  const [settings, setSettings] = useState<CreditSettings>(emptySettings())
  const [smsConfig, setSmsConfig] = useState<SmsConfig | null>(null)
  const [smsBody, setSmsBody] = useState(DEFAULT_SMS_CREDIT_REMINDER_BODY)
  const [smsEnabled, setSmsEnabled] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ccRes, sms] = await Promise.all([
        customersApi.getCreditControl() as Promise<any>,
        fetchSmsConfig().catch(() => null),
      ])
      const payload = (ccRes?.data ?? ccRes) as CreditControlData
      setData(payload)
      setSettings(payload.settings ?? emptySettings())
      if (sms) {
        setSmsConfig(sms)
        const tpl = sms.templates?.creditReminder
        setSmsBody(tpl?.body || DEFAULT_SMS_CREDIT_REMINDER_BODY)
        setSmsEnabled(tpl?.enabled !== false)
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load credit control')
      onClose()
    } finally {
      setLoading(false)
    }
  }, [onClose])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  if (!open) return null

  const ensureEdit = () => {
    if (!canEdit) {
      viewOnlyToast('customers')
      return false
    }
    return true
  }

  const handleSaveSettings = async () => {
    if (!ensureEdit()) return
    setSaving(true)
    try {
      const [ccRes] = await Promise.all([
        customersApi.updateCreditControl(settings) as Promise<any>,
        smsConfig
          ? saveSmsConfig({
              templates: {
                ...smsConfig.templates,
                creditReminder: { enabled: smsEnabled, body: smsBody },
              },
            })
          : Promise.resolve(null),
      ])
      const next = ccRes?.data ?? ccRes
      if (next?.settings) setSettings(next.settings)
      toast.success('Credit control settings saved')
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkSend = async () => {
    if (!ensureEdit()) return
    if (!window.confirm('Send reminders to all eligible overdue customers now? (max 50)')) return
    setBulkSending(true)
    try {
      const res: any = await customersApi.sendCreditRemindersBulk()
      const r = res?.data ?? res
      toast.success(`Sent ${r.sent ?? 0} · skipped ${r.skipped ?? 0} · failed ${r.failed ?? 0}`)
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Bulk send failed')
    } finally {
      setBulkSending(false)
    }
  }

  const handleRowSend = async (customerId: string, channels?: { sms?: boolean; whatsapp?: boolean }) => {
    if (!ensureEdit()) return
    setRowSending(customerId)
    try {
      await customersApi.sendCreditReminder(customerId, channels)
      toast.success('Reminder sent')
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Send failed')
    } finally {
      setRowSending(null)
    }
  }

  const summary = data?.summary
  const customers = data?.customers ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-hidden border flex flex-col"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <span
              className="mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border"
              style={{
                background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
                borderColor: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)',
                color: 'var(--brand-primary)',
              }}
            >
              <Bell size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Credit Control</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Templates, automation, and overdue reminders (SMS + WhatsApp)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-5 pt-3 shrink-0">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={TABS.map(t => ({ id: t.id, label: t.label }))}
            size="sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={18} className="animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {tab === 'overview' && (
                <div className="space-y-4">
                  <StatGrid cols={3}>
                    <StatCard
                      label="Customers with due"
                      value={String(summary?.customersWithDue ?? 0)}
                      icon={Users}
                      tone="brand"
                    />
                    <StatCard
                      label="Total outstanding"
                      value={formatCurrency(summary?.totalOutstanding ?? 0)}
                      icon={CreditCard}
                      tone="danger"
                    />
                    <StatCard
                      label={`Overdue (≥ ${settings.reminder.minDaysOverdue}d)`}
                      value={String(summary?.overdueCount ?? 0)}
                      icon={AlertTriangle}
                      tone="warning"
                    />
                  </StatGrid>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={summary?.smsReady ? 'success' : 'neutral'}>
                      {summary?.smsReady ? 'SMS ready' : 'SMS not ready'}
                    </StatusBadge>
                    <StatusBadge tone={summary?.whatsappReady ? 'success' : 'neutral'}>
                      {summary?.whatsappReady ? 'WhatsApp ready' : 'WhatsApp not ready'}
                    </StatusBadge>
                    <StatusBadge tone={settings.reminder.enabled ? 'brand' : 'neutral'}>
                      {settings.reminder.enabled ? 'Auto reminders on' : 'Auto reminders off'}
                    </StatusBadge>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Automatic reminders run hourly for tenants with Customer Credit enabled and automation turned on.
                    Cooldown: {settings.reminder.cooldownDays} day(s).
                  </p>
                </div>
              )}

              {tab === 'templates' && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl border p-4 space-y-3"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">SMS credit reminder</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Uses the SMS gateway creditReminder template
                        </p>
                      </div>
                      <Switch
                        checked={smsEnabled}
                        disabled={!canEdit}
                        onChange={setSmsEnabled}
                      />
                    </div>
                    <textarea
                      className="input-field w-full min-h-[96px] resize-y font-mono text-xs leading-relaxed"
                      value={smsBody}
                      disabled={!canEdit}
                      onChange={e => setSmsBody(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {CREDIT_VARS.map(v => (
                        <button
                          key={v}
                          type="button"
                          disabled={!canEdit}
                          className="text-[10px] px-2 py-0.5 rounded border font-mono"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                          onClick={() => setSmsBody(b => `${b}${b ? ' ' : ''}${v}`)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit}
                      className="text-xs flex items-center gap-1 font-medium"
                      style={{ color: 'var(--brand-primary)' }}
                      onClick={() => setSmsBody(DEFAULT_SMS_CREDIT_REMINDER_BODY)}
                    >
                      <RotateCcw size={12} /> Reset SMS default
                    </button>
                    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Preview · {smsSegmentCount(previewSmsTemplate(smsBody))} segment(s)
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {previewSmsTemplate(smsBody) || '—'}
                      </p>
                    </div>
                  </div>

                  <div
                    className="rounded-xl border p-4 space-y-3"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">WhatsApp credit reminder</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Stored in credit control settings
                        </p>
                      </div>
                      <Switch
                        checked={settings.whatsappTemplate.enabled}
                        disabled={!canEdit}
                        onChange={enabled =>
                          setSettings(s => ({
                            ...s,
                            whatsappTemplate: { ...s.whatsappTemplate, enabled },
                          }))
                        }
                      />
                    </div>
                    <textarea
                      className="input-field w-full min-h-[96px] resize-y font-mono text-xs leading-relaxed"
                      value={settings.whatsappTemplate.body}
                      disabled={!canEdit}
                      onChange={e =>
                        setSettings(s => ({
                          ...s,
                          whatsappTemplate: { ...s.whatsappTemplate, body: e.target.value },
                        }))
                      }
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {CREDIT_VARS.map(v => (
                        <button
                          key={v}
                          type="button"
                          disabled={!canEdit}
                          className="text-[10px] px-2 py-0.5 rounded border font-mono"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                          onClick={() =>
                            setSettings(s => ({
                              ...s,
                              whatsappTemplate: {
                                ...s.whatsappTemplate,
                                body: `${s.whatsappTemplate.body}${s.whatsappTemplate.body ? ' ' : ''}${v}`,
                              },
                            }))
                          }
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit}
                      className="text-xs flex items-center gap-1 font-medium"
                      style={{ color: 'var(--brand-primary)' }}
                      onClick={() =>
                        setSettings(s => ({
                          ...s,
                          whatsappTemplate: { ...s.whatsappTemplate, body: DEFAULT_WA_BODY },
                        }))
                      }
                    >
                      <RotateCcw size={12} /> Reset WhatsApp default
                    </button>
                    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Preview
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {previewSmsTemplate(settings.whatsappTemplate.body) || '—'}
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      className="btn-primary text-sm inline-flex items-center gap-2"
                      disabled={saving}
                      onClick={() => void handleSaveSettings()}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save templates
                    </button>
                  )}
                </div>
              )}

              {tab === 'automation' && (
                <div className="space-y-4 max-w-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Enable automatic reminders</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Hourly job sends to eligible overdue customers
                      </p>
                    </div>
                    <Switch
                      checked={settings.reminder.enabled}
                      disabled={!canEdit}
                      onChange={enabled =>
                        setSettings(s => ({ ...s, reminder: { ...s.reminder, enabled } }))
                      }
                    />
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Min days overdue
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      className="input-field w-full"
                      disabled={!canEdit}
                      value={settings.reminder.minDaysOverdue}
                      onChange={e =>
                        setSettings(s => ({
                          ...s,
                          reminder: { ...s.reminder, minDaysOverdue: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Cooldown days (skip if reminded recently)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      className="input-field w-full"
                      disabled={!canEdit}
                      value={settings.reminder.cooldownDays}
                      onChange={e =>
                        setSettings(s => ({
                          ...s,
                          reminder: { ...s.reminder, cooldownDays: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </label>

                  <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Channels
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SMS</span>
                      <Switch
                        checked={settings.reminder.channels.sms}
                        disabled={!canEdit}
                        onChange={sms =>
                          setSettings(s => ({
                            ...s,
                            reminder: {
                              ...s.reminder,
                              channels: { ...s.reminder.channels, sms },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">WhatsApp</span>
                      <Switch
                        checked={settings.reminder.channels.whatsapp}
                        disabled={!canEdit}
                        onChange={whatsapp =>
                          setSettings(s => ({
                            ...s,
                            reminder: {
                              ...s.reminder,
                              channels: { ...s.reminder.channels, whatsapp },
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      className="btn-primary text-sm inline-flex items-center gap-2"
                      disabled={saving}
                      onClick={() => void handleSaveSettings()}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save automation
                    </button>
                  )}
                </div>
              )}

              {tab === 'send' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-60"
                      disabled={!canEdit || bulkSending || (summary?.overdueCount ?? 0) === 0}
                      onClick={() => void handleBulkSend()}
                    >
                      {bulkSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Remind all eligible now
                    </button>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Cap 50 per run · respects cooldown and channel settings
                    </p>
                  </div>

                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                          <th className="text-left px-3 py-2 font-medium">Customer</th>
                          <th className="text-right px-3 py-2 font-medium">Due</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="text-right px-3 py-2 font-medium">Send</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                              No customers with outstanding balances
                            </td>
                          </tr>
                        ) : (
                          customers.map(c => (
                            <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="px-3 py-2">
                                <p className="font-medium truncate max-w-[180px]">{c.name}</p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-red-600 dark:text-red-400">
                                {formatCurrency(c.totalDue)}
                              </td>
                              <td className="px-3 py-2">
                                {c.overdue ? (
                                  <StatusBadge tone="warning">Overdue</StatusBadge>
                                ) : (
                                  <StatusBadge tone="neutral">Due</StatusBadge>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  className="btn-secondary text-xs inline-flex items-center gap-1 disabled:opacity-60"
                                  disabled={!canEdit || rowSending === c.id || !c.phone}
                                  onClick={() => void handleRowSend(c.id)}
                                >
                                  {rowSending === c.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Send size={12} />
                                  )}
                                  Send
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
