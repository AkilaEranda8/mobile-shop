'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Truck, Loader2, CheckCircle, Smartphone, FileText, Package, AlertCircle, X, Printer, Calendar, Hash, Eye, CreditCard, ClipboardCheck, Upload } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders, useProducts } from '@/lib/hooks'
import { suppliersApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { isImeiHealthBannerDismissed, dismissImeiHealthBanner } from '@/lib/productImei'
import type { PurchaseOrder } from '@/types'
import toast from 'react-hot-toast'
import { printBarcodeLabels, type BarcodeLabelItem } from '@/lib/barcode-print'
import {
  DEFAULT_BARCODE_LABEL_SETTINGS,
  fetchInvoiceSettings,
  resolveBarcodeLabelSettings,
  type BarcodeLabelSettings,
} from '@/lib/invoiceSettings'
import {
  ConfirmReceiveModal,
  IMEIRegisterModal,
  NewPOModal,
  getExpectedImeiCount,
  poCanRegisterImei,
  poHasImeiProducts,
  poStatusColors,
  type PoProduct as SharedPoProduct,
} from '@/components/suppliers/suppliers-shared'
import { BulkPOImportModal } from '@/components/suppliers/BulkPOImportModal'

function PODetailsModal({
  po,
  products,
  onClose,
  onViewInvoice,
  onReceive,
  onRegisterImei,
  onPrintBarcodes,
  receiving,
}: {
  po: PurchaseOrder
  products: SharedPoProduct[]
  onClose: () => void
  onViewInvoice: () => void
  onReceive?: () => void
  onRegisterImei?: () => void
  onPrintBarcodes?: () => void
  receiving?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const canReceive = ['DRAFT', 'SENT', 'PARTIAL'].includes(po.status)
  const canRegisterImei = poCanRegisterImei(po, products)
  const imeiExpected = getExpectedImeiCount(po, products)
  const imeiRegistered = po.imeiRegisteredCount ?? 0
  const paid = Number(po.paidAmount ?? 0)
  const due = Number(po.dueAmount ?? Math.max(0, Number(po.total ?? 0) - paid))
  const paymentStatus = due > 0 ? (paid > 0 ? 'Partial' : 'Unpaid') : 'Paid'
  const paymentStatusClass = due > 0
    ? (paid > 0
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25')
    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'

  const orderedQty = (po.items ?? []).reduce((s, i) => s + Number(i.quantity ?? 0), 0)
  const receivedQty = (po.items ?? []).reduce((s, i) => s + Number(i.receivedQuantity ?? 0), 0)
  const hasReceived = receivedQty > 0 || !!po.receivedAt || ['RECEIVED', 'CLOSED', 'PARTIAL'].includes(po.status)
  const grnNumber = hasReceived ? `GRN-${po.poNumber}` : null
  const grnStatus =
    !hasReceived ? 'Pending'
      : receivedQty >= orderedQty && orderedQty > 0 ? 'Fully received'
        : receivedQty > 0 ? 'Partially received'
          : po.status === 'RECEIVED' || po.status === 'CLOSED' ? 'Fully received'
            : 'Pending'
  const grnStatusClass =
    grnStatus === 'Fully received'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
      : grnStatus === 'Partially received'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
        : 'bg-slate-500/15 text-slate-500 border-slate-500/25'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Package size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Purchase Order Details ( PO : <span className="font-mono">{safeText(po.poNumber)}</span> )
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {safeText(po.supplierName)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${paymentStatusClass}`}>
              {paymentStatus}
            </span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${poStatusColors[po.status] || ''}`}>
              {safeText(po.status)}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Order date:</span>
                <span className="font-medium">{safeText(formatDate(po.createdAt))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>PO number:</span>
                <span className="font-mono">{safeText(po.poNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className="font-medium">{safeText(po.status)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Payment status:</span>
                <span className="font-medium">{paymentStatus}</span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Supplier:</span>
                <span className="font-medium">{safeText(po.supplierName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Expected delivery:</span>
                <span className="font-medium">{safeText(po.expectedDelivery ? formatDate(po.expectedDelivery) : '')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Received at:</span>
                <span className="font-medium">{safeText(po.receivedAt ? formatDate(po.receivedAt) : '')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>IMEI registered:</span>
                <span className="font-medium">
                  {imeiExpected > 0 ? `${imeiRegistered}/${imeiExpected}` : '—'}
                </span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>LKR</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span className="font-medium">{formatCurrency(po.subtotal ?? 0)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Tax</span><span className="font-medium">{formatCurrency(po.tax ?? 0)}</span></div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}><span className="font-semibold">Total Payable</span><span className="font-semibold">{formatCurrency(po.total ?? 0)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Total paid</span><span className="font-medium">{formatCurrency(paid)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Total remaining</span><span className="font-medium">{formatCurrency(due)}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-violet-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Items ({po.items?.length ?? 0})
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right">Unit cost</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(po.items ?? []).map((item, idx) => (
                        <tr key={item.id ?? `${item.productId}-${idx}`} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{safeText(item.productName)}</div>
                            {(item.sku || item.colorName || item.storage) && (
                              <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                {[item.sku, item.colorName, item.storage].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{item.receivedQuantity ?? 0}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(item.unitCost ?? 0)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{formatCurrency(item.total ?? (item.quantity * item.unitCost))}</td>
                        </tr>
                      ))}
                      {(!po.items || po.items.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No items</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GRN — Goods Received Note */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardCheck size={12} />
                    GRN — Goods Received Note
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${grnStatusClass}`}
                    style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)', color: '#fff' }}
                  >
                    {grnStatus}
                  </span>
                </div>

                <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px] border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                  <div>
                    <p style={{ color: 'var(--text-muted)' }}>GRN number</p>
                    <p className="font-mono font-semibold">{safeText(grnNumber)}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-muted)' }}>Received date</p>
                    <p className="font-semibold">{safeText(po.receivedAt ? formatDate(po.receivedAt) : '')}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-muted)' }}>Qty received / ordered</p>
                    <p className="font-semibold">{receivedQty} / {orderedQty}</p>
                  </div>
                </div>

                {!hasReceived ? (
                  <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    GRN not created yet — receive this PO to record goods inward.
                    {canReceive && onReceive && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={onReceive}
                          disabled={receiving}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400 font-semibold disabled:opacity-60"
                        >
                          {receiving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          Create GRN / Receive stock
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-right">Ordered</th>
                          <th className="px-3 py-2 text-right">Received</th>
                          <th className="px-3 py-2 text-right">Pending</th>
                          <th className="px-3 py-2 text-right">Line value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(po.items ?? []).map((item, idx) => {
                          const ordered = Number(item.quantity ?? 0)
                          const received = Number(item.receivedQuantity ?? (po.status === 'RECEIVED' || po.status === 'CLOSED' ? ordered : 0))
                          const pending = Math.max(0, ordered - received)
                          return (
                            <tr key={`grn-${item.id ?? item.productId}-${idx}`} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{safeText(item.productName)}</div>
                                {(item.sku || item.colorName || item.storage) && (
                                  <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                    {[item.sku, item.colorName, item.storage].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">{ordered}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{received}</td>
                              <td className={`px-3 py-2 text-right font-medium ${pending > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{pending}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(item.total ?? (ordered * Number(item.unitCost ?? 0)))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>PO note:</p>
                <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(po.notes)}</p>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                <p className="text-[12px] font-semibold">Total</p>
                <p className="text-[12px] font-semibold">{formatCurrency(po.total ?? 0)}</p>
              </div>
              <div className="p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(po.subtotal ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Tax:</span>
                  <span className="font-medium">{formatCurrency(po.tax ?? 0)}</span>
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Payable:</span>
                    <span className="font-semibold">{formatCurrency(po.total ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total paid:</span>
                    <span className="font-medium">{formatCurrency(paid)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total remaining:</span>
                    <span className="font-medium">{formatCurrency(due)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>GRN:</span>
                    <span className="font-medium font-mono">{safeText(grnNumber)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2 flex-wrap">
            {canReceive && onReceive && (
              <button
                type="button"
                onClick={onReceive}
                disabled={receiving}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400 font-semibold disabled:opacity-60"
              >
                {receiving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Create GRN / Receive stock
              </button>
            )}
            {canRegisterImei && onRegisterImei && (
              <button
                type="button"
                onClick={onRegisterImei}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold"
              >
                <Smartphone size={14} />
                Register IMEI
              </button>
            )}
            {(po.status === 'RECEIVED' || po.status === 'CLOSED') && onPrintBarcodes && (
              <button
                type="button"
                onClick={onPrintBarcodes}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
              >
                <Printer size={14} />
                Print barcodes
              </button>
            )}
            <button
              type="button"
              onClick={onViewInvoice}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
            >
              <Eye size={14} />
              View invoice
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
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

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showNewPO, setShowNewPO] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [markReceiving, setMarkReceiving] = useState<string | null>(null)
  const [confirmPO, setConfirmPO] = useState<PurchaseOrder | null>(null)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [registerImeiPO, setRegisterImeiPO] = useState<PurchaseOrder | null>(null)
  const [imeiBannerHidden, setImeiBannerHidden] = useState(() => isImeiHealthBannerDismissed())
  const [textSearch, setTextSearch] = useState('')
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CLOSED'>('all')

  const tenantId = authStorage.getUser()?.tenantId
  const [shopName, setShopName] = useState('')
  const barcodeLabelRef = useRef<BarcodeLabelSettings>({ ...DEFAULT_BARCODE_LABEL_SETTINGS })

  const openPoInvoice = useCallback((id: string) => router.push(`/purchase-invoice?id=${id}`), [router])
  const openPoDetail = useCallback((po: PurchaseOrder) => setDetailPO(po), [])
  const { data: suppliersData, refetch: refetchSuppliers } = useSuppliers()
  const { data: ordersData, loading: ordersLoading, refetch: refetchOrders } = usePurchaseOrders()
  const { data: productsData } = useProducts({ limit: '2000' })
  const suppliers = (suppliersData?.data ?? []) as import('@/types').Supplier[]
  const allProducts: SharedPoProduct[] = (productsData?.data ?? []) as SharedPoProduct[]

  const loadBarcodeSettings = useCallback(async () => {
    if (!tenantId) return
    try {
      const s = await fetchInvoiceSettings(tenantId)
      barcodeLabelRef.current = resolveBarcodeLabelSettings(s)
      setShopName(s.shopName ?? '')
    } catch {
      /* keep defaults */
    }
  }, [tenantId])

  useEffect(() => {
    loadBarcodeSettings()
  }, [loadBarcodeSettings])

  useEffect(() => {
    const onUpdated = () => { loadBarcodeSettings() }
    window.addEventListener('invoice-settings-updated', onUpdated)
    return () => window.removeEventListener('invoice-settings-updated', onUpdated)
  }, [loadBarcodeSettings])

  const mapPoLabels = (raw: any[]): BarcodeLabelItem[] =>
    raw.map((l: any) => ({
      barcode: l.barcode,
      name: l.name,
      sku: l.sku,
      price: l.price,
      qty: l.qty ?? 1,
    }))

  const printPoLabels = useCallback((labels: BarcodeLabelItem[], poNumber: string) => {
    if (!labels.length) {
      toast.error('No barcode labels to print for this PO')
      return
    }
    printBarcodeLabels(labels, {
      settings: barcodeLabelRef.current,
      shopName,
      preview: true,
    })
    const total = labels.reduce((s, l) => s + (l.qty ?? 1), 0)
    toast.success(`${poNumber}: ${total} barcode label(s) — preview open, then Print`)
  }, [shopName])

  const handlePrintPoLabels = useCallback(async (po: PurchaseOrder) => {
    try {
      await loadBarcodeSettings()
      const res: any = await suppliersApi.getPoLabels(po.id)
      const payload = res?.data ?? res
      printPoLabels(mapPoLabels(payload?.labelsToPrint ?? []), po.poNumber)
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not load PO barcodes')
    }
  }, [printPoLabels, loadBarcodeSettings])

  const purchaseOrders: PurchaseOrder[] = (ordersData?.data ?? []) as PurchaseOrder[]

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'suppliers') {
      router.replace('/dashboard/suppliers')
      return
    }

    const action = searchParams.get('action')
    if (action === 'new-po' || action === 'add-po' || searchParams.get('new') === '1') {
      setShowNewPO(true)
    }

    const id = searchParams.get('id')
    if (id && purchaseOrders.length) {
      const found = purchaseOrders.find(po => po.id === id)
      if (found) setDetailPO(found)
    }
  }, [searchParams, router, purchaseOrders])

  const incompletePoCount = useMemo(() =>
    purchaseOrders.filter(po => {
      const expected = getExpectedImeiCount(po, allProducts)
      const registered = po.imeiRegisteredCount ?? 0
      return (po.status === 'RECEIVED' || po.status === 'CLOSED') && expected > 0 && registered < expected
    }).length,
  [purchaseOrders, allProducts])

  const filteredPOs = useMemo(() => {
    let rows = purchaseOrders
    if (poStatusFilter !== 'all') rows = rows.filter(po => po.status === poStatusFilter)
    const q = textSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(po =>
      po.poNumber?.toLowerCase().includes(q) ||
      po.supplierName?.toLowerCase().includes(q)
    )
  }, [purchaseOrders, textSearch, poStatusFilter])

  const handleMarkReceived = async (po: PurchaseOrder) => {
    setConfirmPO(po)
  }

  const doReceive = async () => {
    if (!confirmPO) return
    setMarkReceiving(confirmPO.id)
    try {
      await loadBarcodeSettings()
      const res: any = await suppliersApi.updatePO(confirmPO.id, { status: 'RECEIVED' })
      toast.success(`${confirmPO.poNumber} received — inventory updated`)
      refetchOrders()
      const payload = res?.data ?? res
      const updated = (payload?.id ? payload : payload?.purchaseOrder ?? confirmPO) as PurchaseOrder
      const labels = mapPoLabels(payload?.labelsToPrint ?? [])
      if (labels.length > 0) printPoLabels(labels, confirmPO.poNumber)
      if (poHasImeiProducts(updated, allProducts) && poCanRegisterImei(updated, allProducts)) {
        setRegisterImeiPO(updated)
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update PO')
    } finally {
      setMarkReceiving(null)
      setConfirmPO(null)
    }
  }

  const poColumns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      accessorKey: 'poNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />,
      cell: ({ row }) => (
        <button type="button" className="text-xs font-mono text-violet-600 dark:text-violet-300 hover:underline" onClick={() => openPoDetail(row.original)}>
          {row.original.poNumber}
        </button>
      ),
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => openPoDetail(row.original)}>
          <Truck size={13} className="text-slate-500 flex-shrink-0" />
          <span className="text-sm text-gray-800 dark:text-slate-200">{row.original.supplierName}</span>
        </button>
      ),
    },
    {
      id: 'itemCount',
      accessorFn: (row) => row.items.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-slate-400">{row.original.items.length} items</span>,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(row.original.total)}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order Date" />,
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-slate-400">{formatDate(row.original.createdAt)}</span>,
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
      id: 'imei',
      header: ({ column }) => <DataTableColumnHeader column={column} title="IMEI" />,
      cell: ({ row }) => {
        const po = row.original
        const canRegisterImei = poCanRegisterImei(po, allProducts)
        const imeiExpected = getExpectedImeiCount(po, allProducts)
        const imeiRegistered = po.imeiRegisteredCount ?? 0
        if (imeiExpected <= 0) {
          return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
        }
        if (canRegisterImei) {
          return (
            <button
              type="button"
              onClick={() => setRegisterImeiPO(po)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 whitespace-nowrap"
            >
              <Smartphone size={10} />
              Register ({imeiRegistered}/{imeiExpected})
            </button>
          )
        }
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 whitespace-nowrap">
            <CheckCircle size={10} /> Done
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const po = row.original
        const canReceive = ['DRAFT', 'SENT', 'PARTIAL'].includes(po.status)
        const canPrint = po.status === 'RECEIVED' || po.status === 'CLOSED'
        const canRegisterImei = poCanRegisterImei(po, allProducts)
        const menu = [
          { text: 'View details', function: () => openPoDetail(po), icon: <Eye size={13} /> },
          { text: 'View Invoice', function: () => openPoInvoice(po.id), icon: <FileText size={13} /> },
        ]
        if (canReceive) {
          menu.push({
            text: markReceiving === po.id ? 'Receiving…' : 'Receive stock',
            function: () => handleMarkReceived(po),
            icon: markReceiving === po.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />,
          })
        }
        if (canRegisterImei) {
          menu.push({
            text: 'Register IMEI',
            function: () => setRegisterImeiPO(po),
            icon: <Smartphone size={13} />,
          })
        }
        if (canPrint) {
          menu.push({
            text: 'Print barcodes',
            function: () => handlePrintPoLabels(po),
            icon: <Printer size={13} />,
          })
        }
        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button
              type="button"
              onClick={() => openPoDetail(po)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}
              title="View details"
            >
              <Eye size={11} />
              View
            </button>
            <TableActionsRow dropMoreActions={menu} />
          </div>
        )
      },
    },
  ], [openPoInvoice, openPoDetail, markReceiving, allProducts, handlePrintPoLabels])

  return (
    <div className="space-y-6">
      {detailPO && (
        <PODetailsModal
          po={detailPO}
          products={allProducts}
          onClose={() => setDetailPO(null)}
          onViewInvoice={() => {
            const id = detailPO.id
            setDetailPO(null)
            openPoInvoice(id)
          }}
          onReceive={['DRAFT', 'SENT', 'PARTIAL'].includes(detailPO.status)
            ? () => { setConfirmPO(detailPO); setDetailPO(null) }
            : undefined}
          onRegisterImei={poCanRegisterImei(detailPO, allProducts)
            ? () => { setRegisterImeiPO(detailPO); setDetailPO(null) }
            : undefined}
          onPrintBarcodes={(detailPO.status === 'RECEIVED' || detailPO.status === 'CLOSED')
            ? () => handlePrintPoLabels(detailPO)
            : undefined}
          receiving={markReceiving === detailPO.id}
        />
      )}
      {showNewPO && (
        <NewPOModal
          suppliers={suppliers}
          onClose={() => setShowNewPO(false)}
          onSaved={() => { refetchOrders(); refetchSuppliers() }}
        />
      )}
      {showBulkImport && (
        <BulkPOImportModal
          suppliers={suppliers}
          products={(productsData?.data ?? []) as any[]}
          onClose={() => setShowBulkImport(false)}
          onSaved={() => { refetchOrders(); refetchSuppliers() }}
        />
      )}
      {confirmPO && (
        <ConfirmReceiveModal
          po={confirmPO}
          onConfirm={doReceive}
          onCancel={() => setConfirmPO(null)}
          loading={!!markReceiving}
        />
      )}
      {registerImeiPO && (
        <IMEIRegisterModal
          po={registerImeiPO}
          products={allProducts}
          onClose={() => setRegisterImeiPO(null)}
          onSaved={() => refetchOrders()}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">{purchaseOrders.length} purchase orders</p>
        </div>
        <div className="flex gap-2 sm:ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => router.push('/dashboard/suppliers')}
            className="btn-secondary text-sm"
          >
            Suppliers
          </button>
          <button
            type="button"
            onClick={() => setShowBulkImport(true)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Upload size={14} />Bulk Import
          </button>
          <button onClick={() => setShowNewPO(true)} className="btn-primary text-sm flex items-center gap-2">
            <Package size={14} />New PO
          </button>
        </div>
      </div>

      {incompletePoCount > 0 && !imeiBannerHidden && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-900 dark:text-amber-200">
              <strong>{incompletePoCount}</strong> received PO(s) still need device IMEI registration — use <strong>Register IMEI</strong> on each PO.
            </p>
          </div>
          <button type="button" onClick={() => { dismissImeiHealthBanner(); setImeiBannerHidden(true) }}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-200/60 dark:text-slate-400 dark:hover:bg-white/5 flex-shrink-0">
            <X size={13} /> Hide
          </button>
        </div>
      )}

      <ToolbarSearch
        value={textSearch}
        onChange={setTextSearch}
        placeholder="Search PO #, supplier…"
        className="max-w-md"
      />

      <div className="flex gap-1 p-1 rounded-xl flex-wrap w-fit" style={{ background: 'var(--bg-subtle)' }}>
        {([
          { id: 'all', label: 'All' },
          { id: 'DRAFT', label: 'Draft' },
          { id: 'SENT', label: 'Sent' },
          { id: 'PARTIAL', label: 'Partial' },
          { id: 'RECEIVED', label: 'Received' },
          { id: 'CLOSED', label: 'Closed' },
        ] as const).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPoStatusFilter(opt.id)}
            className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
            style={poStatusFilter === opt.id
              ? { background: 'var(--brand-primary-light)', color: '#fff' }
              : { color: 'var(--text-muted)' }}>
            {opt.label}
          </button>
        ))}
      </div>

      <ClientSideTable
        data={filteredPOs}
        columns={poColumns}
        isLoading={ordersLoading}
        pageCount={Math.ceil((filteredPOs.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />
    </div>
  )
}
