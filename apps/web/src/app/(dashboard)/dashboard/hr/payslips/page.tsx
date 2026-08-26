'use client'

import { useCallback, useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { hrApi } from '@/lib/api'
import { HrFeatureGate, HrPageShell, HrLoading, HrError } from '@/components/hr/hr-ui'

type Slip = {
  id: string; gross: number; deductions: number; net: number; issuedAt: string
  employee: { fullName: string; employeeCode: string }
  run: { status: string; period: { label: string } }
}

export default function HrPayslipsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Slip[]>([])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await hrApi.listPayslips() as { data: Slip[] }
      setRows(res.data ?? [])
    } catch (e: unknown) { setError((e as Error)?.message ?? 'Failed to load payslips') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <HrFeatureGate>
      <HrPageShell title="Payslips" subtitle="Snapshots from processed payroll runs" icon={Receipt}>
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Deductions</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Run</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.employee.fullName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.run.period.label}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.gross.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.deductions.toLocaleString()}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{r.net.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.run.status}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No payslips yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </HrPageShell>
    </HrFeatureGate>
  )
}
