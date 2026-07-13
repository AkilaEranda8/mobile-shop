'use client'

import { Check, Printer, Save, Loader2 } from 'lucide-react'
import { BarcodeStickerPreview } from '@/components/inventory/BarcodeLabelPreview'
import type { BarcodeLabelItem } from '@/lib/barcode-print'
import {
  BARCODE_LABEL_DESIGNS,
  BARCODE_LABEL_PRESETS,
  type BarcodeLabelPreset,
  type BarcodeLabelSettings,
} from '@/lib/invoiceSettings'

interface Props {
  settings: BarcodeLabelSettings
  onChange: (patch: Partial<BarcodeLabelSettings>) => void
  sampleItem?: BarcodeLabelItem | null
  shopName?: string
  onSave?: () => void
  saving?: boolean
  canSave?: boolean
}

export default function BarcodeLabelCustomizer({
  settings,
  onChange,
  sampleItem,
  shopName,
  onSave,
  saving,
  canSave = true,
}: Props) {
  const selectDesign = (id: BarcodeLabelPreset) => {
    const design = BARCODE_LABEL_DESIGNS[id]
    onChange({
      widthMm: design.widthMm,
      heightMm: design.heightMm,
      preset: design.preset,
      showShopName: design.showShopName,
      showProductName: design.showProductName,
      showSku: design.showSku,
      showPrice: design.showPrice,
      showBarcodeText: design.showBarcodeText,
      showCopyIndex: design.showCopyIndex,
      nameFontPt: design.nameFontPt,
      barcodeHeight: design.barcodeHeight,
      barcodeBarWidth: design.barcodeBarWidth,
      nameMaxLines: design.nameMaxLines,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
            <Printer size={13} /> Select design
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Design 1, 2, හෝ 3 තෝරන්න — එකක් විතරක්. Save කරලා print වලට apply වෙනවා.
          </p>
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !canSave}
            className="btn-primary text-xs flex items-center gap-1.5 self-start disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save design
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {BARCODE_LABEL_PRESETS.map(id => {
          const design = BARCODE_LABEL_DESIGNS[id]
          const selected = settings.preset === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectDesign(id)}
              className={`group text-left rounded-2xl border overflow-hidden transition-all ${
                selected
                  ? 'border-violet-500 ring-2 ring-violet-500/50 bg-violet-500/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-violet-500/40'
              }`}
            >
              <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{design.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{design.description}</p>
                </div>
                <span
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border flex-shrink-0 ${
                    selected
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'border-white/20 text-transparent'
                  }`}
                >
                  <Check size={12} />
                </span>
              </div>

              <div className="mx-3 mb-3 rounded-xl bg-white border border-slate-200/80 p-3 flex justify-center min-h-[120px] items-center">
                <BarcodeStickerPreview
                  item={sampleItem}
                  settings={design}
                  shopName={shopName || 'My Shop'}
                />
              </div>

              <div className="px-4 pb-3 flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-500">
                  {design.widthMm}×{design.heightMm} mm
                </span>
                <span className={`text-[10px] font-semibold ${selected ? 'text-violet-400' : 'text-slate-500'}`}>
                  {selected ? 'Selected' : 'Select'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
