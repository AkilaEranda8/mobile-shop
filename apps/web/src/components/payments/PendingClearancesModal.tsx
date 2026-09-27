'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { salesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { salePaymentLabel, usePaymentMethods } from '@/lib/payment-methods'
import { MarkClearModal } from '@/components/payments/SalePaymentsSection'

type PendingRow = {
  id: string
  method: string
  methodLabel?: string | null
  methodConfigId?: string | null
  amount: number
  customerFeeAmount?: number | null
  reference?: string | null
  sale: { id: string; invoiceNumber: string; customerName?: string | null; createdAt: string }
}

export function PendingClearancesModal({
  glAccountId,
  title,
  canClear,
  onClose,
  onChanged,
}: {
  glAccountId: string
  title: string
  canClear: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const methods = usePaymentMethods()
  const [rows, setRows] = useState<PendingRow[] | null>(null)
  const [target, setTarget] = useState<PendingRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res: any = await salesApi.pendingClearances(glAccountId)
      setRows((res?.data ?? res) as PendingRow[])
    } catch (e: any) {
      toast.error(e?.message || 'Could not load pending payments')
      setRows([])
    }
  }, [glAccountId])

  useEffect(() => { load() }, [load])

  const total = (rows ?? []).reduce((s, r) => s + Number(r.amount) + Number(r.customerFeeAmount ?? 0), 0)
  const hintFor = (r: PendingRow) =>
    methods.find(m => m.id === r.methodConfigId)?.clearance?.expectedDeductionRate

  return (
    <>
      <div
        className="fixed inset-0 z-[55] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape' && !target) { e.stopPropagation(); onClose() } }}
      >
        <div
          className="w-full max-w-2xl rounded-xl border shadow-2xl max-h-[85vh] flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <h3 className="text-sm font-semibold">{title} — pending payments</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Clear each payment when the provider pays you. The deduction is posted as a provider fee.
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            {rows === null ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-400" /></div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No pending payments.</p>
            ) : (
              <div className="space-y-2">
                {rows.map(r => {
                  const gross = Number(r.amount) + Number(r.customerFeeAmount ?? 0)
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.sale.invoiceNumber}
                          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                            {salePaymentLabel(r)} · {new Date(r.sale.createdAt).toLocaleDateString('en-LK')}
                          </span>
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {r.sale.customerName || 'Walk-in'}
                          {Number(r.customerFeeAmount ?? 0) > 0 && ` · includes fee ${formatCurrency(Number(r.customerFeeAmount))}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{formatCurrency(gross)}</span>
                        {canClear ? (
                          <button type="button" onClick={() => setTarget(r)} className="btn-primary text-xs px-3 py-1.5">Mark as Clear</button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500"><Clock size={12} /> Pending</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {rows && rows.length > 0 && (
            <div className="border-t px-4 py-3 flex justify-between text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{rows.length} pending</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
          )}
        </div>
      </div>

      {target && (
        <MarkClearModal
          saleId={target.sale.id}
          payment={target}
          deductionHint={hintFor(target)}
          onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); load(); onChanged() }}
        />
      )}
    </>
  )
}
