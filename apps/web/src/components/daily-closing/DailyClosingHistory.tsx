'use client'

import { useEffect, useState } from 'react'
import { Loader2, History, CheckCircle2, FileEdit } from 'lucide-react'
import { dailyClosingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

function closingDateKey(value: string | Date): string {
  const at = typeof value === 'string' ? new Date(value) : value
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

export function DailyClosingHistory({ branchId, onSelectDate }: { branchId: string; onSelectDate: (date: string) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    dailyClosingApi.list({ branchId, limit: '30' })
      .then((res: any) => setRows(res?.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [branchId])

  if (!branchId) return null

  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={15} className="text-violet-500" />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Closings</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-500" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No closing records yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Date', 'Status', 'Sales', 'Net Profit', 'Variance', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r: any) => {
                const dateStr = closingDateKey(r.date)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{dateStr}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${r.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {r.status === 'CLOSED' ? <CheckCircle2 size={10} /> : <FileEdit size={10} />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(r.totalSales ?? 0)}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-600">{formatCurrency(r.netProfit ?? 0)}</td>
                    <td className={`px-3 py-2 font-semibold ${Math.abs(r.cashVariance ?? 0) > 100 ? 'text-red-500' : 'text-slate-500'}`}>
                      {formatCurrency(r.cashVariance ?? 0)}
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onSelectDate(dateStr)}
                        className="text-xs text-violet-500 hover:underline">View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
