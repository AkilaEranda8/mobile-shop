'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Check, Loader2, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { cn } from '@/lib/utils'
import {
  HrFeatureGate,
  HrPageShell,
  HrLoading,
  HrError,
  HrKpiCard,
  HrModal,
  HrField,
} from '@/components/hr/hr-ui'

type LeaveType = {
  id: string
  name: string
  code: string | null
  isPaid: boolean
  requiresApproval: boolean
  allowHalfDay: boolean
  annualAllowance: number
  isActive: boolean
}

type LeaveBalance = {
  id: string
  year: number
  entitled: number
  used: number
  pending: number
  employee: { id: string; fullName: string; employeeCode: string }
  leaveType: LeaveType
}

type LeaveRequest = {
  id: string
  status: string
  startDate: string
  endDate: string
  startPart: string
  endPart: string
  days: number
  reason: string | null
  reviewerNote: string | null
  employee: { id: string; fullName: string; employeeCode: string }
  leaveType: { id: string; name: string }
}

type Employee = { id: string; fullName: string; employeeCode: string }

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  CANCELLED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  DRAFT: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
}

function dateKey(iso: string) {
  return iso.slice(0, 10)
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

export default function HrLeavePage() {
  const { canEdit } = useModuleAccess()
  const [tab, setTab] = useState<'requests' | 'balances' | 'types'>('requests')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('SUBMITTED')
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [types, setTypes] = useState<LeaveType[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [submitOpen, setSubmitOpen] = useState(false)
  const [typeModal, setTypeModal] = useState<LeaveType | null | 'new'>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: todayKey(),
    endDate: todayKey(),
    startPart: 'FULL',
    endPart: 'FULL',
    reason: '',
  })
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    annualAllowance: '14',
    isPaid: true,
    requiresApproval: true,
    allowHalfDay: true,
    isActive: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      const [reqRes, balRes, typeRes, empRes] = await Promise.all([
        hrApi.listLeaveRequests(params) as Promise<{ data: LeaveRequest[] }>,
        hrApi.listLeaveBalances() as Promise<{ data: LeaveBalance[] }>,
        hrApi.listLeaveTypes() as Promise<{ data: LeaveType[] }>,
        canEdit
          ? (hrApi.listEmployees({ limit: '200' }) as Promise<{ data: { data: Employee[] } }>)
          : Promise.resolve({ data: { data: [] as Employee[] } }),
      ])
      setRequests(reqRes.data ?? [])
      setBalances(balRes.data ?? [])
      setTypes(typeRes.data ?? [])
      setEmployees(empRes.data?.data ?? [])
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load leave')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, canEdit])

  useEffect(() => { void load() }, [load])

  const kpis = useMemo(() => {
    const pending = requests.filter(r => r.status === 'SUBMITTED').length
    const approved = requests.filter(r => r.status === 'APPROVED').length
    const available = balances.reduce((s, b) => s + Math.max(0, b.entitled - b.used - b.pending), 0)
    return { pending, approved, balances: balances.length, available }
  }, [requests, balances])

  const openSubmit = () => {
    setForm({
      employeeId: employees[0]?.id ?? '',
      leaveTypeId: types.find(t => t.isActive)?.id ?? '',
      startDate: todayKey(),
      endDate: todayKey(),
      startPart: 'FULL',
      endPart: 'FULL',
      reason: '',
    })
    setSubmitOpen(true)
  }

  const openType = (row?: LeaveType) => {
    if (row) {
      setTypeForm({
        name: row.name,
        code: row.code ?? '',
        annualAllowance: String(row.annualAllowance),
        isPaid: row.isPaid,
        requiresApproval: row.requiresApproval,
        allowHalfDay: row.allowHalfDay,
        isActive: row.isActive,
      })
      setTypeModal(row)
    } else {
      setTypeForm({
        name: '',
        code: '',
        annualAllowance: '14',
        isPaid: true,
        requiresApproval: true,
        allowHalfDay: true,
        isActive: true,
      })
      setTypeModal('new')
    }
  }

  const submitLeave = async () => {
    if (!form.leaveTypeId || !form.startDate) {
      toast.error('Leave type and start date required')
      return
    }
    setSaving(true)
    try {
      await hrApi.submitLeave({
        employeeId: form.employeeId || undefined,
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        startPart: form.startPart,
        endPart: form.endPart,
        reason: form.reason || null,
      })
      toast.success('Leave submitted')
      setSubmitOpen(false)
      await load()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  const saveType = async () => {
    if (!typeForm.name.trim()) {
      toast.error('Name required')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: typeForm.name.trim(),
        code: typeForm.code.trim() || null,
        annualAllowance: Number(typeForm.annualAllowance) || 0,
        isPaid: typeForm.isPaid,
        requiresApproval: typeForm.requiresApproval,
        allowHalfDay: typeForm.allowHalfDay,
        isActive: typeForm.isActive,
      }
      if (typeModal === 'new') await hrApi.createLeaveType(body)
      else if (typeModal) await hrApi.updateLeaveType(typeModal.id, body)
      toast.success(typeModal === 'new' ? 'Leave type created' : 'Leave type updated')
      setTypeModal(null)
      await load()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const review = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    setBusyId(id)
    try {
      if (action === 'approve') await hrApi.approveLeave(id)
      else if (action === 'reject') await hrApi.rejectLeave(id)
      else await hrApi.cancelLeave(id)
      toast.success(action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Cancelled')
      await load()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <HrFeatureGate>
      <HrPageShell
        title="Leave"
        subtitle="Requests, balances, and leave types"
        icon={Briefcase}
        actions={
          <button
            type="button"
            onClick={openSubmit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus className="w-4 h-4" /> Request leave
          </button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HrKpiCard label="Pending approval" value={kpis.pending} />
          <HrKpiCard label="Approved (list)" value={kpis.approved} />
          <HrKpiCard label="Balance rows" value={kpis.balances} />
          <HrKpiCard label="Days available" value={Number(kpis.available.toFixed(1))} />
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ['requests', 'Requests'],
            ['balances', 'Balances'],
            ['types', 'Leave types'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm border',
                tab === key ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent',
              )}
              style={{ background: tab === key ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}

        {!loading && !error && tab === 'requests' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">All statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Dates</th>
                    <th className="px-3 py-2 font-medium">Days</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                        No leave requests
                      </td>
                    </tr>
                  )}
                  {requests.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                        <div className="font-medium">{r.employee.fullName}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.employee.employeeCode}</div>
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.leaveType.name}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                        {dateKey(r.startDate)}
                        {dateKey(r.endDate) !== dateKey(r.startDate) ? ` → ${dateKey(r.endDate)}` : ''}
                        {(r.startPart !== 'FULL' || r.endPart !== 'FULL') && (
                          <span className="ml-1 text-xs">({r.startPart}/{r.endPart})</span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.days}</td>
                      <td className="px-3 py-2">
                        <span className={cn('inline-flex px-2 py-0.5 rounded border text-xs', STATUS_STYLE[r.status] ?? STATUS_STYLE.DRAFT)}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {canEdit && r.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => void review(r.id, 'approve')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}
                              >
                                {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => void review(r.id, 'reject')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}
                          {(r.status === 'SUBMITTED' || r.status === 'APPROVED') && (
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void review(r.id, 'cancel')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                              style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && tab === 'balances' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Entitled</th>
                  <th className="px-3 py-2 font-medium">Used</th>
                  <th className="px-3 py-2 font-medium">Pending</th>
                  <th className="px-3 py-2 font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      No balances yet — link your user to an employee or open as manager
                    </td>
                  </tr>
                )}
                {balances.map(b => {
                  const available = Math.max(0, b.entitled - b.used - b.pending)
                  return (
                    <tr key={b.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.employee.fullName}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.leaveType.name}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{b.entitled}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{b.used}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{b.pending}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{available}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && tab === 'types' && (
          <div className="space-y-3">
            {canEdit && (
              <button
                type="button"
                onClick={() => openType()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <Plus className="w-4 h-4" /> Add leave type
              </button>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {types.map(t => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && openType(t)}
                  className="text-left rounded-xl p-4"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex justify-between gap-2">
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                    <span className="text-xs" style={{ color: t.isActive ? '#6ee7b7' : 'var(--text-muted)' }}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t.code || '—'} · {t.annualAllowance} days · {t.isPaid ? 'Paid' : 'Unpaid'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </HrPageShell>

      {submitOpen && (
        <HrModal title="Request leave" onClose={() => setSubmitOpen(false)}>
          <div className="space-y-3">
            {canEdit && employees.length > 0 && (
              <HrField label="Employee">
                <select
                  value={form.employeeId}
                  onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="">My linked employee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
                  ))}
                </select>
              </HrField>
            )}
            <HrField label="Leave type">
              <select
                value={form.leaveTypeId}
                onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {types.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </HrField>
            <div className="grid grid-cols-2 gap-3">
              <HrField label="Start">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </HrField>
              <HrField label="End">
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </HrField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HrField label="Start part">
                <select
                  value={form.startPart}
                  onChange={e => setForm(f => ({ ...f, startPart: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="FULL">Full day</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </HrField>
              <HrField label="End part">
                <select
                  value={form.endPart}
                  onChange={e => setForm(f => ({ ...f, endPart: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="FULL">Full day</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </HrField>
            </div>
            <HrField label="Reason">
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </HrField>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submitLeave()}
              className="w-full inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit
            </button>
          </div>
        </HrModal>
      )}

      {typeModal && (
        <HrModal title={typeModal === 'new' ? 'New leave type' : 'Edit leave type'} onClose={() => setTypeModal(null)}>
          <div className="space-y-3">
            <HrField label="Name">
              <input
                value={typeForm.name}
                onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </HrField>
            <HrField label="Code">
              <input
                value={typeForm.code}
                onChange={e => setTypeForm(f => ({ ...f, code: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </HrField>
            <HrField label="Annual allowance">
              <input
                type="number"
                min={0}
                value={typeForm.annualAllowance}
                onChange={e => setTypeForm(f => ({ ...f, annualAllowance: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </HrField>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={typeForm.isPaid} onChange={e => setTypeForm(f => ({ ...f, isPaid: e.target.checked }))} />
              Paid leave
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={typeForm.requiresApproval} onChange={e => setTypeForm(f => ({ ...f, requiresApproval: e.target.checked }))} />
              Requires approval
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={typeForm.allowHalfDay} onChange={e => setTypeForm(f => ({ ...f, allowHalfDay: e.target.checked }))} />
              Allow half day
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={typeForm.isActive} onChange={e => setTypeForm(f => ({ ...f, isActive: e.target.checked }))} />
              Active
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveType()}
              className="w-full inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
