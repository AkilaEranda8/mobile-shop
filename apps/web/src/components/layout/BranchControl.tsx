'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId, getBranchLabel, setActiveBranchId } from '@/lib/active-branch'

export function BranchControl() {
  const user = authStorage.getUser()
  const branches = useMemo(() => (user?.branches ?? []).filter(b => b.isActive !== false), [user])
  const assigned = user?.branchIds ?? []
  const visible = branches.length
    ? branches.filter(b => assigned.includes(b.id) || user?.role === 'OWNER')
    : branches

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  if (!user || visible.length === 0) return null

  const activeId = getActiveBranchId()
  const isOwner = user.role === 'OWNER'
  const showDropdown = visible.length > 1 || (isOwner && visible.length >= 1)
  const currentValue = user.branchScope === 'all' ? 'all' : (activeId ?? visible[0]?.id ?? '')
  const label = user.branchScope === 'all'
    ? 'All Branches'
    : getBranchLabel(visible, activeId ?? visible[0]?.id)

  const options = [
    ...(isOwner ? [{ value: 'all', label: 'All Branches' }] : []),
    ...visible.map(b => ({ value: b.id, label: b.name })),
  ]

  const pick = (value: string) => {
    if (value === 'all' && isOwner) setActiveBranchId('all', 'all')
    else setActiveBranchId(value, 'assigned')
    setOpen(false)
    window.location.reload()
  }

  if (!showDropdown) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium max-w-[170px]"
        style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
        <Building2 size={13} className="flex-shrink-0 opacity-70" />
        <span className="truncate">{label}</span>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-xl text-xs font-medium max-w-[190px] transition-colors"
        style={{
          background: 'var(--bg-subtle)',
          color: 'var(--text-secondary)',
          border: open ? '1px solid rgba(109,40,217,0.35)' : '1px solid var(--border-subtle)',
        }}
        title="Active branch"
      >
        <Building2 size={13} className="flex-shrink-0 opacity-70" />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown size={12} className={`flex-shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[200px] max-h-56 overflow-y-auto rounded-xl shadow-2xl py-1 z-50"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          {options.map(opt => {
            const selected = opt.value === currentValue
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{
                  color: selected ? '#8b5cf6' : 'var(--text-primary)',
                  background: selected ? 'rgba(109,40,217,0.12)' : 'transparent',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
