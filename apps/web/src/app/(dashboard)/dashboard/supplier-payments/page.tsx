'use client'

import { useMemo, useState } from 'react'
import {
  Wallet, Plus, Truck, FileText, CreditCard, Scale,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatCurrency, formatDate } from '@/lib/utils'
import { businessToday, businessMonthStart } from '@/lib/business-date'
import { useSupplierPayments, useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import { RecordPaymentModal } from '@/components/suppliers/suppliers-shared'
import { ChequePaymentMeta } from '@/components/payments/ChequeDetailsFields'
import type { PurchaseOrder, Supplier } from '@/types'
import { PageHeader, StatCard, StatGrid, FilterBar } from '@/components/design-system'

interface PaymentRow {
  id: string
  supplierId?: string | null
  supplierName?: string | null
  purchaseInvoice?: string | null
  amountPaid: number
  paymentMethod?: string | null
  paymentDate: string
  reference?: string | null
  description?: string | null
  balanceDue: number
}

export default function SupplierPaymentsPage() {
  const { canEdit } = useModuleAccess()
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null)

  const periodTo = businessToday()
  const periodFrom = businessMonthStart(periodTo)

  const paymentParams = useMemo(() => {
    const p: Record<string, string> = { from: periodFrom, to: periodTo, limit: '200' }
    if (supplierFilter !== 'all') p.supplierId = supplierFilter
    return p
  }, [periodFrom, periodTo, supplierFilter])

  const { data: payData, loading, refetch } = useSupplierPayments(paymentParams)
  const { data: suppliersData } = useSuppliers()
  const { data: poData, refetch: refetchPOs } = usePurchaseOrders()

  const payments = (payData?.data ?? []) as PaymentRow[]
  const suppliers = (suppliersData?.data ?? []) as Supplier[]
  const allPOs = (poData?.data ?? []) as PurchaseOrder[]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return payments
    return payments.filter(p =>
      String(p.supplierName ?? '').toLowerCase().includes(q)
      || String(p.purchaseInvoice ?? '').toLowerCase().includes(q)
      || String(p.reference ?? '').toLowerCase().includes(q)
      || String(p.description ?? '').toLowerCase().includes(q),
    )
  }, [payments, search])

  const paidMtd = filtered.reduce((s, p) => s + Number(p.amountPaid ?? 0), 0)
  const outstanding = suppliers.reduce((s, x) => s + Number(x.outstandingDues ?? 0), 0)
  const suppliersWithDue = suppliers.filter(s => Number(s.outstandingDues ?? 0) > 0)

  const openPayFor = (supplierId?: string | null) => {
    if (!canEdit) {
      viewOnlyToast('suppliers')
      return
    }
    const s = suppliers.find(x => x.id === supplierId) ?? suppliersWithDue[0] ?? suppliers[0]
    if (s) setPaySupplier(s)
  }

  const columns = useMemo<ColumnDef<PaymentRow>[]>(() => [
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <Truck size={13} className="text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate">
              {row.original.supplierName || '—'}
            </p>
            {row.original.reference && (
              <div className="mt-0.5">
                <ChequePaymentMeta
                  method={row.original.paymentMethod}
                  reference={row.original.reference}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'purchaseInvoice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Purchase Invoice" />,
      cell: ({ row }) => {
        const invoices = String(row.original.purchaseInvoice ?? '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
        if (!invoices.length) {
          return (
            <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
              <FileText size={11} />
              <span className="font-mono">—</span>
            </span>
          )
        }
        const shown = invoices.slice(0, 2)
        const extra = invoices.length - shown.length
        return (
          <span
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 max-w-[260px]"
            title={invoices.join(', ')}
          >
            <FileText size={11} className="flex-shrink-0" />
            <span className="font-mono truncate">{shown.join(', ')}</span>
            {extra > 0 && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
              >
                +{extra} more
              </span>
            )}
          </span>
        )
      },
    },
    {
      accessorKey: 'amountPaid',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount Paid" />,
      cell: ({ row }) => (
        <span className="text-sm font-bold text-green-400">
          {formatCurrency(row.original.amountPaid ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: 'paymentMethod',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
      cell: ({ row }) => (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
        >
          <CreditCard size={10} />
          {String(row.original.paymentMethod ?? '').replace(/_/g, ' ') || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'paymentDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Payment Date" />,
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
          {formatDate(row.original.paymentDate)}
        </span>
      ),
    },
    {
      accessorKey: 'balanceDue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance Due" />,
      cell: ({ row }) => (
        <span className={`text-sm font-bold ${Number(row.original.balanceDue ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {formatCurrency(row.original.balanceDue ?? 0)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const s = suppliers.find(x => x.id === row.original.supplierId)
        if (!canEdit || !s || Number(s.outstandingDues ?? 0) <= 0) return null
        return (
          <button
            onClick={() => openPayFor(s.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <CreditCard size={10} />Pay
          </button>
        )
      },
    },
  ], [canEdit, suppliers, openPayFor])

  return (
    <div className="space-y-6">
      {paySupplier && (
        <RecordPaymentModal
          supplier={paySupplier}
          allPOs={allPOs}
          onClose={() => setPaySupplier(null)}
          onSaved={() => { refetch(); refetchPOs() }}
        />
      )}

      <PageHeader
        title="Supplier Payments"
        subtitle={`${filtered.length} payments this month (${periodFrom} → ${periodTo})`}
        actions={
          canEdit ? (
            <button
              onClick={() => openPayFor()}
              className="btn-primary text-sm flex items-center gap-2"
              disabled={suppliers.length === 0}
            >
              <Plus size={14} />Record Payment
            </button>
          ) : undefined
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Paid (MTD)" value={formatCurrency(paidMtd)} icon={Wallet} tone="success" />
        <StatCard label="Outstanding Dues" value={formatCurrency(outstanding)} icon={Scale} tone="danger" />
        <StatCard label="Payments (MTD)" value={String(filtered.length)} icon={CreditCard} tone="brand" />
        <StatCard label="Suppliers with Due" value={String(suppliersWithDue.length)} icon={Truck} tone="warning" />
      </StatGrid>

      <FilterBar>
        <ToolbarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search supplier, invoice, reference…"
          className="flex-1 sm:max-w-md w-full sm:min-w-[220px]"
        />
        <select
          className="input-field sm:w-56"
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
        >
          <option value="all">All suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FilterBar>

      {/* ── Payments table ── */}
      <ClientSideTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((filtered.length || 1) / 20)}
        searchableColumns={[]}
      />

      {/* ── Quick pay ── */}
      {canEdit && suppliersWithDue.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Quick pay — open balances
          </p>
          <div className="flex flex-wrap gap-2">
            {suppliersWithDue.slice(0, 8).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => openPayFor(s.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                {s.name}
                <span className="ml-1.5 text-rose-500 font-semibold">{formatCurrency(s.outstandingDues ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
