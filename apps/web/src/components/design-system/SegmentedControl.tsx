'use client'

import { cn } from '@/lib/utils'

export type SegmentOption<T extends string> = {
  id: T
  label: React.ReactNode
}

/** Shared filter/tabs chip group — active = Hexalyte blue. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (id: T) => void
  options: SegmentOption<T>[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap gap-1 p-1 rounded-xl border',
        className,
      )}
      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
      role="tablist"
    >
      {options.map(opt => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-black/[0.04] dark:hover:bg-white/5',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
