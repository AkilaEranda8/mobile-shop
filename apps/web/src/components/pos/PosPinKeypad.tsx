'use client'

import { Delete, Loader2 } from 'lucide-react'
import { POS_THEME } from './pos-theme'

type Props = {
  value: string
  maxLength: 4 | 6
  onChange: (next: string) => void
  onSubmit: () => void
  loading?: boolean
  error?: string
  disabled?: boolean
  /** When true, Enter / full length auto-submits via parent */
  autoSubmit?: boolean
  title?: string
  subtitle?: string
}

export function PosPinKeypad({
  value,
  maxLength,
  onChange,
  onSubmit,
  loading,
  error,
  disabled,
  title,
  subtitle,
}: Props) {
  const push = (d: string) => {
    if (disabled || loading) return
    if (value.length >= maxLength) return
    onChange(value + d)
  }
  const back = () => {
    if (disabled || loading) return
    onChange(value.slice(0, -1))
  }
  const clear = () => {
    if (disabled || loading) return
    onChange('')
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

  return (
    <div className="w-full max-w-[280px] mx-auto">
      {(title || subtitle) && (
        <div className="text-center mb-5">
          {title && <h3 className="text-base font-bold" style={{ color: POS_THEME.text }}>{title}</h3>}
          {subtitle && <p className="text-xs mt-1" style={{ color: POS_THEME.muted }}>{subtitle}</p>}
        </div>
      )}

      <div className="flex justify-center gap-2.5 mb-5" aria-label="PIN entry">
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className="w-3 h-3 rounded-full border transition-colors"
            style={{
              borderColor: POS_THEME.border,
              background: i < value.length ? POS_THEME.purple : 'transparent',
              boxShadow: i < value.length ? `0 0 8px ${POS_THEME.purple}66` : undefined,
            }}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-xs mb-3 font-medium" style={{ color: POS_THEME.red }}>{error}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => {
          const isClear = k === 'C'
          const isBack = k === '⌫'
          return (
            <button
              key={k}
              type="button"
              disabled={disabled || loading}
              onClick={() => {
                if (isClear) clear()
                else if (isBack) back()
                else push(k)
              }}
              className="h-14 rounded-2xl text-lg font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: POS_THEME.card,
                border: `1px solid ${POS_THEME.border}`,
                color: isClear ? POS_THEME.red : isBack ? POS_THEME.muted : POS_THEME.text,
              }}
            >
              {isBack ? <Delete size={18} className="mx-auto" /> : k}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={disabled || loading || value.length !== maxLength}
        onClick={onSubmit}
        className="mt-4 w-full h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: POS_THEME.purple }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Continue'}
      </button>
    </div>
  )
}
