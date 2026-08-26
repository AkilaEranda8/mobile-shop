'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Undo2, Plus, Package, Truck, FileText, Loader2, X,
  Calendar, Hash, Receipt, CreditCard, User, AlertTriangle, Banknote,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'

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
  supplierCreditCreated?: number
  reason: string
  notes?: string | null
  createdAt: string
  purchaseOrder: { poNumber: string; status?: string; dueAmount?: number; paidAmount?: number }
  items: Array<{
    id?: string
    productName: string
    quantity: number
    unitCost?: number
    total: number
    sku?: string | null
    imei?: string | null
    storage?: string | null
    colorName?: string | null
  }>
  supplier?: { id: string; name: string; phone?: string | null }
}

const settlementLabel = (m?: string) => {
  const key = String(m || '').toUpperCase()
  if (key === 'CREDIT') return 'Credit note (AP)'
  if (key === 'BANK_TRANSFER') return 'Bank refund'
  if (key === 'CASH') return 'Cash refund'
  if (key === 'CARD') return 'Card refund'
  return key.replace(/_/g, ' ') || '—'
}

/* ── Purchase Return Detail Modal (Sales Returns layout) ───────────────── */
function PurchaseReturnDetailModal({
  ret,
  loading,
  onClose,
}: {
  ret: ReturnRow | null
  loading?: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const items = ret?.items ?? []
  const itemCount = items.reduce((s, i) => s + Number(i.quantity ?? 0), 0)
  const po = ret?.purchaseOrder ?? { poNumber: '' }
  const method = String(ret?.settlementMethod || '').toUpperCase()
  const isCredit = method === 'CREDIT'

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
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2">
            <Undo2 size={16} className="text-violet-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Return Details ( Return No : <span className="font-mono">{safeText(ret?.returnNumber)}</span> )
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {safeText(ret?.supplierName || ret?.supplier?.name)}
                {po.poNumber ? ` · PO ${po.poNumber}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25">
              {isCredit ? 'AP credit' : 'Refund'}
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

        {loading || !ret ? (
          <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading return…</span>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
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
                  <span style={{ color: 'var(--text-muted)' }}>PO No:</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(po.poNumber)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Settlement:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{settlementLabel(ret.settlementMethod)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <User size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Supplier:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(ret.supplierName || ret.supplier?.name)}</span>
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
                  <span style={{ color: 'var(--text-muted)' }}>AP reduced:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(ret.apReduced ?? 0)}</span>
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
                    <span style={{ color: 'var(--text-muted)' }}>AP reduced</span>
                    <span className="font-medium">{formatCurrency(ret.apReduced ?? 0)}</span>
                  </div>
                  {Number(ret.supplierCreditCreated ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Supplier credit</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(ret.supplierCreditCreated ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold">Return value</span>
                    <span className="font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(ret.creditAmount ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-violet-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                    Returned products
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-right">Quantity</th>
                          <th className="px-3 py-2 text-right">Unit cost</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const qty = Number(item.quantity ?? 0)
                          const unit = Number(item.unitCost ?? 0)
                          const subtotal = Number(item.total ?? qty * unit)
                          return (
                            <tr key={item.id ?? idx} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(item.productName)}</div>
                                {(item.sku || item.imei || item.storage || item.colorName) && (
                                  <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                    {[item.sku, item.storage, item.colorName, item.imei ? `IMEI ${item.imei}` : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">{qty ? `${qty} Qty` : '—'}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(unit)}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-violet-600 dark:text-violet-400">
                                {formatCurrency(subtotal)}
                              </td>
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

                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-violet-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                    Settlement info
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[560px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Reference No</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-left">Settlement</th>
                          <th className="px-3 py-2 text-left">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>1</td>
                          <td className="px-3 py-2">{safeText(formatDate(ret.createdAt))}</td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{safeText(ret.returnNumber)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-violet-600 dark:text-violet-400">
                            {formatCurrency(ret.creditAmount ?? 0)}
                          </td>
                          <td className="px-3 py-2">{settlementLabel(ret.settlementMethod)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{safeText(ret.notes)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Return reason:</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(ret.reason)}</p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Notes:</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(ret.notes)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border p-4 space-y-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Summary</p>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: 'var(--text-muted)' }}>Return value</span>
                    <span className="font-bold text-violet-600 dark:text-violet-400">{formatCurrency(ret.creditAmount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: 'var(--text-muted)' }}>AP reduced</span>
                    <span className="font-semibold">{formatCurrency(ret.apReduced ?? 0)}</span>
                  </div>
                  {Number(ret.supplierCreditCreated ?? 0) > 0 && (
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: 'var(--text-muted)' }}>Supplier credit</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(ret.supplierCreditCreated ?? 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

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
        )}
      </div>
    </div>
  )
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
  const [detailRet, setDetailRet] = useState<ReturnRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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

  const openDetail = useCallback(async (row: ReturnRow) => {
    setDetailRet(row)
    setDetailLoading(true)
    try {
      const res: any = await suppliersApi.getPurchaseReturn(row.id)
      const full = (res?.data ?? res) as ReturnRow
      if (full?.id) setDetailRet(full)
    } catch {
      /* keep list row */
    } finally {
      setDetailLoading(false)
    }
  }, [])

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
      cell: ({ row }) => (
        <button
          type="button"
          className="font-mono text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          onClick={() => void openDetail(row.original)}
        >
          {row.original.returnNumber}
        </button>
      ),
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
        <span className="text-xs px-2 py-0.5 rounded-full border border-slate-500/30 text-slate-600 dark:text-slate-300">
          {settlementLabel(row.original.settlementMethod)}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <TableActionsRow showAction={{ action: () => void openDetail(row.original) }} />
      ),
    },
  ], [openDetail])

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

      {detailRet !== null && (
        <PurchaseReturnDetailModal
          ret={detailRet}
          loading={detailLoading}
          onClose={() => { setDetailRet(null); setDetailLoading(false) }}
        />
      )}

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
