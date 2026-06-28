'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X, type LucideIcon } from 'lucide-react'

export type FilterDropdownOption = { value: string; label: string }

type FilterDropdownProps = {
  value: string
  onChange: (value: string) => void
  options: FilterDropdownOption[]
  icon: LucideIcon
  placeholder: string
  active?: boolean
  onClear?: () => void
  /** White labels on dark modals (e.g. stock transfer) */
  tone?: 'default' | 'dark'
}

export function FilterDropdown({
  value,
  onChange,
  options,
  icon: Icon,
  placeholder,
  active = false,
  onClear,
  tone = 'default',
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const selected = options.find(o => o.value === value)
  const label = selected?.label ?? placeholder
  const isDark = tone === 'dark'

  const labelColor = isDark
    ? '#ffffff'
    : (active ? '#8b5cf6' : 'var(--text-primary)')
  const iconColor = isDark
    ? '#ffffff'
    : (active ? '#8b5cf6' : 'var(--text-muted)')

  return (
    <div ref={rootRef} className="relative min-w-[170px]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl w-full text-left transition-colors"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)',
          border: active
            ? '1px solid rgba(109,40,217,0.35)'
            : isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid var(--border-subtle)',
        }}>
        <Icon size={13} style={{ color: iconColor }} />
        <span
          className="text-xs font-medium flex-1 min-w-0 truncate"
          style={{ color: labelColor }}>
          {label}
        </span>
        <ChevronDown
          size={12}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: isDark ? '#ffffff' : 'var(--text-muted)' }}
        />
        {active && onClear && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onClear() }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClear() } }}
            className="hover:text-red-400 transition-colors flex-shrink-0"
            style={{ color: isDark ? '#ffffff' : 'var(--text-muted)' }}>
            <X size={11} />
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-1.5 min-w-full max-h-56 overflow-y-auto rounded-xl shadow-2xl py-1"
          style={{
            background: isDark ? '#0f1623' : 'var(--bg-card)',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid var(--border-default)',
          }}>
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:opacity-90"
                style={{
                  color: isDark ? '#ffffff' : (isSelected ? '#8b5cf6' : 'var(--text-primary)'),
                  background: isSelected ? 'rgba(109,40,217,0.12)' : 'transparent',
                }}>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
