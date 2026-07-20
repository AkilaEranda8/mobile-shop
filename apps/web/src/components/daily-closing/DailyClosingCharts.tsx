'use client'

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['var(--brand-light)', '#3b82f6', '#10b981', 'var(--status-warn)', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export function DailyClosingCharts({ data, showReload = true }: { data: any; showReload?: boolean }) {
  const salesMix = data?.charts?.salesMix ?? []
  const expenses = data?.charts?.expenses ?? []
  const reload = showReload ? (data?.charts?.reloadCommission ?? []) : []

  if (!salesMix.length && !expenses.length && !reload.length) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {salesMix.length > 0 && (
        <div className="card rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Sales Mix</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={salesMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {salesMix.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {expenses.length > 0 && (
        <div className="card rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Expenses by Category</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={expenses} layout="vertical" margin={{ left: 8, right: 8 }}>
              <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {reload.length > 0 && (
        <div className="card rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Reload Commission</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={reload}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="amount" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="commission" name="Commission" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
