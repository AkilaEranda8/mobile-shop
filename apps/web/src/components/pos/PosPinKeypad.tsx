'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight, Delete, Loader2 } from 'lucide-react'
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
  showKeypad?: boolean
  /** Login card look (dots + accent keys) vs POS gate boxes */
  variant?: 'default' | 'login'
}

/** Light login theme — white surface, blue accents (system-aligned) */
const LOGIN = {
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  keyBg: '#FFFFFF',
  keyBorder: '#E2E8F0',
  keyHover: '#F8FAFC',
  muted: '#64748B',
  text: '#0F172A',
  red: '#DC2626',
  dotEmpty: '#CBD5E1',
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
  variant = 'default',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const isLogin = variant === 'login'
  const accent = isLogin ? LOGIN.blue : POS_THEME.purple
  const border = isLogin ? LOGIN.keyBorder : POS_THEME.border
  const text = isLogin ? LOGIN.text : POS_THEME.text
  const muted = isLogin ? LOGIN.muted : POS_THEME.muted
  const red = isLogin ? LOGIN.red : POS_THEME.red

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
            <h3 className="text-base font-semibold tracking-tight" style={{ color: text }}>{title}</h3>
          )}
          {subtitle && (
            <p className="text-xs mt-1.5" style={{ color: muted }}>{subtitle}</p>
          )}
        </div>
      )}

      <div
        className={`flex justify-center mb-5 ${isLogin ? 'gap-3' : 'gap-2'}`}
        aria-label="PIN entry"
        aria-live="polite"
        role="group"
      >
        {Array.from({ length: maxLength }).map((_, i) => {
          const filled = i < value.length
          if (isLogin) {
            return (
              <span
                key={i}
                className="h-3 w-3 rounded-full border-2 transition-all duration-150"
                style={{
                  borderColor: error ? red : filled ? accent : LOGIN.dotEmpty,
                  background: filled ? accent : 'transparent',
                  boxShadow: filled ? `0 0 8px ${accent}44` : undefined,
                }}
              />
            )
          }
          const active = !disabled && !loading && i === Math.min(value.length, maxLength - 1) && value.length < maxLength
          return (
            <span
              key={i}
              className="relative flex h-11 w-9 items-center justify-center rounded-lg border transition-all duration-150"
              style={{
                borderColor: error ? `${red}88` : active ? accent : filled ? `${accent}55` : border,
                background: filled ? `${accent}14` : 'rgba(255,255,255,0.03)',
                boxShadow: active ? `0 0 0 2px ${accent}28` : undefined,
              }}
            >
              {filled ? (
                <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
              ) : active ? (
                <span className="h-3.5 w-0.5 rounded-full animate-pulse" style={{ background: accent }} />
              ) : null}
            </span>
          )
        })}
      </div>

      {error && (
        <p className="text-center text-xs mb-3 font-medium -mt-2" style={{ color: red }}>{error}</p>
      )}

      {showKeypad && (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
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
                className="h-[52px] rounded-xl text-[17px] font-semibold transition-all active:scale-[0.96] disabled:opacity-45 select-none hover:brightness-[0.98]"
                style={{
                  background: isLogin ? LOGIN.keyBg : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isLogin ? LOGIN.keyBorder : border}`,
                  color: isClear ? red : isBack ? muted : text,
                  boxShadow: isLogin ? '0 1px 2px rgba(15,23,42,0.04)' : undefined,
                }}
              >
                {isBack ? <Delete size={17} className="mx-auto" strokeWidth={2.25} /> : k}
              </button>
            )
          })}
        </div>
      )}

      {!showKeypad && (
        <p className="text-center text-[11px] mb-4" style={{ color: muted }}>
          Type your {maxLength}-digit PIN
        </p>
      )}

      {loading && !showSubmit && (
        <div className="flex justify-center py-2">
          <Loader2 size={18} className="animate-spin" style={{ color: accent }} />
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
          style={{
            background: isLogin
              ? `linear-gradient(135deg, ${LOGIN.blue}, ${LOGIN.blueDark})`
              : accent,
            boxShadow: isLogin ? `0 8px 20px ${LOGIN.blue}33` : undefined,
          }}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <span>{submitLabel}</span>
              {isLogin && <ArrowRight size={16} />}
            </>
          )}
        </button>
      )}
    </div>
  )
}
