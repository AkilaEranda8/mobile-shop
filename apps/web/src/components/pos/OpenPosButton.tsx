'use client'

import { ShoppingCart } from 'lucide-react'
import { usePos } from '@/lib/use-pos'
import { useRolePermissions } from '@/lib/hooks'
import { viewOnlyToast } from '@/lib/module-access'
import { cn } from '@/lib/utils'
import type { PosCustomerPreset } from '@/stores/ui-store'

interface OpenPosButtonProps {
  label?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  customer?: PosCustomerPreset
  showIcon?: boolean
}

export function OpenPosButton({
  label = 'POS Terminal',
  className,
  variant = 'primary',
  customer,
  showIcon = true,
}: OpenPosButtonProps) {
  const { openPos, hasPos } = usePos()
  const { canEdit } = useRolePermissions()
  if (!hasPos || !canEdit('POS')) return null

  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'secondary'
        ? 'btn-secondary'
        : 'btn-accent flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm'

  return (
    <button
      type="button"
      onClick={() => {
        if (!canEdit('POS')) return viewOnlyToast('POS')
        openPos(customer)
      }}
      className={cn('text-sm flex items-center gap-2', base, className)}
    >
      {showIcon && <ShoppingCart size={14} />}
      {label}
    </button>
  )
}
