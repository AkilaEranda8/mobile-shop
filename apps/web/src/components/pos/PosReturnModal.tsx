'use client'

import React, { useMemo, useState } from 'react'
import { RotateCcw, X, Loader2, Minus, Plus, Search } from 'lucide-react'
import { salesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { POS_THEME } from './HexaPosLayout'

const RETURN_REASONS = [
  'Defective / Damaged',
  'Wrong Item Delivered',
  'Customer Changed Mind',
  'Duplicate Order',
  'Quality Not as Expected',
  'Other',
]

export function PosReturnModal({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const [step, setStep] = useState<'search' | 'items'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [sale, setSale] = useState<any>(null)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [reason, setReason] = useState(RETURN_REASONS[0])
  const [refundMethod, setRefundMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res: any = await salesApi.list({ search: query, limit: '10' })
      setResults((res?.data ?? []).filter((s: any) => s.status !== 'RETURNED'))
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
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
    } finally {
      setSearching(false)
    }
  }

  const adjust = (id: string, max: number, delta: number) =>
    setQtys(p => ({ ...p, [id]: Math.max(0, Math.min(max, (p[id] ?? 0) + delta)) }))

  const alreadyReturnedQty = useMemo(() => {
    const bySaleItemId: Record<string, number> = {}
    const byProductId: Record<string, number> = {}
    for (const ret of sale?.returns ?? []) {
      for (const ri of ret.items ?? []) {
        const sid = (ri as any).saleItemId as string | undefined
        if (sid) bySaleItemId[sid] = (bySaleItemId[sid] ?? 0) + ri.quantity
        else if (ri.productId) byProductId[ri.productId] = (byProductId[ri.productId] ?? 0) + ri.quantity
      }
    }
    return { bySaleItemId, byProductId }
  }, [sale])

  const selectedItems = (sale?.items ?? []).filter((i: any) => qtys[i.id] > 0)
  const refundAmount = selectedItems.reduce((s: number, i: any) => {
    const unitNet = i.quantity > 0 ? i.total / i.quantity : i.unitPrice
    return s + unitNet * qtys[i.id]
  }, 0)

  const handleSubmit = async () => {
    if (!selectedItems.length) return toast.error('Select at least one item to return')
    setLoading(true)
    try {
      await salesApi.processReturn(sale.id, {
        items: selectedItems.map((i: any) => ({
          saleItemId: i.id,
          quantity: qtys[i.id],
          imei: i.imei,
        })),
        reason,
        refundMethod,
        notes: notes.trim() || undefined,
      })
      toast.success(`Return processed — ${formatCurrency(refundAmount)} refunded`)
      onDone?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Return failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div data-pos="dark" className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: POS_THEME.border }}>
          <div className="flex items-center gap-2">
            <RotateCcw size={15} style={{ color: POS_THEME.amber }} />
            <h3 className="font-bold text-sm text-white">Process Return</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70"><X size={14} /></button>
        </div>

        {step === 'search' ? (
          <div className="p-5 space-y-4">
            <p className="text-xs text-white/60">Search by invoice number, customer name, or phone</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Invoice # or customer…"
                  className="w-full h-10 pl-9 pr-3 rounded-xl text-sm border outline-none text-white placeholder:text-white/40"
                  style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
                />
              </div>
              <button type="button" onClick={search} disabled={searching}
                className="px-4 h-10 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                style={{ background: POS_THEME.purple }}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {results.map(s => (
                <button key={s.id} type="button" onClick={() => selectSale(s)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border hover:bg-white/5 transition-colors"
                  style={{ borderColor: POS_THEME.border }}>
                  <p className="text-xs font-bold text-white">{s.invoiceNumber}</p>
                  <p className="text-[10px] text-white/60">{s.customerName} · {formatCurrency(s.total)} · {new Date(s.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
              {!searching && results.length === 0 && query && (
                <p className="text-center text-xs text-white/40 py-4">No sales found</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <button type="button" onClick={() => { setStep('search'); setSale(null) }} className="text-[11px] text-violet-400 hover:underline">← Back to search</button>
            <div className="rounded-xl border p-3" style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
              <p className="text-xs font-bold text-white">{sale?.invoiceNumber}</p>
              <p className="text-[10px] text-white/60">{sale?.customerName} · {formatCurrency(sale?.total ?? 0)}</p>
            </div>
            <div className="space-y-2">
              {(sale?.items ?? []).map((item: any) => {
                const prev = alreadyReturnedQty.bySaleItemId[item.id] ?? alreadyReturnedQty.byProductId[item.productId] ?? 0
                const maxReturn = Math.max(0, item.quantity - prev)
                if (maxReturn <= 0) return null
                return (
                  <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: POS_THEME.border }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.productName}</p>
                      <p className="text-[10px] text-white/50">{formatCurrency(item.unitPrice)} · max {maxReturn}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => adjust(item.id, maxReturn, -1)} className="w-7 h-7 rounded-md bg-white/5 text-white flex items-center justify-center"><Minus size={10} /></button>
                      <span className="w-6 text-center text-xs font-bold text-white">{qtys[item.id] ?? 0}</span>
                      <button type="button" onClick={() => adjust(item.id, maxReturn, 1)} className="w-7 h-7 rounded-md bg-white/5 text-white flex items-center justify-center"><Plus size={10} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/50 uppercase">Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full mt-1 h-9 px-2 rounded-lg text-xs border outline-none text-white"
                  style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}>
                  {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase">Refund via</label>
                <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
                  className="w-full mt-1 h-9 px-2 rounded-lg text-xs border outline-none text-white"
                  style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}>
                  {['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
              className="w-full h-9 px-3 rounded-lg text-xs border outline-none text-white placeholder:text-white/40"
              style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }} />
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: POS_THEME.border }}>
              <span className="text-sm text-white/60">Refund total</span>
              <span className="text-lg font-extrabold" style={{ color: POS_THEME.green }}>{formatCurrency(refundAmount)}</span>
            </div>
            <button type="button" onClick={handleSubmit} disabled={loading || refundAmount <= 0}
              className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` }}>
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Process Return'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
