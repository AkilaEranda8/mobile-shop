'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, X, Loader2, ArrowLeftRight, Trash2, Phone, RefreshCw,
  Receipt, Smartphone, Package, ArrowDownLeft, ArrowUpRight, Printer,
  Calendar, Hash, User, CreditCard,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exchangesApi, salesApi, tenantApi } from '@/lib/api'
import { ExchangeWizard } from '@/components/exchanges/ExchangeWizard'
import { getInvoiceSettings, fetchInvoiceSettings, shopContextFromTenant, type InvoiceSettings, type ShopContext } from '@/lib/invoiceSettings'
import { buildReceiptFromApiSale, printReceipt, receiptPrintLabel } from '@/lib/printReceipt'
import { tradeInFromExchange, soldVariantFromExchange } from '@/lib/exchangeBill'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent', badge: 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300' },
  { value: 'GOOD',      label: 'Good',      badge: 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/25 text-green-700 dark:text-green-300' },
  { value: 'FAIR',      label: 'Fair',      badge: 'bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/25 text-amber-700 dark:text-amber-300' },
  { value: 'POOR',      label: 'Poor',      badge: 'bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/25 text-rose-700 dark:text-rose-300' },
]

/* ── Exchange Detail Modal (Sales Details layout) ────────────────────── */
function ExchangeDetailModal({
  exchange,
  invSettings,
  shopCtx,
  onClose,
  onDeleted,
}: {
  exchange: any
  invSettings: InvoiceSettings
  shopCtx?: ShopContext
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const cond = CONDITIONS.find(c => c.value === exchange.oldCondition) ?? CONDITIONS[1]
  const isShopRefund = exchange.balanceDirection === 'SHOP_REFUNDS'
  const balanceLabel = isShopRefund ? 'Shop Refunded' : 'Customer Paid'
  const hasNewDevice = !!(exchange.newBrand || exchange.newModel)
  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handlePrint = async () => {
    if (!exchange.saleId) {
      toast.error('No invoice linked to this exchange')
      return
    }
    setPrinting(true)
    try {
      const res: any = await salesApi.getById(exchange.saleId)
      const sale = res.data ?? res
      printReceipt(
        buildReceiptFromApiSale(sale, {
          customerAddress: exchange.customerAddress,
          tradeIn: tradeInFromExchange(exchange),
          soldVariant: soldVariantFromExchange(exchange),
        }),
        invSettings,
        shopCtx,
      )
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to print receipt')
    } finally {
      setPrinting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this exchange record?')) return
    setDeleting(true)
    try {
      await exchangesApi.remove(exchange.id)
      toast.success('Deleted')
      onDeleted(); onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed')
    } finally { setDeleting(false) }
  }

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
            <ArrowLeftRight size={16} className="text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Exchange Details ( Exchange No : <span className="font-mono">{safeText(exchange.exchangeNumber)}</span> )
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {safeText(exchange.customerName)}
                {exchange.invoiceNumber ? ` · Invoice ${exchange.invoiceNumber}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${cond.badge}`}>
              {cond.label}
            </span>
            {exchange.invoiceNumber ? (
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
                Invoiced
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25">
                No Invoice
              </span>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
              title="Delete exchange"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
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
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(formatDate(exchange.createdAt))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Exchange No:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(exchange.exchangeNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Receipt size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Invoice No:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(exchange.invoiceNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Balance:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {exchange.balanceAmount != null ? `${balanceLabel} · ${formatCurrency(exchange.balanceAmount)}` : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Customer name:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(exchange.customerName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(exchange.customerPhone)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(exchange.customerAddress)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Condition:</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${cond.badge}`}>{cond.label}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>LKR</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Trade-in value</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(exchange.exchangeValue ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Sold price</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {exchange.newDevicePrice != null ? formatCurrency(exchange.newDevicePrice) : '—'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold">{balanceLabel}</span>
                  <span className={`font-semibold ${isShopRefund ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {exchange.balanceAmount != null ? formatCurrency(exchange.balanceAmount) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Devices + totals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Trade-in device */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <ArrowDownLeft size={12} /> Device received (Trade-in)
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left">Device</th>
                        <th className="px-3 py-2 text-left">IMEI</th>
                        <th className="px-3 py-2 text-left">Colour / Storage</th>
                        <th className="px-3 py-2 text-left">Condition</th>
                        <th className="px-3 py-2 text-right">Buy Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {safeText([exchange.oldBrand, exchange.oldModel].filter(Boolean).join(' '))}
                        </td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{safeText(exchange.oldImei)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                          {safeText([exchange.oldStorage, exchange.oldColor].filter(Boolean).join(' · '))}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${cond.badge}`}>{cond.label}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {formatCurrency(exchange.exchangeValue ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sold device */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <ArrowUpRight size={12} /> Device sold (New)
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[560px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left">Device</th>
                        <th className="px-3 py-2 text-left">IMEI</th>
                        <th className="px-3 py-2 text-right">Sell Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasNewDevice ? (
                        <tr className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {safeText([exchange.newBrand, exchange.newModel].filter(Boolean).join(' '))}
                          </td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{safeText(exchange.newImei)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {exchange.newDevicePrice != null ? formatCurrency(exchange.newDevicePrice) : '—'}
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No sold device recorded</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Customer:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    {safeText(exchange.customerName)}
                    {exchange.customerPhone ? ` · ${exchange.customerPhone}` : ''}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Exchange note:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{safeText(exchange.notes)}</p>
                </div>
              </div>
            </div>

            {/* Right totals */}
            <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Total</p>
                <p className={`text-[12px] font-semibold ${isShopRefund ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {exchange.balanceAmount != null ? formatCurrency(exchange.balanceAmount) : formatCurrency(exchange.exchangeValue ?? 0)}
                </p>
              </div>
              <div className="p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Trade-in value:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(exchange.exchangeValue ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Sold price:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {exchange.newDevicePrice != null ? formatCurrency(exchange.newDevicePrice) : '—'}
                  </span>
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{balanceLabel}:</span>
                    <span className={`font-semibold ${isShopRefund ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {exchange.balanceAmount != null ? formatCurrency(exchange.balanceAmount) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Invoice:</span>
                    <span className="font-medium font-mono">{safeText(exchange.invoiceNumber)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2">
            {exchange.saleId && (
              <button
                type="button"
                onClick={handlePrint}
                disabled={printing}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 font-semibold disabled:opacity-60"
              >
                {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                {printing ? 'Loading…' : receiptPrintLabel(invSettings)}
              </button>
            )}
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

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function ExchangesPage() {
  const searchParams = useSearchParams()
  const [records, setRecords]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [textSearch, setTextSearch] = useState('')
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [shopCtx, setShopCtx] = useState<ShopContext | undefined>(undefined)

  const fetchExchanges = useCallback(() => {
    setLoading(true)
    exchangesApi.list({ limit: '200' })
      .then((r: any) => setRecords(r.data ?? []))
      .catch(() => toast.error('Failed to load exchanges'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchExchanges() }, [fetchExchanges])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new' || action === 'add' || searchParams.get('new') === '1') setShowNew(true)
    const id = searchParams.get('id')
    if (!id || !records.length) return
    const found = records.find(r => r.id === id)
    if (found) setSelected(found)
  }, [searchParams, records])

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    const branchId = getActiveBranchId()
    const loadSettings = () => {
      Promise.all([
        fetchInvoiceSettings(user.tenantId, branchId),
        tenantApi.get(user.tenantId).catch(() => null),
      ]).then(([settings, tenantRes]) => {
        setInvSettings(settings)
        const tenant = (tenantRes as any)?.data ?? tenantRes
        setShopCtx(shopContextFromTenant(tenant, branchId))
      }).catch(() => {})
    }
    loadSettings()
    window.addEventListener('invoice-settings-updated', loadSettings)
    return () => window.removeEventListener('invoice-settings-updated', loadSettings)
  }, [])

  const stats = useMemo(() => {
    const withInvoice = records.filter(r => r.invoiceNumber).length
    const refunds = records.filter(r => r.balanceDirection === 'SHOP_REFUNDS').length
    const totalBuy = records.reduce((s, r) => s + (r.exchangeValue ?? 0), 0)
    const totalSold = records.reduce((s, r) => s + (r.newDevicePrice ?? 0), 0)
    return { total: records.length, withInvoice, refunds, totalBuy, totalSold }
  }, [records])

  const openDetail = useCallback((row: any) => setSelected(row), [])

  const filteredRecords = useMemo(() => {
    const q = textSearch.trim().toLowerCase()
    if (!q) return records
    return records.filter(r =>
      r.exchangeNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.customerPhone?.toLowerCase().includes(q) ||
      `${r.oldBrand ?? ''} ${r.oldModel ?? ''}`.toLowerCase().includes(q) ||
      `${r.newBrand ?? ''} ${r.newModel ?? ''}`.toLowerCase().includes(q)
    )
  }, [records, textSearch])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'exchangeNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Exchange #" />,
      cell: ({ row }) => (
        <button type="button" onClick={() => openDetail(row.original)}
          className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 hover:underline text-left">
          {row.original.exchangeNumber}
        </button>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <button type="button" className="text-left" onClick={() => openDetail(row.original)}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-[11px] font-bold text-amber-600 dark:text-amber-300 flex-shrink-0">
              {row.original.customerName?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="text-sm font-medium hover:text-amber-500 transition-colors" style={{ color: 'var(--text-primary)' }}>{row.original.customerName}</p>
              <p className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                <Phone size={9} />{row.original.customerPhone}
              </p>
            </div>
          </div>
        </button>
      ),
    },
    {
      id: 'oldDevice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Trade-in" />,
      cell: ({ row }) => {
        const cond = CONDITIONS.find(c => c.value === row.original.oldCondition) ?? CONDITIONS[1]
        return (
          <div>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.oldBrand} {row.original.oldModel}</p>
            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cond.badge}`}>{cond.label}</span>
            {row.original.oldImei && <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{row.original.oldImei}</p>}
          </div>
        )
      },
    },
    {
      id: 'newDevice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sold Phone" />,
      cell: ({ row }) => row.original.newBrand ? (
        <div>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.newBrand} {row.original.newModel}</p>
          {row.original.newImei && <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{row.original.newImei}</p>}
        </div>
      ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      accessorKey: 'exchangeValue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Buy Price" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(row.original.exchangeValue)}</span>,
    },
    {
      id: 'balance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
      cell: ({ row }) => row.original.balanceAmount != null ? (
        <div>
          <span className={`text-sm font-bold ${row.original.balanceDirection === 'SHOP_REFUNDS' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatCurrency(row.original.balanceAmount)}
          </span>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {row.original.balanceDirection === 'SHOP_REFUNDS' ? 'Shop refunds' : 'Customer pays'}
          </p>
        </div>
      ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => row.original.invoiceNumber
        ? <span className="text-xs font-mono text-violet-600 dark:text-violet-400">{row.original.invoiceNumber}</span>
        : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <TableActionsRow showAction={{ action: () => openDetail(row.original) }} />
      ),
    },
  ], [openDetail])

  return (
    <div className="space-y-6">
      {showNew && <ExchangeWizard onClose={() => setShowNew(false)} onSaved={fetchExchanges} />}
      {selected && (
        <ExchangeDetailModal
          exchange={selected}
          invSettings={invSettings}
          shopCtx={shopCtx}
          onClose={() => setSelected(null)}
          onDeleted={fetchExchanges}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Device Exchanges</h1>
          <p className="page-subtitle">Trade-in purchases, stock updates, and exchange invoices</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button type="button" onClick={fetchExchanges} disabled={loading}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button" onClick={() => setShowNew(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />New Exchange
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Exchanges', value: String(stats.total),       icon: <ArrowLeftRight size={15} />, color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.22)'  },
          { label: 'Trade-in Value',  value: formatCurrency(stats.totalBuy),  icon: <Package size={15} />,      color: 'var(--brand-primary)', bg: 'var(--brand-glow)', border: 'var(--sidebar-active-border)' },
          { label: 'With Invoice',    value: String(stats.withInvoice), icon: <Receipt size={15} />,      color: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.22)'  },
          { label: 'Shop Refunds',    value: String(stats.refunds),     icon: <Smartphone size={15} />,   color: '#e11d48', bg: 'rgba(225,29,72,0.08)',  border: 'rgba(225,29,72,0.22)'  },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>
                {icon}
              </div>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {records.length > 0 && (
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          placeholder="Search exchange #, customer, device…"
          className="max-w-md"
        />
      )}

      {/* Table or Empty */}
      {!loading && records.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No exchange records yet"
          description="Accept customer trade-ins, sell a phone from stock, and generate an exchange invoice in one flow."
          accentColor="amber"
          actions={[{ label: 'Start First Exchange', onClick: () => setShowNew(true), primary: true }]}
          hints={[
            'Trade-in phone is added to inventory with EXCHANGE_IN stock movement.',
            'Sold phone IMEI is marked SOLD and linked to the invoice.',
            'Balance = sell price minus buy price (customer pays or shop refunds).',
          ]}
        />
      ) : (
        <ClientSideTable
          data={filteredRecords}
          columns={columns}
          isLoading={loading}
          pageCount={Math.ceil((filteredRecords.length || 1) / 20)}
          searchableColumns={[]}
          showFilter={false}
        />
      )}
    </div>
  )
}
