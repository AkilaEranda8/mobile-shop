'use client'

import { AlignJustify, List } from 'lucide-react'

export type TableDensity = 'comfortable' | 'compact'

interface Props {
  value: TableDensity
  onChange: (v: TableDensity) => void
}

export function TableDensityToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center bg-white/5 border border-white/8 rounded-lg p-0.5 gap-0.5">
      <button
        title="Comfortable"
        onClick={() => onChange('comfortable')}
        className={`p-1.5 rounded-md transition-all duration-150 ${value === 'comfortable' ? 'bg-violet-600/80 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
        <AlignJustify size={13} />
      </button>
      <button
        title="Compact"
        onClick={() => onChange('compact')}
        className={`p-1.5 rounded-md transition-all duration-150 ${value === 'compact' ? 'bg-violet-600/80 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
        <List size={13} />
      </button>
    </div>
  )
}
