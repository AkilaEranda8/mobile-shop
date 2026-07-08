'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Wrench } from 'lucide-react'
import RepairDetailsView from '@/components/repairs/RepairDetailsView'
import EditRepairModal from '@/components/repairs/EditRepairModal'
import { useRepairs, useFeatureFlag } from '@/lib/hooks'
import { repairsApi } from '@/lib/api'
import { normalizeRepairTicket, repairTicketEditable } from '@/lib/repair.util'
import type { RepairTicket } from '@/types'
import toast from 'react-hot-toast'

const statusLabels: Record<string, string> = {
  RECEIVED: 'Received', DIAGNOSED: 'Diagnosed',
  IN_REPAIR: 'In Repair', QC: 'Quality Check',
  READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

export default function RepairDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const hasAccess = useFeatureFlag('REPAIRS')
  const { data: repairsData, refetch } = useRepairs()
  const [repair, setRepair] = useState<RepairTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  const allRepairs: RepairTicket[] = useMemo(
    () => ((repairsData?.data ?? []) as unknown[]).map((r) => normalizeRepairTicket(r)),
    [repairsData],
  )

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function run() {
      setLoading(true)
      const found = allRepairs.find(r => r.id === id)
      if (found) {
        if (!cancelled) {
          setRepair(found)
          setLoading(false)
        }
        return
      }
      try {
        const res: any = await repairsApi.getById(id)
        if (!cancelled) {
          const ticket = normalizeRepairTicket(res?.data ?? res)
          setRepair(ticket?.id ? ticket : null)
        }
      } catch {
        if (!cancelled) setRepair(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [id, allRepairs])

  const handleStatusUpdate = async (repairId: string, status: string) => {
    try {
      await repairsApi.updateStatus(repairId, status)
      toast.success(`Status → ${statusLabels[status] ?? status}`)
      await refetch()
      const res: any = await repairsApi.getById(repairId)
      setRepair(normalizeRepairTicket(res?.data ?? repair))
    } catch (err: any) {
      toast.error(err?.message ?? 'Status update failed')
    }
  }

  const handleRefresh = async () => {
    await refetch()
    if (!repair?.id) return
    const res: any = await repairsApi.getById(repair.id)
    setRepair(normalizeRepairTicket(res?.data ?? repair))
  }

  const handleEdit = () => {
    if (!repair || !repairTicketEditable(repair.status)) {
      toast.error('Completed or cancelled repairs cannot be edited')
      return
    }
    setShowEdit(true)
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.1)' }}>
          <Wrench size={26} className="text-violet-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Repair Details</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This feature is not enabled for your account.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    )
  }

  if (!repair) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard/repairs')}
          className="text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Back to Repair Jobs
        </button>
        <div className="card p-8 text-center">
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Repair ticket not found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>It may have been deleted or you may not have access.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showEdit && (
        <EditRepairModal
          repair={repair}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            setShowEdit(false)
            await handleRefresh()
          }}
        />
      )}
      <RepairDetailsView
        repair={repair}
        allRepairs={allRepairs}
        onBack={() => router.push('/dashboard/repairs')}
        onEdit={handleEdit}
        onStatusChange={handleStatusUpdate}
        onRepairUpdate={setRepair}
        onRefresh={handleRefresh}
      />
    </>
  )
}
