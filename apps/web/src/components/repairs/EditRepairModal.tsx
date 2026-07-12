'use client'

import { useState, useEffect } from 'react'
import { X, Pencil, Loader2, CheckCircle2, User, Phone, Smartphone, Hash, AlertTriangle, Wrench, DollarSign, Calendar, Save } from 'lucide-react'
import { repairsApi } from '@/lib/api'
import { repairTicketEditable } from '@/lib/repair.util'
import { REPAIR_WARRANTY_OPTIONS } from '@/lib/repair-invoice.util'
import { formatWarrantyPeriodLabel } from '@/components/pos/cart-rules'
import type { RepairTicket } from '@/types'
import toast from 'react-hot-toast'
/* Edit Repair Modal */
export default function EditRepairModal({ repair, onClose, onSaved }: {
  repair: RepairTicket; onClose: () => void; onSaved: () => void
}) {
  const locked = !repairTicketEditable(repair.status)
  const [form, setForm] = useState({
    customerName:        repair.customerName    ?? '',
    customerPhone:       repair.customerPhone   ?? '',
    deviceBrand:         repair.deviceBrand     ?? '',
    deviceModel:         repair.deviceModel     ?? '',
    deviceColor:         (repair as any).deviceColor ?? '',
    imei:                repair.imei            ?? '',
    reportedIssue:       repair.reportedIssue   ?? '',
    technicianName:      repair.technicianName  ?? '',
    priority:            repair.priority        ?? 'NORMAL',
    estimatedCost:       String(repair.estimatedCost ?? ''),
    estimatedCompletion: repair.estimatedCompletion ? repair.estimatedCompletion.slice(0, 10) : '',
    warrantyMonths:      repair.warrantyMonths != null ? String(repair.warrantyMonths) : '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await repairsApi.update(repair.id, {
        ...form,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        warrantyMonths: form.warrantyMonths !== '' ? Number(form.warrantyMonths) : null,
      })
      toast.success('Repair job updated')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-purple-600 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 flex-shrink-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/15 shrink-0">
              <Pencil size={18} className="text-violet-500" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>Edit Repair Job</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400">{repair.ticketNumber}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {locked ? 'This ticket is completed or cancelled and cannot be edited' : 'Update the details of this repair ticket'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {locked ? (
          <div className="p-6">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
              Completed and cancelled repairs are locked. Use the detail view to see payment and profit information.
            </div>
            <button type="button" onClick={onClose} className="mt-4 w-full h-11 rounded-xl border text-sm font-semibold" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
              Close
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Customer Information */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <User size={15} className="text-violet-500" />
              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Customer Information</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Customer Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input required type="text" className="input-field pl-9 h-10" placeholder="Customer name" value={form.customerName} onChange={f('customerName')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input required type="text" className="input-field pl-9 h-10" placeholder="Phone number" value={form.customerPhone} onChange={f('customerPhone')} />
                </div>
              </div>
            </div>
          </div>

          {/* Device Information */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <Smartphone size={15} className="text-violet-500" />
              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Device Information</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Brand <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Smartphone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input required type="text" className="input-field pl-9 h-10" placeholder="e.g. Samsung" value={form.deviceBrand} onChange={f('deviceBrand')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Model <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input required type="text" className="input-field pl-9 h-10" placeholder="e.g. Galaxy S24" value={form.deviceModel} onChange={f('deviceModel')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>IMEI <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
                <div className="relative">
                  <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input type="text" className="input-field pl-9 h-10 font-mono" placeholder="15-digit IMEI" maxLength={17} value={form.imei} onChange={f('imei')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Color <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
                <input type="text" className="input-field h-10" placeholder="e.g. Phantom Black" value={form.deviceColor} onChange={f('deviceColor')} />
              </div>
            </div>
          </div>

          {/* Reported Issue */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <AlertTriangle size={15} className="text-violet-500" />
              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Reported Issue</h4>
            </div>
            <div className="p-4">
              <textarea required className="input-field w-full resize-none text-sm" rows={3}
                placeholder="Describe the fault or issue reported by the customer…"
                value={form.reportedIssue} onChange={f('reportedIssue')} />
            </div>
          </div>

          {/* Job Details */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <Wrench size={15} className="text-violet-500" />
              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Job Details</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Technician</label>
                <div className="relative">
                  <Wrench size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input type="text" className="input-field pl-9 h-10" placeholder="Assign technician" value={form.technicianName} onChange={f('technicianName')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Priority</label>
                <select className="input-field h-10" value={form.priority} onChange={f('priority')}>
                  {(['LOW','NORMAL','HIGH','URGENT'] as const).map(p => (
                    <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Estimated Cost (LKR)</label>
                <div className="relative">
                  <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input type="number" min={0} className="input-field pl-9 h-10" placeholder="0.00" value={form.estimatedCost} onChange={f('estimatedCost')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Warranty</label>
                <select className="input-field h-10" value={form.warrantyMonths} onChange={f('warrantyMonths')}>
                  <option value="">Not set</option>
                  {REPAIR_WARRANTY_OPTIONS.map(m => (
                    <option key={m} value={m}>{m === 0 ? 'No warranty' : formatWarrantyPeriodLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Estimated Completion</label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                  <input type="date" className="input-field pl-9 h-10" value={form.estimatedCompletion} onChange={f('estimatedCompletion')} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-violet-500/20 transition-all hover:opacity-90"
              style={{ background: 'var(--brand-gradient)' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>

        </form>
        )}
      </div>
    </div>
  )
}
