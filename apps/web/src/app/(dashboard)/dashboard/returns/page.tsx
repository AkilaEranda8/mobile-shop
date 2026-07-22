'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  RotateCcw, X, Package, Loader2,
  TrendingDown, AlertTriangle,
  CreditCard, Banknote, Smartphone, ArrowUpRight,
  Search, Minus, Plus, Calendar, Hash, User, Receipt,
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
import { useModuleAccess, EditOnly, viewOnlyToast } from '@/lib/module-access'

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

/* ── Return Detail Modal (Sales Details layout) ──────────────────────────── */
function ReturnDetailModal({ ret, onClose }: { ret: any; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const items = ret.items ?? []
  const itemCount = items.reduce((s: number, i: any) => s + Number(i.quantity ?? 0), 0)
  const refundMethodLabel = safeText(ret.refundMethod?.replace('_', ' '))
  const sale = ret.sale ?? {}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2">
            <RotateCcw size={16} className="text-rose-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Return Details ( Return No : <span className="font-mono">{safeText(ret.returnNumber)}</span> )
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {safeText(sale.customerName || 'Walk-in Customer')}
                {sale.invoiceNumber ? ` · Invoice ${sale.invoiceNumber}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25">
              Refunded
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
              Completed
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Top meta row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(formatDate(ret.createdAt))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Return No:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(ret.returnNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Receipt size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Invoice No:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(sale.invoiceNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Refund status:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Refunded</span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Customer name:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(sale.customerName || 'Walk-in Customer')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Items returned:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{itemCount || items.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Reason:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(ret.reason)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Banknote size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Refund method:</span>
                <span className="font-medium inline-flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                  {methodIcon[ret.refundMethod]}
                  {refundMethodLabel}
                </span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>LKR</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Line items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Qty returned</span>
                  <span className="font-medium">{itemCount || items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Original sale</span>
                  <span className="font-medium">{sale.total != null ? formatCurrency(sale.total) : '—'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold">Total Refunded</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(ret.refundAmount ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items + refund info + totals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Returned products */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Returned products
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, idx: number) => {
                        const qty = Number(item.quantity ?? 0)
                        const unit = Number(item.unitPrice ?? 0)
                        const subtotal = Number(item.total ?? qty * unit)
                        return (
                          <tr key={item.id ?? idx} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(item.productName)}</div>
                              {(item.sku || item.imei) && (
                                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                  {item.sku ? safeText(item.sku) : ''}
                                  {item.imei ? `${item.sku ? ' · ' : ''}IMEI ${item.imei}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{qty ? `${qty.toFixed(2)} Qty` : '—'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(unit)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(subtotal)}</td>
                          </tr>
                        )
                      })}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No items</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Refund info */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Refund info
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[560px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Reference No</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Refund mode</th>
                        <th className="px-3 py-2 text-left">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>1</td>
                        <td className="px-3 py-2">{safeText(formatDate(ret.createdAt))}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{safeText(ret.returnNumber)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-rose-600 dark:text-rose-400">
                          {formatCurrency(ret.refundAmount ?? 0)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            {methodIcon[ret.refundMethod]}
                            {refundMethodLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{safeText(ret.notes)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Return reason:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(ret.reason)}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Return note:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(ret.notes)}</p>
                </div>
              </div>
            </div>

            {/* Right column: totals */}
            <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Total</p>
                <p className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(ret.refundAmount ?? 0)}</p>
              </div>
              <div className="p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Products:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Quantity:</span>
                  <span className="font-medium">{itemCount || items.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Refund method:</span>
                  <span className="font-medium">{refundMethodLabel}</span>
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Refunded:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(ret.refundAmount ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Original invoice:</span>
                    <span className="font-medium font-mono">{safeText(sale.invoiceNumber)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold transition-colors"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Returns Page ───────────────────────────────────────────────────── */
export default function ReturnsPage() {
  const { canEdit } = useModuleAccess()
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
    if (action === 'new' || action === 'add' || searchParams.get('new') === '1') {
      if (canEdit) setShowNewReturn(true)
      else viewOnlyToast('POS')
    }
    const id = searchParams.get('id')
    if (!id || !returns.length) return
    const found = returns.find(r => r.id === id)
    if (found) setDetailRet(found)
  }, [canEdit, searchParams, returns])

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
          <EditOnly><OpenPosButton label="New Sale" variant="secondary" /></EditOnly>
          <EditOnly><button onClick={() => setShowNewReturn(true)}
            className="btn-primary text-sm flex items-center gap-2">
            <RotateCcw size={14} />
            New Return
          </button></EditOnly>
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
      {canEdit && showNewReturn && <ProcessReturnModal onClose={() => setShowNewReturn(false)} onDone={load} />}
    </div>
  )
}
