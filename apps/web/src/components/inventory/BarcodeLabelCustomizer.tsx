'use client'

import { Check, Printer, Save, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { BarcodeStickerPreview } from '@/components/inventory/BarcodeLabelPreview'
import type { BarcodeLabelItem } from '@/lib/barcode-print'
import {
  BARCODE_LABEL_DESIGNS,
  BARCODE_QUICK_DESIGNS,
  DEFAULT_BARCODE_LABEL_SETTINGS,
  type BarcodeLabelSettings,
  type BarcodeQuickDesign,
} from '@/lib/invoiceSettings'

const SIZE_PRESETS = [
  { label: '38×25', w: 38, h: 25 },
  { label: '40×30', w: 40, h: 30 },
  { label: '50×30', w: 50, h: 30 },
] as const

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
  const patchCustom = (patch: Partial<BarcodeLabelSettings>) => {
    onChange({ ...patch, preset: 'custom' })
  }

  const applyQuickDesign = (id: BarcodeQuickDesign) => {
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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
            <Printer size={13} /> Barcode sticker customize
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Choose a quick design, then customize size, fields, and barcode density.
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
            Save sticker
          </button>
        )}
      </div>

      {/* Quick designs */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Quick designs</label>
        <div className="grid sm:grid-cols-3 gap-3">
          {BARCODE_QUICK_DESIGNS.map(id => {
            const design = BARCODE_LABEL_DESIGNS[id]
            const selected = settings.preset === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyQuickDesign(id)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected
                    ? 'border-violet-500 ring-2 ring-violet-500/40 bg-violet-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-violet-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{design.label}</p>
                  {selected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-2">{design.description}</p>
                <div className="rounded-lg bg-white border border-slate-200 p-2 flex justify-center min-h-[88px] items-center">
                  <BarcodeStickerPreview item={sampleItem} settings={design} shopName={shopName || 'My Shop'} />
                </div>
              </button>
            )
          })}
        </div>
        {settings.preset === 'custom' && (
          <p className="text-[11px] text-amber-500/90 mt-2">Custom — sticker uses your edited settings</p>
        )}
      </div>

      {/* Live preview — full width, large */}
      <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Live sticker preview</p>
          <p className="text-[10px] text-slate-500">
            {settings.widthMm}×{settings.heightMm} mm
            {settings.preset === 'custom' ? ' · custom' : ` · ${settings.preset}`}
          </p>
        </div>
        <div className="w-full min-h-[360px] rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden">
          <BarcodeStickerPreview
            item={sampleItem}
            settings={settings}
            shopName={shopName || 'My Shop'}
            large
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Size */}
        <div className="card p-4 space-y-3 border-white/10">
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Sticker size</p>
          <div className="flex gap-2 flex-wrap">
            {SIZE_PRESETS.map(s => {
              const active = settings.widthMm === s.w && settings.heightMm === s.h
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => patchCustom({ widthMm: s.w, heightMm: s.h })}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'
                  }`}
                >
                  {s.label} mm
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Width (mm)</label>
              <input
                type="number"
                min={20}
                max={100}
                value={settings.widthMm}
                onChange={e =>
                  patchCustom({
                    widthMm: Number(e.target.value) || DEFAULT_BARCODE_LABEL_SETTINGS.widthMm,
                  })
                }
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
                onChange={e =>
                  patchCustom({
                    heightMm: Number(e.target.value) || DEFAULT_BARCODE_LABEL_SETTINGS.heightMm,
                  })
                }
                className="input text-sm w-full"
              />
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="card p-4 space-y-2 border-white/10">
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">Fields on sticker</p>
          {FIELD_TOGGLES.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <span className="text-sm text-slate-200">{label}</span>
              <Switch
                checked={Boolean(settings[key])}
                onChange={v => patchCustom({ [key]: v })}
                variant="violet"
              />
            </div>
          ))}
        </div>

        {/* Typography / barcode */}
        <div className="card p-4 space-y-3 border-white/10 lg:col-span-2">
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Text & barcode</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Name lines</label>
              <div className="flex gap-2">
                {([1, 2] as const).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patchCustom({ nameMaxLines: n })}
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
                onChange={e => patchCustom({ nameFontPt: Number(e.target.value) || 5.5 })}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Barcode height</label>
              <input
                type="range"
                min={12}
                max={48}
                value={settings.barcodeHeight}
                onChange={e => patchCustom({ barcodeHeight: Number(e.target.value) })}
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
                onChange={e => patchCustom({ barcodeBarWidth: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{settings.barcodeBarWidth.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
