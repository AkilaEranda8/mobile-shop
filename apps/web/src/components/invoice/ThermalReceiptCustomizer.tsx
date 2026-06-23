'use client'

import type { InvoiceSettings } from '@/lib/invoiceSettings'
import ThermalReceipt, { SAMPLE_THERMAL_SALE } from '@/components/invoice/ThermalReceipt'
import { Switch } from '@/components/ui/Switch'
import { Printer } from 'lucide-react'

const LAYOUT_TOGGLES: { key: keyof InvoiceSettings; label: string }[] = [
  { key: 'thermalShowLogo',     label: 'Logo' },
  { key: 'thermalShowSlogan',   label: 'Slogan' },
  { key: 'thermalShowAddress',  label: 'Address' },
  { key: 'thermalShowPhone',    label: 'Phone' },
  { key: 'thermalShowEmail',    label: 'Email' },
  { key: 'thermalShowCustomer', label: 'Customer name' },
  { key: 'thermalShowSku',      label: 'SKU on items' },
  { key: 'thermalShowImei',     label: 'IMEI on items' },
  { key: 'thermalShowPayment',  label: 'Payment / change' },
  { key: 'thermalShowBank',     label: 'Bank details' },
  { key: 'thermalShowWebsite',  label: 'Website footer' },
  { key: 'thermalShowWarranty', label: 'Warranty block' },
]

interface Props {
  settings: InvoiceSettings
  onChange: (patch: Partial<InvoiceSettings>) => void
  showPreview?: boolean
}

export function ThermalReceiptPreview({ settings }: { settings: InvoiceSettings }) {
  return (
    <div className="card p-4 border-violet-500/20 bg-violet-500/5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Live Preview</p>
        <span className="text-[10px] text-slate-500">{settings.thermalWidthPOS || '58mm'} · sample sale</span>
      </div>
      <div className="rounded-xl border-2 border-dashed border-violet-500/30 bg-white p-4 flex justify-center overflow-x-auto min-h-[280px]">
        <ThermalReceipt sale={SAMPLE_THERMAL_SALE} settings={settings} />
      </div>
      <p className="text-[10px] text-slate-500 mt-3 text-center">
        Changes to company info and thermal layout update here instantly.
      </p>
    </div>
  )
}

export default function ThermalReceiptCustomizer({ settings, onChange, showPreview = true }: Props) {
  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
            <Printer size={13} /> Thermal Receipt Design
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Choose paper size, font, and which sections appear on POS thermal prints.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">POS paper width</label>
            <div className="flex gap-2 flex-wrap">
              {(['58mm', '80mm'] as const).map(w => (
                <button key={w} type="button" onClick={() => onChange({ thermalWidthPOS: w })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${settings.thermalWidthPOS === w ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'}`}>
                  {w}
                </button>
              ))}
              <button type="button" onClick={() => onChange({ thermalWidthPOS: 'stockForm' })}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${settings.thermalWidthPOS === 'stockForm' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'}`}
                title="9.5&quot; × 11&quot; dot-matrix continuous form paper (241 mm × 279 mm)">
                9.5″×11″
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Repair paper width</label>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as const).map(w => (
                <button key={w} type="button" onClick={() => onChange({ thermalWidthRepair: w })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${settings.thermalWidthRepair === w ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'}`}>
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-2">Font size</label>
          <div className="flex gap-2">
            {([
              { v: 'sm' as const, label: 'Small' },
              { v: 'md' as const, label: 'Medium' },
              { v: 'lg' as const, label: 'Large' },
            ]).map(({ v, label }) => (
              <button key={v} type="button" onClick={() => onChange({ thermalFontSize: v })}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${settings.thermalFontSize === v ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-2">Show on receipt</label>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
            {LAYOUT_TOGGLES.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3 py-1.5 min-w-0">
                <span className="text-xs text-slate-300 truncate">{label}</span>
                <Switch
                  checked={Boolean(settings[key])}
                  onChange={v => onChange({ [key]: v } as Partial<InvoiceSettings>)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPreview && <ThermalReceiptPreview settings={settings} />}
    </div>
  )
}
