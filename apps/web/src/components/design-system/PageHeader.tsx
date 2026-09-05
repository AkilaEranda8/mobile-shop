'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Alias for subtitle */
  description?: React.ReactNode
  icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
}) {
  const sub = subtitle ?? description
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4', className)}>
      <div className="min-w-0 flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-brand-600 dark:text-brand-400" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {sub != null && sub !== false && <p className="page-subtitle">{sub}</p>}
        </div>
      </div>
      {actions != null && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">{actions}</div>
      )}
    </div>
  )
}
