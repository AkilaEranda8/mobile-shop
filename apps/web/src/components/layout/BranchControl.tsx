'use client'

import { Building2 } from 'lucide-react'
import { authStorage } from '@/lib/auth'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { getActiveBranchId, getBranchLabel, setActiveBranchId, hasMultipleBranches, getVisibleBranches } from '@/lib/active-branch'

export function BranchControl() {
  const user = authStorage.getUser()
  const visible = getVisibleBranches(user)

  if (!user || visible.length === 0) return null

  const activeId = getActiveBranchId()
  const isOwner = user.role === 'OWNER'
  const multiBranch = hasMultipleBranches(user)
  const showDropdown = multiBranch
  const currentValue = user.branchScope === 'all' ? 'all' : (activeId ?? visible[0]?.id ?? '')
  const label = user.branchScope === 'all'
    ? 'All Branches'
    : getBranchLabel(visible, activeId ?? visible[0]?.id)

  const options = [
    ...(isOwner && multiBranch ? [{ value: 'all', label: 'All Branches' }] : []),
    ...visible.map(b => ({ value: b.id, label: b.name })),
  ]

  const pick = (value: string) => {
    if (value === 'all' && isOwner) setActiveBranchId('all', 'all')
    else setActiveBranchId(value, 'assigned')
    window.location.reload()
  }

  if (!showDropdown) {
    return (
      <div
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium max-w-[min(170px,42vw)]"
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <Building2 size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        <span className="truncate">{label}</span>
      </div>
    )
  }

  return (
    <FilterDropdown
      value={currentValue}
      onChange={pick}
      options={options}
      icon={Building2}
      placeholder="Active branch"
      active={false}
      tone="default"
      className="min-w-[min(190px,46vw)] max-w-[190px]"
    />
  )
}
