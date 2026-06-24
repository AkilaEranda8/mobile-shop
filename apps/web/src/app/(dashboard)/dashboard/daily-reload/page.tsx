'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Upload, Plus, Trash2, Download, RefreshCw, Calendar, TrendingUp, PhoneCall, CheckCircle2, FileSpreadsheet, AlertCircle, Banknote, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { dailyReloadApi } from '@/lib/api'
import { useFeatureFlag } from '@/lib/hooks'
import { businessToday } from '@/lib/business-date'

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface Reload {
  id: string
  connectionNo: string
  provider?: string | null
  reloadType?: string | null
  transactionId?: string
  executedBy?: string
  reloadDate: string
  status: string
  amount: number
  commission?: number
  commissionRate?: number
}

interface ProviderRow {
  provider: string
  count: number
  reloadTotal: number
  commission: number
  netPayable: number
  paid: number
  remaining: number
  isPaid: boolean
}

interface Settlement {
  reloadTotal: number
  commission: number
  netPayable: number
  paid: number
  remaining: number
}

interface Summary {
  data: Reload[]
  total: number
  totalAmount: number
  commission: number
  netPayable?: number
  providerBreakdown?: ProviderRow[]
  settlement?: Settlement
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const today = () => businessToday()

function formatAmt(n: number) {
  return `Rs ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-LK', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function DailyReloadPage() {
  const hasAccess = useFeatureFlag('DAILY_RELOAD')
  const [date, setDate]               = useState(today())
  const [summary, setSummary]         = useState<Summary>({ data: [], total: 0, totalAmount: 0, commission: 0 })
  const [settlementSummary, setSettlementSummary] = useState<{
    providerBreakdown: ProviderRow[]
    settlement?: Settlement
    loading: boolean
  }>({ providerBreakdown: [], loading: false })
  const [loading, setLoading]         = useState(false)
  const [tab, setTab]                 = useState<'upload' | 'manual' | 'settlement'>('upload')
  const [uploading, setUploading]     = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const fileRef                       = useRef<HTMLInputElement>(null)

  /* Manual form */
  const [phone,  setPhone]   = useState('')
  const [amount, setAmount]  = useState('')
  const [txId,   setTxId]    = useState('')
  const [agent,  setAgent]   = useState('')
  const [status, setStatus]  = useState('Success')
  const [reloadType, setReloadType] = useState<'RELOAD' | 'RECHARGE_CARD'>('RELOAD')
  const [saving, setSaving]  = useState(false)
  const [payingProvider, setPayingProvider] = useState<string | null>(null)
  const [payModal, setPayModal] = useState<{ provider: string; remaining: number; netPayable: number; paid: number } | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')

  /* ── Fetch ───────────────────────────────────────────────────────────────── */
  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await dailyReloadApi.list({ date, _t: Date.now().toString() })
      const payload = res.data ?? res
      setSummary({
        data:        payload.data        ?? [],
        total:       payload.total       ?? 0,
        totalAmount: payload.totalAmount ?? 0,
        commission:  payload.commission  ?? 0,
        netPayable:  payload.netPayable,
      })
    } catch { toast.error('Failed to load reloads') }
    finally { setLoading(false) }
  }, [date])

  const fetchSettlement = useCallback(async () => {
    const payDate = today()
    setSettlementSummary(prev => ({ ...prev, loading: true }))
    try {
      const res: any = await dailyReloadApi.list({ date: payDate, _t: Date.now().toString() })
      const payload = res.data ?? res
      setSettlementSummary({
        providerBreakdown: payload.providerBreakdown ?? [],
        settlement: payload.settlement,
        loading: false,
      })
    } catch {
      toast.error('Failed to load provider settlement')
      setSettlementSummary(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => { fetchSettlement() }, [fetchSettlement])

  useEffect(() => {
    const onSaleComplete = () => { fetch(); fetchSettlement() }
    window.addEventListener('pos:sale-complete', onSaleComplete)
    return () => window.removeEventListener('pos:sale-complete', onSaleComplete)
  }, [fetch, fetchSettlement])

  /* ── Excel Upload ────────────────────────────────────────────────────────── */
  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { toast.error('Please upload an Excel (.xlsx) file'); return }
    setUploading(true)
    try {
      const result = await dailyReloadApi.uploadFile(file)
      toast.success(`${result?.imported ?? 0} reloads imported successfully`)
      fetch()
      fetchSettlement()
    } catch (e: any) { toast.error(e.message || 'Import failed') }
    finally { setUploading(false) }
  }

  /* ── Manual Save ─────────────────────────────────────────────────────────── */
  const handleManualSave = async () => {
    if (!phone.trim()) { toast.error('Phone number is required'); return }
    if (!amount || isNaN(parseFloat(amount))) { toast.error('Valid amount is required'); return }
    setSaving(true)
    try {
      await dailyReloadApi.create({
        connectionNo:  phone.trim(),
        transactionId: txId.trim()   || undefined,
        executedBy:    agent.trim()  || undefined,
        reloadDate:    new Date().toISOString(),
        reloadType,
        status,
        amount:        parseFloat(amount),
      })
      toast.success('Reload added')
      setPhone(''); setAmount(''); setTxId(''); setAgent(''); setStatus('Success'); setReloadType('RELOAD')
      fetch()
      fetchSettlement()
    } catch (e: any) { toast.error(e.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const openPayModal = (provider: string) => {
    const row = settlementSummary.providerBreakdown.find(p => p.provider === provider)
    if (!row || row.remaining <= 0) return
    setPayModal({
      provider,
      remaining: row.remaining,
      netPayable: row.netPayable,
      paid: row.paid,
    })
    setPayAmount(row.remaining.toFixed(2))
    setPayMethod('CASH')
  }

  const submitProviderPay = async () => {
    if (!payModal) return
    const amt = parseFloat(payAmount)
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid payment amount'); return }
    if (amt > payModal.remaining + 0.01) {
      toast.error(`Amount cannot exceed balance (${formatAmt(payModal.remaining)})`)
      return
    }
    setPayingProvider(payModal.provider)
    try {
      await dailyReloadApi.payProvider({
        date: today(),
        provider: payModal.provider,
        amount: amt,
        paymentMethod: payMethod,
      })
      const balanceAfter = Math.max(0, payModal.remaining - amt)
      toast.success(
        balanceAfter > 0.01
          ? `${payModal.provider}: ${formatAmt(amt)} paid · ${formatAmt(balanceAfter)} remaining`
          : `${payModal.provider} fully paid`,
      )
      setPayModal(null)
      fetchSettlement()
    } catch (e: any) { toast.error(e.message || 'Payment failed') }
    finally { setPayingProvider(null) }
  }

  const handlePayProvider = (provider: string) => openPayModal(provider)

  /* ── Delete ──────────────────────────────────────────────────────────────── */
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this reload record?')) return
    try {
      await dailyReloadApi.remove(id)
      toast.success('Deleted')
      fetch()
      fetchSettlement()
    } catch { toast.error('Delete failed') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Columns ─────────────────────────────────────────────────────────────── */
  const columns = useMemo<ColumnDef<Reload>[]>(() => [
    {
      accessorKey: 'connectionNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Connection No" />,
      cell: ({ row: { original: r } }) => (
        <span className="font-mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{r.connectionNo}</span>
      ),
    },
    {
      id: 'reloadType',
      accessorFn: (r) => r.reloadType ?? 'RELOAD',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row: { original: r } }) => (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
          background: r.reloadType === 'RECHARGE_CARD' ? 'rgba(139,92,246,0.12)' : 'rgba(20,184,166,0.12)',
          color: r.reloadType === 'RECHARGE_CARD' ? '#8b5cf6' : '#14b8a6',
        }}>
          {r.reloadType === 'RECHARGE_CARD' ? 'Recharge Card' : 'Reload'}
        </span>
      ),
    },
    {
      accessorKey: 'transactionId',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Transaction ID" />,
      cell: ({ row: { original: r } }) => (
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.transactionId || '—'}</span>
      ),
    },
    {
      accessorKey: 'executedBy',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Executed By" />,
      cell: ({ row: { original: r } }) => (
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.executedBy || '—'}</span>
      ),
    },
    {
      accessorKey: 'reloadDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date & Time" />,
      cell: ({ row: { original: r } }) => (
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.reloadDate)}</span>
      ),
    },
    {
      id: 'status',
      accessorFn: (r) => r.status,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row: { original: r } }) => (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
          background: r.status === 'Success' ? 'rgba(16,185,129,0.12)' : r.status === 'Failed' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
          color:      r.status === 'Success' ? '#10b981'               : r.status === 'Failed' ? '#ef4444'               : '#f59e0b',
        }}>{r.status}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row: { original: r } }) => (
        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Rs {r.amount.toLocaleString()}</span>
      ),
    },
    {
      id: 'commission',
      accessorFn: (r) => r.commission ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Commission" />,
      cell: ({ row: { original: r } }) => (
        <span className="font-semibold text-sm text-emerald-400">
          Rs {(r.commission ?? 0).toFixed(2)}
          {r.commissionRate != null && <span className="text-[10px] ml-1 opacity-70">({r.commissionRate}%)</span>}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row: { original: r } }) => (
        <button
          onClick={() => handleDelete(r.id)}
          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
          style={{ color: 'var(--text-muted)' }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      ),
    },
  ], [handleDelete])

  /* ── Export CSV ──────────────────────────────────────────────────────────── */
  const handleExport = () => {
    try {
      const header = 'Connection No,Type,Transaction ID,Executed By,Date & Time,Status,Amount (Rs),Commission'
      const rows   = summary.data.map(r =>
        [r.connectionNo, r.reloadType === 'RECHARGE_CARD' ? 'Recharge Card' : 'Reload', r.transactionId ?? '', r.executedBy ?? '', fmtDate(r.reloadDate), r.status, r.amount, (r.commission ?? 0).toFixed(2)].join(',')
      )
      rows.push(`,,,,Total,${summary.totalAmount},${summary.commission}`)
      const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url; a.download = `DailyReload_${date}_commission.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch { toast.error('Export failed') }
  }

