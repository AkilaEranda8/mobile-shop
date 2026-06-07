'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PhoneCall, ScanLine, Loader2, Plus } from 'lucide-react'
import { POS_THEME } from './HexaPosLayout'
import { formatCurrency } from '@/lib/utils'

export const RELOAD_PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000]

export function normalizeReloadPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('94') && digits.length >= 11) return '0' + digits.slice(2, 12)
  if (digits.length === 9 && digits.startsWith('7')) return '0' + digits
  if (digits.length >= 10) return digits.slice(0, 10)
  return digits
}

export function looksLikeReloadPhone(raw: string): boolean {
  const n = normalizeReloadPhone(raw.trim())
  return /^0[0-9]{9}$/.test(n)
}

interface PosReloadPanelProps {
  onAdd: (phone: string, amount: number) => void
  initialPhone?: string
  compact?: boolean
}

export function PosReloadPanel({ onAdd, initialPhone = '', compact = false }: PosReloadPanelProps) {
  const [phone, setPhone] = useState(initialPhone)
  const [amount, setAmount] = useState<number | null>(null)
  const [customAmt, setCustomAmt] = useState('')
  const phoneRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialPhone) setPhone(normalizeReloadPhone(initialPhone))
  }, [initialPhone])

  useEffect(() => {
    phoneRef.current?.focus()
  }, [])

  const submit = () => {
    const p = normalizeReloadPhone(phone)
    if (!/^0[0-9]{9}$/.test(p)) return false
    const amt = amount ?? (customAmt ? parseFloat(customAmt) : 0)
    if (!amt || amt <= 0) return false
    onAdd(p, amt)
    setPhone('')
    setAmount(null)
    setCustomAmt('')
    phoneRef.current?.focus()
    return true
  }

  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-4 px-3' : 'py-8 px-4 min-h-[320px]'}`}>
      <div className={`w-full ${compact ? 'max-w-md' : 'max-w-lg'}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${POS_THEME.teal}22` }}>
            <PhoneCall size={18} style={{ color: POS_THEME.teal }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Mobile Reload</p>
            <p className="text-[11px]" style={{ color: POS_THEME.muted }}>Scan barcode or enter connection number</p>
          </div>
        </div>

        <div className="relative mb-4">
          <ScanLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: POS_THEME.muted }} />
          <input
            ref={phoneRef}
            type="text"
            inputMode="numeric"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && amount) submit()
            }}
            placeholder="07XXXXXXXX — scan barcode here"
            className="w-full h-12 pl-9 pr-3 rounded-xl text-base font-mono font-bold border outline-none text-white placeholder:text-white/40"
            style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
          />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: POS_THEME.muted }}>Select amount</p>
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

        <div className="flex gap-2 mb-4">
          <input
            type="number"
            min="1"
            step="1"
            value={customAmt}
            onChange={e => { setCustomAmt(e.target.value); setAmount(null) }}
            placeholder="Custom amount"
            className="flex-1 h-10 px-3 rounded-xl text-sm border outline-none text-white placeholder:text-white/40"
            style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
          />
        </div>

        <button
          type="button"
          onClick={() => submit()}
          disabled={!looksLikeReloadPhone(phone) || (!(amount && amount > 0) && !(parseFloat(customAmt) > 0))}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
          style={{ background: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` }}>
          <Plus size={16} /> Add Reload to Cart
        </button>
      </div>
    </div>
  )
}
