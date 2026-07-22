'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Route, Package, ShoppingCart, Truck, History, BarChart3, Hash,
  FileSpreadsheet, FileText, Printer, Loader2, ExternalLink,
  Clock, TrendingUp, Users, Receipt, AlertTriangle, Building2,
  Tag, Layers, ArrowLeft, X, Calendar, Smartphone, ArrowLeftRight,
} from 'lucide-react'
import { productTraceabilityApi, productsApi } from '@/lib/api'
import { useBranches } from '@/lib/hooks'
import { PERMISSIONS, useHasPermission } from '@/lib/permissions'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  exportTraceabilityExcel,
  exportTraceabilityPdf,
  printTraceabilityReport,
} from '@/lib/product-traceability-export'
import toast from 'react-hot-toast'

type PaginatedMeta = { total: number; page: number; limit: number; totalPages: number }

const safeText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-LK', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Paginator({
  meta, page, onPage, pageSize, onPageSize,
}: {
  meta: PaginatedMeta | null
  page: number
  onPage: (p: number) => void
  pageSize: number
  onPageSize: (n: number) => void
}) {
  if (!meta || meta.total === 0) return null
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t text-[11px]"
      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}
    >
      <span>{meta.total.toLocaleString()} records · Page {page} of {meta.totalPages}</span>
      <div className="flex items-center gap-2">
        <select
          className="input-field py-1 px-2 text-[11px] w-auto"
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}
        >
          {[10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button type="button" className="btn-secondary text-[11px] py-1 px-2" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <button type="button" className="btn-secondary text-[11px] py-1 px-2" disabled={page >= meta.totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}

function DetailPanel({
  title, icon: Icon, children, loading, emptyLabel,
}: {
  title: string
  icon: typeof Package
  children: ReactNode
  loading?: boolean
  emptyLabel?: string
}) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
        <Icon size={12} /> {title}
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-emerald-500" />
          </div>
        ) : children ?? (
          <p className="text-[12px] py-8 text-center" style={{ color: 'var(--text-muted)' }}>{emptyLabel ?? 'No records found'}</p>
        )}
      </div>
    </div>
  )
}

