'use client'

import React, { useState } from 'react'
import { CreditCard, PhoneCall, Plus, Smartphone } from 'lucide-react'
import { POS_THEME } from './HexaPosLayout'
import { formatCurrency } from '@/lib/utils'
import type { ReloadServiceType } from '@/lib/reloadSettings'

export const RELOAD_PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000]

export const RELOAD_PROVIDERS = [
  { id: 'Dialog',  label: 'Dialog',  color: '#E11D48', bg: '#E11D4822' },
  { id: 'Mobitel', label: 'Mobitel', color: '#2563EB', bg: '#2563EB22' },
  { id: 'Airtel',  label: 'Airtel',  color: '#DC2626', bg: '#DC262622' },
  { id: 'Hutch',   label: 'Hutch',   color: '#F59E0B', bg: '#F59E0B22' },
] as const

export type ReloadProvider = typeof RELOAD_PROVIDERS[number]['id']

const SERVICE_TYPES: { id: ReloadServiceType; label: string; icon: typeof PhoneCall }[] = [
  { id: 'RELOAD', label: 'Reload', icon: Smartphone },
  { id: 'RECHARGE_CARD', label: 'Recharge Card', icon: CreditCard },
]

interface PosReloadPanelProps {
  onAdd: (provider: ReloadProvider, amount: number, serviceType: ReloadServiceType) => void
  compact?: boolean
}

export function PosReloadPanel({ onAdd, compact = false }: PosReloadPanelProps) {
  const [serviceType, setServiceType] = useState<ReloadServiceType>('RELOAD')
  const [provider, setProvider] = useState<ReloadProvider | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [customAmt, setCustomAmt] = useState('')

  const resolvedAmount = amount ?? (customAmt ? parseFloat(customAmt) : 0)
  const serviceLabel = serviceType === 'RECHARGE_CARD' ? 'Recharge Card' : 'Reload'

  const submit = () => {
    if (!provider || !resolvedAmount || resolvedAmount <= 0) return false
    onAdd(provider, resolvedAmount, serviceType)
    setAmount(null)
    setCustomAmt('')
    return true
  }

  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-4 px-3' : 'py-8 px-4 min-h-[320px]'}`}>
      <div className={`w-full ${compact ? 'max-w-md' : 'max-w-lg'}`}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${POS_THEME.teal}22` }}>
            <PhoneCall size={18} style={{ color: POS_THEME.teal }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Reload / Recharge Card</p>
            <p className="text-[11px]" style={{ color: POS_THEME.muted }}>Select type, network provider and amount</p>
          </div>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: POS_THEME.muted }}>Service type</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {SERVICE_TYPES.map(s => {
            const Icon = s.icon
            const active = serviceType === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceType(s.id)}
                className="h-12 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2"
                style={active
                  ? { background: `${POS_THEME.purple}33`, borderColor: POS_THEME.purple, color: POS_THEME.text }
                  : { background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.muted }}>
                <Icon size={14} />
                {s.label}
              </button>
            )
          })}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: POS_THEME.muted }}>Network provider</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {RELOAD_PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className="h-14 rounded-xl text-sm font-bold border-2 transition-all"
              style={provider === p.id
                ? { background: p.bg, borderColor: p.color, color: '#fff', boxShadow: `0 0 0 1px ${p.color}44` }
                : { background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.muted }}>
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: POS_THEME.muted }}>Amount</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {RELOAD_PRESET_AMOUNTS.map(amt => (
            <button
              key={amt}
              type="button"
              onClick={() => { setAmount(amt); setCustomAmt('') }}
              className="py-2.5 rounded-xl text-xs font-bold border transition-all"
              style={amount === amt
                ? { background: `${POS_THEME.purple}33`, borderColor: POS_THEME.purple, color: POS_THEME.text }
                : { background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.muted }}>
              {formatCurrency(amt)}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-5">
          <input
            type="number"
            min="1"
            step="1"
            value={customAmt}
            onChange={e => { setCustomAmt(e.target.value); setAmount(null) }}
            onKeyDown={e => { if (e.key === 'Enter' && provider) submit() }}
            placeholder="Custom amount (Rs)"
            className="flex-1 h-10 px-3 rounded-xl text-sm border outline-none text-white placeholder:text-white/40"
            style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
          />
        </div>

        <button
          type="button"
          onClick={() => submit()}
          disabled={!provider || !(resolvedAmount > 0)}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
          style={{ background: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` }}>
          <Plus size={16} />
          {provider && resolvedAmount > 0
            ? `Add ${provider} ${serviceLabel} ${formatCurrency(resolvedAmount)} to Cart`
            : `Add ${serviceLabel} to Cart`}
        </button>
      </div>
    </div>
  )
}
