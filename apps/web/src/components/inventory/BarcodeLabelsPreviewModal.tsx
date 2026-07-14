'use client'

import { useMemo } from 'react'
import { Loader2, Printer, X } from 'lucide-react'
import { BarcodeStickerPreview } from '@/components/inventory/BarcodeLabelPreview'
import type { BarcodeLabelItem } from '@/lib/barcode-print'
import type { BarcodeLabelSettings } from '@/lib/invoiceSettings'

const MAX_VISIBLE = 24

type Props = {
  open: boolean
  poNumber: string
  labels: BarcodeLabelItem[]
  settings: BarcodeLabelSettings
  shopName?: string
  loading?: boolean
  printing?: boolean
  onClose: () => void
  onPrint: () => void
}

function expandLabels(labels: BarcodeLabelItem[]): BarcodeLabelItem[] {
  const out: BarcodeLabelItem[] = []
  for (const item of labels) {
    const copies = Math.max(1, Math.min(item.qty ?? 1, 99))
    for (let i = 0; i < copies; i++) {
      out.push({ ...item, qty: 1 })
    }
  }
  return out
}

export default function BarcodeLabelsPreviewModal({
  open,
  poNumber,
  labels,
  settings,
  shopName,
  loading,
  printing,
  onClose,
  onPrint,
}: Props) {
  const expanded = useMemo(() => expandLabels(labels), [labels])
  const total = expanded.length
  const visible = expanded.slice(0, MAX_VISIBLE)
  const hidden = Math.max(0, total - visible.length)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-hidden border flex flex-col"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Barcode preview — {poNumber}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {loading
                ? 'Loading labels…'
                : `${total} label${total === 1 ? '' : 's'} · ${settings.widthMm}×${settings.heightMm} mm · Review, then Print`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onPrint}
              disabled={loading || printing || total === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-[12px] rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
            >
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5" style={{ background: 'var(--bg-subtle)' }}>
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={18} className="animate-spin" />
              Loading barcode labels…
            </div>
          )}

          {!loading && total === 0 && (
            <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
              No barcode labels for this PO. IMEI-tracked devices use Register IMEI instead of shelf barcodes.
            </div>
          )}

          {!loading && total > 0 && (
            <>
              <div className="flex flex-wrap justify-center gap-4">
                {visible.map((item, idx) => (
                  <div
                    key={`${item.barcode}-${idx}`}
                    className="rounded-lg border bg-white p-2 shadow-sm"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <BarcodeStickerPreview
                      item={item}
                      settings={settings}
                      shopName={shopName}
                    />
                  </div>
                ))}
              </div>
              {hidden > 0 && (
                <p className="text-center text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
                  Showing first {MAX_VISIBLE} of {total} labels. All {total} will print.
                </p>
              )}
            </>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Layout from Settings → Barcode Labels
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-[12px] rounded-lg border font-semibold"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onPrint}
              disabled={loading || printing || total === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-[12px] rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
            >
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print {total > 0 ? `(${total})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
