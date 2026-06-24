'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Truck, Phone, Mail, Package, Eye, Edit, Loader2, X, ChevronDown, Trash2, FileText, MapPin, Globe, Hash, ShoppingBag, TrendingUp, AlertCircle, Calendar, CheckCircle, Save, PackageCheck, ShieldAlert, CreditCard, Banknote, Receipt, Smartphone, ClipboardList } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders, useProducts } from '@/lib/hooks'
import { suppliersApi, branchesApi, imeiApi } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Supplier, PurchaseOrder, POItem } from '@/types'

/* ── IMEI Register Modal ─────────────────────────────────────────── */
function IMEIRegisterModal({ po, onClose, onSaved }: { po: PurchaseOrder; onClose: () => void; onSaved: (poId: string) => void }) {
  const [branches, setBranches] = useState<any[]>([])
  const [defaultBranch, setDefaultBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanValue, setScanValue] = useState('')

  // Build item sections keyed by "productId::storage::colorName"
  const itemsWithId = po.items.filter(i => i.productId)
  const itemKey = (item: POItem) =>
    `${item.productId}::${item.storage ?? ''}::${item.colorName ?? ''}`

  // imeis[itemKey] = string[] (one per unit)
  const [imeis, setImeis] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const item of itemsWithId) {
      init[itemKey(item)] = Array(item.quantity).fill('')
    }
    return init
  })

  useEffect(() => {
    branchesApi.list().then((r: any) => {
      const list = r.data ?? []
      setBranches(list)
      setDefaultBranch(list[0]?.id ?? '')
    }).catch(() => {})
  }, [])

  const setImei = (key: string, idx: number, val: string) =>
    setImeis(prev => ({ ...prev, [key]: prev[key].map((v, i) => i === idx ? val : v) }))

  // Fill next empty IMEI slot from scanner
  const handleScan = (scanned: string) => {
    const trimmed = scanned.trim()
    if (!trimmed) return
    let filled = false
    setImeis(prev => {
      const next = { ...prev }
      outer: for (const key of Object.keys(next)) {
        const arr = [...next[key]]
        for (let i = 0; i < arr.length; i++) {
          if (!arr[i]) { arr[i] = trimmed; next[key] = arr; filled = true; break outer }
        }
      }
      return next
    })
    setScanValue('')
    if (!filled) toast('All slots filled — scroll down to check')
  }

  const handlePaste = (key: string, idx: number, text: string) => {
    const lines = text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean)
    if (lines.length > 1) {
      setImeis(prev => {
        const arr = [...prev[key]]
        lines.forEach((line, i) => { if (idx + i < arr.length) arr[idx + i] = line })
        return { ...prev, [key]: arr }
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const entries: { productId: string; branchId: string; imei: string; variation?: string | null }[] = []
    // Map key back to productId
    for (const item of itemsWithId) {
      const key = itemKey(item)
      const variationLabel = item.sku || `${item.storage}::${item.colorName}`
      for (const imei of (imeis[key] ?? [])) {
        if (imei.trim()) entries.push({ productId: item.productId, branchId: defaultBranch, imei: imei.trim(), variation: variationLabel })
      }
    }
    if (!entries.length) { toast.error('Enter at least one IMEI'); return }
    setLoading(true)
    try {
      const r: any = await suppliersApi.registerPoImei(po.id, entries)
      toast.success(r.message ?? `${r.data?.created ?? 0} IMEI(s) registered`)
      if ((r.data?.errors?.length ?? 0) > 0) toast.error(`Errors: ${r.data.errors.join(', ')}`)
      onSaved(po.id)
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to register IMEIs')
    } finally {
      setLoading(false)
    }
  }

  // Color dot helper
  const colorDot = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('black'))                                 return '#1a1a1a'
    if (n.includes('white') || n.includes('silver') || n.includes('star')) return '#e2e8f0'
    if (n.includes('gold')  || n.includes('yellow'))        return '#f59e0b'
    if (n.includes('red')   || n.includes('rose'))          return '#ef4444'
    if (n.includes('blue')  || n.includes('sky'))           return '#3b82f6'
    if (n.includes('green') || n.includes('midnight'))      return '#10b981'
    if (n.includes('purple')|| n.includes('violet'))        return '#8b5cf6'
    if (n.includes('pink'))                                  return '#ec4899'
    if (n.includes('orange'))                                return '#f97316'
    return '#6b7280'
  }

  // Filled count
  const totalSlots  = Object.values(imeis).flat().length
  const filledSlots = Object.values(imeis).flat().filter(v => v.length === 15).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Smartphone size={16} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Register IMEIs</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                PO {po.poNumber} — {filledSlots}/{totalSlots} slots filled
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">

          {/* Scan bar */}
          <div className="flex gap-2 items-center p-3 rounded-xl border border-violet-500/20 bg-violet-500/5">
            <Hash size={13} className="text-violet-400 flex-shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm font-mono tracking-widest placeholder:text-[var(--text-muted)] placeholder:opacity-50"
              style={{ color: 'var(--text-primary)' }}
              placeholder="Scan or type IMEI then press Enter..."
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScan(scanValue) } }}
              maxLength={15}
            />
            {scanValue.length === 15 && <span className="text-[10px] text-green-400 font-bold">✓ VALID</span>}
          </div>

          {/* Branch selector */}
          {branches.length > 1 && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Branch</label>
              <select className="input-field" value={defaultBranch} onChange={e => setDefaultBranch(e.target.value)}>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {itemsWithId.length === 0 && (
            <p className="text-xs text-amber-400 text-center py-4">No linked products in this PO. Assign products first.</p>
          )}

          {/* One card per variation line item */}
          {itemsWithId.map(item => {
            const key = itemKey(item)
            const slots = imeis[key] ?? []
            const filled = slots.filter(v => v.length === 15).length
            return (
              <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>

                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.productName}</p>
                    {/* Variation badges */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {item.storage && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                          style={{ background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.2)', color: 'var(--text-primary)' }}>
                          {item.storage}
                        </span>
                      )}
                      {item.colorName && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                          <span className="w-2 h-2 rounded-full border border-[var(--border-default)] flex-shrink-0"
                            style={{ background: colorDot(item.colorName) }} />
                          {item.colorName}
                        </span>
                      )}
                      {item.sku && (
                        <span className="text-[10px] font-mono"
                          style={{ background: 'rgba(139,92,246,0.08)', color: 'var(--text-primary)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(139,92,246,0.2)' }}>
                          {item.sku}
                        </span>
                      )}
                      {!item.storage && !item.colorName && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No variation</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      {item.quantity} units
                    </span>
                    <span className={`text-[10px] font-semibold ${filled === item.quantity ? 'text-green-400' : 'text-slate-500'}`}>
                      {filled}/{item.quantity} filled
                    </span>
                  </div>
                </div>

                {/* IMEI input grid */}
                <div className="p-4 space-y-3">
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Paste multiple IMEIs separated by newlines or enter one per field
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((val, idx) => (
                      <div key={idx}>
                        <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Unit {idx + 1}</label>
                        <input
                          className={`input-field font-mono text-xs tracking-wider w-full placeholder:text-[var(--text-muted)] placeholder:opacity-50 ${
                            val.length === 15 ? 'border-green-500/40' : val.length > 0 ? 'border-red-500/40' : ''
                          }`}
                          placeholder="000000000000000"
                          maxLength={15}
                          value={val}
                          onChange={e => setImei(key, idx, e.target.value)}
                          onPaste={e => {
                            const text = e.clipboardData.getData('text')
                            if (text.includes('\n') || text.includes(',')) {
                              e.preventDefault()
                              handlePaste(key, idx, text)
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Progress bar */}
          {totalSlots > 0 && (
            <div className="rounded-xl p-3 border" style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.15)' }}>
              <div className="flex justify-between text-[10px] mb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Overall progress</span>
                <span className={filledSlots === totalSlots ? 'text-green-400 font-bold' : 'text-violet-400'}>
                  {filledSlots} / {totalSlots} IMEIs
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border-default)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(filledSlots / totalSlots) * 100}%`, background: filledSlots === totalSlots ? '#22c55e' : '#8b5cf6' }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading || itemsWithId.length === 0}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
              Register IMEIs
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


/* ── Record Payment Modal ────────────────────────────────────────── */
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD'] as const

function RecordPaymentModal({ supplier, allPOs, onClose, onSaved }: {
  supplier: Supplier
  allPOs: PurchaseOrder[]
  onClose: () => void
  onSaved: () => void
}) {
  const unpaidPOs = allPOs.filter(po => po.supplierId === supplier.id && po.dueAmount > 0)
  const [selectedPOs, setSelectedPOs] = useState<Set<string>>(new Set(unpaidPOs.map(p => p.id)))
  const [method,    setMethod]    = useState<string>('CASH')
  const [reference, setReference] = useState('')
  const [loading,   setLoading]   = useState(false)

  const totalDue = unpaidPOs
    .filter(p => selectedPOs.has(p.id))
    .reduce((s, p) => s + p.dueAmount, 0)
  const [amount, setAmount] = useState(String(totalDue.toFixed(2)))

  const togglePO = (id: string) =>
    setSelectedPOs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setLoading(true)
    try {
      await suppliersApi.recordPayment(supplier.id, {
        amount:    Number(amount),
        method,
        reference: reference || undefined,
        poIds:     [...selectedPOs],
      })
      toast.success('Payment recorded successfully')
      onSaved(); onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to record payment')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-emerald-500" />
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Banknote size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Record Payment</h3>
              <p className="text-xs text-slate-500">{supplier.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Outstanding POs */}
          {unpaidPOs.length > 0 ? (
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">Apply to Purchase Orders</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {unpaidPOs.map(po => (
                  <label key={po.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedPOs.has(po.id)
                      ? 'bg-violet-500/10 border-violet-500/30'
                      : 'bg-white/3 border-white/5 hover:border-white/10'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" checked={selectedPOs.has(po.id)} onChange={() => togglePO(po.id)}
                        className="accent-violet-500" />
                      <span className="text-xs font-mono text-violet-300">{po.poNumber}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-red-400">{formatCurrency(po.dueAmount)} due</p>
                      <p className="text-[10px] text-slate-600">{formatCurrency(po.total)} total</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle size={13} className="text-emerald-400" />
              <p className="text-xs text-emerald-400">No outstanding POs — full payment will be recorded</p>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Payment Amount
              {totalDue > 0 && (
                <button type="button" onClick={() => setAmount(totalDue.toFixed(2))}
                  className="ml-2 text-violet-400 hover:text-violet-300 text-[10px]">
                  Fill {formatCurrency(totalDue)}
                </button>
              )}
            </label>
            <input required type="number" min="0.01" step="0.01"
              className="input-field" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Payment Method</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                    method === m
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                  }`}>
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Reference / Note (optional)</label>
            <input className="input-field" placeholder="Cheque no., bank ref…" value={reference} onChange={e => setReference(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Receipt size={13} />}
              {loading ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Confirm Receive Modal ────────────────────────────────────────── */
function ConfirmReceiveModal({ po, onConfirm, onCancel, loading }: {
  po: PurchaseOrder
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const isRetroactive = po.status === 'RECEIVED'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className={`h-1 w-full ${isRetroactive ? 'bg-amber-500' : 'bg-green-500'}`} />

        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isRetroactive ? 'bg-amber-500/15 border border-amber-500/20' : 'bg-green-500/15 border border-green-500/20'
          }`}>
            {isRetroactive
              ? <ShieldAlert size={22} className="text-amber-400" />
              : <PackageCheck size={22} className="text-green-400" />}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-white text-center mb-1">
            {isRetroactive ? 'Apply Restock?' : 'Receive Purchase Order?'}
          </h3>
          <p className="text-xs text-slate-500 text-center mb-5">
            {isRetroactive
              ? 'This PO is already marked RECEIVED. Restock will only run if it was not applied before.'
              : 'This will mark the order as received and add all items to your inventory stock.'}
          </p>

          {/* PO summary */}
          <div className="bg-white/3 border border-white/5 rounded-xl p-3.5 mb-5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">PO Number</span>
              <span className="font-mono text-violet-300 font-semibold">{po.poNumber}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Supplier</span>
              <span className="text-slate-200">{po.supplierName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Items</span>
              <span className="text-slate-200">{po.items?.length ?? 0} item{(po.items?.length ?? 0) !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Value</span>
              <span className="text-white font-bold">{formatCurrency(po.total)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                isRetroactive
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
              }`}>
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <CheckCircle size={14} />}
              {loading ? 'Processing…' : 'Yes, Receive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const poStatusColors: Record<string, string> = {
  DRAFT:    'bg-slate-500/10 border-slate-500/20 text-slate-400',
  SENT:     'bg-blue-500/10 border-blue-500/20 text-blue-400',
  PARTIAL:  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  RECEIVED: 'bg-green-500/10 border-green-500/20 text-green-400',
  CLOSED:   'bg-violet-500/10 border-violet-500/20 text-violet-400',
}

/* ── Supplier Details Modal ─────────────────────────────────────────── */
function SupplierDetailsModal({ supplier, allPOs, onClose, onEdit }: { supplier: Supplier; allPOs: PurchaseOrder[]; onClose: () => void; onEdit: () => void }) {
  const supplierPOs = allPOs.filter(p => p.supplierId === supplier.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const totalPaid = supplierPOs.reduce((s, p) => s + (p.paidAmount ?? 0), 0)
  const totalDue  = supplierPOs.reduce((s, p) => s + (p.dueAmount ?? 0), 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-base font-bold text-violet-300">
              {supplier.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{supplier.name}</h3>
              {supplier.contactName && <p className="text-xs text-slate-500">{supplier.contactName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
              <Edit size={11} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: ShoppingBag,  label: 'Orders',       value: String(supplier.totalOrders),                       cls: 'text-violet-400'  },
              { icon: TrendingUp,   label: 'Total Value',  value: formatCurrency(supplier.totalPurchaseValue ?? 0),   cls: 'text-emerald-400' },
              { icon: CreditCard,   label: 'Paid',         value: formatCurrency(totalPaid),                          cls: 'text-green-400'   },
              { icon: AlertCircle,  label: 'Outstanding',  value: formatCurrency(totalDue),                           cls: totalDue > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(({ icon: Icon, label, value, cls }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3 text-center border border-white/5">
                <Icon size={13} className={`mx-auto mb-1 ${cls}`} />
                <p className={`text-sm font-bold ${cls}`}>{value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Contact details */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-2.5">
            {[
              supplier.phone    && { icon: Phone,   label: 'Phone',   value: supplier.phone },
              supplier.email    && { icon: Mail,    label: 'Email',   value: supplier.email },
              supplier.address  && { icon: MapPin,  label: 'Address', value: supplier.address },
              supplier.city     && { icon: Globe,   label: 'City',    value: supplier.city },
              supplier.gstin    && { icon: Hash,    label: 'GSTIN',   value: supplier.gstin },
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 flex items-start justify-between gap-4">
                  <span className="text-[11px] text-slate-500 w-14 flex-shrink-0">{row.label}</span>
                  <span className="text-xs text-slate-200 text-right">{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Status + created */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {supplier.isActive
                ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={11} />Active</span>
                : <span className="flex items-center gap-1 text-red-400"><X size={11} />Inactive</span>}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar size={11} />
              <span>Joined {formatDate(supplier.createdAt)}</span>
            </div>
          </div>

          {/* ── Ledger ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><Receipt size={10} />Purchase Order Ledger</p>
            {supplierPOs.length === 0 ? (
              <p className="text-xs text-center text-slate-600 py-6">No purchase orders yet</p>
            ) : (
              <div className="space-y-1.5">
                {supplierPOs.map(po => (
                  <div key={po.id} className="bg-white/3 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-violet-400">{po.poNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${poStatusColors[po.status] ?? 'text-slate-400 bg-white/5 border-white/10'}`}>{po.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={9} />{formatDate(po.createdAt)}</p>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">{formatCurrency(po.total)}</p>
                        {po.dueAmount > 0 && <p className="text-[10px] text-red-400">Due: {formatCurrency(po.dueAmount)}</p>}
                        {po.paidAmount > 0 && <p className="text-[10px] text-green-400">Paid: {formatCurrency(po.paidAmount)}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Supplier Modal ─────────────────────────────────────────────── */
function EditSupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier; onClose: () => void; onSaved: () => void }) {
  const [form, setForm]   = useState({
    name:        supplier.name        ?? '',
    contactName: supplier.contactName ?? '',
    phone:       supplier.phone       ?? '',
    email:       supplier.email       ?? '',
    city:        supplier.city        ?? '',
    address:     supplier.address     ?? '',
    gstin:       supplier.gstin       ?? '',
  })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await suppliersApi.update(supplier.id, form)
      toast.success('Supplier updated')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-sm font-bold text-white">Edit Supplier</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'name',        label: 'Supplier Name *', full: true  },
              { k: 'contactName', label: 'Contact Name',    full: false },
              { k: 'phone',       label: 'Phone',           full: false },
              { k: 'email',       label: 'Email',           full: false },
              { k: 'city',        label: 'City',            full: false },
              { k: 'address',     label: 'Address',         full: true  },
              { k: 'gstin',       label: 'GSTIN / VAT No',  full: false },
            ].map(({ k, label, full }) => (
              <div key={k} className={full ? 'col-span-2' : ''}>
                <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                <input
                  className="input-field"
                  value={(form as any)[k]}
                  onChange={f(k)}
                  required={k === 'name'}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Add Supplier Modal ──────────────────────────────────────────────── */
function AddSupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', city: '', address: '', gstin: '' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await suppliersApi.create(form)
      toast.success('Supplier added')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed to add supplier') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Supplier</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Company Name *</label>
              <input required className="input-field" placeholder="Apple India Pvt Ltd" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Contact Person</label>
              <input className="input-field" placeholder="Rajesh Kumar" value={form.contactName} onChange={f('contactName')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input required className="input-field" placeholder="9876543210" value={form.phone} onChange={f('phone')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="supplier@email.com" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">City</label>
              <input className="input-field" placeholder="Chennai" value={form.city} onChange={f('city')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Address</label>
              <input className="input-field" placeholder="Street address" value={form.address} onChange={f('address')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">GSTIN</label>
              <input className="input-field" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={f('gstin')} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── New PO Modal ────────────────────────────────────────────────────── */
function NewPOModal({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [supplierId, setSupplierId]   = useState(suppliers[0]?.id ?? '')
  const [expectedDelivery, setExpDel] = useState('')
  const [notes, setNotes]             = useState('')
  const [items, setItems] = useState<{
    productId: string
    productName: string
    quantity: number
    unitCost: number
    storage?: string
    colorName?: string
    sku?: string
    _variations?: any[]
  }[]>([])
  const [loading, setLoading]         = useState(false)
  const [searches, setSearches]       = useState<string[]>([])
  const [openIdx, setOpenIdx]         = useState<number | null>(null)
  const [quickSearch, setQuickSearch] = useState('')
  const [quickOpen, setQuickOpen]     = useState(false)
  const [branches, setBranches]       = useState<{id:string;name:string}[]>([])
  const [branchId, setBranchId]       = useState('')

  useEffect(() => {
    branchesApi.list().then((res: any) => {
      const list = (res.data ?? res) as {id:string;name:string;isActive:boolean}[]
      const active = list.filter(b => b.isActive)
      setBranches(active)
      if (active.length > 0) setBranchId(active[0].id)
    }).catch(() => {})
  }, [])

  const { data: productsData } = useProducts({ limit: '200' })
  const allProducts: any[] = (productsData?.data ?? []) as any[]

  const getFiltered = (i: number) => {
    const q = (searches[i] ?? '').toLowerCase()
    if (!q) return allProducts.slice(0, 10)
    return allProducts.filter(p =>
      String(p.name ?? '').toLowerCase().includes(q) ||
      String(p.sku ?? '').toLowerCase().includes(q) ||
      String(p.brandName ?? '').toLowerCase().includes(q)
    ).slice(0, 10)
  }

  const selectProduct = (i: number, product: any) => {
    const vars: any[] = Array.isArray(product.storageVariations) ? product.storageVariations : []
    const firstVar = vars[0]
    setItems(prev => prev.map((row, idx) =>
      idx === i ? {
        ...row,
        productId:   product.id,
        productName: product.name,
        unitCost:    firstVar?.costPrice ?? product.buyingPrice ?? 0,
        _variations: vars,
        storage:     firstVar?.storage ?? undefined,
        colorName:   firstVar?.colorName ?? undefined,
        sku:         firstVar?.sku ?? undefined,
      } : row
    ))
    setSearches(prev => prev.map((s, idx) => idx === i ? product.name : s))
    setOpenIdx(null)
  }

  const updateItem = (i: number, k: string, v: string | number) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row))

  const addItem = () => {
    setItems(p => [...p, { productId: '', productName: '', quantity: 1, unitCost: 0, _variations: [] }])
    setSearches(p => [...p, ''])
  }

  const quickAddProduct = (product: any) => {
    const vars: any[] = Array.isArray(product.storageVariations) ? product.storageVariations : []
    const firstVar = vars[0]
    const existing = items.findIndex(r => r.productId === product.id && !r.storage)
    if (existing >= 0 && vars.length === 0) {
      setItems(prev => prev.map((r, i) => i === existing ? { ...r, quantity: r.quantity + 1 } : r))
    } else {
      setItems(p => [...p, {
        productId:   product.id,
        productName: product.name,
        quantity:    1,
        unitCost:    firstVar?.costPrice ?? product.buyingPrice ?? 0,
        _variations: vars,
        storage:     firstVar?.storage ?? undefined,
        colorName:   firstVar?.colorName ?? undefined,
        sku:         firstVar?.sku ?? undefined,
      }])
      setSearches(p => [...p, product.name])
    }
    setQuickSearch('')
    setQuickOpen(false)
  }

  const quickFiltered = quickSearch.trim()
    ? allProducts.filter(p =>
        String(p.name ?? '').toLowerCase().includes(quickSearch.toLowerCase()) ||
        String(p.sku ?? '').toLowerCase().includes(quickSearch.toLowerCase()) ||
        String(p.brandName ?? '').toLowerCase().includes(quickSearch.toLowerCase())
      ).slice(0, 8)
    : allProducts.slice(0, 8)

  const removeItem = (i: number) => {
    setItems(p => p.filter((_, idx) => idx !== i))
    setSearches(p => p.filter((_, idx) => idx !== i))
  }

  const subtotal = items.reduce((s, r) => s + Number(r.quantity) * Number(r.unitCost), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const selectedSupplier = suppliers.find(s => s.id === supplierId)
      await suppliersApi.createPO({
        supplierId,
        supplierName: selectedSupplier?.name ?? '',
        items: items.map(r => ({
          productId:        r.productId   || undefined,
          productName:      r.productName,
          quantity:         Number(r.quantity),
          unitCost:         Number(r.unitCost),
          total:            Number(r.quantity) * Number(r.unitCost),
          receivedQuantity: 0,
          storage:          r.storage   || undefined,
          colorName:        r.colorName || undefined,
          sku:              r.sku       || undefined,
        })),
        branchId: branchId || undefined,
        subtotal,
        tax: 0,
        total: subtotal,
        paidAmount: 0,
        dueAmount: subtotal,
        expectedDelivery: expectedDelivery || undefined,
        notes,
        status: 'DRAFT',
      })
      toast.success('Purchase Order created')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed to create PO') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">New Purchase Order</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Supplier + delivery */}
          <div className="grid grid-cols-2 gap-4">
            {branches.length > 1 && (
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">Branch *</label>
                <select className="input-field" value={branchId} onChange={e => setBranchId(e.target.value)}>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Supplier *</label>
              {suppliers.length === 0
                ? <p className="text-xs text-red-400">No suppliers yet — add one first</p>
                : <select className="input-field" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
              }
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Expected Delivery</label>
              <input type="date" className="input-field" value={expectedDelivery} onChange={e => setExpDel(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Notes</label>
              <input className="input-field" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Items *</label>
            </div>

            {/* Quick product search */}
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input
                className="input-field pl-8 text-sm w-full"
                placeholder="Search & add product…"
                value={quickSearch}
                onChange={e => { setQuickSearch(e.target.value); setQuickOpen(true) }}
                onFocus={() => setQuickOpen(true)}
                onBlur={() => setTimeout(() => setQuickOpen(false), 150)}
              />
              {quickOpen && quickFiltered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-2xl z-50 overflow-hidden max-h-52 overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {quickFiltered.map((p: any) => (
                    <button key={p.id} type="button"
                      onMouseDown={() => quickAddProduct(p)}
                      className="w-full px-3 py-2.5 text-left hover:bg-violet-500/15 transition-colors flex items-center justify-between gap-2"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate font-medium">{p.name}</p>
                        <p className="text-[10px] text-slate-500">{p.sku} · {p.brandName}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-2">
                        <div>
                          <p className="text-xs text-violet-400 font-semibold">{formatCurrency(p.buyingPrice)}</p>
                          <p className="text-[10px] text-slate-600">stock: {p.stock}</p>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                          <Plus size={12} className="text-violet-400" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 mb-1 px-2">
              <span className="col-span-5 text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Product</span>
              <span className="col-span-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wide text-center">Qty</span>
              <span className="col-span-3 text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Unit Cost</span>
              <span className="col-span-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wide text-right">Total</span>
            </div>

            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div key={i} className="rounded-xl border overflow-visible" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>

                  {/* ── Main row ── */}
                  <div className="grid grid-cols-12 gap-3 items-start p-2">

                    {/* Product search */}
                    <div className="col-span-5">
                      <div className="relative">
                        <input
                          required
                          className="input-field text-sm w-full"
                          placeholder="Search product..."
                          value={searches[i] ?? ''}
                          onFocus={() => setOpenIdx(i)}
                          onChange={e => {
                            const v = e.target.value
                            setSearches(prev => prev.map((s, idx) => idx === i ? v : s))
                            setItems(prev => prev.map((row, idx) => idx === i ? { ...row, productName: v, productId: '', _variations: [] } : row))
                            setOpenIdx(i)
                          }}
                          onBlur={() => setTimeout(() => setOpenIdx(null), 150)}
                        />
                        {openIdx === i && getFiltered(i).length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            {getFiltered(i).map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={() => selectProduct(i, p)}
                                className="w-full px-3 py-2.5 text-left hover:bg-violet-500/10 transition-colors flex items-center justify-between gap-2"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs text-[var(--text-primary)] truncate font-medium">{p.name}</p>
                                  <p className="text-[10px] text-slate-500">{p.sku}{p.brandName ? ` · ${p.brandName}` : ''}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[10px] text-violet-400 font-semibold">{formatCurrency(p.buyingPrice)}</p>
                                  <p className="text-[10px] text-slate-600">stock: {p.stock}</p>
                                </div>
                              </button>
                            ))}
                            {allProducts.length === 0 && (
                              <p className="text-xs text-slate-500 px-3 py-2">No products in inventory</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Qty */}
                    <div className="col-span-2">
                      <input
                        required type="number" min="1"
                        className="input-field text-sm text-center w-full"
                        placeholder="1"
                        value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', e.target.value)}
                      />
                    </div>

                    {/* Unit Cost */}
                    <div className="col-span-3">
                      <input
                        required type="number" min="0"
                        className="input-field text-sm w-full"
                        placeholder="0"
                        value={item.unitCost}
                        onChange={e => updateItem(i, 'unitCost', e.target.value)}
                      />
                    </div>

                    {/* Total + delete */}
                    <div className="col-span-2 flex items-center justify-end gap-2 pt-1">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{formatCurrency(Number(item.quantity) * Number(item.unitCost))}</span>
                      <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 disabled:opacity-20 transition-all flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* ── Variation selectors (only when product has variants) ── */}
                  {(item._variations?.length ?? 0) > 0 && (() => {
                    const vars = item._variations!
                    const storageOpts = [...new Set(vars.filter((v: any) => v.storage).map((v: any) => v.storage as string))]
                    const colorOpts = vars.filter((v: any) => v.storage === item.storage && v.colorName)
                    return (
                      <div className="px-3 pb-3 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex flex-wrap items-start gap-4 pt-2">

                          {/* Storage pills */}
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Storage</p>
                            <div className="flex flex-wrap gap-1.5">
                              {storageOpts.map(s => (
                                <button key={s} type="button"
                                  onClick={() => {
                                    const firstColorForStorage = vars.find((v: any) => v.storage === s)
                                    setItems(prev => prev.map((row, idx) => idx === i ? {
                                      ...row,
                                      storage:   s,
                                      colorName: firstColorForStorage?.colorName ?? '',
                                      sku:       firstColorForStorage?.sku ?? '',
                                      unitCost:  firstColorForStorage?.costPrice ?? row.unitCost,
                                    } : row))
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                                  style={item.storage === s
                                    ? { background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.2)', color: 'var(--text-primary)' }
                                    : { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Color pills */}
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Color</p>
                            <div className="flex flex-wrap gap-1.5">
                              {colorOpts.map((v: any) => (
                                <button key={v.colorName ?? v.sku ?? Math.random()} type="button"
                                  onClick={() => {
                                    setItems(prev => prev.map((row, idx) => idx === i ? {
                                      ...row,
                                      colorName: v.colorName,
                                      sku:       v.sku ?? row.sku,
                                      unitCost:  v.costPrice ?? row.unitCost,
                                    } : row))
                                  }}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                                  style={item.colorName === v.colorName
                                    ? { background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.2)', color: 'var(--text-primary)' }
                                    : { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20"
                                    style={{ background: (() => {
                                      const n = (v.colorName ?? '').toLowerCase()
                                      if (n.includes('black')) return '#1a1a1a'
                                      if (n.includes('white') || n.includes('silver') || n.includes('star')) return '#e2e8f0'
                                      if (n.includes('gold') || n.includes('yellow')) return '#f59e0b'
                                      if (n.includes('red') || n.includes('rose')) return '#ef4444'
                                      if (n.includes('blue') || n.includes('sky')) return '#3b82f6'
                                      if (n.includes('green') || n.includes('midnight')) return '#10b981'
                                      if (n.includes('purple') || n.includes('violet')) return '#8b5cf6'
                                      if (n.includes('pink')) return '#ec4899'
                                      if (n.includes('orange')) return '#f97316'
                                      return '#6b7280'
                                    })() }} />
                                  {v.colorName}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* SKU chip */}
                          {item.sku && (
                            <div className="flex items-start gap-1.5 pt-4">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-0.5">SKU</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--text-primary)' }}>{item.sku}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                </div>
              ))}
            </div>

            <div className="flex justify-end mt-3 pt-3 border-t border-white/5">
              <span className="text-sm font-bold text-white">Total: {formatCurrency(subtotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading || suppliers.length === 0} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}Create PO
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [showAddSupplier, setShowAddSupplier]     = useState(false)
  const [showNewPO, setShowNewPO]                 = useState(false)
  const [detailSupplier, setDetailSupplier]       = useState<Supplier | null>(null)
  const [editSupplier,   setEditSupplier]         = useState<Supplier | null>(null)
  const [markReceiving,  setMarkReceiving]        = useState<string | null>(null)
  const [confirmPO,       setConfirmPO]           = useState<PurchaseOrder | null>(null)
  const [registerImeiPO,  setRegisterImeiPO]      = useState<PurchaseOrder | null>(null)
  const [registeredImeiPOs, setRegisteredImeiPOs] = useState<Set<string>>(new Set())
  const [paySupplier,     setPaySupplier]         = useState<Supplier | null>(null)
  const { data: suppliersData, loading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers()
  const { data: ordersData,    loading: ordersLoading,    refetch: refetchOrders    } = usePurchaseOrders()
  const suppliers:      Supplier[]      = (suppliersData?.data ?? []) as Supplier[]
  const purchaseOrders: PurchaseOrder[] = (ordersData?.data    ?? []) as PurchaseOrder[]

  const handleMarkReceived = async (po: PurchaseOrder) => {
    setConfirmPO(po)
  }

  const doReceive = async () => {
    if (!confirmPO) return
    setMarkReceiving(confirmPO.id)
    try {
      await suppliersApi.updatePO(confirmPO.id, { status: 'RECEIVED' })
      toast.success(`${confirmPO.poNumber} received — inventory updated`)
      refetchOrders()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update PO')
    } finally {
      setMarkReceiving(null)
      setConfirmPO(null)
    }
  }

  const supplierColumns = useMemo<ColumnDef<Supplier>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
            {row.original.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm">{row.original.name}</p>
            {row.original.contactName && <p className="text-xs text-slate-500">{row.original.contactName}</p>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => (
        <a href={`tel:${row.original.phone}`} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-300">
          <Phone size={11} />{row.original.phone}
        </a>
      ),
    },
    {
      accessorKey: 'city',
      header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.city || '—'}</span>,
    },
    {
      accessorKey: 'totalOrders',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-violet-400">{row.original.totalOrders}</span>,
    },
    {
      accessorKey: 'outstandingDues',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
      cell: ({ row }) => (
        <span className={`text-sm font-bold ${(row.original as any).outstandingDues > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {formatCurrency((row.original as any).outstandingDues ?? 0)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const s = row.original
        return (
          <div className="flex items-center gap-2">
            {(s as any).outstandingDues > 0 && (
              <button onClick={() => setPaySupplier(s)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm">
                <CreditCard size={10} />Pay
              </button>
            )}
            <TableActionsRow
              showAction={{ action: () => setDetailSupplier(s) }}
              editAction={{ action: () => setEditSupplier(s) }}
            />
          </div>
        )
      },
    },
  ], [setDetailSupplier, setEditSupplier, setPaySupplier, purchaseOrders])

  const poColumns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      accessorKey: 'poNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />,
      cell: ({ row }) => <span className="text-xs font-mono text-violet-300">{row.original.poNumber}</span>,
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Truck size={13} className="text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-200">{row.original.supplierName}</span>
        </div>
      ),
    },
    {
      id: 'itemCount',
      accessorFn: (row) => row.items.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.items.length} items</span>,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-white">{formatCurrency(row.original.total)}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order Date" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{formatDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${poStatusColors[row.original.status] || ''}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const po = row.original
        const canReceive = po.status !== 'CLOSED'
        const canRegisterImei = (po.status === 'RECEIVED' || po.status === 'CLOSED') && po.items.some(i => i.productId) && !registeredImeiPOs.has(po.id)
        return (
          <div className="flex items-center gap-2">
            {canReceive && (
              <button
                onClick={() => handleMarkReceived(po)}
                disabled={markReceiving === po.id}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                {markReceiving === po.id
                  ? <Loader2 size={10} className="animate-spin" />
                  : <CheckCircle size={10} />}
                Receive
              </button>
            )}
            {canRegisterImei && (
              <button
                onClick={() => setRegisterImeiPO(po)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors">
                <Smartphone size={10} />IMEIs
              </button>
            )}
            <TableActionsRow
              dropMoreActions={[{ text: 'View Invoice', function: () => router.push(`/purchase-invoice?id=${po.id}`), icon: <FileText size={13} /> }]}
            />
          </div>
        )
      },
    },
  ], [router, markReceiving, handleMarkReceived, setRegisterImeiPO, registeredImeiPOs])

  return (
    <div className="space-y-6">
      {showAddSupplier && <AddSupplierModal onClose={() => setShowAddSupplier(false)} onSaved={refetchSuppliers} />}
      {showNewPO       && <NewPOModal suppliers={suppliers} onClose={() => setShowNewPO(false)} onSaved={() => { refetchOrders(); refetchSuppliers() }} />}
      {detailSupplier  && <SupplierDetailsModal supplier={detailSupplier} allPOs={purchaseOrders} onClose={() => setDetailSupplier(null)} onEdit={() => { setEditSupplier(detailSupplier); setDetailSupplier(null) }} />}
      {editSupplier    && <EditSupplierModal supplier={editSupplier} onClose={() => setEditSupplier(null)} onSaved={() => { refetchSuppliers(); setEditSupplier(null) }} />}
      {confirmPO       && <ConfirmReceiveModal po={confirmPO} onConfirm={doReceive} onCancel={() => setConfirmPO(null)} loading={!!markReceiving} />}
      {registerImeiPO  && <IMEIRegisterModal po={registerImeiPO} onClose={() => setRegisterImeiPO(null)} onSaved={(poId) => { setRegisteredImeiPOs(prev => new Set([...prev, poId])); refetchOrders() }} />}
      {paySupplier     && <RecordPaymentModal supplier={paySupplier} allPOs={purchaseOrders} onClose={() => setPaySupplier(null)} onSaved={() => { refetchSuppliers(); refetchOrders() }} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Suppliers & Purchase Orders</h1>
          <p className="page-subtitle">{suppliers.length} suppliers · {purchaseOrders.length} purchase orders</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => setShowAddSupplier(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Plus size={14} />Add Supplier
          </button>
          <button onClick={() => setShowNewPO(true)} className="btn-primary text-sm flex items-center gap-2">
            <Package size={14} />New PO
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 p-1 rounded-xl w-fit">
        {[['suppliers', 'Suppliers'], ['orders', 'Purchase Orders']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'suppliers' | 'orders')}
            className={`px-4 py-1.5 text-xs rounded-lg transition-colors ${activeTab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'suppliers' ? (
        <ClientSideTable
          data={suppliers}
          columns={supplierColumns}
          isLoading={suppliersLoading}
          pageCount={Math.ceil((suppliers.length || 1) / 20)}
          searchableColumns={[
            { id: 'name',        title: 'Name'    },
            { id: 'contactName', title: 'Contact' },
          ]}
        />
      ) : (
        <ClientSideTable
          data={purchaseOrders}
          columns={poColumns}
          isLoading={ordersLoading}
          pageCount={Math.ceil((purchaseOrders.length || 1) / 20)}
          searchableColumns={[
            { id: 'poNumber',     title: 'PO #'     },
            { id: 'supplierName', title: 'Supplier' },
          ]}
          filterableColumns={[{
            id: 'status',
            title: 'Status',
            options: [
              { label: 'Draft',    value: 'DRAFT'    },
              { label: 'Sent',     value: 'SENT'     },
              { label: 'Partial',  value: 'PARTIAL'  },
              { label: 'Received', value: 'RECEIVED' },
              { label: 'Closed',   value: 'CLOSED'   },
            ],
          }]}
        />
      )}
    </div>
  )
}
