'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Phone, CreditCard, Truck, Package, Wallet, AlertCircle } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import type { Supplier } from '@/types'
import {
  AddSupplierModal,
  EditSupplierModal,
  RecordPaymentModal,
  SupplierDetailsModal,
} from '@/components/suppliers/suppliers-shared'
import { PageHeader, StatCard, StatGrid, FilterBar } from '@/components/design-system'

export default function SuppliersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canEdit } = useModuleAccess()
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null)
  const [textSearch, setTextSearch] = useState('')

  const openSupplier = useCallback((s: Supplier) => setDetailSupplier(s), [])
  const { data: suppliersData, loading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers()
  const { data: ordersData, refetch: refetchOrders } = usePurchaseOrders()
  const suppliers: Supplier[] = (suppliersData?.data ?? []) as Supplier[]
  const purchaseOrders = (ordersData?.data ?? []) as import('@/types').PurchaseOrder[]

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'orders') {
      const qs = searchParams.toString()
      router.replace(qs ? `/dashboard/purchase-orders?${qs}` : '/dashboard/purchase-orders')
      return
    }

    const action = searchParams.get('action')
    if (action === 'new-po' || action === 'add-po') {
      router.replace('/dashboard/purchase-orders?action=new-po')
      return
    }
    if (action === 'add' || action === 'add-supplier' || searchParams.get('new') === '1') {
      if (canEdit) setShowAddSupplier(true)
      else viewOnlyToast('suppliers')
    }
    const id = searchParams.get('id')
    if (id && suppliers.length) {
      const found = suppliers.find(s => s.id === id)
      if (found) setDetailSupplier(found)
    }
  }, [searchParams, suppliers, router, canEdit])

  const filteredSuppliers = useMemo(() => {
    const q = textSearch.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      (s.contactName ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').toLowerCase().includes(q) ||
      (s.city ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, textSearch])

  const stats = useMemo(() => {
    const totalOutstanding = suppliers.reduce((s, x) => s + Number((x as any).outstandingDues ?? 0), 0)
    const totalOrders = suppliers.reduce((s, x) => s + Number(x.totalOrders ?? 0), 0)
    const withDues = suppliers.filter(x => Number((x as any).outstandingDues ?? 0) > 0).length
    return { totalOutstanding, totalOrders, withDues }
  }, [suppliers])

  const supplierColumns = useMemo<ColumnDef<Supplier>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/20 flex items-center justify-center text-sm font-bold text-brand-300 flex-shrink-0">
            {row.original.name.charAt(0)}
          </div>
          <div>
            <button type="button" className="font-semibold text-gray-900 dark:text-slate-100 text-sm hover:text-brand-400 text-left transition-colors" onClick={() => openSupplier(row.original)}>
              {row.original.name}
            </button>
            {row.original.contactName && <p className="text-xs text-gray-500 dark:text-slate-500">{row.original.contactName}</p>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => (
        <a href={`tel:${row.original.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300">
          <Phone size={11} />{row.original.phone}
        </a>
      ),
    },
    {
      accessorKey: 'city',
      header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-slate-400">{row.original.city || '—'}</span>,
    },
    {
      accessorKey: 'totalOrders',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-brand-400">{row.original.totalOrders}</span>,
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
            {canEdit && (s as any).outstandingDues > 0 && (
              <button onClick={() => setPaySupplier(s)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm">
                <CreditCard size={10} />Pay
              </button>
            )}
            <TableActionsRow
              showAction={{ action: () => setDetailSupplier(s) }}
              editAction={canEdit ? { action: () => setEditSupplier(s) } : undefined}
            />
          </div>
        )
      },
    },
  ], [canEdit, openSupplier])

  return (
    <div className="space-y-6">
      {showAddSupplier && <AddSupplierModal onClose={() => setShowAddSupplier(false)} onSaved={refetchSuppliers} />}
      {detailSupplier && (
        <SupplierDetailsModal
          supplier={detailSupplier}
          allPOs={purchaseOrders}
          onClose={() => setDetailSupplier(null)}
          onEdit={canEdit ? () => { setEditSupplier(detailSupplier); setDetailSupplier(null) } : undefined}
        />
      )}
      {editSupplier && (
        <EditSupplierModal
          supplier={editSupplier}
          onClose={() => setEditSupplier(null)}
          onSaved={() => { refetchSuppliers(); setEditSupplier(null) }}
        />
      )}
      {paySupplier && (
        <RecordPaymentModal
          supplier={paySupplier}
          allPOs={purchaseOrders}
          onClose={() => setPaySupplier(null)}
          onSaved={() => { refetchSuppliers(); refetchOrders() }}
        />
      )}

      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} suppliers`}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push('/dashboard/purchase-orders')}
              className="btn-secondary text-sm"
            >
              Purchase Orders
            </button>
            {canEdit && (
              <button onClick={() => setShowAddSupplier(true)} className="btn-primary text-sm flex items-center gap-2">
                <Plus size={14} />Add Supplier
              </button>
            )}
          </>
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Total Suppliers" value={String(suppliers.length)} icon={Truck} tone="brand" />
        <StatCard label="Total Outstanding" value={formatCurrency(stats.totalOutstanding)} icon={Wallet} tone="danger" />
        <StatCard label="Total Orders" value={String(stats.totalOrders)} icon={Package} tone="info" />
        <StatCard label="With Dues" value={String(stats.withDues)} icon={AlertCircle} tone="warning" />
      </StatGrid>

      <FilterBar>
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          placeholder="Search suppliers…"
          className="max-w-md w-full sm:min-w-[220px]"
        />
      </FilterBar>

      <ClientSideTable
        data={filteredSuppliers}
        columns={supplierColumns}
        isLoading={suppliersLoading}
        pageCount={Math.ceil((filteredSuppliers.length || 1) / 20)}
        searchableColumns={[]}
      />
    </div>
  )
}
