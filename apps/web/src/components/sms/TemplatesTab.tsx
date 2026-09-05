'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Loader2, RotateCcw, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  smsApi,
  SMS_EVENT_META,
  SMS_TEMPLATE_VARS,
  previewSmsTemplate,
  smsSegmentCount,
  type SmsConfig,
  type SmsEventType,
} from '@/lib/sms-api'
import { Switch } from '@/components/ui/Switch'
import { viewOnlyToast } from '@/lib/module-access'

function TemplateEditor({
  eventKey,
  template,
  disabled,
  onChange,
}: {
  eventKey: SmsEventType
  template: SmsConfig['templates'][SmsEventType]
  disabled: boolean
  onChange: (next: SmsConfig['templates'][SmsEventType]) => void
}) {
  const meta = SMS_EVENT_META[eventKey]
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {meta.title} <span className="text-[10px] font-normal opacity-60">/ {meta.titleSi}</span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta.description}</p>
        </div>
        <Switch checked={template.enabled} disabled={disabled} onChange={enabled => onChange({ ...template, enabled })} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>SMS body</label>
        <textarea className="input-field w-full min-h-[96px] resize-y font-mono text-xs leading-relaxed"
          value={template.body} disabled={disabled} onChange={e => onChange({ ...template, body: e.target.value })} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SMS_TEMPLATE_VARS.map(v => (
            <button key={v} type="button" disabled={disabled}
              className="text-[10px] px-2 py-0.5 rounded border font-mono"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              onClick={() => onChange({ ...template, body: `${template.body}${template.body ? ' ' : ''}${v}` })}>
              {v}
            </button>
          ))}
        </div>
        <button type="button" disabled={disabled} className="text-xs mt-2 flex items-center gap-1 text-brand-600"
          onClick={() => onChange({ ...template, body: meta.defaultBody })}>
          <RotateCcw size={12} /> Reset to default
        </button>
      </div>
      <div className="rounded-lg border px-3 py-2 space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Preview · {smsSegmentCount(previewSmsTemplate(template.body))} segment(s)
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {previewSmsTemplate(template.body) || '—'}
        </p>
      </div>
    </div>
  )
}

interface Props {
  config: SmsConfig
  canEdit: boolean
  onConfigChange: (c: SmsConfig) => void
}

export default function TemplatesTab({ config, canEdit, onConfigChange }: Props) {
  const [form, setForm] = useState(config)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(config) }, [config])

  const handleSave = async () => {
    if (!canEdit) return viewOnlyToast('SMS Gateway')
    setSaving(true)
    try {
      const res: any = await smsApi.updateConfig({ templates: form.templates })
      const data = res?.data ?? res
      const next = { ...form, ...data, templates: { ...form.templates, ...data?.templates } }
      setForm(next)
      onConfigChange(next)
      toast.success('SMS templates saved')
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const eventKeys = Object.keys(SMS_EVENT_META) as SmsEventType[]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-5 max-w-3xl">
      <div className="flex items-start gap-2">
        <FileText size={15} className="text-brand-400 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Auto SMS templates</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Sale, repair, HP reminder, delivery, credit reminder — sent when enabled (customer phone required).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {eventKeys.map(key => (
          <TemplateEditor
            key={key}
            eventKey={key}
            template={form.templates[key]}
            disabled={!canEdit}
            onChange={tpl => setForm(f => ({ ...f, templates: { ...f.templates, [key]: tpl } }))}
          />
        ))}
      </div>

      {canEdit && (
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save templates
        </button>
      )}
    </motion.div>
  )
}
