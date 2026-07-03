'use client'

import { useEffect, useState } from 'react'
import { FileText, Check, Maximize2, X } from 'lucide-react'
import InvoiceA4View, { SAMPLE_SALE_FOR_PREVIEW } from '@/components/invoice/InvoiceA4View'
import { tenantApi } from '@/lib/api'
import {
  INVOICE_TEMPLATE_OPTIONS,
  resolveInvoiceTemplate,
  type InvoiceSettings,
  type InvoiceTemplateId,
} from '@/lib/invoiceSettings'

interface TemplateOption {
  id: InvoiceTemplateId
  label: string
  description: string
}

interface Props {
  settings: InvoiceSettings
  tenantSlug?: string
  onChange: (template: InvoiceTemplateId) => void
}

function TemplatePreviewFrame({
  templateId,
  label,
  selected,
  settings,
  tenantSlug,
  onSelect,
  onExpand,
  scale = 0.22,
}: {
  templateId: InvoiceTemplateId
  label: string
  selected: boolean
  settings: InvoiceSettings
  tenantSlug?: string
  onSelect: () => void
  onExpand: () => void
  scale?: number
}) {
  const marginBottom = Math.round(-1123 * scale + 180)

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        selected
          ? 'border-violet-500 ring-2 ring-violet-500/40 bg-violet-500/5'
          : 'border-white/10 bg-white/[0.02] hover:border-violet-500/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
        <button type="button" onClick={onSelect} className="flex items-center gap-2 min-w-0 text-left">
          <span className={`text-xs font-semibold truncate ${selected ? 'text-violet-300' : 'text-white'}`}>{label}</span>
          {selected && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 shrink-0">
              <Check size={11} /> Active
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onExpand}
          title="Full preview"
          className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 shrink-0"
        >
          <Maximize2 size={12} />
        </button>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left bg-white overflow-hidden cursor-pointer"
      >
        <div
          className="origin-top-left pointer-events-none"
          style={{ transform: `scale(${scale})`, width: 794, minHeight: 200, marginBottom }}
        >
          <InvoiceA4View
            sale={SAMPLE_SALE_FOR_PREVIEW}
            settings={settings}
            tenantSlug={tenantSlug}
            template={templateId}
            hideControls
          />
        </div>
      </button>
      {!selected && (
        <div className="px-3 py-2 border-t border-white/10">
          <button
            type="button"
            onClick={onSelect}
            className="w-full py-1.5 text-[11px] font-semibold rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:border-violet-500/30 transition-colors"
          >
            Use this template
          </button>
        </div>
      )}
    </div>
  )
}

export function InvoiceTemplatePicker({ settings, tenantSlug, onChange }: Props) {
  const [templates, setTemplates] = useState<TemplateOption[]>(INVOICE_TEMPLATE_OPTIONS)
  const [expanded, setExpanded] = useState<InvoiceTemplateId | null>(null)
  const active = resolveInvoiceTemplate(settings, tenantSlug)

  useEffect(() => {
    tenantApi.listInvoiceTemplates()
      .then((res: unknown) => {
        const list = (res as { data?: TemplateOption[] })?.data
        if (Array.isArray(list) && list.length > 0) setTemplates(list)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
              <FileText size={13} /> A4 Invoice Templates
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              All layouts below use your company info. Click a preview to select, or expand for full view.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map(opt => (
              <TemplatePreviewFrame
                key={opt.id}
                templateId={opt.id}
                label={opt.label}
                selected={active === opt.id}
                settings={settings}
                tenantSlug={tenantSlug}
                onSelect={() => onChange(opt.id)}
                onExpand={() => setExpanded(opt.id)}
              />
            ))}
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            Active: <span className="text-violet-400 font-semibold">{templates.find(t => t.id === active)?.label ?? active}</span>
            {' · '}Used for POS A4 bills, sales PDF, and repair quotes
          </p>
        </div>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-[#0f1623] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div>
                <p className="text-sm font-bold text-white">
                  {templates.find(t => t.id === expanded)?.label ?? expanded}
                </p>
                <p className="text-[11px] text-slate-500">Sample sale preview · scroll to see full page</p>
              </div>
              <div className="flex items-center gap-2">
                {active !== expanded && (
                  <button
                    type="button"
                    onClick={() => { onChange(expanded); setExpanded(null) }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                  >
                    Use this template
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(null)}
                  className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-200 p-4">
              <div className="mx-auto shadow-2xl" style={{ width: 794 }}>
                <InvoiceA4View
                  sale={SAMPLE_SALE_FOR_PREVIEW}
                  settings={settings}
                  tenantSlug={tenantSlug}
                  template={expanded}
                  hideControls
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default InvoiceTemplatePicker