  /* ── UI ──────────────────────────────────────────────────────────────────── */
  const successCount = summary.data.filter(r => r.status === 'Success').length
  const settlement = settlementSummary.settlement
  const providerRows = settlementSummary.providerBreakdown
  const netPayable = summary.netPayable ?? (summary.totalAmount - summary.commission)
  const settlementLoading = settlementSummary.loading

  if (!hasAccess) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
        <PhoneCall size={26} style={{ color: '#8b5cf6' }} />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Daily Reload</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This feature is not enabled for your account.</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Contact your administrator to enable Daily Reload.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Daily Reload</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Upload &amp; manage daily mobile top-up transactions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab !== 'settlement' && (
            <>
          {/* Date picker */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button onClick={() => setDate(today())} className="px-3 py-2 rounded-xl border text-xs font-medium transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>Today</button>
            </>
          )}
          <button onClick={() => { fetch(); if (tab === 'settlement') fetchSettlement() }} disabled={loading || settlementLoading} className="p-2 rounded-xl border transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }} title="Refresh">
            <RefreshCw size={14} className={(loading || settlementLoading) ? 'animate-spin' : ''} />
          </button>
          {tab !== 'settlement' && (
          <button
            onClick={handleExport}
            disabled={summary.data.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <Download size={13} /> Export Report
          </button>
          )}
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      {tab !== 'settlement' && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: PhoneCall,     label: 'Total Reloads',  value: summary.total.toString(),      color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
          { icon: TrendingUp,    label: 'Reload Total',   value: formatAmt(summary.totalAmount), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { icon: TrendingUp,    label: 'Commission (Earned)',  value: formatAmt(summary.commission),  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { icon: CheckCircle2,  label: 'Net to Provider', value: formatAmt(netPayable), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon size={17} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* ── Upload + Manual Entry + Provider Pay ────────────────────────────── */}
      <div className="card rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {([
            { id: 'upload' as const, icon: FileSpreadsheet, label: 'Upload Excel' },
            { id: 'manual' as const, icon: Plus, label: 'Manual Entry' },
            { id: 'settlement' as const, icon: Banknote, label: 'Provider Pay' },
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor:  tab === id ? 'var(--brand-primary)' : 'transparent',
                color:        tab === id ? 'var(--brand-primary)' : 'var(--text-muted)',
                background:   'transparent',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Excel Upload ─────────────────────────────────────────────── */}
          {tab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
                style={{ borderColor: dragOver ? 'var(--brand-primary)' : 'var(--border-default)', background: dragOver ? 'rgba(139,92,246,0.05)' : 'transparent' }}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--brand-primary)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Importing…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload size={32} style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Drop Excel file here or click to browse</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Columns: Connection No · Transaction ID · Executed By · Date · Time · Status · Amount</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#3b82f6' }} />
                <span style={{ color: 'var(--text-muted)' }}>Row 1 is treated as a header and skipped. Amount column accepts "Rs 159" or "159" format. Date should be DD/MM/YYYY.</span>
              </div>
            </div>
          )}

          {/* ── Manual Entry ─────────────────────────────────────────────── */}
          {tab === 'manual' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Phone / Connection No *', value: phone,  setter: setPhone,  placeholder: '07XX XXX XXX', type: 'text' },
                { label: 'Amount (Rs) *',           value: amount, setter: setAmount, placeholder: '159',          type: 'number' },
                { label: 'Transaction ID',          value: txId,   setter: setTxId,   placeholder: '34954049239',  type: 'text' },
                { label: 'Executed By (Agent)',     value: agent,  setter: setAgent,  placeholder: '07XX XXX XXX', type: 'text' },
              ].map(({ label, value, setter, placeholder, type }) => (
                <div key={label}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 transition-colors"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Type</label>
                <select
                  value={reloadType}
                  onChange={e => setReloadType(e.target.value as 'RELOAD' | 'RECHARGE_CARD')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 transition-colors"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                  <option value="RELOAD">Reload</option>
                  <option value="RECHARGE_CARD">Recharge Card</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 transition-colors"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                  <option value="Success">Success</option>
                  <option value="Failed">Failed</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleManualSave}
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving…' : 'Add Reload'}
                </button>
              </div>
            </div>
          )}

          {/* ── Provider Pay ─────────────────────────────────────────────────── */}
          {tab === 'settlement' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Provider Settlement</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Today ({today()}) · Pay provider = Reload total − Commission earned
                  </p>
                </div>
              </div>

              {settlementLoading ? (
                <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
                  <RefreshCw size={28} className="animate-spin mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading today&apos;s settlement…</p>
                </div>
              ) : providerRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
                  <Banknote size={32} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No reload data for this date</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Upload Excel or add manual entries first</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                        {['Provider', 'Reloads', 'Reload Total', 'Commission', 'Net to Pay', 'Paid', 'Balance', 'Action'].map(h => (
                          <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wide px-3 py-2" style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {providerRows.map(row => (
                        <tr key={row.provider} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-3 py-2.5 font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{row.provider}</td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.count}</td>
                          <td className="px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{formatAmt(row.reloadTotal)}</td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-emerald-500">{formatAmt(row.commission)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-amber-500">{formatAmt(row.netPayable)}</td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{formatAmt(row.paid)}</td>
                          <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: row.remaining > 0 ? '#ef4444' : '#10b981' }}>
                            {formatAmt(row.remaining)}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.isPaid || row.remaining <= 0.01 ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500">Paid</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {row.paid > 0.01 && (
                                  <span className="text-[9px] font-medium text-amber-500">Partial paid</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handlePayProvider(row.provider)}
                                  disabled={payingProvider !== null}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-40"
                                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                                >
                                  {payingProvider === row.provider ? <RefreshCw size={11} className="animate-spin" /> : <Banknote size={11} />}
                                  Pay
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {settlement && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg-subtle)' }}>
                          <td className="px-3 py-2.5 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Total</td>
                          <td />
                          <td className="px-3 py-2.5 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatAmt(settlement.reloadTotal)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-emerald-500">{formatAmt(settlement.commission)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-amber-500">{formatAmt(settlement.netPayable)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatAmt(settlement.paid)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold" style={{ color: settlement.remaining > 0 ? '#ef4444' : '#10b981' }}>{formatAmt(settlement.remaining)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(59,130,246,0.08)', color: 'var(--text-muted)' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
                <span>Commission is your shop profit from the provider. Net to Pay is sent to the provider (reload total minus commission). You can pay the full balance or enter a smaller amount in parts. Each payment is recorded in Finance as &quot;Reload Provider&quot; expense.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Provider Pay Modal ─────────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !payingProvider && setPayModal(null)}>
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Pay {payModal.provider}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{today()}</p>
              </div>
              <button type="button" onClick={() => setPayModal(null)} disabled={!!payingProvider} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Net to Pay', value: formatAmt(payModal.netPayable), color: '#f59e0b' },
                  { label: 'Paid', value: formatAmt(payModal.paid), color: '#10b981' },
                  { label: 'Balance', value: formatAmt(payModal.remaining), color: '#ef4444' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-2.5" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="text-xs font-bold mt-0.5" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount to pay now (Rs)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={payModal.remaining}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPayAmount(payModal.remaining.toFixed(2))}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                  >
                    Full balance
                  </button>
                  {[1000, 5000, 10000].filter(n => n < payModal.remaining).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPayAmount(String(n))}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                    >
                      Rs {n.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Payment method</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="WALLET">Wallet</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  disabled={!!payingProvider}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border disabled:opacity-40"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitProviderPay}
                  disabled={!!payingProvider}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}
                >
                  {payingProvider === payModal.provider ? <RefreshCw size={14} className="animate-spin" /> : <Banknote size={14} />}
                  Record payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {tab !== 'settlement' && (
      <ClientSideTable
        data={summary.data}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((summary.total || 1) / 20)}
        searchableColumns={[
          { id: 'connectionNo',  title: 'Connection No'  },
          { id: 'transactionId', title: 'Transaction ID' },
          { id: 'executedBy',    title: 'Executed By'    },
        ]}
        filterableColumns={[
          {
            id: 'status' as any,
            title: 'Status',
            options: [
              { label: 'Success', value: 'Success' },
              { label: 'Failed',  value: 'Failed'  },
              { label: 'Pending', value: 'Pending' },
            ],
          },
        ]}
      />
      )}

      {/* ── Commission Footer ──────────────────────────────────────────────── */}
      {tab !== 'settlement' && summary.data.length > 0 && (
        <div className="card rounded-2xl flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{formatAmt(summary.totalAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Commission Earned</p>
              <p className="text-lg font-bold text-emerald-400">{formatAmt(summary.commission)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Net to Provider</p>
              <p className="text-lg font-bold text-amber-400">{formatAmt(netPayable)}</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <Download size={14} /> Download Commission Report
          </button>
        </div>
      )}
    </div>
  )
}
