'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, CheckCircle2, WifiOff, AlertTriangle,
  Loader2, Send, Key, Phone, Hash, Save, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  smsApi,
  SMS_PROVIDER_OPTIONS,
  DEFAULT_SMS_CONFIG,
  previewSmsTemplate,
  smsSegmentCount,
  type SmsConfig,
  type SmsStatusInfo,
} from '@/lib/sms-api'
import { Switch } from '@/components/ui/Switch'
import { viewOnlyToast } from '@/lib/module-access'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  connected:      { label: 'Connected',     color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   Icon: CheckCircle2 },
  disabled:       { label: 'Disabled',      color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', Icon: AlertTriangle },
  not_configured: { label: 'Not configured', color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',  Icon: WifiOff },
}

interface Props {
  canEdit: boolean
  status: SmsStatusInfo | null
  config: SmsConfig
  onStatusChange: (s: SmsStatusInfo) => void
  onConfigChange: (c: SmsConfig) => void
}

export default function ConnectionTab({ canEdit, status, config, onStatusChange, onConfigChange }: Props) {
  const [form, setForm] = useState(config)
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [manualSending, setManualSending] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('Hexalyte SMS test — your gateway is working.')
  const [manualPhone, setManualPhone] = useState('')
  const [manualMessage, setManualMessage] = useState('')
  const [manualName, setManualName] = useState('')

  useEffect(() => { setForm(config) }, [config])

  const currentStatus = status?.status ?? 'not_configured'
  const scfg = STATUS_CFG[currentStatus] ?? STATUS_CFG.not_configured
  const providerHint = SMS_PROVIDER_OPTIONS.find(p => p.id === form.provider)?.hint ?? ''

  const handleSave = async () => {
    if (!canEdit) return viewOnlyToast('SMS Gateway')
    setSaving(true)
    try {
      const res: any = await smsApi.updateConfig({
        enabled: form.enabled,
        provider: form.provider,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        senderId: form.senderId,
        validatePhones: form.validatePhones,
        storeFullBody: form.storeFullBody,
      })
      const data = res?.data ?? res
      const next = { ...form, ...data, templates: form.templates }
      setForm(next)
      onConfigChange(next)
      const st: any = await smsApi.getStatus()
      onStatusChange(st?.data ?? st)
      toast.success('SMS gateway settings saved')
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!canEdit) return viewOnlyToast('SMS Gateway')
    if (!testPhone.trim()) return toast.error('Enter a test phone number')
    setTesting(true)
    try {
      await smsApi.testConnection(testPhone.trim(), testMessage.trim())
      toast.success('Test SMS sent')
      const st: any = await smsApi.getStatus()
      onStatusChange(st?.data ?? st)
    } catch (e: any) {
      toast.error(e?.message ?? 'Test SMS failed')
    } finally {
      setTesting(false)
    }
  }

  const handleManualSend = async () => {
    if (!canEdit) return viewOnlyToast('SMS Gateway')
    if (!manualPhone.trim() || !manualMessage.trim()) return toast.error('Phone and message required')
    setManualSending(true)
    try {
      await smsApi.sendMessage({
        phone: manualPhone.trim(),
        message: manualMessage.trim(),
        customerName: manualName.trim() || undefined,
      })
      toast.success('SMS sent')
      setManualMessage('')
      const st: any = await smsApi.getStatus()
      onStatusChange(st?.data ?? st)
    } catch (e: any) {
      toast.error(e?.message ?? 'Send failed')
    } finally {
      setManualSending(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-3 card p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Gateway connection</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Dialog ESMS / Hexalyte SMS Gateway / Mobitel — API keys per shop
            </p>
          </div>
          <span className={`badge-status ${scfg.bg} border ${scfg.color} text-[10px]`}>
            <scfg.Icon size={10} /> {scfg.label}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Enable SMS gateway</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto SMS + manual send</p>
          </div>
          <Switch checked={form.enabled} disabled={!canEdit} onChange={v => setForm(f => ({ ...f, enabled: v }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Provider</label>
            <select className="input-field w-full" value={form.provider} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value as SmsConfig['provider'] }))}>
              {SMS_PROVIDER_OPTIONS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {providerHint && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{providerHint}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Key size={11} />{' '}
              {form.provider === 'twilio'
                ? 'Account SID'
                : form.provider === 'dialog'
                  ? 'URL Message Key / Username'
                  : form.provider === 'hexalyte'
                    ? 'User ID'
                    : 'User ID / API Key'}
            </label>
            <input className="input-field w-full" value={form.apiKey} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {form.provider === 'twilio'
                ? 'Auth Token'
                : form.provider === 'dialog'
                  ? 'Password (optional for esmsqk)'
                  : form.provider === 'hexalyte'
                    ? 'API Key'
                    : 'Password / API Secret'}
            </label>
            <div className="relative">
              <input className="input-field w-full pr-10" type={showSecret ? 'text' : 'password'}
                value={form.apiSecret} disabled={!canEdit}
                placeholder={form.hasApiSecret && !form.apiSecret ? '******** (saved)' : ''}
                onChange={e => setForm(f => ({ ...f, apiSecret: e.target.value }))} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }} onClick={() => setShowSecret(s => !s)}>
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Hash size={11} />{' '}
              {form.provider === 'generic'
                ? 'Provider HTTP URL'
                : form.provider === 'hexalyte'
                  ? 'Sender ID (mask)'
                  : 'Sender ID / Mask'}
            </label>
            <input className="input-field w-full" value={form.senderId} disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, senderId: e.target.value }))} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Validate phone numbers</span>
            <Switch checked={form.validatePhones} disabled={!canEdit}
              onChange={v => setForm(f => ({ ...f, validatePhones: v }))} />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Store full message body</span>
            <Switch checked={form.storeFullBody} disabled={!canEdit}
              onChange={v => setForm(f => ({ ...f, storeFullBody: v }))} />
          </div>
        </div>

        {canEdit && (
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save connection settings
          </button>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="lg:col-span-2 space-y-4">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-brand-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Test SMS</h3>
          </div>
          <input className="input-field w-full" value={testPhone} disabled={!canEdit} placeholder="07XXXXXXXX"
            onChange={e => setTestPhone(e.target.value)} />
          <textarea className="input-field w-full min-h-[72px] text-xs resize-y" value={testMessage} disabled={!canEdit}
            onChange={e => setTestMessage(e.target.value)} />
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {smsSegmentCount(testMessage)} segment(s) · preview: {previewSmsTemplate(testMessage).slice(0, 80)}…
          </p>
          <button type="button" className="btn-secondary w-full" disabled={!canEdit || testing} onClick={() => void handleTest()}>
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send test
          </button>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-cyan-400" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manual SMS</h3>
          </div>
          <input className="input-field w-full" value={manualName} disabled={!canEdit} placeholder="Customer name (optional)"
            onChange={e => setManualName(e.target.value)} />
          <input className="input-field w-full" value={manualPhone} disabled={!canEdit} placeholder="07XXXXXXXX"
            onChange={e => setManualPhone(e.target.value)} />
          <textarea className="input-field w-full min-h-[80px] text-xs resize-y" value={manualMessage} disabled={!canEdit}
            placeholder="Message body…" onChange={e => setManualMessage(e.target.value)} />
          <button type="button" className="btn-secondary w-full" disabled={!canEdit || manualSending}
            onClick={() => void handleManualSend()}>
            {manualSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send SMS
          </button>
        </div>

        {status && (
          <div className="card p-4 text-xs space-y-1.5" style={{ color: 'var(--text-muted)' }}>
            <p>Total sent: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{status.totalSent}</span></p>
            {status.lastSentAt && (
              <p>Last sent: {new Date(status.lastSentAt).toLocaleString()}</p>
            )}
            <p>Provider: {status.provider} · Mask: {status.senderId || '—'}</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
