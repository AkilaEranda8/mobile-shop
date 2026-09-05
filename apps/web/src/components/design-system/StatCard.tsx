'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveTone, type AccentTone } from './tones'

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'brand',
  /** @deprecated use tone */
  color,
  onClick,
  active,
  className,
  as: As = 'div',
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: LucideIcon
  tone?: AccentTone
  color?: AccentTone | string
  onClick?: () => void
  active?: boolean
  className?: string
  as?: 'div' | 'button'
}) {
  const t = resolveTone(tone ?? color)
  const interactive = As === 'button' || !!onClick
  const Comp = interactive ? 'button' : As

  return (
    <Comp
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'stat-card-enterprise',
        interactive && 'cursor-pointer text-left w-full hover:border-brand-500/30',
        active && 'ring-2 ring-brand-500/35 border-brand-500/30',
        className,
      )}
    >
      {Icon && (
        <div className={cn('stat-card-icon', t.iconWrap)}>
          <Icon size={15} className={t.icon} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="stat-card-value">{value}</p>
        <p className="stat-card-label">{label}</p>
        {sub != null && <p className="stat-card-sub">{sub}</p>}
      </div>
    </Comp>
  )
}

export function StatGrid({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode
  cols?: 2 | 3 | 4 | 5 | 6
  className?: string
}) {
  const colClass =
    cols === 2
      ? 'sm:grid-cols-2'
      : cols === 3
        ? 'sm:grid-cols-3'
        : cols === 5
          ? 'sm:grid-cols-2 lg:grid-cols-5'
          : cols === 6
            ? 'sm:grid-cols-3 xl:grid-cols-6'
            : 'sm:grid-cols-2 lg:grid-cols-4'

  return <div className={cn('grid grid-cols-2 gap-3', colClass, className)}>{children}</div>
}
