'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Check, Maximize2, X } from 'lucide-react'
import InvoiceA4View, { SAMPLE_SALE_FOR_PREVIEW } from '@/components/invoice/InvoiceA4View'
import { tenantApi } from '@/lib/api'
import {
  INVOICE_TEMPLATE_OPTIONS,
  resolveInvoiceTemplate,
  type InvoiceSettings,
  type InvoiceTemplateId,
} from '@/lib/invoiceSettings'

const A4_WIDTH = 794
const A4_HEIGHT = 1123

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

function usePreviewScale(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(0.28)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / A4_WIDTH)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  return scale
}

function ScaledInvoicePreview({
  templateId,
  settings,
  tenantSlug,
}: {
  templateId: InvoiceTemplateId
  settings: InvoiceSettings
  tenantSlug?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scale = usePreviewScale(containerRef)
  const visibleHeight = Math.round(A4_HEIGHT * scale)

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-white"
      style={{ height: visibleHeight }}
    >
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <InvoiceA4View
          sale={SAMPLE_SALE_FOR_PREVIEW}
          settings={settings}
          tenantSlug={tenantSlug}
          template={templateId}
          hideControls
        />
      </div>
    </div>
  )
}

function TemplatePreviewCard({
  templateId,
  label,
  selected,
  settings,
  tenantSlug,
  onSelect,
  onExpand,
}: {
  templateId: InvoiceTemplateId
  label: string
  selected: boolean
  settings: InvoiceSettings
  tenantSlug?: string
  onSelect: () => void
  onExpand: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden transition-all ${
        selected
          ? 'border-violet-500 ring-2 ring-violet-500/50 shadow-[0_0_0_1px_rgba(139,92,246,0.35)]'
          : 'border-white/15 hover:border-violet-500/35'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/10 bg-white/[0.03] shrink-0">
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center gap-1.5 min-w-0 text-left"
        >
          <span className={`text-sm font-semibold truncate ${selected ? 'text-violet-300' : 'text-white'}`}>
            {label}
          </span>
          {selected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-400 shrink-0">
              <Check size={12} strokeWidth={3} />
              Active
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onExpand}
          title="Full preview"
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        aria-pressed={selected}
        aria-label={`Select ${label} invoice template`}
      >
        <ScaledInvoicePreview
          templateId={templateId}
          settings={settings}
          tenantSlug={tenantSlug}
        />
      </button>
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
      <div className="card p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
            <FileText size={13} /> A4 Invoice Templates
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            All layouts below use your company info. Click a preview to select, or expand for full view.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {templates.map(opt => (
            <TemplatePreviewCard
              key={opt.id}
              templateId={opt.id}
              label={opt.label}
              selected={active === opt.id}
              settings={settings}
              tenantSlug={tenantSlug}
              onSelect={() => onChange(opt.id)}
              onExpand={e => { e.stopPropagation(); setExpanded(opt.id) }}
            />
          ))}
        </div>

        <p className="text-[10px] text-slate-500 text-center pt-1">
          Active:{' '}
          <span className="text-violet-400 font-semibold">
            {templates.find(t => t.id === active)?.label ?? active}
          </span>
          {' · '}POS A4 bills, sales PDF, and repair quotes
        </p>
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
              <div className="mx-auto shadow-2xl" style={{ width: A4_WIDTH }}>
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
