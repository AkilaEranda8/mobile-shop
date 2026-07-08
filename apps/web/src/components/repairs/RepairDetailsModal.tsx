'use client'

import { useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import RepairDetailsView from '@/components/repairs/RepairDetailsView'
import type { RepairTicket } from '@/types'

export default function RepairDetailsModal({ repair, onClose, onEdit, onStatusChange, onRefresh, onRepairUpdate, allRepairs }: {
  repair: RepairTicket
  onClose: () => void
  onEdit: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onRefresh: () => void
  onRepairUpdate: (repair: RepairTicket) => void
  allRepairs?: RepairTicket[]
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[96vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-2xl overflow-hidden border shadow-2xl"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
        >
          <div className="sticky top-0 z-20 bg-[var(--bg-card)]">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-sm inline-flex items-center gap-2"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl border flex items-center justify-center hover:opacity-90 transition-opacity"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                aria-label="Close"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            {/* Accent divider like system details views */}
            <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-purple-600" />
          </div>

          <RepairDetailsView
            repair={repair}
            allRepairs={allRepairs}
            onBack={onClose}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onRepairUpdate={onRepairUpdate}
            onRefresh={onRefresh}
            showPageHeader={false}
          />
        </div>
      </div>
    </div>
  )
}

