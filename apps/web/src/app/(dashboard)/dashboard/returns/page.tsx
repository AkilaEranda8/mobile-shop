'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  RotateCcw, X, Package, Loader2,
  TrendingDown, AlertTriangle,
  CreditCard, Banknote, Smartphone, ArrowUpRight,
  Search, Minus, Plus,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { salesApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { OpenPosButton } from '@/components/pos/OpenPosButton'

const RETURN_REASONS = [
  'Defective / Damaged',
  'Wrong Item Delivered',
  'Customer Changed Mind',
  'Duplicate Order',
  'Quality Not as Expected',
  'Other',
]

const methodIcon: Record<string, React.ReactNode> = {
  CASH:          <Banknote   size={11} />,
  CARD:          <CreditCard size={11} />,
  UPI:           <Smartphone size={11} />,
  BANK_TRANSFER: <ArrowUpRight size={11} />,
}

/* ── Process Return Modal ────────────────────────────────────────────────── */
function ProcessReturnModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step,         setStep]         = useState<'search' | 'items'>('search')
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<any[]>([])
  const [searching,    setSearching]    = useState(false)
  const [sale,         setSale]         = useState<any>(null)
  const [qtys,         setQtys]         = useState<Record<string, number>>({})
  const [reason,       setReason]       = useState(RETURN_REASONS[0])
  const [refundMethod, setRefundMethod] = useState('CASH')
  const [notes,        setNotes]        = useState('')
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res: any = await salesApi.list({ search: query, limit: '10' })
      const data = (res?.data ?? []).filter((s: any) => s.status !== 'RETURNED')
      setResults(data)
    } catch { /* silent */ }
    finally { setSearching(false) }
  }

  const selectSale = async (s: any) => {
    setSearching(true)
    try {
      const full: any = await salesApi.getById(s.id)
      const fullSale = full?.data ?? full
      setSale(fullSale)
      setQtys(Object.fromEntries((fullSale.items ?? []).map((i: any) => [i.id, 0])))
      setStep('items')
    } catch {
      setSale(s)
      setQtys(Object.fromEntries((s.items ?? []).map((i: any) => [i.id, 0])))
      setStep('items')
    } finally { setSearching(false) }
  }

  const adjust = (id: string, max: number, delta: number) =>
    setQtys(p => ({ ...p, [id]: Math.max(0, Math.min(max, (p[id] ?? 0) + delta)) }))

  // Compute already-returned qty per productId from prior returns
  const alreadyReturnedQty = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ret of (sale?.returns ?? [])) {
      for (const ri of (ret.items ?? [])) {
        if (ri.productId) map[ri.productId] = (map[ri.productId] ?? 0) + ri.quantity
      }
    }
    return map
  }, [sale])

  const selectedItems = (sale?.items ?? []).filter((i: any) => qtys[i.id] > 0)
  // Prorated refund: use (item.total / item.quantity) to account for per-item discounts
  const refundAmount  = selectedItems.reduce((s: number, i: any) => {
    const unitNet = i.quantity > 0 ? i.total / i.quantity : i.unitPrice
    return s + unitNet * qtys[i.id]
  }, 0)

  const handleSubmit = async () => {
    if (!selectedItems.length) return toast.error('Select at least one item to return')
    setLoading(true)
    try {
      await salesApi.processReturn(sale.id, {
        items: selectedItems.map((i: any) => {
          const unitNet = i.quantity > 0 ? i.total / i.quantity : i.unitPrice
          return {
            productId:   i.productId,
            productName: i.productName,
            quantity:    qtys[i.id],
            unitPrice:   i.unitPrice,
            imei:        i.imei,
            total:       unitNet * qtys[i.id],
          }
        }),
        reason,
        refundMethod,
        notes: notes || undefined,
      })
      toast.success('Return processed — stock restored & refund recorded')
      onDone(); onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to process return')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0f1623] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-orange-500" />

        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
              <RotateCcw size={15} className="text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">New Return</h3>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {step === 'search' ? 'Search invoice to process return' : `${sale?.invoiceNumber} · ${sale?.customerName || 'Walk-in Customer'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {step === 'search' ? (
            <>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Search by invoice # or customer name..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                />
                <button onClick={search} disabled={searching}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                  {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  Search
                </button>
              </div>

              {results.length > 0 && (
                <div className="space-y-2">
                  {results.map((s: any) => (
                    <button key={s.id} onClick={() => selectSale(s)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/5 hover:border-rose-400 hover:bg-rose-50 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/5 transition-all text-left">
                      <div>
                        <p className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">{s.invoiceNumber}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{s.customerName || 'Walk-in'} · {s.items?.length ?? 0} items</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(s.total)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.length === 0 && query && !searching && (
                <p className="text-center text-xs text-gray-400 dark:text-slate-500 py-4">No returnable orders found</p>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setStep('search'); setResults([]); }}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                ← Back to search
              </button>

              <div>
                <p className="text-xs text-gray-400 dark:text-slate-400 uppercase tracking-wide mb-2 font-semibold">Select items to return</p>
                <div className="space-y-2">
                  {(sale?.items ?? []).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.productName}</p>
                        <p className="text-[10px] text-gray-500 dark:text-slate-500">
                          Sold: {item.quantity}{(alreadyReturnedQty[item.productId] ?? 0) > 0 ? ` · Already returned: ${alreadyReturnedQty[item.productId]}` : ''} · {formatCurrency(item.quantity > 0 ? item.total / item.quantity : item.unitPrice)} each
                        </p>
                        {item.imei && <p className="text-[9px] font-mono text-violet-400">IMEI: {item.imei}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button onClick={() => adjust(item.id, item.quantity - (alreadyReturnedQty[item.productId] ?? 0), -1)}
                          className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-white/10 border border-gray-200 dark:border-transparent flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-rose-500">
                          <Minus size={10} />
                        </button>
                        <span className={`w-7 text-center text-sm font-bold ${qtys[item.id] > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-gray-400 dark:text-slate-500'}`}>
                          {qtys[item.id]}
                        </span>
                        <button onClick={() => adjust(item.id, item.quantity - (alreadyReturnedQty[item.productId] ?? 0), +1)}
                          className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-white/10 border border-gray-200 dark:border-transparent flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-rose-500">
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Return Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)} className="input-field">
                  {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Refund Method</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['CASH','CARD','UPI','BANK_TRANSFER'].map(m => (
                    <button key={m} type="button" onClick={() => setRefundMethod(m)}
                      className={`py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                        refundMethod === m
                          ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-300'
                          : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-500 hover:border-rose-300 hover:text-rose-500 dark:hover:border-white/20 dark:hover:text-slate-300'
                      }`}>{m.replace('_',' ')}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Notes (optional)</label>
                <input className="input-field" placeholder="Additional details..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {refundAmount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-rose-500 dark:text-rose-400" />
                    <span className="text-xs text-rose-600 dark:text-rose-300 font-medium">Refund amount</span>
                  </div>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(refundAmount)}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 text-sm py-2 px-4 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 font-medium transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={loading || !selectedItems.length}
                  className="flex-1 text-sm flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-rose-200">
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  {loading ? 'Processing...' : 'Process Return'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Return Detail Modal ─────────────────────────────────────────────────── */
function ReturnDetailModal({ ret, onClose }: { ret: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0f1623] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-orange-500" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
              <RotateCcw size={15} className="text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{ret.returnNumber}</h3>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                {ret.sale?.invoiceNumber} · {ret.sale?.customerName || 'Walk-in'} · {formatDate(ret.createdAt)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Returned Items */}
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Returned Items</p>
            <div className="space-y-2">
              {(ret.items ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center">
                      <Package size={12} className="text-rose-500 dark:text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.productName}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-500">Qty: {item.quantity} × {formatCurrency(item.unitPrice)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reason + Refund */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/5">
              <p className="text-[10px] text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{ret.reason}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/5">
              <p className="text-[10px] text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Refund Method</p>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 dark:text-slate-400">{methodIcon[ret.refundMethod]}</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{ret.refundMethod?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Refund amount */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-500 dark:text-rose-400" />
              <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">Total Refunded</span>
            </div>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(ret.refundAmount)}</span>
          </div>

          {ret.notes && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/5">
              <p className="text-[10px] text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 italic">{ret.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Returns Page ───────────────────────────────────────────────────── */
export default function ReturnsPage() {
  const searchParams = useSearchParams()
  const [returns,    setReturns]    = useState<any[]>([])
  const [meta,       setMeta]       = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [detailRet,     setDetailRet]     = useState<any>(null)
  const [showNewReturn, setShowNewReturn] = useState(false)
  const [textSearch, setTextSearch] = useState('')

  const openDetail = useCallback((ret: any) => setDetailRet(ret), [])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new' || action === 'add' || searchParams.get('new') === '1') setShowNewReturn(true)
    const id = searchParams.get('id')
    if (!id || !returns.length) return
    const found = returns.find(r => r.id === id)
    if (found) setDetailRet(found)
  }, [searchParams, returns])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await salesApi.listReturns({ limit: '500' })
      setReturns(res?.data ?? [])
      setMeta(res?.meta ?? null)
    } catch { toast.error('Failed to load returns') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const totalRefunded  = returns.reduce((s, r) => s + (r.refundAmount ?? 0), 0)
  const totalItems     = returns.reduce((s, r) => s + (r.items ?? []).reduce((a: number, i: any) => a + (i.quantity ?? 1), 0), 0)

  const reasonCounts = useMemo(() => {
    const m: Record<string, number> = {}
    returns.forEach(r => { m[r.reason] = (m[r.reason] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [returns])

  const filteredReturns = useMemo(() => {
    const q = textSearch.trim().toLowerCase()
    if (!q) return returns
    return returns.filter(r =>
      r.returnNumber?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.sale?.invoiceNumber?.toLowerCase().includes(q) ||
      r.sale?.customerName?.toLowerCase().includes(q)
    )
  }, [returns, textSearch])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'returnNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Return #" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="font-mono text-xs text-rose-600 dark:text-rose-400 hover:underline"
          onClick={() => openDetail(row.original)}
        >
          {row.original.returnNumber}
        </button>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs text-foreground/80 whitespace-nowrap">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'invoice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-mono text-violet-500">{row.original.sale?.invoiceNumber ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground">{row.original.sale?.customerName || 'Walk-in'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'reason',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
      cell: ({ row }) => (
        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 font-medium">
          {row.original.reason}
        </span>
      ),
    },
    {
      id: 'items',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-foreground/80">
          {row.original.items?.length ?? 0} item{row.original.items?.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      accessorKey: 'refundMethod',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-foreground/70">
          {methodIcon[row.original.refundMethod]}
          <span>{row.original.refundMethod?.replace('_', ' ')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'refundAmount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Refund" />,
      cell: ({ row }) => (
        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(row.original.refundAmount)}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <TableActionsRow showAction={{ action: () => openDetail(row.original) }} />
      ),
    },
  ], [openDetail])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Returns</h1>
          <p className="page-subtitle">Track all product returns and refunds</p>
        </div>
        <div className="flex items-center gap-2">
          <OpenPosButton label="New Sale" variant="secondary" />
          <button onClick={() => setShowNewReturn(true)}
            className="btn-primary text-sm flex items-center gap-2">
            <RotateCcw size={14} />
            New Return
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Returns',   value: String(meta?.total ?? returns.length), icon: RotateCcw,   color: 'rose'   },
          { label: 'Total Refunded',  value: formatCurrency(totalRefunded),          icon: TrendingDown, color: 'orange' },
          { label: 'Items Returned',  value: String(totalItems),                     icon: Package,      color: 'slate'  },
          { label: 'Top Reason',      value: reasonCounts[0]?.[0]?.split(' /')[0] ?? '—', icon: AlertTriangle, color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20 flex-shrink-0`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground truncate">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <ToolbarSearch
        value={textSearch}
        onChange={setTextSearch}
        placeholder="Search return #, invoice, reason…"
        className="max-w-md"
      />

      {/* Table */}
      <ClientSideTable
        data={filteredReturns}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((filteredReturns.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />

      {detailRet     && <ReturnDetailModal ret={detailRet} onClose={() => setDetailRet(null)} />}
      {showNewReturn && <ProcessReturnModal onClose={() => setShowNewReturn(false)} onDone={load} />}
    </div>
  )
}
