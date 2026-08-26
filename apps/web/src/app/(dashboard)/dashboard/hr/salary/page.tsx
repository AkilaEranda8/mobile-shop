'use client'

import { useCallback, useEffect, useState } from 'react'
import { DollarSign, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import {
  HrFeatureGate, HrPageShell, HrLoading, HrError, HrModal, HrField,
} from '@/components/hr/hr-ui'

type Component = {
  id: string; name: string; code: string; kind: string; calcType: string
  defaultAmount: number; isActive: boolean
}
type Package = {
  id: string; basicSalary: number; effectiveFrom: string; effectiveTo: string | null
  employee: { id: string; fullName: string; employeeCode: string }
  lines: Array<{ componentId: string; amount: number; component: Component }>
}
type Employee = { id: string; fullName: string; employeeCode: string }

export default function HrSalaryPage() {
  const { canEdit } = useModuleAccess()
  const [tab, setTab] = useState<'packages' | 'components'>('packages')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [components, setComponents] = useState<Component[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pkgOpen, setPkgOpen] = useState(false)
  const [compOpen, setCompOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pkgForm, setPkgForm] = useState({
    employeeId: '', basicSalary: '', effectiveFrom: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }),
  })
  const [compForm, setCompForm] = useState({
    name: '', code: '', kind: 'EARNING', calcType: 'FIXED', defaultAmount: '0',
  })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, p, e] = await Promise.all([
        hrApi.listSalaryComponents() as Promise<{ data: Component[] }>,
        hrApi.listSalaryPackages() as Promise<{ data: Package[] }>,
        hrApi.listEmployees({ limit: '200' }) as Promise<{ data: { data: Employee[] } }>,
      ])
      setComponents(c.data ?? [])
      setPackages(p.data ?? [])
      setEmployees(e.data?.data ?? [])
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load salary')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const savePackage = async () => {
    if (!pkgForm.employeeId || !pkgForm.basicSalary) { toast.error('Employee and basic required'); return }
    setSaving(true)
    try {
      await hrApi.upsertSalaryPackage({
        employeeId: pkgForm.employeeId,
        basicSalary: Number(pkgForm.basicSalary),
        effectiveFrom: pkgForm.effectiveFrom,
        lines: components.filter(c => c.isActive).map(c => ({
          componentId: c.id, amount: c.defaultAmount,
        })),
      })
      toast.success('Package saved'); setPkgOpen(false); await load()
    } catch (err: unknown) { toast.error((err as Error)?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  const saveComponent = async () => {
    if (!compForm.name || !compForm.code) { toast.error('Name and code required'); return }
    setSaving(true)
    try {
      await hrApi.createSalaryComponent({
        ...compForm, defaultAmount: Number(compForm.defaultAmount) || 0,
      })
      toast.success('Component created'); setCompOpen(false); await load()
    } catch (err: unknown) { toast.error((err as Error)?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <HrFeatureGate>
      <HrPageShell title="Salary" subtitle="Components and employee packages" icon={DollarSign}
        actions={canEdit ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setCompOpen(true)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Component
            </button>
            <button type="button" onClick={() => { setPkgForm(f => ({ ...f, employeeId: employees[0]?.id ?? '' })); setPkgOpen(true) }}
              className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Package
            </button>
          </div>
        ) : undefined}
      >
        <div className="flex gap-2">
          {(['packages', 'components'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} className="px-3 py-1.5 rounded-lg text-sm capitalize"
              style={{ background: tab === t ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-muted)' }}>{t}</button>
          ))}
        </div>
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && tab === 'packages' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Basic</th>
                  <th className="px-3 py-2">Effective</th>
                  <th className="px-3 py-2">Lines</th>
                </tr>
              </thead>
              <tbody>
                {packages.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{p.employee.fullName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{p.basicSalary.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{p.effectiveFrom.slice(0, 10)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{p.lines.length}</td>
                  </tr>
                ))}
                {!packages.length && <tr><td colSpan={4} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No packages yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && tab === 'components' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {components.map(c => (
              <div key={c.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.code} · {c.kind} · {c.calcType} · {c.defaultAmount}</div>
              </div>
            ))}
          </div>
        )}
      </HrPageShell>

      {pkgOpen && (
        <HrModal title="Set salary package" onClose={() => setPkgOpen(false)}>
          <div className="space-y-3">
            <HrField label="Employee">
              <select value={pkgForm.employeeId} onChange={e => setPkgForm(f => ({ ...f, employeeId: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </HrField>
            <HrField label="Basic salary">
              <input type="number" value={pkgForm.basicSalary} onChange={e => setPkgForm(f => ({ ...f, basicSalary: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </HrField>
            <HrField label="Effective from">
              <input type="date" value={pkgForm.effectiveFrom} onChange={e => setPkgForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </HrField>
            <button type="button" disabled={saving} onClick={() => void savePackage()}
              className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
              {saving && <Loader2 className="w-4 h-4 inline animate-spin mr-1" />} Save
            </button>
          </div>
        </HrModal>
      )}

      {compOpen && (
        <HrModal title="New component" onClose={() => setCompOpen(false)}>
          <div className="space-y-3">
            {(['name', 'code'] as const).map(k => (
              <HrField key={k} label={k}>
                <input value={compForm[k]} onChange={e => setCompForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
              </HrField>
            ))}
            <HrField label="Kind">
              <select value={compForm.kind} onChange={e => setCompForm(f => ({ ...f, kind: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="EMPLOYER">Employer</option>
              </select>
            </HrField>
            <HrField label="Default amount / %">
              <input type="number" value={compForm.defaultAmount} onChange={e => setCompForm(f => ({ ...f, defaultAmount: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </HrField>
            <button type="button" disabled={saving} onClick={() => void saveComponent()}
              className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>Save</button>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
