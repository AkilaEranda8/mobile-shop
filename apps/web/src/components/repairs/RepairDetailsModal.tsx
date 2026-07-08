'use client'

import { useEffect } from 'react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[96vh] overflow-y-auto">
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
  )
}

