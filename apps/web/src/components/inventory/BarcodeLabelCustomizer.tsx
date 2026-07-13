'use client'

import { Printer, Save, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { BarcodeStickerPreview } from '@/components/inventory/BarcodeLabelPreview'
import type { BarcodeLabelItem } from '@/lib/barcode-print'
import {
  DEFAULT_BARCODE_LABEL_SETTINGS,
  type BarcodeLabelPreset,
  type BarcodeLabelSettings,
} from '@/lib/invoiceSettings'

const PRESETS: { id: BarcodeLabelPreset; label: string; w: number; h: number }[] = [
  { id: '38x25', label: '38×25 mm', w: 38, h: 25 },
  { id: '50x30', label: '50×30 mm', w: 50, h: 30 },
  { id: '40x30', label: '40×30 mm', w: 40, h: 30 },
  { id: 'custom', label: 'Custom', w: 0, h: 0 },
]

const FIELD_TOGGLES: { key: keyof BarcodeLabelSettings; label: string }[] = [
  { key: 'showShopName', label: 'Shop name' },
  { key: 'showProductName', label: 'Product name' },
  { key: 'showSku', label: 'SKU' },
  { key: 'showPrice', label: 'Price' },
  { key: 'showBarcodeText', label: 'Barcode digits' },
  { key: 'showCopyIndex', label: 'Copy index (1/N)' },
]

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
  const applyPreset = (id: BarcodeLabelPreset) => {
    const p = PRESETS.find(x => x.id === id)
    if (!p) return
    if (id === 'custom') {
      onChange({ preset: 'custom' })
      return
    }
    onChange({ preset: id, widthMm: p.w, heightMm: p.h })
  }

  return (
    <div className="card p-5 space-y-4 border-amber-500/20">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
            <Printer size={13} /> Barcode Label Design
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Customize sticker size and fields. PO qty still controls how many labels print.
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
            Save layout
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Label size</label>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    settings.preset === p.id
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-amber-500/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {settings.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Width (mm)</label>
                <input
                  type="number"
                  min={20}
                  max={100}
                  value={settings.widthMm}
                  onChange={e => onChange({ widthMm: Number(e.target.value) || DEFAULT_BARCODE_LABEL_SETTINGS.widthMm, preset: 'custom' })}
                  className="input text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Height (mm)</label>
                <input
                  type="number"
                  min={10}
                  max={80}
                  value={settings.heightMm}
                  onChange={e => onChange({ heightMm: Number(e.target.value) || DEFAULT_BARCODE_LABEL_SETTINGS.heightMm, preset: 'custom' })}
                  className="input text-sm w-full"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-2">Fields on label</label>
            <div className="space-y-2">
              {FIELD_TOGGLES.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl border border-white/10 bg-white/[0.03]"
                >
                  <span className="text-sm text-slate-200">{label}</span>
                  <Switch
                    checked={Boolean(settings[key])}
                    onChange={v => onChange({ [key]: v })}
                    variant="violet"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Name lines</label>
              <div className="flex gap-2">
                {([1, 2] as const).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange({ nameMaxLines: n })}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                      settings.nameMaxLines === n
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {n} line{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Name font (pt)</label>
              <input
                type="number"
                min={4}
                max={12}
                step={0.5}
                value={settings.nameFontPt}
                onChange={e => onChange({ nameFontPt: Number(e.target.value) || 5.5 })}
                className="input text-sm w-full"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Barcode height</label>
              <input
                type="range"
                min={12}
                max={48}
                value={settings.barcodeHeight}
                onChange={e => onChange({ barcodeHeight: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{settings.barcodeHeight}px</p>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Bar density</label>
              <input
                type="range"
                min={0.6}
                max={2}
                step={0.1}
                value={settings.barcodeBarWidth}
                onChange={e => onChange({ barcodeBarWidth: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{settings.barcodeBarWidth.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">Live preview</p>
          <div className="flex justify-center items-center min-h-[140px] rounded-lg bg-slate-100/80 dark:bg-white/5 p-4">
            <BarcodeStickerPreview
              item={sampleItem}
              settings={settings}
              shopName={shopName}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-3 text-center">
            {settings.widthMm}×{settings.heightMm} mm
            {sampleItem?.barcode ? ` · ${sampleItem.name}` : ' · sample label'}
          </p>
        </div>
      </div>
    </div>
  )
}
