'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Plus, Trash2, Download, RefreshCw, Calendar, TrendingUp, PhoneCall, CheckCircle2, X, FileSpreadsheet, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { dailyReloadApi } from '@/lib/api'

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface Reload {
  id: string
  connectionNo: string
  transactionId?: string
  executedBy?: string
  reloadDate: string
  status: string
  amount: number
}

interface Summary {
  data: Reload[]
  total: number
  totalAmount: number
  commission: number
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().slice(0, 10)

function formatAmt(n: number) {
  return `Rs ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-LK', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/* ── Parse amount from "Rs 159" or "159" ────────────────────────────────────── */
function parseAmt(raw: unknown): number {
  return parseFloat(String(raw ?? '0').replace(/[^0-9.]/g, '')) || 0
}

/* ── Parse date "17/05/2026" + time "09:32 PM" into ISO ────────────────────── */
function parseDateTime(dateStr: string, timeStr: string): string {
  try {
    const [d, m, y] = String(dateStr).split('/')
    if (!d || !m || !y) return new Date().toISOString()
    const base = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    if (!timeStr) return new Date(base).toISOString()
    return new Date(`${base} ${timeStr}`).toISOString()
  } catch { return new Date().toISOString() }
}

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function DailyReloadPage() {
  const [date, setDate]               = useState(today())
  const [summary, setSummary]         = useState<Summary>({ data: [], total: 0, totalAmount: 0, commission: 0 })
  const [loading, setLoading]         = useState(false)
  const [tab, setTab]                 = useState<'upload' | 'manual'>('upload')
  const [uploading, setUploading]     = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const fileRef                       = useRef<HTMLInputElement>(null)

  /* Manual form */
  const [phone,  setPhone]   = useState('')
  const [amount, setAmount]  = useState('')
  const [txId,   setTxId]    = useState('')
  const [agent,  setAgent]   = useState('')
  const [status, setStatus]  = useState('Success')
  const [saving, setSaving]  = useState(false)

  /* ── Fetch ───────────────────────────────────────────────────────────────── */
  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await dailyReloadApi.list({ date })
      setSummary({
        data:        res.data?.data        ?? [],
        total:       res.data?.total       ?? 0,
        totalAmount: res.data?.totalAmount ?? 0,
        commission:  res.data?.commission  ?? 0,
      })
    } catch { toast.error('Failed to load reloads') }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { fetch() }, [fetch])

  /* ── Excel Upload ────────────────────────────────────────────────────────── */
  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { toast.error('Please upload an Excel (.xlsx) file'); return }
    setUploading(true)
    try {
      const xlsx: any = await import('xlsx')
      const buf    = await file.arrayBuffer()
      const wb     = xlsx.read(buf, { type: 'array' })
      const ws     = wb.Sheets[wb.SheetNames[0]]
      const matrix: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })

      /* Skip header row, map columns: A=connNo B=txId C=agent D=date E=time F=status G=amount */
      const rows = (matrix as any[][]).slice(1)
        .map((r) => ({
          connectionNo:  String(r[0] ?? '').trim(),
          transactionId: String(r[1] ?? '').trim(),
          executedBy:    String(r[2] ?? '').trim(),
          date:          parseDateTime(String(r[3] ?? ''), String(r[4] ?? '')),
          status:        String(r[5] ?? 'Success').trim() || 'Success',
          amount:        parseAmt(r[6]),
        }))
        .filter(r => r.connectionNo && r.amount > 0)

      if (rows.length === 0) { toast.error('No valid rows found in the file'); return }

      const res: any = await dailyReloadApi.bulkImport(rows)
      toast.success(`${res.data?.imported ?? rows.length} reloads imported`)
      fetch()
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
        status,
        amount:        parseFloat(amount),
      })
      toast.success('Reload added')
      setPhone(''); setAmount(''); setTxId(''); setAgent(''); setStatus('Success')
      fetch()
    } catch (e: any) { toast.error(e.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  /* ── Delete ──────────────────────────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reload record?')) return
    try {
      await dailyReloadApi.remove(id)
      toast.success('Deleted')
      fetch()
    } catch { toast.error('Delete failed') }
  }

  /* ── Export Excel ────────────────────────────────────────────────────────── */
  const handleExport = async () => {
    try {
      const xlsx: any = await import('xlsx')
      const header = [['Connection No', 'Transaction ID', 'Executed By', 'Date & Time', 'Status', 'Amount (Rs)', 'Commission (3%)']]
      const rows   = summary.data.map(r => [
        r.connectionNo,
        r.transactionId ?? '',
        r.executedBy    ?? '',
        fmtDate(r.reloadDate),
        r.status,
        r.amount,
        Math.round(r.amount * 0.03 * 100) / 100,
      ])
      const footer = [
        [],
        ['', '', '', '', 'Total', summary.totalAmount, summary.commission],
      ]
      const ws = xlsx.utils.aoa_to_sheet([...header, ...rows, ...footer])
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Daily Reload')
      xlsx.writeFile(wb, `DailyReload_${date}_commission.xlsx`)
      toast.success('Report downloaded')
    } catch { toast.error('Export failed') }
  }

  /* ── UI ──────────────────────────────────────────────────────────────────── */
  const successCount = summary.data.filter(r => r.status === 'Success').length

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Daily Reload</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Upload &amp; manage daily mobile top-up transactions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <button onClick={fetch} disabled={loading} className="p-2 rounded-xl border transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            disabled={summary.data.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: PhoneCall,     label: 'Total Reloads',  value: summary.total.toString(),      color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
          { icon: TrendingUp,    label: 'Total Amount',   value: formatAmt(summary.totalAmount), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { icon: TrendingUp,    label: '3% Commission',  value: formatAmt(summary.commission),  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { icon: CheckCircle2,  label: 'Success',        value: `${successCount} / ${summary.total}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
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

      {/* ── Upload + Manual Entry ───────────────────────────────────────────── */}
      <div className="card rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {(['upload', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor:  tab === t ? 'var(--accent)' : 'transparent',
                color:        tab === t ? 'var(--accent)' : 'var(--text-muted)',
                background:   'transparent',
              }}
            >
              {t === 'upload' ? <><FileSpreadsheet size={14} /> Upload Excel</> : <><Plus size={14} /> Manual Entry</>}
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
                style={{ borderColor: dragOver ? 'var(--accent)' : 'var(--border-default)', background: dragOver ? 'rgba(139,92,246,0.05)' : 'transparent' }}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
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
        </div>
      </div>

      {/* ── Data Table ─────────────────────────────────────────────────────── */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Reload Records — {new Date(date).toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
            {summary.total} records
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : summary.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <PhoneCall size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No reload records for this date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                  {['#', 'Connection No', 'Transaction ID', 'Executed By', 'Date & Time', 'Status', 'Amount', 'Commission (3%)', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.data.map((r, i) => (
                  <tr key={r.id} className="border-b transition-colors hover:bg-white/3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{r.connectionNo}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.transactionId || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.executedBy || '—'}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.reloadDate)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                        background: r.status === 'Success' ? 'rgba(16,185,129,0.12)' : r.status === 'Failed' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                        color:      r.status === 'Success' ? '#10b981'               : r.status === 'Failed' ? '#ef4444'               : '#f59e0b',
                      }}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>Rs {r.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">Rs {(r.amount * 0.03).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400" style={{ color: 'var(--text-muted)' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Commission Footer ───────────────────────────────────────────── */}
        {summary.data.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(16,185,129,0.04)' }}>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{formatAmt(summary.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>3% Commission</p>
                <p className="text-lg font-bold text-emerald-400">{formatAmt(summary.commission)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Transactions</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{summary.total}</p>
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
    </div>
  )
}
