'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Truck, Loader2, CheckCircle, Smartphone, FileText, Package, AlertCircle, X } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders, useProducts } from '@/lib/hooks'
import { suppliersApi } from '@/lib/api'
import { isImeiHealthBannerDismissed, dismissImeiHealthBanner } from '@/lib/productImei'
import type { PurchaseOrder } from '@/types'
import toast from 'react-hot-toast'
import { printBarcodeLabels, type BarcodeLabelItem } from '@/lib/barcode-print'
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

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showNewPO, setShowNewPO] = useState(false)
  const [markReceiving, setMarkReceiving] = useState<string | null>(null)
  const [confirmPO, setConfirmPO] = useState<PurchaseOrder | null>(null)
  const [registerImeiPO, setRegisterImeiPO] = useState<PurchaseOrder | null>(null)
  const [imeiBannerHidden, setImeiBannerHidden] = useState(() => isImeiHealthBannerDismissed())
  const [textSearch, setTextSearch] = useState('')
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CLOSED'>('all')

  const openPoInvoice = useCallback((id: string) => router.push(`/purchase-invoice?id=${id}`), [router])
  const { data: suppliersData, refetch: refetchSuppliers } = useSuppliers()
  const { data: ordersData, loading: ordersLoading, refetch: refetchOrders } = usePurchaseOrders()
  const { data: productsData } = useProducts({ limit: '2000' })
  const suppliers = (suppliersData?.data ?? []) as import('@/types').Supplier[]
  const purchaseOrders: PurchaseOrder[] = (ordersData?.data ?? []) as PurchaseOrder[]
  const allProducts: SharedPoProduct[] = (productsData?.data ?? []) as SharedPoProduct[]

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
  }, [searchParams, router])

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
      const res: any = await suppliersApi.updatePO(confirmPO.id, { status: 'RECEIVED' })
      toast.success(`${confirmPO.poNumber} received — inventory updated`)
      refetchOrders()
      const payload = res?.data ?? res
      const updated = (payload?.id ? payload : payload?.purchaseOrder ?? confirmPO) as PurchaseOrder
      const labels: BarcodeLabelItem[] = Array.isArray(payload?.labelsToPrint)
        ? payload.labelsToPrint.map((l: any) => ({
            barcode: l.barcode,
            name: l.name,
            sku: l.sku,
            price: l.price,
            qty: l.qty ?? 1,
          }))
        : []
      if (labels.length > 0) {
        printBarcodeLabels(labels)
        toast.success(`Printing ${labels.reduce((s, l) => s + (l.qty ?? 1), 0)} barcode label(s)`)
      }
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
        <button type="button" className="text-xs font-mono text-violet-300 hover:underline" onClick={() => openPoInvoice(row.original.id)}>
          {row.original.poNumber}
        </button>
      ),
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
        const canReceive = ['DRAFT', 'SENT', 'PARTIAL'].includes(po.status)
        const canRegisterImei = poCanRegisterImei(po, allProducts)
        const imeiExpected = getExpectedImeiCount(po, allProducts)
        const imeiRegistered = po.imeiRegisteredCount ?? 0
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
                <Smartphone size={10} />
                Register IMEI
                {imeiRegistered > 0 && (
                  <span className="text-[9px] opacity-75">({imeiRegistered}/{imeiExpected})</span>
                )}
              </button>
            )}
            {(po.status === 'RECEIVED' || po.status === 'CLOSED') && imeiExpected > 0 && !canRegisterImei && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 px-2 py-0.5">
                <CheckCircle size={10} /> IMEI done
              </span>
            )}
            <TableActionsRow
              dropMoreActions={[{ text: 'View Invoice', function: () => router.push(`/purchase-invoice?id=${po.id}`), icon: <FileText size={13} /> }]}
            />
          </div>
        )
      },
    },
  ], [openPoInvoice, markReceiving, allProducts, router])

  return (
    <div className="space-y-6">
      {showNewPO && (
        <NewPOModal
          suppliers={suppliers}
          onClose={() => setShowNewPO(false)}
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
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => router.push('/dashboard/suppliers')}
            className="btn-secondary text-sm"
          >
            Suppliers
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
              ? { background: '#6d28d9', color: '#fff' }
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
