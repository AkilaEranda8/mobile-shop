'use client'

import { AlertTriangle } from 'lucide-react'

export function MaintenanceBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2.5 border-b text-sm"
      style={{
        background: 'rgba(239,68,68,0.12)',
        borderColor: 'rgba(239,68,68,0.35)',
        color: 'var(--text-primary)',
      }}
      role="alert"
    >
      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold text-red-500">Maintenance mode is active</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
      </div>
    </div>
  )
}
