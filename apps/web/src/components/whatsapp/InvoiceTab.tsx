'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Loader2, FileText, Send, CheckSquare, Phone, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { whatsappApi, saveLocalWAConfig, type WAConfig } from '@/lib/whatsapp-api'
import { Switch } from '@/components/ui/Switch'

const DEFAULT_TEMPLATE = `Hello {{customer_name}},

Thank you for your purchase at {{shop_name}}! 🎉

Here is your invoice summary:
📋 Order: {{order_id}}
💰 Total: {{currency}} {{amount}}
📅 Date: {{date}}

{{#if pdf_attached}}
Your invoice PDF is attached to this message.
{{/if}}

For any queries, please contact us.
Thank you for choosing us! 🙏`

const VARIABLES = [
  { key: '{{customer_name}}',  desc: 'Customer full name'   },
  { key: '{{shop_name}}',      desc: 'Your shop name'       },
  { key: '{{order_id}}',       desc: 'Order reference ID'   },
  { key: '{{amount}}',         desc: 'Invoice total amount' },
  { key: '{{currency}}',       desc: 'Currency code'        },
  { key: '{{date}}',           desc: 'Invoice date'         },
]

interface Props {
  config: Partial<WAConfig>
  onConfigChange: (c: Partial<WAConfig>) => void
}

export default function InvoiceTab({ config, onConfigChange }: Props) {
  const [form, setForm] = useState({
    autoSendInvoice: config.autoSendInvoice ?? false,
    sendPdfInvoice:  config.sendPdfInvoice  ?? false,
    validatePhones:  config.validatePhones  ?? true,
    invoiceTemplate: config.invoiceTemplate ?? DEFAULT_TEMPLATE,
  })
  const [saving, setSaving] = useState(false)
  const [charCount, setCharCount] = useState(form.invoiceTemplate.length)

  const setToggle = (key: keyof typeof form, val: boolean) => setForm(p => ({ ...p, [key]: val }))

  const handleTemplateChange = (val: string) => {
    setForm(p => ({ ...p, invoiceTemplate: val }))
    setCharCount(val.length)
  }

  const insertVariable = (v: string) => {
    const textarea = document.getElementById('invoice-template') as HTMLTextAreaElement
    if (!textarea) { handleTemplateChange(form.invoiceTemplate + v); return }
    const start = textarea.selectionStart ?? form.invoiceTemplate.length
    const end   = textarea.selectionEnd   ?? start
    const next  = form.invoiceTemplate.slice(0, start) + v + form.invoiceTemplate.slice(end)
    handleTemplateChange(next)
    setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + v.length; textarea.focus() }, 0)
  }

  const handleSave = async () => {
    if (form.invoiceTemplate.trim().length < 10) { toast.error('Template is too short'); return }
    setSaving(true)
    try {
      await whatsappApi.updateConfig(form)
      onConfigChange(form)
      saveLocalWAConfig(form)
      toast.success('Invoice automation settings saved!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save settings')
    } finally { setSaving(false) }
  }

  const toggleRows = [
    {
      key:   'autoSendInvoice' as const,
      Icon:  Send,
      label: 'Auto-send invoice after order',
      desc:  'Automatically send a WhatsApp message when an order is completed',
      color: 'text-green-400',
      bg:    'bg-green-500/10',
    },
    {
      key:   'sendPdfInvoice' as const,
      Icon:  FileText,
      label: 'Attach PDF invoice',
      desc:  'Send the invoice PDF as a document attachment alongside the message',
      color: 'text-blue-400',
      bg:    'bg-blue-500/10',
    },
    {
      key:   'validatePhones' as const,
      Icon:  Phone,
      label: 'Validate customer phone numbers',
      desc:  'Skip sending if the customer phone number format is invalid',
      color: 'text-violet-400',
      bg:    'bg-violet-500/10',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Toggle Settings */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-1">
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Automation Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Control how invoices are automatically sent via WhatsApp</p>
          </div>
        </div>
        <div className="space-y-0.5">
          {toggleRows.map(({ key, Icon, label, desc, color, bg }) => (
            <div key={key}
              className="flex items-center justify-between gap-4 p-3.5 rounded-xl transition-colors hover:bg-white/3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={15} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{desc}</p>
                </div>
              </div>
              <Switch
                checked={form[key] as boolean}
                onChange={v => setToggle(key, v)}
                disabled={key === 'validatePhones' && !form.autoSendInvoice}
                variant="green"
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Message Template */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invoice Message Template</h2>
            <p className="text-xs text-slate-500 mt-0.5">Customize the WhatsApp message sent with each invoice</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        </div>

        {/* Variable chips */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Info size={11} className="text-slate-500" />
            <span className="text-[11px] text-slate-500">Click a variable to insert at cursor</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map(({ key, desc }) => (
              <button key={key} onClick={() => insertVariable(key)} title={desc}
                className="text-[11px] px-2 py-1 rounded-md border font-mono transition-all hover:border-violet-500/50 hover:text-violet-400"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            id="invoice-template"
            rows={12}
            className="input-field font-mono text-xs resize-none leading-relaxed"
            value={form.invoiceTemplate}
            onChange={e => handleTemplateChange(e.target.value)}
            placeholder="Type your invoice message template..."
          />
          <span className={`absolute bottom-2.5 right-3 text-[10px] ${charCount > 1000 ? 'text-yellow-400' : 'text-slate-600'}`}>
            {charCount} chars
          </span>
        </div>

        {/* Preview hint */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
          <CheckSquare size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            Variables like <code className="text-blue-400 font-mono">{'{{customer_name}}'}</code> are replaced automatically when sending. Supports WhatsApp formatting: <code className="text-slate-300 font-mono">*bold*</code>, <code className="text-slate-300 font-mono">_italic_</code>.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