function DataTable({ columns, rows, emptyLabel }: {
  columns: { key: string; label: string; align?: 'left' | 'right'; render?: (row: Record<string, unknown>) => ReactNode }[]
  rows: Record<string, unknown>[]
  emptyLabel?: string
}) {
  if (!rows.length) {
    return <p className="text-[12px] py-8 text-center" style={{ color: 'var(--text-muted)' }}>{emptyLabel ?? 'No records found'}</p>
  }
  return (
    <table className="min-w-[640px] w-full text-[12px]">
      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
        <tr style={{ color: 'var(--text-secondary)' }}>
          {columns.map(c => (
            <th key={c.key} className={`px-3 py-2 font-medium whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={String(row.id ?? i)} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
            {columns.map(c => (
              <td
                key={c.key}
                className={`px-3 py-2 align-top ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                style={{ color: 'var(--text-primary)' }}
              >
                {c.render ? c.render(row) : safeText(row[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const linkClass = 'text-violet-600 dark:text-violet-300 hover:underline inline-flex items-center gap-1 font-medium'

const SECTIONS = [
  { id: 'purchases', label: 'Purchases', icon: Truck },
  { id: 'sales', label: 'Customer Sales', icon: ShoppingCart },
  { id: 'transfers', label: 'Stock Transfers', icon: ArrowLeftRight },
  { id: 'movements', label: 'Movements', icon: Package },
  { id: 'serials', label: 'Serial / IMEI', icon: Hash },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export default function ProductTraceabilityPage() {
  const params = useParams()
  const router = useRouter()
  const productId = String(params.productId ?? '')
  const canView = useHasPermission(PERMISSIONS.PRODUCT_TRACEABILITY_VIEW)
  const { data: branchesRes } = useBranches()
  const branches: Array<{ id: string; name: string }> = (branchesRes as any)?.data ?? branchesRes ?? []

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [branchId, setBranchId] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('purchases')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [productDetail, setProductDetail] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [sectionRows, setSectionRows] = useState<Record<string, unknown>[]>([])
  const [sectionMeta, setSectionMeta] = useState<PaginatedMeta | null>(null)
  const [exporting, setExporting] = useState(false)

  const filterParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: String(pageSize) }
    if (search.trim()) p.search = search.trim()
    if (from) p.from = from
    if (to) p.to = to
    if (branchId) p.branchId = branchId
    return p
  }, [search, from, to, branchId, page, pageSize])

  const loadSummary = useCallback(async () => {
    if (!productId) return
    setSummaryLoading(true)
    try {
      const [detailRes, summaryRes]: any[] = await Promise.all([
        productsApi.getById(productId).catch(() => null),
        productTraceabilityApi.summary(productId, {
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(branchId ? { branchId } : {}),
        }),
      ])
      if (detailRes) setProductDetail(detailRes.data ?? detailRes)
      setSummary(summaryRes?.data ?? summaryRes)
    } catch {
      toast.error('Failed to load product traceability')
    } finally {
      setSummaryLoading(false)
    }
  }, [productId, search, from, to, branchId])

  const loadSection = useCallback(async () => {
    if (!productId || activeSection === 'analytics') return
    setSectionLoading(true)
    try {
      const apiMap = {
        purchases: productTraceabilityApi.purchases,
        sales: productTraceabilityApi.sales,
        transfers: productTraceabilityApi.transfers,
        movements: productTraceabilityApi.movements,
        serials: productTraceabilityApi.serials,
        timeline: productTraceabilityApi.timeline,
      } as const
      const res: any = await apiMap[activeSection](productId, filterParams)
      setSectionRows(res.data ?? [])
      setSectionMeta(res.meta ?? null)
    } catch {
      toast.error('Failed to load section data')
      setSectionRows([])
      setSectionMeta(null)
    } finally {
      setSectionLoading(false)
    }
  }, [productId, activeSection, filterParams])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadSection() }, [loadSection])
  useEffect(() => { setPage(1) }, [search, from, to, branchId, activeSection])

  const handleExport = async (mode: 'excel' | 'pdf' | 'print') => {
    const product = summary?.product
    if (!product) return
    setExporting(true)
    try {
      const base = {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(branchId ? { branchId } : {}),
        limit: '5000',
        page: '1',
      }
      const [purchases, sales, transfers, movements, serials, timeline] = await Promise.all([
        productTraceabilityApi.purchases(productId, base),
        productTraceabilityApi.sales(productId, base),
        productTraceabilityApi.transfers(productId, base),
        productTraceabilityApi.movements(productId, base),
        productTraceabilityApi.serials(productId, base),
        productTraceabilityApi.timeline(productId, base),
      ])
      const payload = {
        productName: product.name,
        sku: product.sku,
        generatedAt: new Date().toLocaleString('en-LK'),
        analytics: summary.analytics ?? {},
        purchases: (purchases as any).data ?? [],
        sales: (sales as any).data ?? [],
        transfers: (transfers as any).data ?? [],
        movements: (movements as any).data ?? [],
        serials: (serials as any).data ?? [],
        timeline: (timeline as any).data ?? [],
      }
      if (mode === 'excel') exportTraceabilityExcel(payload)
      else if (mode === 'pdf') exportTraceabilityPdf(payload)
      else printTraceabilityReport(payload)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!canView) {
    return (
      <div
        className="rounded-xl border max-w-lg mx-auto p-8 text-center space-y-3"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <AlertTriangle className="mx-auto text-amber-400" size={32} />
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Access Denied</h1>
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          You need the <strong>PRODUCT_TRACEABILITY_VIEW</strong> permission to access this page.
        </p>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-violet-700 dark:text-violet-300 border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20"
        >
          <ArrowLeft size={12} /> Back to Inventory
        </Link>
      </div>
    )
  }

  const product = summary?.product
  const analytics = summary?.analytics
  const currentStock = product?.currentStock ?? productDetail?.stock ?? 0
  const isOut = currentStock === 0
  const isLow = currentStock > 0 && currentStock < (productDetail?.minStock ?? 5)
  const stockLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'
  const stockBadgeClass = isOut
    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25'
    : isLow
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25'
      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'

  const purchaseColumns = [
    { key: 'purchaseOrderNo', label: 'PO No', render: (r: Record<string, unknown>) => (
      <Link href={`/purchase-invoice?id=${r.purchaseOrderId}`} className={linkClass}>{safeText(r.purchaseOrderNo)} <ExternalLink size={10} /></Link>
    ) },
    { key: 'purchaseInvoiceNo', label: 'Invoice No' },
    { key: 'supplierName', label: 'Supplier', render: (r: Record<string, unknown>) => (
      <Link href={`/suppliers?id=${r.supplierId}`} className={linkClass}>{safeText(r.supplierName)}</Link>
    ) },
    { key: 'purchaseDate', label: 'Date', render: (r: Record<string, unknown>) => formatDateShort(r.purchaseDate as string) },
    { key: 'warehouseName', label: 'Warehouse' },
    { key: 'quantityPurchased', label: 'Qty', align: 'right' as const },
    { key: 'unitCost', label: 'Unit Cost', align: 'right' as const, render: (r: Record<string, unknown>) => formatCurrency(Number(r.unitCost)) },
    { key: 'totalCost', label: 'Total', align: 'right' as const, render: (r: Record<string, unknown>) => formatCurrency(Number(r.totalCost)) },
    { key: 'receivedBy', label: 'Received By' },
    { key: 'status', label: 'Status' },
    { key: 'view', label: '', render: (r: Record<string, unknown>) => (
      <Link href={`/purchase-invoice?id=${r.purchaseOrderId}`} className={`${linkClass} text-[11px]`}>View</Link>
    ) },
  ]

  const salesColumns = [
    { key: 'invoiceNumber', label: 'Invoice Number', render: (r: Record<string, unknown>) => (
      <Link href={`/sales?id=${r.saleId}`} className={linkClass}>{safeText(r.invoiceNumber)} <ExternalLink size={10} /></Link>
    ) },
    { key: 'customerName', label: 'Customer Name', render: (r: Record<string, unknown>) => (
      r.customerId
        ? <Link href={`/customers?customerId=${r.customerId}`} className={linkClass}>{safeText(r.customerName)}</Link>
        : safeText(r.customerName)
    ) },
    { key: 'contactNumber', label: 'Contact' },
    { key: 'invoiceDate', label: 'Date', render: (r: Record<string, unknown>) => formatDateShort(r.invoiceDate as string) },
    { key: 'quantityPurchased', label: 'Qty', align: 'right' as const },
    { key: 'sellingPrice', label: 'Price', align: 'right' as const, render: (r: Record<string, unknown>) => formatCurrency(Number(r.sellingPrice)) },
    { key: 'discount', label: 'Discount', align: 'right' as const, render: (r: Record<string, unknown>) => formatCurrency(Number(r.discount)) },
    { key: 'invoiceTotal', label: 'Total', align: 'right' as const, render: (r: Record<string, unknown>) => formatCurrency(Number(r.invoiceTotal)) },
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'paymentStatus', label: 'Payment' },
    { key: 'view', label: '', render: (r: Record<string, unknown>) => (
      <Link href={`/sales?id=${r.saleId}`} className={`${linkClass} text-[11px]`}>View</Link>
    ) },
  ]

  const movementColumns = [
    { key: 'dateTime', label: 'Date & Time', render: (r: Record<string, unknown>) => formatDateTime(r.dateTime as string) },
    { key: 'transactionType', label: 'Type' },
    { key: 'referenceNumber', label: 'Reference', render: (r: Record<string, unknown>) => <span className="font-mono text-[11px]">{safeText(r.referenceNumber)}</span> },
    { key: 'warehouseName', label: 'Warehouse' },
    { key: 'stockIn', label: 'In', align: 'right' as const, render: (r: Record<string, unknown>) => Number(r.stockIn) > 0 ? safeText(r.stockIn) : '—' },
    { key: 'stockOut', label: 'Out', align: 'right' as const, render: (r: Record<string, unknown>) => Number(r.stockOut) > 0 ? safeText(r.stockOut) : '—' },
    { key: 'runningBalance', label: 'Balance', align: 'right' as const, render: (r: Record<string, unknown>) => safeText(r.runningBalance) },
    { key: 'performedBy', label: 'By' },
    { key: 'remarks', label: 'Remarks' },
  ]

  const transferColumns = [
    { key: 'dateTime', label: 'Date & Time', render: (r: Record<string, unknown>) => formatDateTime(r.dateTime as string) },
    { key: 'reference', label: 'Reference', render: (r: Record<string, unknown>) => <span className="font-mono text-[11px]">{safeText(r.reference)}</span> },
    { key: 'directionLabel', label: 'Direction', render: (r: Record<string, unknown>) => {
      const dir = String(r.direction ?? '')
      const cls = dir === 'IN'
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25'
        : dir === 'OUT'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
          : 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25'
      return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cls}`}>
          {safeText(r.directionLabel)}
        </span>
      )
    } },
    { key: 'route', label: 'From → To' },
    { key: 'quantity', label: 'Qty', align: 'right' as const },
    { key: 'variant', label: 'Variant' },
    { key: 'imeis', label: 'IMEI', render: (r: Record<string, unknown>) => (
      <span className="font-mono text-[10px] max-w-[12rem] inline-block truncate" title={safeText(r.imeis)}>{safeText(r.imeis)}</span>
    ) },
    { key: 'notes', label: 'Notes' },
    { key: 'performedBy', label: 'By' },
    { key: 'view', label: '', render: () => (
      <Link href="/dashboard/stock-transfer" className={`${linkClass} text-[11px]`}>Open</Link>
    ) },
  ]

  const serialColumns = [
    { key: 'serialImei', label: 'Serial / IMEI', render: (r: Record<string, unknown>) => <span className="font-mono text-[11px]">{safeText(r.serialImei)}</span> },
    { key: 'currentStatus', label: 'Status' },
    { key: 'purchaseInvoiceNo', label: 'Purchase Inv.', render: (r: Record<string, unknown>) => (
      r.purchaseInvoiceId ? <Link href={`/purchase-invoice?id=${r.purchaseInvoiceId}`} className={linkClass}>{safeText(r.purchaseInvoiceNo)}</Link> : '—'
    ) },
    { key: 'salesInvoiceNo', label: 'Sales Inv.', render: (r: Record<string, unknown>) => (
      r.salesInvoiceId ? <Link href={`/sales?id=${r.salesInvoiceId}`} className={linkClass}>{safeText(r.salesInvoiceNo)}</Link> : '—'
    ) },
    { key: 'customerName', label: 'Customer', render: (r: Record<string, unknown>) => (
      r.customerId ? <Link href={`/customers?customerId=${r.customerId}`} className={linkClass}>{safeText(r.customerName)}</Link> : safeText(r.customerName)
    ) },
    { key: 'warrantyStatus', label: 'Warranty' },
    { key: 'soldDate', label: 'Sold Date', render: (r: Record<string, unknown>) => formatDateShort(r.soldDate as string) },
  ]

  const sectionTitle = SECTIONS.find(s => s.id === activeSection)?.label ?? 'History'
  const sectionIcon = SECTIONS.find(s => s.id === activeSection)?.icon ?? History

  return (
    <div className="w-full max-w-none pb-8">
      <div
        className="rounded-xl shadow-sm border overflow-hidden w-full"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
      >
        {/* Sticky header — matches Product Details modal */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-20"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Route size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Product Traceability ( SKU : <span className="font-mono">{safeText(product?.sku ?? productDetail?.sku)}</span> )
                {summaryLoading && <Loader2 size={12} className="inline-block ml-2 animate-spin text-slate-400" />}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{safeText(product?.name ?? productDetail?.name)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {!summaryLoading && (
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${stockBadgeClass}`}>{stockLabel}</span>
            )}
            {product?.trackImei && (
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25">
                IMEI tracked
              </span>
            )}
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60"
            >
              <FileText size={12} /> PDF
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport('excel')}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-violet-700 dark:text-violet-300 border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-60"
            >
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport('print')}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-slate-600 dark:text-slate-300 border-slate-500/25 bg-slate-500/10 hover:bg-slate-500/20 disabled:opacity-60"
            >
              <Printer size={12} /> Print
            </button>
            <button
              type="button"
              onClick={() => router.push('/inventory')}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Back to inventory"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Meta row — same 3-col layout as Product Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>SKU:</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(product?.sku)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Barcode:</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(product?.barcode)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Brand:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(product?.brand ?? productDetail?.brandName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Category:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(product?.category ?? productDetail?.categoryName)}</span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Warehouse:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(product?.branchName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>IMEI tracking:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{product?.trackImei ? 'Enabled' : 'Not tracked'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Total purchased:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{analytics?.totalPurchasedQty ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShoppingCart size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Total sold:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{analytics?.totalSoldQty ?? '—'}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
                >
                  {productDetail?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productDetail.imageUrl} alt={product?.name} className="w-full h-full object-contain" />
                  ) : (
                    <Package size={18} className="text-emerald-500 opacity-70" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between border-b pb-1.5 mb-1" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Stock summary</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Qty</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Current</span>
                    <span className={`font-medium ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : ''}`}>{currentStock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Reserved</span>
                    <span className="font-medium">{product?.reservedStock ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Available</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{product?.availableStock ?? currentStock}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold">Gross profit</span>
                    <span className="font-semibold">{formatCurrency(analytics?.grossProfit ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarSearch
                value={search}
                onChange={setSearch}
                placeholder="Invoice, PO, customer, supplier, serial…"
                className="w-full sm:w-auto sm:min-w-[220px]"
              />
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <Calendar size={12} />
                <input type="date" className="input-field text-[11px] py-1.5 w-auto" value={from} onChange={e => setFrom(e.target.value)} />
                <span>–</span>
                <input type="date" className="input-field text-[11px] py-1.5 w-auto" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              {branches.length > 1 && (
                <FilterDropdown
                  value={branchId}
                  onChange={setBranchId}
                  icon={Building2}
                  placeholder="All warehouses"
                  options={[{ value: '', label: 'All warehouses' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
                />
              )}
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                  activeSection === s.id
                    ? 'text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/15'
                    : 'text-slate-600 dark:text-slate-300 border-slate-500/20 bg-slate-500/5 hover:bg-slate-500/10'
                }`}
              >
                <s.icon size={12} /> {s.label}
              </button>
            ))}
          </div>

          {/* Main history (full width) + summary */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4">
            <div className="min-w-0 space-y-4">
              {activeSection === 'analytics' ? (
                <DetailPanel title="Analytics summary" icon={BarChart3}>
                  <div className="p-3 grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Purchased Qty', value: analytics?.totalPurchasedQty },
                      { label: 'Total Sold Qty', value: analytics?.totalSoldQty },
                      { label: 'Total Returned Qty', value: analytics?.totalReturnedQty },
                      { label: 'Current Stock', value: analytics?.currentStock },
                      { label: 'Total Purchase Value', value: formatCurrency(analytics?.totalPurchaseValue ?? 0), text: true },
                      { label: 'Total Sales Value', value: formatCurrency(analytics?.totalSalesValue ?? 0), text: true },
                      { label: 'Gross Profit', value: formatCurrency(analytics?.grossProfit ?? 0), text: true },
                      { label: 'Customers Purchased', value: analytics?.totalCustomersPurchased },
                      { label: 'Purchase Orders', value: analytics?.totalPurchaseOrders },
                      { label: 'Sales Invoices', value: analytics?.totalSalesInvoices },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                        <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {item.text ? item.value : Number(item.value ?? 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </DetailPanel>
              ) : activeSection === 'timeline' ? (
                <DetailPanel title="Product lifecycle timeline" icon={History} loading={sectionLoading} emptyLabel="No timeline events yet">
                  {!sectionLoading && sectionRows.length > 0 && (
                    <div className="p-4 space-y-0">
                      {sectionRows.map((ev, i) => (
                        <div key={String(ev.id)} className="flex gap-3 pb-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1" />
                            {i < sectionRows.length - 1 && <div className="w-px flex-1 bg-emerald-500/20 mt-1" />}
                          </div>
                          <div className="pb-1 min-w-0">
                            <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{safeText(ev.title)}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{safeText(ev.subtitle)}</p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                              {formatDateTime(ev.dateTime as string)} · {safeText(ev.transactionType)} · Qty {Number(ev.quantity) > 0 ? '+' : ''}{safeText(ev.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!sectionLoading && <Paginator meta={sectionMeta} page={page} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />}
                </DetailPanel>
              ) : activeSection === 'serials' && !product?.trackImei ? (
                <DetailPanel title="Serial / IMEI history" icon={Hash}>
                  <p className="text-[12px] py-8 text-center" style={{ color: 'var(--text-muted)' }}>This product does not track serial / IMEI numbers.</p>
                </DetailPanel>
              ) : (
                <DetailPanel
                  title={
                    activeSection === 'purchases' ? 'Purchase history'
                      : activeSection === 'sales' ? 'Customer purchase history'
                        : activeSection === 'transfers' ? 'Stock transfer history'
                          : activeSection === 'movements' ? 'Inventory movement'
                            : activeSection === 'serials' ? 'Serial / IMEI history'
                              : sectionTitle
                  }
                  icon={sectionIcon}
                  loading={sectionLoading}
                >
                  {!sectionLoading && (
                    <>
                      <DataTable
                        columns={
                          activeSection === 'purchases' ? purchaseColumns
                            : activeSection === 'sales' ? salesColumns
                              : activeSection === 'transfers' ? transferColumns
                                : activeSection === 'movements' ? movementColumns
                                  : serialColumns
                        }
                        rows={sectionRows}
                        emptyLabel={
                          activeSection === 'purchases' ? 'No purchase records for this product'
                            : activeSection === 'sales' ? 'No customer sales for this product'
                              : activeSection === 'transfers' ? 'No stock transfers for this product'
                                : activeSection === 'movements' ? 'No inventory movements recorded'
                                  : 'No serial / IMEI records found'
                        }
                      />
                      <Paginator meta={sectionMeta} page={page} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
                    </>
                  )}
                </DetailPanel>
              )}
            </div>

            {/* Sidebar — matches Product Details summary panel */}
            <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
              <div
                className="px-3 py-2 border-b flex items-center justify-between"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
              >
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Traceability summary</p>
                <BarChart3 size={14} className="text-emerald-500" />
              </div>
              <div className="p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Current stock:</span>
                  <span className={`font-medium ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : ''}`}>{currentStock}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Reserved:</span>
                  <span className="font-medium">{product?.reservedStock ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Available:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{product?.availableStock ?? currentStock}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Total purchased:</span>
                  <span className="font-medium">{analytics?.totalPurchasedQty ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Total sold:</span>
                  <span className="font-medium">{analytics?.totalSoldQty ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Total returned:</span>
                  <span className="font-medium">{analytics?.totalReturnedQty ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Customers:</span>
                  <span className="font-medium">{analytics?.totalCustomersPurchased ?? 0}</span>
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Purchase value:</span>
                    <span className="font-semibold">{formatCurrency(analytics?.totalPurchaseValue ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Sales value:</span>
                    <span className="font-semibold">{formatCurrency(analytics?.totalSalesValue ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Gross profit:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(analytics?.grossProfit ?? 0)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--text-muted)' }}><Receipt size={11} className="inline mr-1" />Purchase orders</span>
                    <span className="font-medium">{analytics?.totalPurchaseOrders ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--text-muted)' }}><Users size={11} className="inline mr-1" />Sales invoices</span>
                    <span className="font-medium">{analytics?.totalSalesInvoices ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
