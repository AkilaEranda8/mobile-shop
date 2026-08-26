'use client'

import { useCallback, useEffect, useState } from 'react'
import { Contact2, Plus, Loader2, Edit2 } from 'lucide-react'
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

type Designation = {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  sortOrder: number
  _count?: { employees: number }
}

function DesignationModal({
  row,
  onClose,
  onSaved,
}: {
  row?: Designation
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!row
  const [form, setForm] = useState({
    name: row?.name ?? '',
    code: row?.code ?? '',
    description: row?.description ?? '',
    isActive: row?.isActive ?? true,
    sortOrder: String(row?.sortOrder ?? 0),
  })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Designation name is required')
      return
    }
    setLoading(true)
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      }
      if (isEdit) {
        await hrApi.updateDesignation(row!.id, body)
        toast.success('Designation updated')
      } else {
        await hrApi.createDesignation(body)
        toast.success('Designation created')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <HrModal
      title={isEdit ? 'Edit Designation' : 'Add Designation'}
      subtitle="Job titles used across departments"
      icon={Contact2}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary text-sm px-4" disabled={loading}>Cancel</button>
          <button type="submit" form="hr-desig-form" disabled={loading} className="btn-primary text-sm px-4 flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : isEdit ? <Edit2 size={14} /> : <Plus size={14} />}
            {isEdit ? 'Save changes' : 'Create designation'}
          </button>
        </>
      )}
    >
      <form id="hr-desig-form" onSubmit={submit} className="space-y-3">
        <HrField label="Name" required>
          <input required className="input-field w-full" placeholder="e.g. Senior Technician" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
        </HrField>
        <div className="grid grid-cols-2 gap-3">
          <HrField label="Code" hint="Optional short code">
            <input className="input-field w-full font-mono" placeholder="SR-TECH" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
          </HrField>
          <HrField label="Sort order">
            <input type="number" min={0} className="input-field w-full" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} />
          </HrField>
        </div>
        <HrField label="Description">
          <textarea className="input-field w-full min-h-[80px] resize-y" placeholder="Responsibilities / level…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </HrField>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
          Active designation
        </label>
      </form>
    </HrModal>
  )
}

export default function HrDesignationsPage() {
  const { canEdit } = useModuleAccess()
  const [rows, setRows] = useState<Designation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<Designation | null | 'new'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await hrApi.listDesignations() as { data: Designation[] }
      setRows(res.data ?? [])
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load designations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <HrFeatureGate>
      <HrPageShell
        title="Designations"
        subtitle="Job titles and role labels"
        icon={Contact2}
        actions={canEdit && (
          <button type="button" onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add designation
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
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Code</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Employees</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{row.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row.code || '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row._count?.employees ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${row.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setModal(row)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No designations yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </HrPageShell>
      {modal && (
        <DesignationModal
          row={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}
    </HrFeatureGate>
  )
}
