'use client'

import type { CSSProperties } from 'react'

/** Asia/Colombo calendar date as YYYY-MM-DD (for `<input type="date">`). */
export function todayChequeDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Build a short reference stored on SalePayment / Transaction. */
export function formatChequeReference(chequeNumber: string, chequeDate: string): string {
  const num = chequeNumber.trim()
  const date = chequeDate.trim()
  const parts: string[] = []
  if (num) parts.push(`Cheque #${num}`)
  if (date) parts.push(date)
  return parts.join(' · ')
}

type Props = {
  chequeNumber: string
  chequeDate: string
  onNumberChange: (v: string) => void
  onDateChange: (v: string) => void
  /** When true, number is required for form submit UX (caller still validates). */
  required?: boolean
  /** Compact styling for dark POS panel */
  variant?: 'default' | 'pos'
}

const defaultInput: CSSProperties = {
  background: 'var(--bg-subtle)',
  borderColor: 'var(--border-subtle)',
  color: 'var(--text-primary)',
}

/**
 * Shown when payment method is CHEQUE — number + date.
 */
export function ChequeDetailsFields({
  chequeNumber,
  chequeDate,
  onNumberChange,
  onDateChange,
  required = true,
  variant = 'default',
}: Props) {
  const isPos = variant === 'pos'
  const labelCls = isPos
    ? 'text-[10px] font-semibold uppercase tracking-wide mb-1 block'
    : 'text-[11px] font-semibold uppercase tracking-wide mb-1.5 block'
  const inputCls = isPos
    ? 'w-full px-3 py-2 rounded-xl text-sm font-semibold border outline-none focus:border-violet-500/50'
    : 'w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:border-violet-500 transition-colors'
  const labelStyle: CSSProperties = isPos
    ? { color: 'var(--text-muted, #94a3b8)' }
    : { color: 'var(--text-muted)' }

  return (
    <div className={`grid gap-3 ${isPos ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
      <div>
        <label className={labelCls} style={labelStyle}>
          Cheque Number{required ? '' : ' (optional)'}
        </label>
        <input
          type="text"
          value={chequeNumber}
          onChange={e => onNumberChange(e.target.value)}
          placeholder="e.g. 123456"
          required={required}
          autoComplete="off"
          className={inputCls}
          style={defaultInput}
        />
      </div>
      <div>
        <label className={labelCls} style={labelStyle}>
          Cheque Date
        </label>
        <input
          type="date"
          value={chequeDate}
          onChange={e => onDateChange(e.target.value)}
          required={required}
          className={inputCls}
          style={defaultInput}
        />
      </div>
    </div>
  )
}
