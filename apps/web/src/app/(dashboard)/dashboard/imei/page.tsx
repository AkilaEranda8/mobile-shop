'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Smartphone, Plus, CheckCircle, X, Loader2, Hash, ShoppingBag, Wrench,
  Search, History, User, Tag, Calendar, ChevronRight, RefreshCw, AlertTriangle,
  Package, Receipt, Phone, Shield, ExternalLink, Trash2, Lock,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { useActiveBranchId, useImeiRecords } from '@/lib/hooks'
import { imeiApi, productsApi, warrantyApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { useModuleAccess, EditOnly, viewOnlyToast } from '@/lib/module-access'
import { isValidUnitSerial, normalizeSerial, SERIAL_MAX_LEN, serialValidationMessage } from '@/lib/serialNumber'
import { PageHeader, StatCard, StatGrid, FilterBar, SegmentedControl } from '@/components/design-system'

/** Local calendar-day bounds as ISO strings (shop timezone). */
function localDayBounds(offsetDays = 0): { from: string; to: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + offsetDays)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return { from: start.toISOString(), to: end.toISOString() }
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  IN_STOCK:             { label: 'In Stock',     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  SOLD:                 { label: 'Sold',          color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  IN_REPAIR:            { label: 'In Repair',     color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  UNDER_WARRANTY_CLAIM: { label: 'Warranty',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  UNDER_HIRE_PURCHASE:  { label: 'Hire Purchase', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  SCRAPPED:             { label: 'Scrapped',      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  REPAIR_ONLY:          { label: 'Repair Record', color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
}

const repairStatusColors: Record<string, string> = {
  RECEIVED:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  DIAGNOSING:  'text-brand-400 bg-brand-500/10 border-brand-500/20',
  IN_PROGRESS: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  WAITING_PARTS: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  READY:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  DELIVERED:   'text-green-400 bg-green-500/10 border-green-500/20',
  CANCELLED:   'text-red-400 bg-red-500/10 border-red-500/20',
}

function formatCurrency(v: any) { return `Rs. ${Number(v ?? 0).toLocaleString('en-LK')}` }
function formatDate(d: string)  { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

/** Owner/admin password gate — same pattern as sales void/edit. */
function DeleteSerialPasswordModal({
  imei,
  statusLabel,
  onClose,
  onConfirm,
}: {
  imei: string
  statusLabel: string
  onClose: () => void
  onConfirm: (adminPassword: string) => Promise<void>
}) {
  const [adminPassword, setAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!adminPassword.trim()) {
      toast.error('Admin password is required')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(adminPassword)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
      <form
        className="rounded-xl w-full max-w-md border shadow-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); void submit() }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/15 text-red-500">
            <Lock size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Delete serial</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Enter the owner / admin password to permanently remove{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{imei}</span>
              {' '}({statusLabel}) from Serial Tracker.
            </p>
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: 'var(--text-secondary)' }}>
          This cannot be undone. In-stock units also reduce product stock by 1. Active hire-purchase locks block delete.
        </div>

        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="inline-flex items-center gap-1"><Lock size={11} /> Owner / Admin password</span>
          </label>
          <input
            type="password"
            autoFocus
            className="input-field w-full text-sm"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            placeholder="Enter owner password to confirm"
            autoComplete="current-password"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-3 py-2 text-xs font-semibold rounded-lg border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-white bg-red-600 hover:bg-red-500 disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete serial
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── IMEI Detail Modal (Sales Details layout) ─────────────────────────── */
function IMEIDetailModal({ imei, onClose, onStatusChange }: { imei: string; onClose: () => void; onStatusChange: () => void }) {
  const { canEdit } = useModuleAccess()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [warranty, setWarranty] = useState<any>(null)
  const [showDeleteGate, setShowDeleteGate] = useState(false)

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

  const handleDelete = async (adminPassword: string) => {
    if (!data?.record?.id) return
    try {
      await imeiApi.remove(data.record.id, { adminPassword })
      toast.success('Serial deleted')
      setShowDeleteGate(false)
      onStatusChange()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete serial')
      throw e
    }
  }

  const record = data?.record
  const repairs: any[] = data?.repairs ?? []
  const sale = data?.saleDetails
  const customer = data?.customerDetails
  const hirePurchase = data?.hirePurchaseAgreement
  const firstRepair = repairs[0]
  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

  const deviceName = (record?.product?.name
    ?? (firstRepair ? `${firstRepair.deviceBrand ?? ''} ${firstRepair.deviceModel ?? ''}`.trim() : '')) || '—'
  const brandName = record?.product?.brand?.name ?? firstRepair?.deviceBrand ?? '—'
  const ownerName = customer?.name ?? firstRepair?.customerName ?? '—'
  const ownerPhone = customer?.phone ?? firstRepair?.customerPhone ?? '—'
  const st = record ? (statusConfig[record.status] ?? statusConfig.IN_STOCK) : statusConfig.REPAIR_ONLY
  const statusOptions = ['IN_STOCK', 'SOLD', 'UNDER_HIRE_PURCHASE', 'IN_REPAIR', 'UNDER_WARRANTY_CLAIM', 'SCRAPPED']

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
            <Smartphone size={16} className="text-brand-500 mt-0.5 flex-shrink-0" />
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
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10 border-brand-500/25">
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
            <Loader2 size={24} className="animate-spin text-brand-400" />
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
                  {updating && <Loader2 size={12} className="animate-spin text-brand-400" />}
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

            {hirePurchase && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Hire Purchase Agreement
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
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Agreement</td>
                        <td className="px-3 py-2 font-mono font-medium text-emerald-600 dark:text-emerald-400">{hirePurchase.agreementNumber}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Status</td>
                        <td className="px-3 py-2 font-medium">{hirePurchase.status ?? '—'}</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Customer</td>
                        <td className="px-3 py-2 font-medium">{hirePurchase.customer?.name ?? '—'}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Phone</td>
                        <td className="px-3 py-2 font-medium">{hirePurchase.customer?.phone ?? '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Monthly</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(hirePurchase.monthlyInstallment)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Outstanding</td>
                        <td className="px-3 py-2 font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(hirePurchase.outstandingBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                          <span className="font-mono font-medium text-brand-600 dark:text-brand-400">{warranty.warrantyCode}</span>
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
                      <p className="text-[10px] mt-1 text-brand-600 dark:text-brand-400">From repair record</p>
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between pt-2">
              <div className="flex flex-col gap-1">
                {record && canEdit && (
                  <button
                    type="button"
                    disabled={updating || Boolean(hirePurchase)}
                    onClick={() => {
                      if (hirePurchase) {
                        toast.error(`Locked by hire purchase ${hirePurchase.agreementNumber}`)
                        return
                      }
                      if (!canEdit) return viewOnlyToast('IMEI')
                      setShowDeleteGate(true)
                    }}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold text-red-500 disabled:opacity-40"
                    style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}
                    title={hirePurchase ? 'Clear hire purchase before deleting' : 'Delete serial (requires admin password)'}
                  >
                    <Trash2 size={13} />
                    Delete serial
                  </button>
                )}
                {hirePurchase && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Delete blocked while hire purchase is active.
                  </p>
                )}
              </div>
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

      {showDeleteGate && record && (
        <DeleteSerialPasswordModal
          imei={imei}
          statusLabel={st.label}
          onClose={() => setShowDeleteGate(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function AddIMEIModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const activeBranchId = useActiveBranchId()
  const [form, setForm] = useState({ imei: '', productId: '' })
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [imeiError, setImeiError] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const todayBounds = useMemo(() => localDayBounds(0), [])
  const todayParams = useMemo(() => {
    const p: Record<string, string> = {
      limit: '5000',
      from: todayBounds.from,
      to: todayBounds.to,
    }
    if (activeBranchId) p.branchId = activeBranchId
    return p
  }, [activeBranchId, todayBounds.from, todayBounds.to])
  const { data: todayData, loading: todayLoading, refetch: refetchToday } = useImeiRecords(todayParams)
  const todayRecords: any[] = (todayData?.data ?? []) as any[]

  useEffect(() => {
    let cancelled = false
    setProductsLoading(true)
    const params: Record<string, string> = { limit: '5000', trackImei: 'true' }
    if (activeBranchId) params.branchId = activeBranchId
    productsApi.list(params)
      .then((r: any) => {
        if (cancelled) return
        const rows = (r.data ?? []) as any[]
        // Only serialized / IMEI-tracked inventory products
        setProducts(rows.filter((p: any) => p.trackImei).sort((a: any, b: any) =>
          String(a.name ?? '').localeCompare(String(b.name ?? '')),
        ))
      })
      .catch(() => { if (!cancelled) setProducts([]) })
      .finally(() => { if (!cancelled) setProductsLoading(false) })
    return () => { cancelled = true }
  }, [activeBranchId])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brandName?.toLowerCase().includes(q) ||
      p.brand?.name?.toLowerCase().includes(q),
    )
  }, [products, productSearch])

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    if (k === 'imei') setImeiError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const serial = normalizeSerial(form.imei)
    const err = serialValidationMessage(serial)
    if (err) { setImeiError(err); return }
    if (!form.productId) { toast.error('Select a product'); return }
    setLoading(true)
    try {
      const selectedProduct = products.find((p: any) => p.id === form.productId)
      const branchId = activeBranchId || selectedProduct?.branchId
      if (!branchId) { toast.error('No active branch — switch branch in header'); return }
      await imeiApi.create({ imei: serial, productId: form.productId, branchId })
      toast.success('Serial registered successfully')
      setForm({ imei: '', productId: form.productId })
      refetchToday()
      onSaved()
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('already')) {
        setImeiError('Duplicate serial — this unit is already in the system.')
      } else {
        toast.error(err?.message ?? 'Failed to register serial')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Register Serial / IMEI</h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
              Link serial · Today&apos;s inventory registrations ({todayRecords.length})
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1.5">Serial Number / IMEI *</label>
              <input
                required maxLength={SERIAL_MAX_LEN}
                className={`input-field font-mono tracking-wide uppercase ${imeiError ? 'border-red-500/50' : ''}`}
                placeholder="SN123456789 or 15-digit IMEI"
                value={form.imei} onChange={f('imei')}
              />
              {imeiError && <p className="text-xs text-red-400 mt-1">{imeiError}</p>}
              {form.imei && isValidUnitSerial(form.imei) && !imeiError && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle size={11} />Valid format</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-gray-600 dark:text-slate-400">Product * (IMEI / serial tracked)</label>
                <span className="text-[10px] font-mono text-slate-500">
                  {productsLoading ? '…' : `${filteredProducts.length}/${products.length}`}
                </span>
              </div>
              <input
                type="search"
                className="input-field text-sm mb-2"
                placeholder="Search product name, SKU, brand…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              <select
                required
                className="input-field"
                value={form.productId}
                onChange={f('productId')}
                disabled={productsLoading}
                size={Math.min(10, Math.max(4, filteredProducts.length || 4))}
              >
                <option value="">{productsLoading ? 'Loading products…' : 'Select product...'}</option>
                {filteredProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.sku}{p.brandName || p.brand?.name ? ` · ${p.brandName || p.brand?.name}` : ''}
                  </option>
                ))}
              </select>
              {!productsLoading && products.length === 0 && (
                <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={11} />
                  No serial-tracked products in this branch. Enable Serial Tracking on the product first.
                </p>
              )}
              {!productsLoading && products.length > 0 && filteredProducts.length === 0 && (
                <p className="text-xs text-slate-500 mt-1.5">No products match “{productSearch}”.</p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Done</button>
              <button type="submit" disabled={loading || productsLoading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Register Serial
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/5 bg-white/[0.03]">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-gray-200">
                <Calendar size={12} className="text-brand-400" />
                Registered today (inventory)
              </p>
              <span className="text-[10px] font-mono text-slate-500">{todayRecords.length} unit{todayRecords.length === 1 ? '' : 's'}</span>
            </div>
            {todayLoading ? (
              <div className="p-6 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
            ) : todayRecords.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">No serials registered today yet — Add Stock or register above.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
                {todayRecords.map((r: any) => (
                  <li key={r.id} className="px-3 py-2 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                      <Smartphone size={12} className="text-brand-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-200 truncate">{r.product?.name ?? '—'}</p>
                      <p className="text-[11px] font-mono text-slate-500">{r.imei}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-500">{formatDateTime(r.createdAt)}</p>
                      <p className="text-[10px] text-green-400/90">{r.status === 'IN_STOCK' ? 'In Stock' : (statusConfig[r.status]?.label ?? r.status)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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
  const [dayFilter,    setDayFilter]    = useState<'today' | 'all'>('today')
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
      setDayFilter('all')
    }
  }, [canEdit, searchParams])
  const branchId = useActiveBranchId()
  const imeiParams = useMemo(() => {
    const p: Record<string, string> = { limit: '5000' }
    if (branchId) p.branchId = branchId
    if (dayFilter === 'today') {
      const { from, to } = localDayBounds(0)
      p.from = from
      p.to = to
    }
    return p
  }, [branchId, dayFilter])
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Serial / Device" />,
      cell: ({ row }) => (
        <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => openDetail(row.original.imei)}>
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <Smartphone size={14} className="text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-medium hover:text-brand-400 transition-colors" style={{ color: 'var(--text-primary)' }}>{row.original.product?.name ?? '—'}</p>
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
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-slate-500">
          {dayFilter === 'today' ? formatDateTime(row.original.createdAt) : formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'action',
      header: () => null,
      cell: ({ row }) => (
        <button
          onClick={() => openDetail(row.original.imei)}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-brand-500/30 text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 transition-colors flex items-center gap-1"
        >
          <History size={10} />Details
        </button>
      ),
    },
  ], [openDetail, dayFilter])

  const stats = [
    { label: dayFilter === 'today' ? 'Today' : 'Total Tracked', value: total, icon: Smartphone, tone: 'brand' as const, filter: 'all' as const },
    { label: 'In Stock',       value: counts.inStock,       icon: CheckCircle, tone: 'success' as const, filter: 'IN_STOCK' as const },
    { label: 'Sold',           value: counts.sold,          icon: ShoppingBag, tone: 'info' as const, filter: 'SOLD' as const },
    { label: 'Repair Records', value: counts.repairOnly,    icon: History,     tone: 'warning' as const, filter: 'REPAIR_ONLY' as const },
  ]

  return (
    <div className="space-y-6">
      {canEdit && showAdd && <AddIMEIModal onClose={() => setShowAdd(false)} onSaved={refetch} />}
      {selectedImei  && <IMEIDetailModal imei={selectedImei} onClose={() => setSelectedImei(null)} onStatusChange={refetch} />}

      <PageHeader
        title="Serial Tracker"
        subtitle={dayFilter === 'today'
          ? `Today's inventory serial / IMEI registrations · ${total} unit${total === 1 ? '' : 's'}`
          : 'Track every unit by serial or IMEI · Full repair & sale history'}
        actions={
          <>
            <button
              onClick={() => setScanMode(!scanMode)}
              className={`btn-secondary text-sm flex items-center gap-2 ${scanMode ? 'border-brand-500/40 text-brand-400' : ''}`}
            >
              <Hash size={14} />{scanMode ? 'Scanner On' : 'Scan Serial'}
            </button>
            <EditOnly><button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus size={14} />Register Unit
            </button></EditOnly>
          </>
        }
      />

      {/* Quick Serial Lookup */}
      <div className="card p-4 border-brand-500/15">
        <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Search size={11} />Quick Serial / IMEI Lookup
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input-field font-mono flex-1"
            placeholder="Enter serial or IMEI to lookup unit history..."
            value={quickSearch}
            onChange={e => { setQuickSearch(e.target.value); setQuickResult(null) }}
            onKeyDown={e => e.key === 'Enter' && handleQuickLookup()}
            maxLength={SERIAL_MAX_LEN}
          />
          <button
            onClick={handleQuickLookup}
            disabled={!quickSearch.trim() || quickResult === 'loading'}
            className="btn-primary text-sm px-4 flex items-center justify-center gap-2 disabled:opacity-50 h-10"
          >
            {quickResult === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Lookup
          </button>
        </div>
        {quickResult === 'notfound' && (
          <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5"><AlertTriangle size={11} />Serial / IMEI not found in this shop&apos;s records</p>
        )}
      </div>

      {/* Scan mode */}
      {scanMode && (
        <div className="card p-4 border-brand-500/20 bg-brand-500/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            <Hash size={18} className="text-brand-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-600 dark:text-brand-300">Serial Scanner Active</p>
            <p className="text-xs text-gray-500 dark:text-slate-500">Scan barcode or type serial / IMEI then press Enter</p>
          </div>
          <input
            autoFocus className="input-field max-w-xs font-mono"
            placeholder="Scan or type serial / IMEI..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) { setSelectedImei(val); setScanMode(false) }
              }
            }}
          />
        </div>
      )}

      <StatGrid cols={4}>
        {stats.map(({ label, value, icon, tone, filter }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            tone={tone}
            active={statusFilter === filter}
            onClick={() => setStatusFilter(filter)}
          />
        ))}
      </StatGrid>

      <FilterBar>
        <SegmentedControl
          size="sm"
          value={dayFilter}
          onChange={setDayFilter}
          options={[
            { id: 'today', label: dayFilter === 'today' ? `Today (${total})` : 'Today' },
            { id: 'all', label: 'All time' },
          ]}
        />
        <ToolbarSearch
          value={listSearch}
          onChange={setListSearch}
          placeholder="Filter by serial, product, brand…"
          className="max-w-md w-full sm:min-w-[220px]"
        />
      </FilterBar>

      <ClientSideTable
        data={filteredRecords}
        columns={columns}
        isLoading={loading}
        pageSize={50}
        pageCount={Math.ceil((filteredRecords.length || 1) / 50)}
        searchableColumns={[]}
        showFilter={false}
      />
    </div>
  )
}
