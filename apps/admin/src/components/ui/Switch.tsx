'use client'

import type { ButtonHTMLAttributes, CSSProperties } from 'react'

const VARIANTS = {
  gray:    { on: 'bg-gray-900', off: 'bg-gray-200' },
  emerald: { on: 'bg-emerald-500', off: 'bg-gray-300' },
} as const

export type SwitchVariant = keyof typeof VARIANTS

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  variant?: SwitchVariant
  trackStyle?: CSSProperties
}

export function Switch({
  checked,
  onChange,
  disabled,
  variant = 'gray',
  trackStyle,
  className = '',
  ...rest
}: SwitchProps) {
  const colors = VARIANTS[variant]
  const trackClass = trackStyle ? '' : checked ? colors.on : colors.off

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-50 ${trackClass} ${className}`}
      style={trackStyle}
      {...rest}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-200"
        style={{ left: checked ? '22px' : '4px' }}
      />
    </button>
  )
}
