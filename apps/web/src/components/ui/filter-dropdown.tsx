'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
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
  disabled?: boolean
  className?: string
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
  disabled = false,
  className = '',
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    const selectedIdx = options.findIndex(o => o.value === value)
    setHighlight(selectedIdx >= 0 ? selectedIdx : 0)
  }, [open, options, value])

  useEffect(() => {
    if (!open || highlight < 0) return
    const el = listRef.current?.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  const selected = options.find(o => o.value === value)
  const label = selected?.label ?? placeholder
  const isDark = tone === 'dark'

  const labelColor = isDark
    ? '#ffffff'
    : (active ? 'var(--brand-light)' : 'var(--text-primary)')
  const iconColor = isDark
    ? '#ffffff'
    : (active ? 'var(--brand-light)' : 'var(--text-muted)')

  const pick = (idx: number) => {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (!options.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(i => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(i => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setHighlight(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setHighlight(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(highlight)
    }
  }

  return (
    <div ref={rootRef} className={`relative min-w-[170px] ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onTriggerKeyDown}
        className="flex items-center gap-2 px-3 py-2 rounded-xl w-full text-left transition-colors disabled:opacity-50"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)',
          border: active
            ? '1px solid var(--sidebar-active-border)'
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
            style={{ color: isDark ? '#ffffff' : 'var(--text-muted)' }}
            aria-label="Clear filter"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute z-50 top-full left-0 mt-1.5 min-w-full max-h-56 overflow-y-auto rounded-xl shadow-2xl py-1 outline-none"
          style={{
            background: isDark ? '#0f1623' : 'var(--bg-card)',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid var(--border-default)',
          }}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            const isHighlighted = idx === highlight
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(idx)}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:opacity-90"
                style={{
                  color: isDark ? '#ffffff' : (isSelected ? 'var(--brand-light)' : 'var(--text-primary)'),
                  background: isHighlighted
                    ? 'var(--brand-glow)'
                    : isSelected ? 'var(--brand-glow)' : 'transparent',
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
