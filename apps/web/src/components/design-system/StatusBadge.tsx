'use client'

import { cn } from '@/lib/utils'
import { resolveTone, type AccentTone } from './tones'

export type StatusBadgeTone = AccentTone

/** Compact enterprise status pill — use everywhere instead of ad-hoc badge classes. */
export function StatusBadge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: React.ReactNode
  tone?: StatusBadgeTone
  className?: string
  title?: string
}) {
  const t = resolveTone(tone)
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap',
        t.softBg,
        t.softBorder,
        t.text,
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Map common domain statuses to semantic tones. */
export function statusToneFromLabel(status: string): StatusBadgeTone {
  const s = status.toUpperCase().replace(/\s+/g, '_')
  if (['PAID', 'ACTIVE', 'IN_STOCK', 'READY', 'DELIVERED', 'COMPLETED', 'SUCCESS', 'APPROVED'].includes(s)) {
    return 'success'
  }
  if (['PENDING', 'LOW_STOCK', 'LOW', 'DUE', 'EXPIRING', 'WARNING', 'OVERDUE', 'PARTIAL'].includes(s)) {
    return 'warning'
  }
  if (['RETURNED', 'VOID', 'OUT_OF_STOCK', 'OUT', 'CANCELLED', 'FAILED', 'SUSPENDED', 'URGENT', 'REJECTED'].includes(s)) {
    return 'danger'
  }
  if (['CLAIMED', 'IN_PROGRESS', 'PROCESSING', 'INFO', 'SOLD'].includes(s)) {
    return 'info'
  }
  return 'neutral'
}
