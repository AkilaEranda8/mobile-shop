'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Phone, CreditCard } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import type { Supplier } from '@/types'
import {
  AddSupplierModal,
  EditSupplierModal,
  RecordPaymentModal,
  SupplierDetailsModal,
} from '@/components/suppliers/suppliers-shared'

export default function SuppliersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
      setShowAddSupplier(true)
    }
    const id = searchParams.get('id')
    if (id && suppliers.length) {
      const found = suppliers.find(s => s.id === id)
      if (found) setDetailSupplier(found)
    }
  }, [searchParams, suppliers, router])

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
            <button type="button" className="font-semibold text-slate-100 text-sm hover:text-violet-400 text-left transition-colors" onClick={() => openSupplier(row.original)}>
              {row.original.name}
            </button>
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
  ], [openSupplier])

  return (
    <div className="space-y-6">
      {showAddSupplier && <AddSupplierModal onClose={() => setShowAddSupplier(false)} onSaved={refetchSuppliers} />}
      {detailSupplier && (
        <SupplierDetailsModal
          supplier={detailSupplier}
          allPOs={purchaseOrders}
          onClose={() => setDetailSupplier(null)}
          onEdit={() => { setEditSupplier(detailSupplier); setDetailSupplier(null) }}
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{suppliers.length} suppliers</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => router.push('/dashboard/purchase-orders')}
            className="btn-secondary text-sm"
          >
            Purchase Orders
          </button>
          <button onClick={() => setShowAddSupplier(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Supplier
          </button>
        </div>
      </div>

      <ToolbarSearch
        value={textSearch}
        onChange={setTextSearch}
        placeholder="Search suppliers…"
        className="max-w-md"
      />

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
