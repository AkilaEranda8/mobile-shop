'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Plus, Loader2, Edit2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import {
  HrFeatureGate,
  HrPageShell,
  HrLoading,
  HrError,
  HrModal,
  HrField,
} from '@/components/hr/hr-ui'

type Shift = {
  id: string
  name: string
  code: string | null
  startMinutes: number
  endMinutes: number
  graceMinutes: number
  isOvernight: boolean
  isActive: boolean
  branch?: { id: string; name: string } | null
  _count?: { assignments: number }
}

type Employee = { id: string; fullName: string; employeeCode: string }

function minsToLabel(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function labelToMins(v: string) {
  const [h, m] = v.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export default function HrShiftsPage() {
  const { canEdit } = useModuleAccess()
  const [rows, setRows] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<Shift | null | 'new'>(null)
  const [assignFor, setAssignFor] = useState<Shift | null>(null)
  const [form, setForm] = useState({
    name: '',
    code: '',
    start: '09:00',
    end: '18:00',
    graceMinutes: '10',
    isOvernight: false,
    isActive: true,
  })
  const [assignForm, setAssignForm] = useState({ employeeId: '', effectiveFrom: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }) })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [shifts, emps] = await Promise.all([
        hrApi.listShifts() as Promise<{ data: Shift[] }>,
        hrApi.listEmployees({ limit: '200' }) as Promise<{ data: { data: Employee[] } }>,
      ])
      setRows(shifts.data ?? [])
      setEmployees(emps.data?.data ?? [])
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openNew = () => {
    setForm({ name: '', code: '', start: '09:00', end: '18:00', graceMinutes: '10', isOvernight: false, isActive: true })
    setModal('new')
  }

  const openEdit = (s: Shift) => {
    setForm({
      name: s.name,
      code: s.code ?? '',
      start: minsToLabel(s.startMinutes),
      end: minsToLabel(s.endMinutes),
      graceMinutes: String(s.graceMinutes),
      isOvernight: s.isOvernight,
      isActive: s.isActive,
    })
    setModal(s)
  }

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        startMinutes: labelToMins(form.start),
        endMinutes: labelToMins(form.end),
        graceMinutes: Number(form.graceMinutes) || 0,
        isOvernight: form.isOvernight,
        isActive: form.isActive,
      }
      if (modal === 'new') {
        await hrApi.createShift(body)
        toast.success('Shift created')
      } else if (modal) {
        await hrApi.updateShift(modal.id, body)
        toast.success('Shift updated')
      }
      setModal(null)
      await load()
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignFor) return
    setSaving(true)
    try {
      await hrApi.assignShift({
        shiftId: assignFor.id,
        employeeId: assignForm.employeeId,
        effectiveFrom: assignForm.effectiveFrom,
      })
      toast.success('Shift assigned')
      setAssignFor(null)
      await load()
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Assign failed')
    } finally {
      setSaving(false)
    }
  }

  const empOptions = useMemo(() => employees, [employees])

  return (
    <HrFeatureGate>
      <HrPageShell
        title="Shifts"
        subtitle="Shift definitions and employee assignments"
        icon={Calendar}
        actions={canEdit && (
          <button type="button" onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} /> Add shift
          </button>
        )}
      >
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Name</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Window</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Grace</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Assignments</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.code || '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {minsToLabel(row.startMinutes)} – {minsToLabel(row.endMinutes)}
                      {row.isOvernight ? ' (overnight)' : ''}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row.graceMinutes}m</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row._count?.assignments ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${row.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right space-x-1">
                        <button type="button" onClick={() => { setAssignFor(row); setAssignForm(p => ({ ...p, employeeId: empOptions[0]?.id ?? '' })) }} className="p-1.5 rounded-lg hover:bg-white/5 inline-flex" style={{ color: 'var(--text-muted)' }} title="Assign">
                          <UserPlus size={14} />
                        </button>
                        <button type="button" onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-white/5 inline-flex" style={{ color: 'var(--text-muted)' }}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No shifts yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </HrPageShell>

      {modal && (
        <HrModal
          title={modal === 'new' ? 'Add shift' : 'Edit shift'}
          subtitle="Times are Asia/Colombo"
          icon={Calendar}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" className="btn-secondary text-sm px-4" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" form="hr-shift-form" disabled={saving} className="btn-primary text-sm px-4 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </>
          )}
        >
          <form id="hr-shift-form" onSubmit={saveShift} className="space-y-3">
            <HrField label="Name" required>
              <input required className="input-field w-full" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </HrField>
            <HrField label="Code">
              <input className="input-field w-full font-mono" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
            </HrField>
            <div className="grid grid-cols-2 gap-3">
              <HrField label="Start">
                <input type="time" className="input-field w-full" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} />
              </HrField>
              <HrField label="End">
                <input type="time" className="input-field w-full" value={form.end} onChange={e => setForm(p => ({ ...p, end: e.target.value }))} />
              </HrField>
            </div>
            <HrField label="Grace (minutes)">
              <input type="number" min={0} className="input-field w-full" value={form.graceMinutes} onChange={e => setForm(p => ({ ...p, graceMinutes: e.target.value }))} />
            </HrField>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={form.isOvernight} onChange={e => setForm(p => ({ ...p, isOvernight: e.target.checked }))} />
              Overnight shift
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
              Active
            </label>
          </form>
        </HrModal>
      )}

      {assignFor && (
        <HrModal
          title="Assign shift"
          subtitle={assignFor.name}
          icon={UserPlus}
          onClose={() => setAssignFor(null)}
          footer={(
            <>
              <button type="button" className="btn-secondary text-sm px-4" onClick={() => setAssignFor(null)}>Cancel</button>
              <button type="submit" form="hr-assign-form" disabled={saving} className="btn-primary text-sm px-4 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Assign
              </button>
            </>
          )}
        >
          <form id="hr-assign-form" onSubmit={saveAssign} className="space-y-3">
            <HrField label="Employee" required>
              <select required className="input-field w-full" value={assignForm.employeeId} onChange={e => setAssignForm(p => ({ ...p, employeeId: e.target.value }))}>
                <option value="">Select…</option>
                {empOptions.map(e => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
                ))}
              </select>
            </HrField>
            <HrField label="Effective from">
              <input type="date" className="input-field w-full" value={assignForm.effectiveFrom} onChange={e => setAssignForm(p => ({ ...p, effectiveFrom: e.target.value }))} />
            </HrField>
          </form>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
