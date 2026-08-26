'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { HrFeatureGate, HrPageShell, HrLoading, HrError, HrModal, HrField, HrKpiCard } from '@/components/hr/hr-ui'

type Rule = { id: string; name: string; source: string; ratePercent: number; flatPerUnit: number; isActive: boolean }
type PreviewRow = {
  employee: { id: string; fullName: string; employeeCode: string }
  total: number; docCount: number
  bySource: Record<string, number>
}

function monthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}` }
}

export default function HrCommissionPage() {
  const { canEdit } = useModuleAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rules, setRules] = useState<Rule[]>([])
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [range, setRange] = useState(monthRange)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', source: 'SALES', ratePercent: '0.5', flatPerUnit: '0' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [r, p] = await Promise.all([
        hrApi.listCommissionRules() as Promise<{ data: Rule[] }>,
        hrApi.commissionPreview(range) as Promise<{ data: { rows: PreviewRow[]; grandTotal: number } }>,
      ])
      setRules(r.data ?? [])
      setRows(p.data?.rows ?? [])
      setGrandTotal(p.data?.grandTotal ?? 0)
    } catch (e: unknown) { setError((e as Error)?.message ?? 'Failed to load') }
    finally { setLoading(false) }
  }, [range])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await hrApi.createCommissionRule({
        name: form.name, source: form.source,
        ratePercent: Number(form.ratePercent) || 0,
        flatPerUnit: Number(form.flatPerUnit) || 0,
      })
      toast.success('Rule created'); setOpen(false); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <HrFeatureGate>
      <HrPageShell title="Commission" subtitle="Staff sales / repair incentive preview (calc only)" icon={TrendingUp}
        actions={canEdit ? (
          <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
            <Plus className="w-4 h-4 inline mr-1" /> Rule
          </button>
        ) : undefined}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HrKpiCard label="Period total" value={Number(grandTotal.toFixed(0))} />
          <HrKpiCard label="Staff with earnings" value={rows.filter(r => r.total > 0).length} />
          <HrKpiCard label="Active rules" value={rules.filter(r => r.isActive).length} />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>From
            <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
              className="block mt-1 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>To
            <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
              className="block mt-1 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </label>
        </div>
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && (
          <>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Docs</th>
                    <th className="px-3 py-2">Sales</th>
                    <th className="px-3 py-2">Repairs</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.employee.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.employee.fullName}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.docCount}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{(r.bySource.SALES ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{(r.bySource.REPAIRS ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{r.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No linked employees with attribution</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {rules.map(r => (
                <div key={r.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{r.source} · {r.ratePercent}% + {r.flatPerUnit} flat</div>
                </div>
              ))}
            </div>
          </>
        )}
      </HrPageShell>
      {open && (
        <HrModal title="Commission rule" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <HrField label="Name"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <HrField label="Source">
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                <option value="SALES">Sales</option>
                <option value="REPAIRS">Repairs</option>
                <option value="HIRE_PURCHASE">Hire purchase</option>
              </select>
            </HrField>
            <HrField label="Rate %"><input type="number" value={form.ratePercent} onChange={e => setForm(f => ({ ...f, ratePercent: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <button type="button" disabled={saving} onClick={() => void save()} className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
              {saving && <Loader2 className="w-4 h-4 inline animate-spin mr-1" />} Save
            </button>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
