'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  DollarSign, Download, Calendar, X, ChevronRight,
  Search, Receipt, Wallet, Truck, Package, ClipboardList,
} from 'lucide-react'
import { useActiveBranchId, usePurchaseReport, usePurchaseReportDetail } from '@/lib/hooks'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday, businessPeriodFrom } from '@/lib/business-date'

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--text-primary)',
}
const COLORS = ['var(--brand-primary-light)', '#1d4ed8', '#0e7490', '#15803d', '#b45309', '#b91c1c', 'var(--brand-primary)', '#0369a1', '#065f46', '#92400e']
const PERIODS = [
  { label: 'Today', days: '1' },
  { label: '7D', days: '7' },
  { label: '30D', days: '30' },
  { label: '90D', days: '90' },
  { label: '1Y', days: '365' },
]

type SupplierRow = {
  supplierId: string
  supplierName: string
  phone: string
  total: number
  paid: number
  due: number
  tax: number
  orders: number
  draftOrders: number
  sentOrders: number
  partialOrders: number
  receivedOrders: number
  closedOrders: number
  unitsOrdered: number
  unitsReceived: number
  avgOrder: number
  outstandingBalance: number
  share: number
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20 flex-shrink-0`}>
        <Icon size={16} className={`text-${color}-600 dark:text-${color}-400`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full bg-violet-500" />
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {sub && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function ExportCSV({ filename, rows, headers }: { filename: string; rows: (string | number)[][]; headers: string[] }) {
  const handle = () => {
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }
  return (
    <button onClick={handle} className="flex items-center gap-1.5 text-xs hover:text-violet-600 dark:hover:text-violet-400 border px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
      <Download size={12} /> Export CSV
    </button>
  )
}

const renderPieLabel = ({ name, percent }: any) =>
  percent > 0.04 ? `${String(name).slice(0, 12)}${String(name).length > 12 ? '…' : ''} ${(percent * 100).toFixed(0)}%` : ''

function statusColor(status: string) {
  if (status === 'RECEIVED' || status === 'CLOSED') return 'text-green-600 dark:text-green-400'
  if (status === 'PARTIAL') return 'text-amber-600 dark:text-amber-400'
  if (status === 'SENT') return 'text-blue-600 dark:text-blue-400'
  return 'text-slate-500'
}

export default function PurchaseReportPage() {
  const [period, setPeriod] = useState('30')
  const branchId = useActiveBranchId() ?? ''
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const todayStr = useMemo(() => businessToday(), [])

  const toDate = useMemo(() => {
    if (isCustom && customTo) return customTo
    return todayStr
  }, [isCustom, customTo, todayStr])

  const fromDate = useMemo(() => {
    if (isCustom && customFrom) return customFrom
    return businessPeriodFrom(parseInt(period), toDate)
  }, [isCustom, customFrom, period, toDate])

  const apiParams: Record<string, string> = { from: fromDate, to: toDate }
  if (branchId) apiParams.branchId = branchId

  const { data: rawData, loading } = usePurchaseReport(apiParams)
  const d = rawData as any
  const suppliers: SupplierRow[] = d?.suppliers ?? []
  const totals = d?.totals ?? {
    total: 0, paid: 0, due: 0, orders: 0, suppliers: 0, unitsOrdered: 0, unitsReceived: 0,
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.supplierName.toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q),
    )
  }, [suppliers, search])

  const selected = selectedId
    ? suppliers.find(s => s.supplierId === selectedId) ?? null
    : null

  const detailParams: Record<string, string> | undefined = selectedId
    ? {
        from: fromDate,
        to: toDate,
        supplierId: selectedId,
        ...(branchId ? { branchId } : {}),
      }
    : undefined

  const { data: rawOrders, loading: ordersLoading } = usePurchaseReportDetail(detailParams)
  const orders: any[] = Array.isArray(rawOrders) ? rawOrders : []

  const best = filtered[0]

  const barData = filtered.slice(0, 10).map(s => ({
    name: s.supplierName.length > 14 ? s.supplierName.slice(0, 13) + '…' : s.supplierName,
    fullName: s.supplierName,
    Total: s.total,
    Paid: s.paid,
  }))

  const pieData = filtered.slice(0, 8).map((s, i) => ({
    name: s.supplierName,
    value: s.total,
    fill: COLORS[i % COLORS.length],
  }))

  const exportRows = filtered.map(s => [
    s.supplierName,
    s.phone,
    s.total.toFixed(2),
    s.paid.toFixed(2),
    s.due.toFixed(2),
    s.orders,
    s.receivedOrders,
    s.unitsOrdered,
    s.unitsReceived,
    s.avgOrder.toFixed(2),
    s.outstandingBalance.toFixed(2),
  ])

  const orderExportRows = orders.map((o: any) => [
    o.poNumber,
    formatDate(o.createdAt),
    o.status,
    o.total.toFixed(2),
    o.paid.toFixed(2),
    o.due.toFixed(2),
    o.unitsOrdered,
    o.unitsReceived,
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="page-title">Purchase Report</h1>
          <p className="page-subtitle">
            PO value · Paid · Due · Received qty — by supplier for the selected period
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => { setPeriod(p.days); setIsCustom(false) }}
                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                style={!isCustom && period === p.days ? { background: 'var(--brand-primary-light)', color: '#fff' } : { color: 'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setIsCustom(true)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
              style={isCustom ? { background: 'var(--brand-primary-light)', color: '#fff' } : { color: 'var(--text-muted)' }}>
              <Calendar size={11} /> Custom
            </button>
          </div>

          {isCustom && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo || todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom} max={todayStr}
                className="text-xs bg-transparent outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }} />
            </div>
          )}

          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
            {fromDate} → {toDate}
          </span>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search supplier…"
              className="text-xs pl-7 pr-3 py-1.5 rounded-xl outline-none border"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)', minWidth: 160 }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading purchase data…
        </div>
      ) : (
        <>
          {selected ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Supplier:</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{selected.supplierName}</span>
                {selected.phone && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selected.phone}</span>
                )}
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>PO breakdown</span>
                <button onClick={() => setSelectedId('')} className="ml-auto text-[11px] flex items-center gap-1 hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <X size={11} /> Clear
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="PO Value" value={formatCurrency(selected.total)} icon={DollarSign} color="violet" />
                <StatCard label="Paid" value={formatCurrency(selected.paid)} icon={Wallet} color="green" />
                <StatCard label="Due" value={formatCurrency(selected.due)} icon={Receipt} color="red" />
                <StatCard label="Orders" value={String(selected.orders)} icon={ClipboardList} color="blue" sub={`${selected.receivedOrders} received`} />
                <StatCard label="Units" value={`${selected.unitsReceived}/${selected.unitsOrdered}`} icon={Package} color="orange" sub={`Avg ${formatCurrency(selected.avgOrder)}`} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Total PO Value" value={formatCurrency(totals.total)} icon={DollarSign} color="violet" />
              <StatCard label="Total Paid" value={formatCurrency(totals.paid)} icon={Wallet} color="green" />
              <StatCard label="Period Due" value={formatCurrency(totals.due)} icon={Receipt} color="red" />
              <StatCard label="Purchase Orders" value={String(totals.orders)} icon={ClipboardList} color="blue" sub={`${totals.unitsReceived}/${totals.unitsOrdered} units`} />
              <StatCard label="Suppliers" value={String(totals.suppliers)} icon={Truck} color="orange" sub={best ? `Top: ${best.supplierName}` : ''} />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <SectionTitle title="PO Value & Paid by Supplier" sub="Top 10 suppliers" />
              {barData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No purchase data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} tickFormatter={v => formatCurrency(v)} width={72} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, _n: any, p: any) => [formatCurrency(v), p.payload.fullName]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Total" fill="var(--brand-primary-light)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Paid" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <SectionTitle title="Purchase Share by Supplier" sub="Top 8 suppliers" />
              {pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No purchase data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={100} label={renderPieLabel} labelLine={false} fontSize={10}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {selected && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle
                  title={`Purchase Orders — ${selected.supplierName}`}
                  sub={`${fromDate} → ${toDate}`}
                />
                <ExportCSV
                  filename={`${selected.supplierName.replace(/\s+/g, '-')}-purchase-orders.csv`}
                  headers={['PO Number', 'Date', 'Status', 'Total', 'Paid', 'Due', 'Ordered', 'Received']}
                  rows={orderExportRows}
                />
              </div>
              {ordersLoading ? (
                <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Loading orders…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['#', 'PO Number', 'Date', 'Status', 'Total', 'Paid', 'Due', 'Ordered', 'Received'].map((h, i) => (
                          <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 ${i <= 3 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o: any, i: number) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{o.poNumber}</td>
                          <td className="px-3 py-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDate(o.createdAt)}</td>
                          <td className={`px-3 py-2.5 text-xs font-semibold ${statusColor(o.status)}`}>{o.status}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(o.total)}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{formatCurrency(o.paid)}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(o.due)}</td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{o.unitsOrdered}</td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{o.unitsReceived}</td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No purchase orders for this supplier in the selected period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle title="All Suppliers" sub={`${filtered.length} suppliers · click a row for PO list`} />
              <ExportCSV
                filename={`purchase-report-${fromDate}-to-${toDate}.csv`}
                headers={['Supplier', 'Phone', 'Total', 'Paid', 'Due', 'Orders', 'Received POs', 'Units Ordered', 'Units Received', 'Avg Order', 'Outstanding']}
                rows={exportRows}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['#', 'Supplier', 'Phone', 'Total', 'Paid', 'Due', 'Orders', 'Received', 'Units', 'Avg', 'Outstanding', 'Share'].map((h, i) => (
                      <th key={h} className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 whitespace-nowrap ${i <= 2 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const active = selectedId === s.supplierId
                    return (
                      <tr
                        key={s.supplierId}
                        onClick={() => setSelectedId(active ? '' : s.supplierId)}
                        className="cursor-pointer transition-colors hover:bg-white/5"
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: active ? 'var(--brand-glow)' : undefined,
                        }}
                      >
                        <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.supplierName}</td>
                        <td className="px-3 py-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.phone || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(s.total)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-green-600 dark:text-green-400">{formatCurrency(s.paid)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-red-600 dark:text-red-400">{formatCurrency(s.due)}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{s.orders}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{s.receivedOrders}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{s.unitsReceived}/{s.unitsOrdered}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(s.avgOrder)}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: s.outstandingBalance > 0 ? '#b91c1c' : 'var(--text-secondary)' }}>{formatCurrency(s.outstandingBalance)}</td>
                        <td className="px-3 py-2.5 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{s.share}%</td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={12} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No purchases for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
