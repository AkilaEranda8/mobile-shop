'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Printer, Receipt, Wallet, Minus, Banknote, Eye } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi, tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { cn } from '@/lib/utils'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { HrFeatureGate, HrPageShell, HrError, HrStatCard, HrModal, HrModalCancel } from '@/components/hr/hr-ui'
import {
  PayslipSheet,
  PayslipActionsBar,
  downloadPayslipPdf,
  printPayslipThermal,
  printPayslipA4,
  type PayslipSlip,
} from '@/components/hr/PayslipDocument'
import {
  getInvoiceSettings,
  fetchInvoiceSettings,
  shopContextFromTenant,
  type InvoiceSettings,
  type ShopContext,
} from '@/lib/invoiceSettings'
import { openReceiptPrintWindow } from '@/lib/printHtml'

export default function HrPayslipsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<PayslipSlip[]>([])
  const [preview, setPreview] = useState<PayslipSlip | null>(null)
  const [renderSlip, setRenderSlip] = useState<PayslipSlip | null>(null)
  const [busy, setBusy] = useState(false)
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [shopCtx, setShopCtx] = useState<ShopContext | undefined>()
  const sheetRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await hrApi.listPayslips() as { data: PayslipSlip[] }
      setRows(res.data ?? [])
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load payslips')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    const branchId = getActiveBranchId() || undefined
    fetchInvoiceSettings(user.tenantId, branchId)
      .then(async (s) => {
        setInvSettings(s)
        try {
          const res: any = await tenantApi.get(user.tenantId)
          setShopCtx(shopContextFromTenant(res?.data ?? res, branchId))
        } catch {
          setShopCtx(undefined)
        }
      })
      .catch(() => {})
  }, [])

  const totalGross = rows.reduce((s, r) => s + r.gross, 0)
  const totalDed = rows.reduce((s, r) => s + r.deductions, 0)
  const totalNet = rows.reduce((s, r) => s + r.net, 0)

  const waitForSheet = async (slip: PayslipSlip) => {
    setRenderSlip(slip)
    if (preview?.id !== slip.id) setPreview(slip)
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    // allow layout after modal open
    await new Promise(r => setTimeout(r, 50))
    return sheetRef.current
  }

  const handleDownload = async (slip: PayslipSlip) => {
    setBusy(true)
    try {
      const el = await waitForSheet(slip)
      if (!el) throw new Error('Payslip preview not ready')
      await downloadPayslipPdf(el, slip)
      toast.success('Payslip PDF downloaded')
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'PDF download failed')
    } finally {
      setBusy(false)
    }
  }

  const handleThermal = (slip: PayslipSlip) => {
    const win = openReceiptPrintWindow('Preparing payslip…')
    const ok = printPayslipThermal(slip, invSettings, shopCtx, { targetWindow: win })
    if (!ok) toast.error('Allow pop-ups to print the thermal payslip')
  }

  const handlePrintA4 = async (slip: PayslipSlip) => {
    setBusy(true)
    try {
      const el = await waitForSheet(slip)
      if (!el) throw new Error('Payslip preview not ready')
      const ok = printPayslipA4(el, slip)
      if (!ok) toast.error('Allow pop-ups to print')
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo<ColumnDef<PayslipSlip>[]>(() => [
    {
      id: 'employee',
      accessorFn: r => r.employee.fullName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.original.employee.fullName}</p>
          <p className="text-xs font-mono text-gray-500 dark:text-slate-500">{row.original.employee.employeeCode}</p>
        </div>
      ),
    },
    {
      id: 'period',
      accessorFn: r => r.run.period.label,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Period" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.run.period.label}</span>,
    },
    {
      accessorKey: 'gross',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gross" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.gross.toLocaleString()}</span>,
    },
    {
      accessorKey: 'deductions',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.deductions.toLocaleString()}</span>,
    },
    {
      accessorKey: 'net',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Net" />,
      cell: ({ row }) => <span className="font-semibold text-gray-900 dark:text-white">{row.original.net.toLocaleString()}</span>,
    },
    {
      id: 'runStatus',
      accessorFn: r => r.run.status,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Run" />,
      cell: ({ row }) => (
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full border',
          row.original.run.status === 'PAID' && 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          row.original.run.status === 'APPROVED' && 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          row.original.run.status === 'REVIEW' && 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        )}>
          {row.original.run.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-xs font-semibold text-gray-500">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const slip = row.original
        return (
          <div className="flex items-center gap-1">
            <button type="button" title="Preview" onClick={() => { setPreview(slip); setRenderSlip(slip) }}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500">
              <Eye className="w-4 h-4" />
            </button>
            <button type="button" title="Download PDF" disabled={busy} onClick={() => void handleDownload(slip)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500">
              <Download className="w-4 h-4" />
            </button>
            <button type="button" title="Thermal print" onClick={() => handleThermal(slip)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500">
              <Receipt className="w-4 h-4" />
            </button>
            <button type="button" title="Print A4" disabled={busy} onClick={() => void handlePrintA4(slip)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500">
              <Printer className="w-4 h-4" />
            </button>
          </div>
        )
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busy, invSettings, shopCtx])

  const activeSheet = renderSlip || preview

  return (
    <HrFeatureGate>
      <HrPageShell title="Payslips" subtitle="Download PDF or print on thermal / A4" icon={Receipt}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Payslips" value={rows.length} icon={Receipt} color="violet" />
          <HrStatCard label="Gross" value={totalGross.toLocaleString()} icon={Wallet} color="blue" />
          <HrStatCard label="Deductions" value={totalDed.toLocaleString()} icon={Minus} color="amber" />
          <HrStatCard label="Net" value={totalNet.toLocaleString()} icon={Banknote} color="emerald" />
        </div>

        {error && <HrError message={error} />}
        {!error && (
          <ClientSideTable
            data={rows}
            columns={columns}
            isLoading={loading}
            pageCount={Math.ceil((rows.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}

        {preview && (
          <HrModal
            title={`Payslip · ${preview.employee.fullName}`}
            subtitle={preview.run.period.label}
            icon={Receipt}
            wide
            onClose={() => setPreview(null)}
            footer={(
              <>
                <HrModalCancel onClick={() => setPreview(null)} />
                <PayslipActionsBar
                  busy={busy}
                  onDownload={() => void handleDownload(preview)}
                  onThermal={() => handleThermal(preview)}
                  onPrintA4={() => void handlePrintA4(preview)}
                />
              </>
            )}
          >
            <div className="overflow-auto max-h-[70vh] -mx-1 bg-slate-100 p-3 rounded-xl">
              <PayslipSheet ref={sheetRef} slip={preview} settings={invSettings} />
            </div>
          </HrModal>
        )}

        {/* Hidden capture target when modal closed */}
        {!preview && activeSheet && (
          <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0" aria-hidden>
            <PayslipSheet ref={sheetRef} slip={activeSheet} settings={invSettings} />
          </div>
        )}
      </HrPageShell>
    </HrFeatureGate>
  )
}
