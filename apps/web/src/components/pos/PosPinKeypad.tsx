'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
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
  /** Auto-focus hidden input so physical / mobile keyboard works immediately */
  autoFocus?: boolean
  /** Show submit button (auto-submit still runs when length is full) */
  showSubmit?: boolean
  submitLabel?: string
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
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const activeIndex = Math.min(value.length, maxLength - 1)

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
        if (valueRef.current.length >= maxLength) return
        onChange(valueRef.current + e.key)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        onChange(valueRef.current.slice(0, -1))
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onChange('')
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

  return (
    <div
      className="w-full max-w-xs mx-auto"
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
        <div className="text-center mb-6">
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

      <div
        className="flex justify-center gap-2.5 sm:gap-3 mb-3"
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
              className="relative flex h-12 w-10 sm:h-14 sm:w-11 items-center justify-center rounded-xl border transition-all duration-200"
              style={{
                borderColor: error
                  ? `${POS_THEME.red}88`
                  : active
                    ? POS_THEME.purple
                    : filled
                      ? `${POS_THEME.purple}66`
                      : POS_THEME.border,
                background: filled
                  ? `${POS_THEME.purple}18`
                  : 'rgba(255,255,255,0.03)',
                boxShadow: active ? `0 0 0 3px ${POS_THEME.purple}22` : undefined,
              }}
            >
              {filled ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: POS_THEME.purple }}
                />
              ) : active ? (
                <span
                  className="h-4 w-0.5 rounded-full animate-pulse"
                  style={{ background: POS_THEME.purple }}
                />
              ) : null}
            </span>
          )
        })}
      </div>

      <p className="text-center text-[11px] mb-4" style={{ color: POS_THEME.muted }}>
        Type your {maxLength}-digit PIN
      </p>

      {error && (
        <p className="text-center text-xs mb-3 font-medium" style={{ color: POS_THEME.red }}>
          {error}
        </p>
      )}

      {loading && !showSubmit && (
        <div className="flex justify-center py-2">
          <Loader2 size={18} className="animate-spin" style={{ color: POS_THEME.purple }} />
        </div>
      )}

      {showSubmit && (
        <button
          type="button"
          disabled={disabled || loading || value.length !== maxLength}
          onClick={onSubmit}
          className="mt-1 w-full h-12 rounded-xl text-sm font-semibold text-white disabled:opacity-45 flex items-center justify-center gap-2 transition-opacity"
          style={{ background: POS_THEME.purple }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : submitLabel}
        </button>
      )}
    </div>
  )
}
