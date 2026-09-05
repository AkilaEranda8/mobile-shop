'use client'

import { cn } from '@/lib/utils'

/** Wraps search + filters into one consistent control bar. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('filter-bar flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  )
}
