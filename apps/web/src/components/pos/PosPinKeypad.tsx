'use client'

import { useEffect, useRef } from 'react'
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
  title?: string
  subtitle?: string
  autoFocus?: boolean
  showSubmit?: boolean
  submitLabel?: string
  /** On-screen number pad (default on for POS / shop login) */
  showKeypad?: boolean
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
  autoFocus = true,
  showSubmit = true,
  submitLabel = 'Continue',
  showKeypad = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const activeIndex = Math.min(value.length, maxLength - 1)

  const push = (d: string) => {
    if (disabled || loading) return
    if (valueRef.current.length >= maxLength) return
    onChange(valueRef.current + d)
  }
  const back = () => {
    if (disabled || loading) return
    onChange(valueRef.current.slice(0, -1))
  }
  const clear = () => {
    if (disabled || loading) return
    onChange('')
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus, loading, disabled, error])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || loading) return
      if (e.target === inputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (valueRef.current.length === maxLength) onSubmit()
        }
        return
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        push(e.key)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        back()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        clear()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (valueRef.current.length === maxLength) onSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, loading, maxLength, onChange, onSubmit])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

  return (
    <div
      className="w-full max-w-[300px] mx-auto flex flex-col items-stretch"
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        value={value}
        disabled={disabled || loading}
        aria-label="PIN"
        className="sr-only"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, maxLength)
          onChange(digits)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.length === maxLength) {
            e.preventDefault()
            onSubmit()
          }
        }}
      />

      {(title || subtitle) && (
        <div className="text-center mb-5">
          {title && (
            <h3 className="text-base font-semibold tracking-tight" style={{ color: POS_THEME.text }}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs mt-1.5" style={{ color: POS_THEME.muted }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* 1 — PIN slots */}
      <div
        className="flex justify-center gap-2 mb-5"
        aria-label="PIN entry"
        aria-live="polite"
        role="group"
      >
        {Array.from({ length: maxLength }).map((_, i) => {
          const filled = i < value.length
          const active = !disabled && !loading && i === activeIndex && value.length < maxLength
          return (
            <span
              key={i}
              className="relative flex h-11 w-9 items-center justify-center rounded-lg border transition-all duration-150"
              style={{
                borderColor: error
                  ? `${POS_THEME.red}88`
                  : active
                    ? POS_THEME.purple
                    : filled
                      ? `${POS_THEME.purple}55`
                      : POS_THEME.border,
                background: filled ? `${POS_THEME.purple}14` : 'rgba(255,255,255,0.03)',
                boxShadow: active ? `0 0 0 2px ${POS_THEME.purple}28` : undefined,
              }}
            >
              {filled ? (
                <span className="h-2 w-2 rounded-full" style={{ background: POS_THEME.purple }} />
              ) : active ? (
                <span className="h-3.5 w-0.5 rounded-full animate-pulse" style={{ background: POS_THEME.purple }} />
              ) : null}
            </span>
          )
        })}
      </div>

      {error && (
        <p className="text-center text-xs mb-3 font-medium -mt-2" style={{ color: POS_THEME.red }}>
          {error}
        </p>
      )}

      {/* 2 — Keypad */}
      {showKeypad && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {keys.map((k) => {
            const isClear = k === 'C'
            const isBack = k === '⌫'
            return (
              <button
                key={k}
                type="button"
                disabled={disabled || loading}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isClear) clear()
                  else if (isBack) back()
                  else push(k)
                  inputRef.current?.focus()
                }}
                className="h-[52px] rounded-xl text-[17px] font-semibold transition-transform active:scale-[0.96] disabled:opacity-45 select-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${POS_THEME.border}`,
                  color: isClear ? POS_THEME.red : isBack ? POS_THEME.muted : POS_THEME.text,
                }}
              >
                {isBack ? <Delete size={17} className="mx-auto" strokeWidth={2.25} /> : k}
              </button>
            )
          })}
        </div>
      )}

      {!showKeypad && (
        <p className="text-center text-[11px] mb-4" style={{ color: POS_THEME.muted }}>
          Type your {maxLength}-digit PIN
        </p>
      )}

      {/* 3 — Submit / loading */}
      {loading && !showSubmit && (
        <div className="flex justify-center py-2">
          <Loader2 size={18} className="animate-spin" style={{ color: POS_THEME.purple }} />
        </div>
      )}

      {showSubmit && (
        <button
          type="button"
          disabled={disabled || loading || value.length !== maxLength}
          onClick={(e) => {
            e.stopPropagation()
            onSubmit()
          }}
          className="w-full h-12 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
          style={{ background: POS_THEME.purple }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : submitLabel}
        </button>
      )}
    </div>
  )
}
