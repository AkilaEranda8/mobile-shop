'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Loader2, Minus, Plus, Printer, Settings2, X } from 'lucide-react'
import { BarcodeStickerPreview } from '@/components/inventory/BarcodeLabelPreview'
import { clampLabelCopies, MAX_LABEL_COPIES, type BarcodeLabelItem } from '@/lib/barcode-print'
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
  /** Copies for the single-product case — shows an editable quantity input. */
  copies?: number
  onCopiesChange?: (copies: number) => void
  onClose: () => void
  onPrint: () => void
}

function expandLabels(labels: BarcodeLabelItem[]): BarcodeLabelItem[] {
  const out: BarcodeLabelItem[] = []
  for (const item of labels) {
    const copies = Math.max(1, Math.min(item.qty ?? 1, MAX_LABEL_COPIES))
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
  copies,
  onCopiesChange,
  onClose,
  onPrint,
}: Props) {
  const expanded = useMemo(() => expandLabels(labels), [labels])
  const total = expanded.length
  const visible = expanded.slice(0, MAX_VISIBLE)
  const hidden = Math.max(0, total - visible.length)
  const showCopies = typeof onCopiesChange === 'function' && labels.length === 1
  const copiesValue = clampLabelCopies(copies ?? labels[0]?.qty ?? 1)

  if (!open) return null

  const bump = (delta: number) => onCopiesChange?.(clampLabelCopies(copiesValue + delta))

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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {loading
                  ? 'Loading labels…'
                  : `${total} label${total === 1 ? '' : 's'} · ${settings.widthMm}×${settings.heightMm} mm`}
              </p>
              {!loading && (
                <Link
                  href="/settings/barcode-labels"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:underline"
                >
                  <Settings2 size={11} /> Edit design
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onPrint}
              disabled={loading || printing || total === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-[12px] rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold disabled:opacity-50"
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
          {showCopies ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Copies</span>
              <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
                <button
                  type="button"
                  onClick={() => bump(-1)}
                  disabled={copiesValue <= 1}
                  className="px-2.5 py-2 hover:bg-white/5 disabled:opacity-40"
                  style={{ color: 'var(--text-primary)' }}
                  aria-label="Decrease copies"
                >
                  <Minus size={13} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_LABEL_COPIES}
                  value={copiesValue}
                  onChange={e => onCopiesChange?.(clampLabelCopies(e.target.value))}
                  onFocus={e => e.target.select()}
                  className="w-16 text-center text-sm font-semibold bg-transparent outline-none tabular-nums"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => bump(1)}
                  disabled={copiesValue >= MAX_LABEL_COPIES}
                  className="px-2.5 py-2 hover:bg-white/5 disabled:opacity-40"
                  style={{ color: 'var(--text-primary)' }}
                  aria-label="Increase copies"
                >
                  <Plus size={13} />
                </button>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>= {copiesValue} label{copiesValue === 1 ? '' : 's'}</span>
            </div>
          ) : (
            <Link
              href="/settings/barcode-labels"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              <Settings2 size={12} /> Edit design in Settings → Barcode Labels
            </Link>
          )}
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
              className="inline-flex items-center gap-2 px-3 py-2 text-[12px] rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold disabled:opacity-50"
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
