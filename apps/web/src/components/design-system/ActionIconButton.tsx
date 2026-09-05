'use client'

import { cn } from '@/lib/utils'

/** Neutral square table/action icon button with blue hover. */
export function ActionIconButton({
  children,
  className,
  title,
  disabled,
  onClick,
  tone = 'neutral',
}: {
  children: React.ReactNode
  className?: string
  title?: string
  disabled?: boolean
  onClick?: () => void
  tone?: 'neutral' | 'brand' | 'danger' | 'success'
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors disabled:opacity-50',
        'bg-[color:var(--bg-card)] border-[color:var(--border-ui)] text-[color:var(--text-muted)]',
        tone === 'neutral' && 'hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-600 dark:hover:text-brand-400',
        tone === 'brand' && 'hover:bg-brand-500/10 hover:border-brand-500/30 text-brand-600 dark:text-brand-400',
        tone === 'danger' && 'hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-600',
        tone === 'success' && 'hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600',
        className,
      )}
    >
      {children}
    </button>
  )
}
