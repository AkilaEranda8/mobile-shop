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

export type ParsedChequeReference = {
  chequeNumber: string | null
  chequeDate: string | null
  /** Remaining free-text after removing the cheque fragment (notes, invoice list, etc.). */
  other: string | null
}

/** Parse `Cheque #123 · 2026-07-23` from a free-text payment reference. */
export function parseChequeReference(raw: string | null | undefined): ParsedChequeReference | null {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const match = text.match(/Cheque\s*#\s*([^|·\n]+?)(?:\s*[·|]\s*(\d{4}-\d{2}-\d{2}))?/i)
  if (!match) return null
  const chequeNumber = match[1]?.trim() || null
  const chequeDate = match[2]?.trim() || null
  const other = text
    .replace(match[0], '')
    .replace(/\|\s*\|/g, '|')
    .replace(/^[|\s·]+|[|\s·]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || null
  if (!chequeNumber && !chequeDate) return null
  return { chequeNumber, chequeDate, other }
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

type MetaProps = {
  method?: string | null
  reference?: string | null
  amount?: number | null
  formatAmount?: (n: number) => string
  className?: string
}

/** Read-only payment line for details modals — highlights cheque # / date when present. */
export function ChequePaymentMeta({ method, reference, amount, formatAmount, className }: MetaProps) {
  const cheque = parseChequeReference(reference)
  const isCheque = String(method ?? '').toUpperCase() === 'CHEQUE' || !!cheque
  const methodLabel = method ? String(method).replace(/_/g, ' ') : null

  return (
    <div className={className} style={{ color: 'var(--text-secondary)' }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {methodLabel && (
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{methodLabel}</span>
        )}
        {amount != null && Number.isFinite(Number(amount)) && formatAmount && (
          <span className="tabular-nums font-medium">{formatAmount(Number(amount))}</span>
        )}
      </div>
      {isCheque && (cheque?.chequeNumber || cheque?.chequeDate) ? (
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {cheque.chequeNumber && (
            <span>
              Cheque #{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {cheque.chequeNumber}
              </span>
            </span>
          )}
          {cheque.chequeDate && (
            <span>
              Date{' '}
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {cheque.chequeDate}
              </span>
            </span>
          )}
          {cheque.other && !/outstanding (settlement|discount)/i.test(cheque.other) && (
            <span className="truncate max-w-[220px]">{cheque.other}</span>
          )}
        </div>
      ) : reference ? (
        <div className="mt-0.5 text-[10px] truncate max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
          Ref: {reference}
        </div>
      ) : null}
    </div>
  )
}
