'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Undo2, Plus, Package, Truck, FileText, Loader2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'

type POItem = {
  id: string
  productId: string | null
  productName: string
  quantity: number
  receivedQuantity: number
  unitCost: number
  sku?: string | null
  storage?: string | null
  colorName?: string | null
}

type PO = {
  id: string
  poNumber: string
  supplierId: string
  supplierName: string
  status: string
  dueAmount: number
  paidAmount: number
  items: POItem[]
  imeiRecords?: Array<{ imei: string; productId: string; status: string; poItemId?: string | null }>
}

type ReturnRow = {
  id: string
  returnNumber: string
  supplierName: string
  creditAmount: number
  settlementMethod: string
  apReduced: number
  reason: string
  createdAt: string
  purchaseOrder: { poNumber: string }
  items: Array<{ productName: string; quantity: number; total: number }>
}

export default function PurchaseReturnsPage() {
  const { canEdit } = useModuleAccess()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pos, setPos] = useState<PO[]>([])
  const [poId, setPoId] = useState('')
  const [reason, setReason] = useState('')
  const [settlementMethod, setSettlementMethod] = useState('CREDIT')
  const [notes, setNotes] = useState('')
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({})
  const [imeiByItem, setImeiByItem] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await suppliersApi.purchaseReturns({ limit: '100' })
      setRows(res?.data ?? [])
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Failed to load purchase returns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openModal = async () => {
    if (!canEdit) {
      viewOnlyToast('suppliers')
      return
    }
    try {
      const res: any = await suppliersApi.purchaseOrders({ limit: '100' })
      const list = (res?.data ?? []) as PO[]
      const receivable = list.filter(p =>
        ['RECEIVED', 'PARTIAL', 'CLOSED'].includes(p.status)
        || (p.items ?? []).some(i => Number(i.receivedQuantity) > 0),
      )
      setPos(receivable)
      setPoId(receivable[0]?.id ?? '')
      setReason('')
      setNotes('')
      setSettlementMethod('CREDIT')
      setQtyByItem({})
      setImeiByItem({})
      setOpen(true)
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'Failed to load POs')
    }
  }

  const selectedPo = pos.find(p => p.id === poId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!poId) { toast.error('Select a purchase order'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }
    const items = Object.entries(qtyByItem)
      .map(([poItemId, q]) => ({
        poItemId,
        quantity: Number(q),
        imei: imeiByItem[poItemId]?.trim() || null,
      }))
      .filter(i => i.quantity > 0)
    if (!items.length) { toast.error('Enter return quantities'); return }

    setSaving(true)
    try {
      await suppliersApi.createPurchaseReturn({
        purchaseOrderId: poId,
        items,
        reason: reason.trim(),
        settlementMethod,
        notes: notes.trim() || null,
      })
      toast.success('Purchase return processed')
      setOpen(false)
      await load()
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Return failed')
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<ReturnRow>[]>(() => [
    {
      accessorKey: 'returnNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Return #" />,
      cell: ({ row }) => <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{row.original.returnNumber}</span>,
    },
    {
      id: 'po',
      accessorFn: r => r.purchaseOrder?.poNumber,
      header: ({ column }) => <DataTableColumnHeader column={column} title="PO" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.purchaseOrder?.poNumber}</span>,
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.supplierName}</span>,
    },
    {
      accessorKey: 'creditAmount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Credit" />,
      cell: ({ row }) => <span className="font-semibold">{formatCurrency(row.original.creditAmount)}</span>,
    },
    {
      accessorKey: 'settlementMethod',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Settlement" />,
      cell: ({ row }) => (
        <span className="text-xs px-2 py-0.5 rounded-full border border-slate-500/30 text-slate-300">
          {row.original.settlementMethod}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{formatDate(row.original.createdAt)}</span>,
    },
  ], [])

  const totalCredit = rows.reduce((s, r) => s + Number(r.creditAmount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
            <Undo2 size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchase Returns</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Return received stock to suppliers — reduces AP or refunds cash
            </p>
          </div>
        </div>
        {canEdit && (
          <button type="button" onClick={() => void openModal()} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New return
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <FileText size={15} className="text-violet-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{rows.length}</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-500">Returns</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Package size={15} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalCredit)}</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-500">Total credited</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Truck size={15} className="text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{new Set(rows.map(r => r.supplierName)).size}</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-500">Suppliers</p>
          </div>
        </div>
      </div>

      <ClientSideTable
        data={rows}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((rows.length || 1) / 20)}
        searchableColumns={[]}
      />

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                  <Undo2 size={18} className="text-violet-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>New purchase return</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Return stock from a received PO to the supplier</p>
                </div>
              </div>
            </div>

            <form id="purchase-return-form" onSubmit={e => void submit(e)} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Purchase order <span className="text-red-500">*</span></label>
                  <select required className="input-field h-11 w-full" value={poId} onChange={async e => {
                    const id = e.target.value
                    setPoId(id)
                    setQtyByItem({})
                    setImeiByItem({})
                    try {
                      const res: any = await suppliersApi.purchaseOrders({ id, limit: '1' })
                      const detail = (res?.data ?? [])[0] as PO | undefined
                      if (detail) setPos(prev => prev.map(p => p.id === id ? { ...p, ...detail } : p))
                    } catch { /* keep list row */ }
                  }}>
                  <option value="" disabled>Select received PO</option>
                  {pos.map(p => (
                    <option key={p.id} value={p.id}>{p.poNumber} · {p.supplierName} · due {formatCurrency(p.dueAmount)}</option>
                  ))}
                </select>
              </div>

              {selectedPo && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Lines to return</p>
                  {(selectedPo.items ?? []).filter(i => Number(i.receivedQuantity) > 0).map(item => (
                    <div key={item.id} className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.productName}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Received {item.receivedQuantity} · Cost {formatCurrency(item.unitCost)}
                            {item.sku ? ` · ${item.sku}` : ''}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={item.receivedQuantity}
                          placeholder="0"
                          className="input-field h-10 w-24 text-right"
                          value={qtyByItem[item.id] ?? ''}
                          onChange={e => setQtyByItem(f => ({ ...f, [item.id]: e.target.value }))}
                        />
                      </div>
                      {(selectedPo.imeiRecords ?? []).some(r => r.productId === item.productId && r.status === 'IN_STOCK') && Number(qtyByItem[item.id] || 0) > 0 && (
                        <input
                          className="input-field h-10 w-full font-mono text-sm"
                          placeholder="IMEI to return"
                          value={imeiByItem[item.id] ?? ''}
                          onChange={e => setImeiByItem(f => ({ ...f, [item.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Settlement <span className="text-red-500">*</span></label>
                  <select className="input-field h-11 w-full" value={settlementMethod} onChange={e => setSettlementMethod(e.target.value)}>
                    <option value="CREDIT">Credit note (reduce AP)</option>
                    <option value="CASH">Cash refund</option>
                    <option value="BANK_TRANSFER">Bank refund</option>
                    <option value="CARD">Card refund</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Reason <span className="text-red-500">*</span></label>
                  <input required className="input-field h-11 w-full" placeholder="Damaged / wrong item…" value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <textarea className="input-field w-full min-h-[72px] resize-y" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </form>

            <div className="shrink-0 px-5 sm:px-6 py-4 flex gap-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button type="button" onClick={() => setOpen(false)} disabled={saving}
                className="h-10 px-6 rounded-xl border text-sm font-semibold"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button type="submit" form="purchase-return-form" disabled={saving}
                className={cn('flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60')}
                style={{ background: 'var(--brand-gradient)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Process return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
