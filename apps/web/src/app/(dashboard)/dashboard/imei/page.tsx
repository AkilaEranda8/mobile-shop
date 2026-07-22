'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Smartphone, Plus, CheckCircle, X, Loader2, Hash, ShoppingBag, Wrench,
  Search, History, User, Tag, Calendar, ChevronRight, RefreshCw, AlertTriangle,
  Package, Receipt, Phone, Shield, ExternalLink,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { useImeiRecords } from '@/lib/hooks'
import { imeiApi, productsApi, warrantyApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import toast from 'react-hot-toast'
import { useModuleAccess, EditOnly, viewOnlyToast } from '@/lib/module-access'

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  IN_STOCK:             { label: 'In Stock',     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  SOLD:                 { label: 'Sold',          color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  IN_REPAIR:            { label: 'In Repair',     color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  UNDER_WARRANTY_CLAIM: { label: 'Warranty',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  SCRAPPED:             { label: 'Scrapped',      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  REPAIR_ONLY:          { label: 'Repair Record', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

const repairStatusColors: Record<string, string> = {
  RECEIVED:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  DIAGNOSING:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
  IN_PROGRESS: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  WAITING_PARTS: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  READY:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  DELIVERED:   'text-green-400 bg-green-500/10 border-green-500/20',
  CANCELLED:   'text-red-400 bg-red-500/10 border-red-500/20',
}

function formatCurrency(v: any) { return `Rs. ${Number(v ?? 0).toLocaleString('en-LK')}` }
function formatDate(d: string)  { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

/* ── IMEI Detail Modal (Sales Details layout) ─────────────────────────── */
function IMEIDetailModal({ imei, onClose, onStatusChange }: { imei: string; onClose: () => void; onStatusChange: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [warranty, setWarranty] = useState<any>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    imeiApi.lookup(imei)
      .then((r: any) => setData(r.data))
      .catch(() => toast.error('Failed to load IMEI details'))
      .finally(() => setLoading(false))
  }, [imei])

  useEffect(() => {
    if (!imei) return
    warrantyApi.list({ search: imei, limit: '5' })
      .then((r: any) => {
        const list: any[] = r.data?.data ?? r.data ?? []
        setWarranty(list.find((w: any) => w.imei === imei) ?? list[0] ?? null)
      })
      .catch(() => {})
  }, [imei])

  const handleStatusChange = async (status: string) => {
    if (!data?.record?.id) return
    setUpdating(true)
    try {
      await imeiApi.updateStatus(data.record.id, status)
      toast.success('Status updated')
      onStatusChange()
      const r: any = await imeiApi.lookup(imei)
      setData(r.data)
    } catch { toast.error('Failed to update status') }
    finally { setUpdating(false) }
  }

  const record = data?.record
  const repairs: any[] = data?.repairs ?? []
  const sale = data?.saleDetails
  const customer = data?.customerDetails
  const firstRepair = repairs[0]
  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

  const deviceName = (record?.product?.name
    ?? (firstRepair ? `${firstRepair.deviceBrand ?? ''} ${firstRepair.deviceModel ?? ''}`.trim() : '')) || '—'
  const brandName = record?.product?.brand?.name ?? firstRepair?.deviceBrand ?? '—'
  const ownerName = customer?.name ?? firstRepair?.customerName ?? '—'
  const ownerPhone = customer?.phone ?? firstRepair?.customerPhone ?? '—'
  const st = record ? (statusConfig[record.status] ?? statusConfig.IN_STOCK) : statusConfig.REPAIR_ONLY
  const statusOptions = ['IN_STOCK', 'SOLD', 'IN_REPAIR', 'UNDER_WARRANTY_CLAIM', 'SCRAPPED']

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
          <div className="flex items-start gap-2 min-w-0">
            <Smartphone size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                IMEI Details ( <span className="font-mono">{safeText(imei)}</span> )
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${deviceName} · ${brandName}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${st.color} ${st.bg} ${st.border}`}>
              {st.label}
            </span>
            {!record && (
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25">
                Repair only
              </span>
            )}
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-violet-400" />
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Top meta */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>IMEI:</span>
                  <span className="font-mono font-medium tracking-wide" style={{ color: 'var(--text-primary)' }}>{safeText(imei)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Device:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(deviceName)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Brand:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(brandName)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>SKU:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(record?.product?.sku)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <User size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Owner:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(ownerName)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(ownerPhone)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Receipt size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Invoice:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(sale?.invoiceNumber)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Registered:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {record?.createdAt ? formatDate(record.createdAt) : '—'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                  {updating && <Loader2 size={12} className="animate-spin text-violet-400" />}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Repairs</span>
                    <span className="font-medium">{repairs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Sale amount</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {sale?.total != null ? formatCurrency(sale.total) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Warranty</span>
                    <span className="font-medium">{warranty?.status ?? '—'}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold">Status</span>
                    <span className={`font-semibold ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                {/* Device info */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Package size={12} /> Device information
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left">Field</th>
                          <th className="px-3 py-2 text-left">Value</th>
                          <th className="px-3 py-2 text-left">Field</th>
                          <th className="px-3 py-2 text-left">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Device</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(deviceName)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Brand</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(brandName)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>SKU</td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(record?.product?.sku)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Category</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(record?.product?.category?.name)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Selling price</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {record?.product?.sellingPrice != null ? formatCurrency(record.product.sellingPrice) : '—'}
                          </td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Product warranty</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {record?.product?.warrantyMonths ? `${record.product.warrantyMonths} months` : '—'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Owner</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(ownerName)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Phone</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(ownerPhone)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sale info */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingBag size={12} /> Sale information
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[560px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Cashier</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale ? (
                          <tr>
                            <td className="px-3 py-2 font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(sale.invoiceNumber)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{safeText(formatDate(sale.createdAt))}</td>
                            <td className="px-3 py-2">{safeText(sale.cashierName)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(sale.total)}</td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No sale linked to this device</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Repair history */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <History size={12} /> Repair history ({repairs.length})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Ticket</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Issue</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairs.map((r: any, idx: number) => {
                          const sc = repairStatusColors[r.status] ?? repairStatusColors.RECEIVED
                          return (
                            <tr key={r.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td className="px-3 py-2 font-mono font-medium" style={{ color: 'var(--text-primary)' }}>#{r.ticketNumber}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{safeText(formatDate(r.createdAt))}</td>
                              <td className="px-3 py-2 max-w-[220px]">
                                <p className="truncate" style={{ color: 'var(--text-primary)' }}>{safeText(r.reportedIssue)}</p>
                                {(r.technicianName || r.customerName) && (
                                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                                    {[r.technicianName && `Tech: ${r.technicianName}`, r.customerName && `Cust: ${r.customerName}`].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${sc}`}>
                                  {safeText(r.status?.replace('_', ' '))}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                                {(r.actualCost ?? r.estimatedCost) > 0
                                  ? formatCurrency(r.actualCost ?? r.estimatedCost)
                                  : '—'}
                              </td>
                            </tr>
                          )
                        })}
                        {repairs.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No repair records for this device</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Warranty + notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[11px] font-semibold mb-1 inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Shield size={11} /> Warranty:
                    </p>
                    {!warranty ? (
                      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No warranty linked to this IMEI</p>
                    ) : (
                      <div className="text-[12px] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-medium text-violet-600 dark:text-violet-400">{warranty.warrantyCode}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                            warranty.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
                              : warranty.status === 'CLAIMED' ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20'
                                : warranty.status === 'EXPIRED' ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                                  : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                          }`}>{warranty.status}</span>
                        </div>
                        <p style={{ color: 'var(--text-primary)' }}>{safeText(warranty.productName)} · {safeText(warranty.customerName)}</p>
                        <p style={{ color: 'var(--text-muted)' }}>
                          {formatDate(warranty.startDate)} → {formatDate(warranty.endDate)}
                          {(warranty.claims?.length ?? 0) > 0 ? ` · ${warranty.claims.length} claim(s)` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Owner / contact:</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                      {safeText(ownerName)}
                      {ownerPhone !== '—' ? ` · ${ownerPhone}` : ''}
                    </p>
                    {!customer && firstRepair?.customerName && (
                      <p className="text-[10px] mt-1 text-violet-600 dark:text-violet-400">From repair record</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right summary */}
              <div className="space-y-4">
                <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Summary</p>
                    <p className={`text-[12px] font-semibold ${st.color}`}>{st.label}</p>
                  </div>
                  <div className="p-3 text-[12px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Repairs:</span>
                      <span className="font-medium">{repairs.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Sale:</span>
                      <span className="font-medium">{sale?.total != null ? formatCurrency(sale.total) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Warranty:</span>
                      <span className="font-medium">{warranty?.status ?? '—'}</span>
                    </div>
                    <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">IMEI:</span>
                        <span className="font-mono text-[10px] font-medium">{safeText(imei)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {record && (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="px-3 py-2 border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Update status</p>
                    </div>
                    <div className="p-3 flex flex-wrap gap-1.5">
                      {statusOptions.map(s => {
                        const cfg = statusConfig[s]
                        const active = record.status === s
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={updating || active}
                            onClick={() => handleStatusChange(s)}
                            className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold disabled:opacity-50 transition-colors ${cfg.color} ${cfg.bg} ${cfg.border} ${active ? 'ring-1 ring-offset-0' : 'hover:opacity-90'}`}
                          >
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2">
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
        )}
      </div>
    </div>
  )
}

function AddIMEIModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const activeBranchId = getActiveBranchId()
  const [form, setForm] = useState({ imei: '', productId: '' })
  const [loading, setLoading] = useState(false)
  const [imeiError, setImeiError] = useState('')
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    const params: Record<string, string> = {}
    if (activeBranchId) params.branchId = activeBranchId
    productsApi.list(params).then((r: any) => setProducts(r.data ?? [])).catch(() => {})
  }, [activeBranchId])

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    if (k === 'imei') setImeiError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{15}$/.test(form.imei)) { setImeiError('IMEI must be exactly 15 digits'); return }
    if (!form.productId) { toast.error('Select a product'); return }
    setLoading(true)
    try {
      const selectedProduct = products.find((p: any) => p.id === form.productId)
      const branchId = activeBranchId || selectedProduct?.branchId
      if (!branchId) { toast.error('No active branch — switch branch in header'); return }
      await imeiApi.create({ imei: form.imei, productId: form.productId, branchId })
      toast.success('IMEI registered successfully')
      onSaved()
      onClose()
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('already')) {
        setImeiError('Duplicate IMEI — this device is already in the system.')
      } else {
        toast.error(err?.message ?? 'Failed to register IMEI')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Register Device IMEI</h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Link IMEI to an existing product</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">IMEI Number * <span className="text-slate-600">(15 digits)</span></label>
            <input
              required maxLength={15}
              className={`input-field font-mono tracking-widest ${imeiError ? 'border-red-500/50' : ''}`}
              placeholder="351756051523798"
              value={form.imei} onChange={f('imei')}
            />
            {imeiError && <p className="text-xs text-red-400 mt-1">{imeiError}</p>}
            {form.imei.length === 15 && !imeiError && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle size={11} />Valid IMEI format</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Product *</label>
            <select required className="input-field" value={form.productId} onChange={f('productId')}>
              <option value="">Select product...</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Register IMEI
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function IMEIPage() {
  const { canEdit } = useModuleAccess()
  const searchParams = useSearchParams()
  const [showAdd,      setShowAdd]      = useState(false)
  const [scanMode,     setScanMode]     = useState(false)
  const [selectedImei, setSelectedImei] = useState<string | null>(null)
  const [quickSearch,  setQuickSearch]  = useState('')
  const [listSearch,   setListSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'IN_STOCK' | 'SOLD' | 'IN_REPAIR' | 'REPAIR_ONLY'>('all')
  const [quickResult,  setQuickResult]  = useState<null | 'loading' | 'found' | 'notfound'>(null)

  const openDetail = useCallback((imei: string) => setSelectedImei(imei), [])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add' || action === 'new' || searchParams.get('new') === '1') {
      if (canEdit) setShowAdd(true)
      else viewOnlyToast('IMEI')
    }
    const imei = searchParams.get('imei') || searchParams.get('q')
    if (imei) {
      setListSearch(imei)
      setSelectedImei(imei)
    }
  }, [canEdit, searchParams])
  const branchId = getActiveBranchId()
  const imeiParams: Record<string, string> = { limit: '500' }
  if (branchId) imeiParams.branchId = branchId
  const { data, loading, refetch } = useImeiRecords(imeiParams)
  const records: any[] = (data?.data ?? []) as any[]
  const total = (data as any)?.meta?.total ?? records.length

  useEffect(() => {
    const onSale = () => { refetch() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [refetch])

  const counts = {
    total,
    inStock:    records.filter((d: any) => d.status === 'IN_STOCK').length,
    sold:       records.filter((d: any) => d.status === 'SOLD').length,
    inRepair:   records.filter((d: any) => d.status === 'IN_REPAIR').length,
    repairOnly: records.filter((d: any) => d.status === 'REPAIR_ONLY').length,
  }

  const handleQuickLookup = async () => {
    const imei = quickSearch.trim()
    if (!imei) return
    setQuickResult('loading')
    try {
      await imeiApi.lookup(imei)
      setQuickResult('found')
      setSelectedImei(imei)
    } catch {
      setQuickResult('notfound')
    }
  }

  const filteredRecords = useMemo(() => {
    let rows = records
    if (statusFilter !== 'all') rows = rows.filter((d: any) => d.status === statusFilter)
    const q = listSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((d: any) =>
      d.imei?.toLowerCase().includes(q) ||
      d.product?.name?.toLowerCase().includes(q) ||
      d.product?.brand?.name?.toLowerCase().includes(q)
    )
  }, [records, statusFilter, listSearch])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'device',
      accessorFn: (row) => `${row.product?.name ?? ''} ${row.imei}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="IMEI / Device" />,
      cell: ({ row }) => (
        <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => openDetail(row.original.imei)}>
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Smartphone size={14} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium hover:text-violet-400 transition-colors" style={{ color: 'var(--text-primary)' }}>{row.original.product?.name ?? '—'}</p>
            <p className="text-xs font-mono text-slate-500">{row.original.imei}</p>
          </div>
        </button>
      ),
    },
    {
      id: 'brand',
      accessorFn: (row) => row.product?.brand?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.original.product?.brand?.name ?? '—'}</span>,
    },
    {
      id: 'variation',
      accessorFn: (row) => row.variation ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Variation" />,
      cell: ({ row }) => <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{row.original.variation?.replace('::', ' ') ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const st = statusConfig[row.original.status] ?? statusConfig['IN_STOCK']
        return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${st.color} ${st.bg} ${st.border}`}>{st.label}</span>
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Registered" />,
      cell: ({ row }) => <span className="text-xs text-gray-500 dark:text-slate-500">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'action',
      header: () => null,
      cell: ({ row }) => (
        <button
          onClick={() => openDetail(row.original.imei)}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-violet-500/30 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors flex items-center gap-1"
        >
          <History size={10} />Details
        </button>
      ),
    },
  ], [openDetail])

  const stats = [
    { label: 'Total Tracked',  value: total,               icon: Smartphone,  color: 'violet', filter: 'all' as const },
    { label: 'In Stock',       value: counts.inStock,       icon: CheckCircle, color: 'green',  filter: 'IN_STOCK' as const },
    { label: 'Sold',           value: counts.sold,          icon: ShoppingBag, color: 'blue',   filter: 'SOLD' as const },
    { label: 'Repair Records', value: counts.repairOnly,    icon: History,     color: 'purple', filter: 'REPAIR_ONLY' as const },
  ]

  return (
    <div className="space-y-6">
      {canEdit && showAdd && <AddIMEIModal onClose={() => setShowAdd(false)} onSaved={refetch} />}
      {selectedImei  && <IMEIDetailModal imei={selectedImei} onClose={() => setSelectedImei(null)} onStatusChange={refetch} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">IMEI Tracker</h1>
          <p className="page-subtitle">Track every device by IMEI · Full repair & sale history</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button
            onClick={() => setScanMode(!scanMode)}
            className={`btn-secondary text-sm flex items-center gap-2 ${scanMode ? 'border-violet-500/40 text-violet-400' : ''}`}
          >
            <Hash size={14} />{scanMode ? 'Scanner On' : 'Scan IMEI'}
          </button>
          <EditOnly><button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Register Device
          </button></EditOnly>
        </div>
      </div>

      {/* Quick IMEI Lookup */}
      <div className="card p-4">
        <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Search size={11} />Quick IMEI Lookup
        </p>
        <div className="flex gap-2">
          <input
            className="input-field font-mono flex-1"
            placeholder="Enter IMEI number to lookup full device history..."
            value={quickSearch}
            onChange={e => { setQuickSearch(e.target.value); setQuickResult(null) }}
            onKeyDown={e => e.key === 'Enter' && handleQuickLookup()}
            maxLength={20}
          />
          <button
            onClick={handleQuickLookup}
            disabled={!quickSearch.trim() || quickResult === 'loading'}
            className="btn-primary text-sm px-4 flex items-center gap-2 disabled:opacity-50"
          >
            {quickResult === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Lookup
          </button>
        </div>
        {quickResult === 'notfound' && (
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5"><AlertTriangle size={11} />IMEI not found in this tenant's records</p>
        )}
      </div>

      {/* Scan mode */}
      {scanMode && (
        <div className="card p-4 border-violet-500/20 bg-violet-500/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Hash size={18} className="text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-300">IMEI Scanner Active</p>
            <p className="text-xs text-gray-500 dark:text-slate-500">Scan barcode or type IMEI then press Enter</p>
          </div>
          <input
            autoFocus className="input-field max-w-xs font-mono"
            placeholder="Scan or type IMEI..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) { setSelectedImei(val); setScanMode(false) }
              }
            }}
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, filter }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`card p-4 flex items-center gap-3 text-left w-full transition-all hover:border-violet-500/30 ${statusFilter === filter ? 'ring-2 ring-violet-500/40' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      <ToolbarSearch
        value={listSearch}
        onChange={setListSearch}
        placeholder="Filter by IMEI, product, brand…"
        className="max-w-md"
      />

      <ClientSideTable
        data={filteredRecords}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((filteredRecords.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />
    </div>
  )
}
