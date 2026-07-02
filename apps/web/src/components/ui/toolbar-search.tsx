'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'

type ToolbarSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  tone?: 'default' | 'dark'
  inputId?: string
  autoFocus?: boolean
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'onKeyDown'>

export const ToolbarSearch = forwardRef<HTMLInputElement, ToolbarSearchProps>(function ToolbarSearch({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  tone = 'default',
  inputId,
  autoFocus = false,
  onKeyDown,
}, ref) {
  const isDark = tone === 'dark'

  return (
    <div className={`relative flex-1 min-w-[140px] max-w-sm ${className}`}>
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
      />
      <input
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-8 py-2 rounded-xl text-xs outline-none transition-colors"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)',
          border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid var(--border-subtle)',
          color: isDark ? '#ffffff' : 'var(--text-primary)',
        }}
        autoComplete="off"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:opacity-80 transition-opacity"
          style={{ color: isDark ? '#ffffff' : 'var(--text-muted)' }}
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
})
