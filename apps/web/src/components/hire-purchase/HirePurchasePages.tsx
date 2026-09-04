'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle, Banknote, Bell, Calendar, CalendarDays, CheckCircle2, Clock3,
  Download, Eye, FileText, Hash, Loader2, Phone, Printer, Save, Settings,
  Shield, ShieldCheck, Smartphone, User, Users, Wallet, X,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { hirePurchaseApi, uploadApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useActiveBranchId } from '@/lib/hooks'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import { usePaymentMethods } from '@/lib/payment-methods'

type Agreement = {
  id: string
  agreementNumber: string
  productName: string
  brandName?: string | null
  imei: string
  cashPrice: number
  downPayment: number
  financeAmount: number
  interestType?: string
  interestRate?: number
  interestAmount?: number
  totalPayable: number
  paidAmount: number
  outstandingBalance: number
  monthlyInstallment: number
  installmentMonths: number
  status: string
  firstDueDate: string
  createdAt: string
  customerNic?: string | null
  customer: { id: string; name: string; phone: string }
  branch?: { id: string; name: string }
  installments?: Array<{
    id: string; sequence: number; dueDate: string; totalDue: number
    paidAmount: number; outstanding: number; status: string; principal?: number; interest?: number
  }>
  payments?: Array<{
    id: string; receiptNumber: string; amount: number; occurredAt: string
    status?: string
    methods: Array<{ method: string; amount: number }>
  }>
  guarantors?: Array<{
    id: string
    name: string
    nic: string
    phone: string
    address?: string | null
    relationship?: string | null
  }>
  documents?: Array<{ id: string; type: string; fileName: string; fileUrl: string }>
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  ACTIVE: 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400',
  COMPLETED: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'bg-slate-500/10 border-slate-500/20 text-slate-500',
  DEFAULTED: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
  PAID: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  PARTIAL: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  OVERDUE: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
  WAIVED: 'bg-slate-500/10 border-slate-500/20 text-slate-500',
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex text-[11px] px-2.5 py-1 rounded-full border font-semibold ${statusColors[value] ?? statusColors.PENDING}`}>
      {value}
    </span>
  )
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action ? <div className="sm:ml-auto">{action}</div> : null}
    </div>
  )
}

function KpiCard({
  label, value, icon: Icon, color = 'emerald',
}: {
  label: string; value: string | number; icon: React.ComponentType<{ size?: number; className?: string }>; color?: string
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
        <Icon size={15} className={`text-${color}-500`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

function SectionTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
        {title}
      </div>
      {children}
    </div>
  )
}

function SettingsPanel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {Icon ? <Icon size={15} style={{ color: 'var(--text-muted)' }} /> : null}
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function useAgreements(status?: string) {
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    setLoading(true)
    hirePurchaseApi.agreements({ limit: '500', ...(status ? { status } : {}) })
      .then((res: any) => setRows(res.data ?? []))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [status])
  useEffect(load, [branchId, load])
  return { rows, loading, reload: load }
}

/* ── Agreement Detail Modal (Sales Details layout) ───────────────────── */
function AgreementDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { canEdit } = useModuleAccess()
  const [row, setRow] = useState<Agreement | null>(null)
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState('')
  const [uploading, setUploading] = useState(false)
  const [addingGuarantor, setAddingGuarantor] = useState(false)
  const [savingGuarantor, setSavingGuarantor] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settlementQuote, setSettlementQuote] = useState<any>(null)
  const [reversingId, setReversingId] = useState<string | null>(null)
  const [guarantorForm, setGuarantorForm] = useState({
    name: '', nic: '', phone: '', address: '', relationship: '',
  })
  const printableRef = useRef<HTMLDivElement>(null)
  const payMethods = usePaymentMethods()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const reload = useCallback(() => {
    setLoading(true)
    hirePurchaseApi.agreement(id)
      .then((res: any) => setRow(res.data ?? res))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(reload, [reload])

  useEffect(() => {
    if (!row) return
    import('qrcode')
      .then(module => module.toDataURL(`${window.location.origin}/dashboard/hire-purchase/agreements?id=${row.id}`, { width: 160, margin: 1 }))
      .then(setQr)
      .catch(() => {})
  }, [row?.id])

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

  const downloadPdf = async () => {
    if (!row || !printableRef.current) return
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    const canvas = await html2canvas(printableRef.current, { scale: 2, backgroundColor: '#ffffff' })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const width = 190
    const height = canvas.height * width / canvas.width
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, width, Math.min(height, 277))
    pdf.save(`${row.agreementNumber}.pdf`)
  }

  const uploadDocument = async (file: File) => {
    if (!row) return
    setUploading(true)
    try {
      const document = await uploadApi.hirePurchaseDocument(row.id, 'OTHER', file)
      setRow(prev => prev
        ? { ...prev, documents: [...(prev.documents ?? []), { ...document, type: 'OTHER', fileName: file.name }] }
        : prev)
      toast.success('Document uploaded')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const saveGuarantor = async () => {
    if (!row) return
    if (!guarantorForm.name.trim() || !guarantorForm.nic.trim() || !guarantorForm.phone.trim()) {
      return toast.error('Guarantor name, NIC and phone are required')
    }
    setSavingGuarantor(true)
    try {
      await hirePurchaseApi.addGuarantor(row.id, guarantorForm)
      toast.success('Guarantor added')
      setAddingGuarantor(false)
      setGuarantorForm({ name: '', nic: '', phone: '', address: '', relationship: '' })
      reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingGuarantor(false)
    }
  }

  const removeGuarantor = async (guarantorId: string) => {
    if (!canEdit) return viewOnlyToast('hire purchase')
    try {
      await hirePurchaseApi.deleteGuarantor(guarantorId)
      toast.success('Guarantor removed')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const loadSettlementQuote = async () => {
    if (!row || !canEdit) return viewOnlyToast('hire purchase')
    try {
      const res: any = await hirePurchaseApi.earlySettlementQuote(row.id)
      setSettlementQuote(res.data ?? res)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const confirmEarlySettlement = async () => {
    if (!row || !settlementQuote) return
    const method = payMethods[0]?.key || 'CASH'
    setSettling(true)
    try {
      await hirePurchaseApi.earlySettlement(row.id, {
        amount: settlementQuote.settlementAmount,
        method,
      })
      toast.success('Early settlement completed')
      setSettlementQuote(null)
      reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSettling(false)
    }
  }

  const reversePayment = async (paymentId: string) => {
    if (!canEdit) return viewOnlyToast('hire purchase')
    const reason = window.prompt('Reason for reversing this payment?')
    if (reason == null) return
    setReversingId(paymentId)
    try {
      await hirePurchaseApi.reversePayment(paymentId, reason || 'Administrative reversal')
      toast.success('Payment reversed')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setReversingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <FileText size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Agreement Details{row ? <> ( <span className="font-mono">{row.agreementNumber}</span> )</> : null}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${safeText(row?.productName)} · ${safeText(row?.customer?.name)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {row && <StatusBadge value={row.status} />}
            {canEdit && row && ['ACTIVE', 'DEFAULTED'].includes(row.status) && row.outstandingBalance > 0.001 && (
              <button
                type="button"
                onClick={() => void loadSettlementQuote()}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-violet-700 dark:text-violet-300 border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20"
              >
                <Wallet size={12} /> Early settle
              </button>
            )}
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!row}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Download size={12} /> PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!row}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <Printer size={12} /> Print
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

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
          </div>
        )}

        {!loading && !row && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Failed to load agreement</div>
        )}

        {!loading && row && (
          <div ref={printableRef} className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Agreement:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{row.agreementNumber}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Created:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(row.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>First due:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(row.firstDueDate)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock3 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Tenure:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.installmentMonths} months</span>
                </div>
              </div>

              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <User size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(row.customer.name)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                  <a href={`tel:${row.customer.phone}`} className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
                    {safeText(row.customer.phone)}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Device:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(row.productName)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>IMEI:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(row.imei)}</span>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Quick totals</span>
                  {qr && <img src={qr} alt="QR" className="h-12 w-12 rounded" />}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total payable</span>
                    <span className="font-medium">{formatCurrency(row.totalPayable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Paid</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(row.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Monthly</span>
                    <span className="font-medium">{formatCurrency(row.monthlyInstallment)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold">Outstanding</span>
                    <span className={`font-semibold ${row.outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatCurrency(row.outstandingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <SectionTable title="Agreement information">
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
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Cash price</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(row.cashPrice)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Down payment</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(row.downPayment)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Finance amount</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(row.financeAmount)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Interest</td>
                          <td className="px-3 py-2 font-medium">{row.interestType ?? '—'} · {row.interestRate ?? 0}%</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>NIC</td>
                          <td className="px-3 py-2 font-medium">{safeText(row.customerNic)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Brand</td>
                          <td className="px-3 py-2 font-medium">{safeText(row.brandName)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Branch</td>
                          <td className="px-3 py-2 font-medium" colSpan={3}>{safeText(row.branch?.name)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </SectionTable>

                <SectionTable title="Installment schedule">
                  <div className="overflow-x-auto">
                    <table className="min-w-[700px] w-full text-[12px]">
                      <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Due date</th>
                          <th className="px-3 py-2 text-right">Due</th>
                          <th className="px-3 py-2 text-right">Paid</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(row.installments ?? []).map(item => (
                          <tr key={item.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2">{item.sequence}</td>
                            <td className="px-3 py-2">{formatDate(item.dueDate)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.totalDue)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.paidAmount)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.outstanding)}</td>
                            <td className="px-3 py-2 text-center"><StatusBadge value={item.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionTable>

                {(row.payments?.length ?? 0) > 0 && (
                  <SectionTable title="Payment history">
                    <div className="overflow-x-auto">
                      <table className="min-w-[640px] w-full text-[12px]">
                        <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                          <tr style={{ color: 'var(--text-secondary)' }}>
                            <th className="px-3 py-2 text-left">Receipt</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Method</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            {canEdit && <th className="px-3 py-2 text-right print:hidden"> </th>}
                          </tr>
                        </thead>
                        <tbody>
                          {row.payments!.map(payment => (
                            <tr key={payment.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="px-3 py-2 font-mono">{payment.receiptNumber}</td>
                              <td className="px-3 py-2">{formatDate(payment.occurredAt)}</td>
                              <td className="px-3 py-2">
                                {(Array.isArray(payment.methods) ? payment.methods : []).map(m => m.method).join(', ') || '—'}
                              </td>
                              <td className="px-3 py-2"><StatusBadge value={payment.status || 'COMPLETED'} /></td>
                              <td className={`px-3 py-2 text-right font-semibold ${payment.status === 'REVERSED' ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatCurrency(payment.amount)}
                              </td>
                              {canEdit && (
                                <td className="px-3 py-2 text-right print:hidden">
                                  {payment.status !== 'REVERSED' && (
                                    <button
                                      type="button"
                                      disabled={reversingId === payment.id}
                                      onClick={() => void reversePayment(payment.id)}
                                      className="text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50"
                                    >
                                      {reversingId === payment.id ? '…' : 'Reverse'}
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionTable>
                )}
              </div>

              <div className="space-y-4">
                <SectionTable title="Guarantors">
                  <div className="overflow-x-auto">
                    {(row.guarantors?.length ?? 0) > 0 ? (
                      <table className="min-w-[280px] w-full text-[12px]">
                        <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                          <tr style={{ color: 'var(--text-secondary)' }}>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">NIC</th>
                            <th className="px-3 py-2 text-left">Phone</th>
                            <th className="px-3 py-2 text-left">Relation</th>
                            {canEdit && <th className="px-3 py-2 text-right print:hidden"> </th>}
                          </tr>
                        </thead>
                        <tbody>
                          {row.guarantors!.map(g => (
                            <tr key={g.id} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                              <td className="px-3 py-2">
                                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{safeText(g.name)}</p>
                                {g.address && (
                                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{g.address}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono">{safeText(g.nic)}</td>
                              <td className="px-3 py-2">
                                {g.phone ? (
                                  <a href={`tel:${g.phone}`} className="text-cyan-600 dark:text-cyan-400 hover:underline">{g.phone}</a>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2">{safeText(g.relationship)}</td>
                              {canEdit && (
                                <td className="px-3 py-2 text-right print:hidden">
                                  <button
                                    type="button"
                                    onClick={() => removeGuarantor(g.id)}
                                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-3 py-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        No guarantors linked to this agreement.
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <div className="border-t p-3 space-y-3 print:hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                      {!addingGuarantor ? (
                        <button
                          type="button"
                          onClick={() => setAddingGuarantor(true)}
                          className="btn-secondary text-xs inline-flex items-center gap-1.5"
                        >
                          <Users size={13} /> Add guarantor
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {[
                              ['name', 'Full name *'],
                              ['nic', 'NIC *'],
                              ['phone', 'Phone *'],
                              ['relationship', 'Relationship'],
                              ['address', 'Address'],
                            ].map(([key, label]) => (
                              <label key={key} className={`text-[11px] ${key === 'address' ? 'sm:col-span-2' : ''}`} style={{ color: 'var(--text-muted)' }}>
                                {label}
                                <input
                                  className="input-field mt-1 text-xs"
                                  value={(guarantorForm as any)[key]}
                                  onChange={e => setGuarantorForm(p => ({ ...p, [key]: e.target.value }))}
                                />
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAddingGuarantor(false)
                                setGuarantorForm({ name: '', nic: '', phone: '', address: '', relationship: '' })
                              }}
                              className="btn-secondary flex-1 text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveGuarantor}
                              disabled={savingGuarantor}
                              className="btn-primary flex-1 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                            >
                              {savingGuarantor ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                              Save guarantor
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionTable>

                <SectionTable title="Documents">
                  <div className="p-3 space-y-3">
                    {canEdit && (
                      <label className="btn-secondary inline-flex cursor-pointer text-xs items-center gap-2 print:hidden">
                        {uploading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                        Upload KYC / Document
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          disabled={uploading}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) void uploadDocument(file)
                          }}
                        />
                      </label>
                    )}
                    {(row.documents?.length ?? 0) > 0 ? (
                      <div className="space-y-1">
                        {row.documents!.map(doc => (
                          <a
                            key={doc.id}
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {doc.fileName}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p>
                    )}
                  </div>
                </SectionTable>
              </div>
            </div>
          </div>
        )}
      </div>

      {settlementQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => !settling && setSettlementQuote(null)}>
          <div
            className="w-full max-w-md rounded-2xl border p-5 shadow-xl space-y-4"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Early settlement quote</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {settlementQuote.agreementNumber} · valid ~15 min
                </p>
              </div>
              <button type="button" onClick={() => setSettlementQuote(null)} disabled={settling} className="p-1 rounded-lg hover:bg-black/5">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex justify-between"><span>Book outstanding</span><span>{formatCurrency(settlementQuote.outstandingBalance)}</span></div>
              <div className="flex justify-between"><span>Principal (open)</span><span>{formatCurrency(settlementQuote.principalOutstanding)}</span></div>
              <div className="flex justify-between"><span>Accrued interest</span><span>{formatCurrency(settlementQuote.accruedInterest)}</span></div>
              {Number(settlementQuote.interestRebate) > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Interest rebate</span><span>−{formatCurrency(settlementQuote.interestRebate)}</span></div>
              )}
              {Number(settlementQuote.penaltyOutstanding) > 0 && (
                <div className="flex justify-between"><span>Penalties</span><span>{formatCurrency(settlementQuote.penaltyOutstanding)}</span></div>
              )}
              <div className="flex justify-between pt-2 border-t font-bold text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                <span>Pay now</span>
                <span className="text-violet-600 dark:text-violet-400">{formatCurrency(settlementQuote.settlementAmount)}</span>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Collects via {payMethods[0]?.label || payMethods[0]?.id || 'CASH'}, waives unearned interest, and completes the agreement.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSettlementQuote(null)} disabled={settling} className="btn-secondary flex-1 text-sm">
                Close
              </button>
              <button type="button" onClick={() => void confirmEarlySettlement()} disabled={settling} className="btn-primary flex-1 text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {settling ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                Collect & complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Dashboard ───────────────────────────────────────────────────────── */
export function HpDashboardPage() {
  const branchId = useActiveBranchId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    hirePurchaseApi.dashboard()
      .then((r: any) => setData(r.data ?? r))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [branchId])

  const maxTrend = Math.max(1, ...(data?.collectionTrend ?? []).map((item: any) => Number(item.amount) || 0))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hire Purchase"
        subtitle="Agreements, installments and collection health for the active branch"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Agreements" value={data?.totalAgreements ?? 0} icon={FileText} color="violet" />
            <KpiCard label="Active" value={data?.activeAgreements ?? 0} icon={ShieldCheck} color="sky" />
            <KpiCard label="Completed" value={data?.completedAgreements ?? 0} icon={CheckCircle2} color="emerald" />
            <KpiCard label="Defaulted" value={data?.defaultedAgreements ?? 0} icon={AlertTriangle} color="rose" />
            <KpiCard label="Outstanding" value={formatCurrency(data?.outstandingAmount ?? 0)} icon={Banknote} color="amber" />
            <KpiCard label="Today's Collections" value={formatCurrency(data?.todayCollections ?? 0)} icon={Wallet} color="emerald" />
            <KpiCard label="Monthly Collections" value={formatCurrency(data?.monthlyCollections ?? 0)} icon={CalendarDays} color="blue" />
            <KpiCard label="Overdue Amount" value={formatCurrency(data?.overdue?.amount ?? 0)} icon={Clock3} color="rose" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 card p-5">
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Six-month collection trend</p>
              <div className="flex h-40 items-end gap-3">
                {(data?.collectionTrend ?? []).map((item: any, index: number) => (
                  <div key={`${item.month}-${index}`} className="flex h-full flex-1 flex-col justify-end gap-2 text-center">
                    <div
                      className="mx-auto w-full max-w-[3.5rem] rounded-t-md bg-emerald-500/80"
                      style={{ height: `${Math.max(4, (Number(item.amount) / maxTrend) * 100)}%` }}
                      title={formatCurrency(item.amount)}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.month}</span>
                  </div>
                ))}
                {!(data?.collectionTrend?.length) && (
                  <p className="text-sm m-auto" style={{ color: 'var(--text-muted)' }}>No collection data yet</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {[
                ['Due Today', data?.dueToday],
                ['Due Tomorrow', data?.dueTomorrow],
                ['Due This Week', data?.dueThisWeek],
              ].map(([label, value]: any) => (
                <div key={label} className="card p-4 border-l-4 border-l-emerald-500">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(value?.amount ?? 0)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{value?.count ?? 0} installments</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Agreements / Defaulters ─────────────────────────────────────────── */
export function HpAgreementsPage({ fixedStatus }: { fixedStatus?: string } = {}) {
  const { rows, loading, reload } = useAgreements(fixedStatus)
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'DEFAULTED'>(
    fixedStatus === 'DEFAULTED' ? 'DEFAULTED' : 'all',
  )
  const { canEdit } = useModuleAccess()

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) setDetail(id)
  }, [searchParams])

  const filtered = useMemo(() => {
    let list = rows
    if (!fixedStatus && tab !== 'all') list = list.filter(r => r.status === tab)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(row =>
      [row.agreementNumber, row.customer.name, row.customer.phone, row.imei, row.productName]
        .some(v => v?.toLowerCase().includes(q)),
    )
  }, [rows, query, tab, fixedStatus])

  const changeStatus = async (row: Agreement, status: string) => {
    if (!canEdit) return viewOnlyToast('hire purchase')
    let reason: string | undefined
    if (status === 'CANCELLED') {
      const typed = window.prompt(
        'Cancel this agreement? Reverse all collections first if any exist.\n\nCancellation reason:',
      )
      if (typed == null) return
      reason = typed.trim() || 'Cancelled by staff'
      if (!window.confirm(`Cancel ${row.agreementNumber}? Device returns to stock if linked to a POS sale.`)) return
    }
    try {
      await hirePurchaseApi.updateStatus(row.id, status, reason)
      toast.success(`Agreement ${status.toLowerCase()}`)
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const columns = useMemo<ColumnDef<Agreement>[]>(() => [
    {
      accessorKey: 'agreementNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
      cell: ({ row }) => (
        <button type="button" className="flex items-center gap-2 hover:opacity-80" onClick={() => setDetail(row.original.id)}>
          <FileText size={13} className="text-emerald-500 flex-shrink-0" />
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline">{row.original.agreementNumber}</span>
        </button>
      ),
    },
    {
      accessorKey: 'customer.name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.customer.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.customer.phone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'productName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device / IMEI" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>{row.original.productName}</p>
          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.original.imei}</p>
        </div>
      ),
    },
    {
      accessorKey: 'monthlyInstallment',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Installment" />,
      cell: ({ row }) => <span className="text-sm">{formatCurrency(row.original.monthlyInstallment)}</span>,
    },
    {
      accessorKey: 'outstandingBalance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
      cell: ({ row }) => (
        <span className={`text-sm font-semibold ${row.original.outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
          {formatCurrency(row.original.outstandingBalance)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      id: 'actions',
      header: () => <span className="text-right block w-full">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDetail(row.original.id)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/25 bg-emerald-500/10"
          >
            <Eye size={12} /> View
          </button>
          {canEdit && row.original.status === 'PENDING' && (
            <button type="button" onClick={() => changeStatus(row.original, 'ACTIVE')} className="text-[11px] font-semibold text-sky-600 hover:underline">
              Approve
            </button>
          )}
          {canEdit && ['ACTIVE', 'DEFAULTED'].includes(row.original.status) && (
            <button type="button" onClick={() => changeStatus(row.original, 'CANCELLED')} className="text-[11px] font-semibold text-rose-600 hover:underline">
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ], [canEdit])

  const counts = useMemo(() => ({
    all: rows.length,
    ACTIVE: rows.filter(r => r.status === 'ACTIVE').length,
    PENDING: rows.filter(r => r.status === 'PENDING').length,
    COMPLETED: rows.filter(r => r.status === 'COMPLETED').length,
    DEFAULTED: rows.filter(r => r.status === 'DEFAULTED').length,
  }), [rows])

  return (
    <div className="space-y-6">
      <PageHeader
        title={fixedStatus === 'DEFAULTED' ? 'Defaulters' : 'Agreements'}
        subtitle={`${filtered.length} contracts · branch-scoped installment agreements`}
      />

      {!fixedStatus && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'All', value: counts.all, icon: FileText, color: 'violet', key: 'all' as const },
              { label: 'Active', value: counts.ACTIVE, icon: ShieldCheck, color: 'sky', key: 'ACTIVE' as const },
              { label: 'Pending', value: counts.PENDING, icon: Clock3, color: 'amber', key: 'PENDING' as const },
              { label: 'Defaulted', value: counts.DEFAULTED, icon: AlertTriangle, color: 'rose', key: 'DEFAULTED' as const },
            ].map(({ label, value, icon: Icon, color, key }) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(key)}
                className={`card p-4 flex items-center gap-3 text-left transition-all w-full ${tab === key ? 'ring-2 ring-emerald-500/40' : 'hover:border-emerald-500/30'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
                  <Icon size={15} className={`text-${color}-500`} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
            {([['all', 'All'], ['ACTIVE', 'Active'], ['PENDING', 'Pending'], ['COMPLETED', 'Completed'], ['DEFAULTED', 'Defaulted']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === key ? 'bg-emerald-600 text-white' : 'hover:text-emerald-500'}`}
                style={tab !== key ? { color: 'var(--text-muted)' } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <ToolbarSearch
        value={query}
        onChange={setQuery}
        placeholder="Search agreement, customer, phone or IMEI…"
        className="max-w-md"
      />

      <ClientSideTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((filtered.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />

      {detail && <AgreementDetailModal id={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ── Payment Collection ──────────────────────────────────────────────── */
export function HpPaymentsPage() {
  const { rows, loading: listLoading, reload } = useAgreements()
  const payMethods = usePaymentMethods()
  const { canEdit } = useModuleAccess()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'open' | 'ACTIVE' | 'DEFAULTED'>('open')
  const [selected, setSelected] = useState<Agreement | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [splitMethod, setSplitMethod] = useState('')
  const [splitAmount, setSplitAmount] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  const openRows = useMemo(
    () => rows.filter(r => ['ACTIVE', 'DEFAULTED'].includes(r.status) && r.outstandingBalance > 0.001),
    [rows],
  )

  const filtered = useMemo(() => {
    let list = openRows
    if (tab === 'ACTIVE') list = list.filter(r => r.status === 'ACTIVE')
    if (tab === 'DEFAULTED') list = list.filter(r => r.status === 'DEFAULTED')
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(row =>
      [row.agreementNumber, row.customer.name, row.customer.phone, row.imei, row.productName]
        .some(v => v?.toLowerCase().includes(q)),
    )
  }, [openRows, query, tab])

  const totals = useMemo(() => ({
    open: openRows.length,
    active: openRows.filter(r => r.status === 'ACTIVE').length,
    defaulted: openRows.filter(r => r.status === 'DEFAULTED').length,
    outstanding: openRows.reduce((sum, row) => sum + (Number(row.outstandingBalance) || 0), 0),
  }), [openRows])

  useEffect(() => {
    if (!selected) return
    setAmount(selected.outstandingBalance.toFixed(2))
    setMethod('CASH')
    setSplitMethod('')
    setSplitAmount('')
    setReference('')
  }, [selected])

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const resetCollect = () => {
    setSelected(null)
    setAmount('')
    setSplitMethod('')
    setSplitAmount('')
    setReference('')
  }

  const submit = async () => {
    if (!canEdit) return viewOnlyToast('hire purchase')
    if (!selected || Number(amount) <= 0) return
    setSaving(true)
    try {
      const split = Math.max(0, Number(splitAmount) || 0)
      const methods = splitMethod && split > 0
        ? [{ method, amount: Number(amount) - split }, { method: splitMethod, amount: split }]
        : undefined
      await hirePurchaseApi.collectPayment(selected.id, { amount: Number(amount), method, methods, reference })
      toast.success('Payment recorded')
      resetCollect()
      reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<Agreement>[]>(() => [
    {
      accessorKey: 'agreementNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
      cell: ({ row }) => (
        <button type="button" className="flex items-center gap-2 hover:opacity-80" onClick={() => setDetail(row.original.id)}>
          <FileText size={13} className="text-emerald-500 flex-shrink-0" />
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline">{row.original.agreementNumber}</span>
        </button>
      ),
    },
    {
      accessorKey: 'customer.name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.customer.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.customer.phone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'productName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device / IMEI" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>{row.original.productName}</p>
          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.original.imei}</p>
        </div>
      ),
    },
    {
      accessorKey: 'monthlyInstallment',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Installment" />,
      cell: ({ row }) => <span className="text-sm">{formatCurrency(row.original.monthlyInstallment)}</span>,
    },
    {
      accessorKey: 'outstandingBalance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          {formatCurrency(row.original.outstandingBalance)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      id: 'actions',
      header: () => <span className="text-right block w-full">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDetail(row.original.id)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/25 bg-emerald-500/10"
          >
            <Eye size={12} /> View
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                if (!canEdit) return viewOnlyToast('hire purchase')
                setSelected(row.original)
              }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-semibold text-sky-700 dark:text-sky-300 border-sky-500/25 bg-sky-500/10"
            >
              <Banknote size={12} /> Collect
            </button>
          )}
        </div>
      ),
    },
  ], [canEdit])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Collection"
        subtitle={`${filtered.length} open agreements · full, partial or split installment payments`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: totals.open, icon: FileText, color: 'violet', key: 'open' as const },
          { label: 'Active', value: totals.active, icon: ShieldCheck, color: 'sky', key: 'ACTIVE' as const },
          { label: 'Defaulted', value: totals.defaulted, icon: AlertTriangle, color: 'rose', key: 'DEFAULTED' as const },
          { label: 'Outstanding', value: formatCurrency(totals.outstanding), icon: Banknote, color: 'amber', key: 'open' as const },
        ].map(({ label, value, icon: Icon, color, key }) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(key)}
            className={`card p-4 flex items-center gap-3 text-left transition-all w-full ${tab === key && label !== 'Outstanding' ? 'ring-2 ring-emerald-500/40' : 'hover:border-emerald-500/30'}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-500`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
        {([['open', 'All open'], ['ACTIVE', 'Active'], ['DEFAULTED', 'Defaulted']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === key ? 'bg-emerald-600 text-white' : 'hover:text-emerald-500'}`}
            style={tab !== key ? { color: 'var(--text-muted)' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <ToolbarSearch
        value={query}
        onChange={setQuery}
        placeholder="Search agreement, customer, phone or IMEI…"
        className="max-w-md"
      />

      <ClientSideTable
        data={filtered}
        columns={columns}
        isLoading={listLoading}
        pageCount={Math.ceil((filtered.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />

      {detail && <AgreementDetailModal id={detail} onClose={() => setDetail(null)} />}

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={resetCollect}
        >
          <div
            className="rounded-xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto border"
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Banknote size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    Record Payment ( <span className="font-mono">{selected.agreementNumber}</span> )
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {selected.customer.name} · {selected.productName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge value={selected.status} />
                <button
                  type="button"
                  onClick={resetCollect}
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
              <div className="grid grid-cols-2 gap-3 text-[12px] rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)' }}>Customer</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.customer.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selected.customer.phone}</p>
                </div>
                <div className="text-right">
                  <p style={{ color: 'var(--text-muted)' }}>Outstanding</p>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatCurrency(selected.outstandingBalance)}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)' }}>Device</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selected.productName}</p>
                </div>
                <div className="text-right">
                  <p style={{ color: 'var(--text-muted)' }}>IMEI</p>
                  <p className="font-mono" style={{ color: 'var(--text-primary)' }}>{selected.imei}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount *</label>
                  <input
                    type="number"
                    min="0.01"
                    max={selected.outstandingBalance}
                    step="0.01"
                    className="input-field"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Reference</label>
                  <input
                    className="input-field"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Optional note / slip no."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Payment method</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {payMethods.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setMethod(item.key)}
                      className={`rounded-lg border p-2.5 text-xs font-semibold transition-colors ${method === item.key ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : ''}`}
                      style={method !== item.key ? { borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' } : undefined}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Optional split method</label>
                  <select className="input-field" value={splitMethod} onChange={e => setSplitMethod(e.target.value)}>
                    <option value="">No split</option>
                    {payMethods.filter(item => item.key !== method).map(item => (
                      <option key={item.id} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </div>
                {splitMethod && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount on split method</label>
                    <input type="number" className="input-field" min="0" max={amount} value={splitAmount} onChange={e => setSplitAmount(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button type="button" onClick={resetCollect} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                disabled={saving || Number(amount) <= 0 || Number(amount) > selected.outstandingBalance}
                onClick={submit}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Due Collections ─────────────────────────────────────────────────── */
export function HpDuesPage() {
  const branchId = useActiveBranchId()
  const [scope, setScope] = useState<'today' | 'tomorrow' | 'upcoming' | 'overdue'>('today')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [reminderChannel, setReminderChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    hirePurchaseApi.dues(scope)
      .then((r: any) => setRows(r.data ?? []))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [scope, branchId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row: any) =>
      [row.agreement?.agreementNumber, row.agreement?.customer?.name, row.agreement?.customer?.phone]
        .some(v => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query])

  const sendReminders = async () => {
    const ids = Array.from(new Set(rows.map((row: any) => row.agreement.id)))
    if (!ids.length) return toast.error('No agreements in this due group')
    setSending(true)
    try {
      const res: any = await hirePurchaseApi.sendReminders(ids, reminderChannel)
      toast.success(`${res.data?.sent ?? 0} ${reminderChannel.toLowerCase()} reminders sent`)
      if (res.data?.failed) toast.error(`${res.data.failed} reminders failed`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'agreement',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
      accessorFn: row => row.agreement?.agreementNumber,
      cell: ({ row }) => (
        <button type="button" className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline" onClick={() => setDetail(row.original.agreement.id)}>
          {row.original.agreement.agreementNumber}
        </button>
      ),
    },
    {
      id: 'customer',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      accessorFn: row => row.agreement?.customer?.name,
      cell: ({ row }) => (
        <div>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.agreement.customer.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.agreement.customer.phone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due date" />,
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dueDate)}</span>,
    },
    {
      accessorKey: 'outstanding',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(row.original.outstanding)}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Due Collections"
        subtitle="Today, tomorrow, upcoming and overdue installments"
        action={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select
              value={reminderChannel}
              onChange={e => setReminderChannel(e.target.value as 'WHATSAPP' | 'SMS' | 'EMAIL')}
              className="text-xs rounded-lg border px-2.5 py-2 bg-transparent"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
            </select>
            <button type="button" onClick={sendReminders} disabled={sending || !rows.length} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
              Send reminders
            </button>
          </div>
        )}
      />

      <div className="flex gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
        {(['today', 'tomorrow', 'upcoming', 'overdue'] as const).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setScope(item)}
            className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${scope === item ? 'bg-emerald-600 text-white' : 'hover:text-emerald-500'}`}
            style={scope !== item ? { color: 'var(--text-muted)' } : undefined}
          >
            {item}
          </button>
        ))}
      </div>

      <ToolbarSearch value={query} onChange={setQuery} placeholder="Search agreement or customer…" className="max-w-md" />

      <ClientSideTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((filtered.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />

      {detail && <AgreementDetailModal id={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ── Guarantors ──────────────────────────────────────────────────────── */
export function HpGuarantorsPage() {
  const branchId = useActiveBranchId()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    hirePurchaseApi.guarantors()
      .then((r: any) => setRows(r.data ?? []))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [branchId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row: any) =>
      [row.name, row.nic, row.phone, row.agreement?.agreementNumber].some(v => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Guarantor" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users size={13} className="text-emerald-500" />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.original.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.relationship || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'nic',
      header: ({ column }) => <DataTableColumnHeader column={column} title="NIC" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.nic}</span>,
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => <span className="text-sm">{row.original.phone}</span>,
    },
    {
      id: 'agreement',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
      accessorFn: row => row.agreement?.agreementNumber,
      cell: ({ row }) => (
        <button type="button" className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline" onClick={() => setDetail(row.original.agreement.id)}>
          {row.original.agreement.agreementNumber}
        </button>
      ),
    },
    {
      id: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      accessorFn: row => row.agreement?.status,
      cell: ({ row }) => <StatusBadge value={row.original.agreement?.status ?? 'PENDING'} />,
    },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader title="Guarantors" subtitle={`${filtered.length} guarantors linked to hire purchase agreements`} />
      <ToolbarSearch value={query} onChange={setQuery} placeholder="Search name, NIC, phone or agreement…" className="max-w-md" />
      <ClientSideTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((filtered.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />
      {detail && <AgreementDetailModal id={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ── Reports ─────────────────────────────────────────────────────────── */
export function HpReportsPage() {
  const reports = [
    { type: 'collections', label: 'Collections', desc: 'Payment collections by agreement' },
    { type: 'outstanding', label: 'Outstanding', desc: 'Open balances across contracts' },
    { type: 'dues', label: 'Dues', desc: 'Installment due schedule' },
    { type: 'defaulters', label: 'Defaulters', desc: 'Defaulted agreements' },
    { type: 'agreements', label: 'Agreements', desc: 'Full agreement register' },
    { type: 'customer-statement', label: 'Customer Statement', desc: 'Customer-linked HP activity' },
    { type: 'profit', label: 'Profit', desc: 'Interest and fee profitability' },
    { type: 'late-fees', label: 'Late Fees', desc: 'Penalty applications' },
    { type: 'cash-flow', label: 'Cash Flow', desc: 'HP cash movement' },
  ]

  const download = async (type: string, format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const params: Record<string, string> = {}
      if (type === 'customer-statement') {
        const customerId = window.prompt('Optional: filter by customer ID (leave blank for all)')
        if (customerId == null) return
        if (customerId.trim()) params.customerId = customerId.trim()
      }
      const res: any = await hirePurchaseApi.report(type, Object.keys(params).length ? params : undefined)
      const rows = res.data?.rows ?? res.rows ?? []
      if (!rows.length) return toast.error('No report data')
      const flat = rows.map((row: any) =>
        Object.fromEntries(Object.entries(row).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))),
      )
      if (format === 'xlsx') {
        const XLSX = await import('xlsx')
        const book = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(flat), type.slice(0, 31))
        XLSX.writeFile(book, `hp-${type}.xlsx`)
        return
      }
      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF()
        pdf.setFontSize(16)
        pdf.text(`Hire Purchase — ${type.replace('-', ' ')}`, 12, 16)
        pdf.setFontSize(8)
        flat.slice(0, 55).forEach((row: any, index: number) =>
          pdf.text(Object.entries(row).map(([key, value]) => `${key}: ${String(value)}`).join('  |  ').slice(0, 180), 12, 25 + index * 4.5),
        )
        pdf.save(`hp-${type}.pdf`)
        return
      }
      const keys: string[] = Array.from(new Set<string>(flat.flatMap((row: any) => Object.keys(row))))
      const csv = [keys.join(','), ...flat.map((row: any) => keys.map(key => JSON.stringify(row[key] ?? '')).join(','))].join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `hp-${type}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="HP Reports" subtitle="Collections, outstanding, dues, profit, penalties and cash flow" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(report => (
          <div key={report.type} className="card p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <Download size={15} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{report.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{report.desc}</p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-auto">
              {(['csv', 'xlsx', 'pdf'] as const).map(format => (
                <button
                  key={format}
                  type="button"
                  onClick={() => download(report.type, format)}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase hover:border-emerald-500/40 hover:text-emerald-600 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Settings ────────────────────────────────────────────────────────── */
export function HpSettingsPage() {
  const { canEdit } = useModuleAccess()
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    hirePurchaseApi.settings()
      .then((r: any) => setForm(r.data ?? r))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const field = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p: any) => ({ ...p, [key]: e.target.value }))

  const save = async () => {
    if (!canEdit) return viewOnlyToast('hire purchase settings')
    if (!form) return
    setSaving(true)
    try {
      await hirePurchaseApi.updateSettings({
        defaultInterestType: form.defaultInterestType,
        defaultInterestRate: Number(form.defaultInterestRate),
        defaultLateFee: Number(form.defaultLateFee),
        defaultGracePeriod: Number(form.defaultGracePeriod),
        defaultDueDay: Number(form.defaultDueDay),
        agreementTemplate: form.agreementTemplate,
        receiptTemplate: form.receiptTemplate,
        reminderSettings: form.reminderSettings,
        penaltyRules: form.penaltyRules,
        rolePermissions: form.rolePermissions,
      })
      toast.success('Hire purchase settings saved')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const actions = ['CREATE', 'EDIT', 'DELETE', 'APPROVE', 'RECEIVE_PAYMENT', 'CANCEL', 'EXPORT_REPORTS', 'EDIT_SETTINGS'] as const
  const defaults: Record<string, string[]> = {
    MANAGER: [...actions],
    CASHIER: ['CREATE', 'RECEIVE_PAYMENT'],
    TECHNICIAN: [],
  }
  const actionEnabled = (role: string, action: string) =>
    form?.rolePermissions?.[role]?.[action] ?? defaults[role]?.includes(action) ?? false
  const setAction = (role: string, action: string, enabled: boolean) =>
    setForm((p: any) => ({
      ...p,
      rolePermissions: {
        ...(p.rolePermissions ?? {}),
        [role]: { ...(p.rolePermissions?.[role] ?? {}), [action]: enabled },
      },
    }))

  const saveButton = canEdit ? (
    <button
      type="button"
      onClick={save}
      disabled={saving || loading || !form}
      className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      Save settings
    </button>
  ) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="HP Settings"
        subtitle="Branch defaults, reminders, penalties, templates and role actions"
        action={saveButton}
      />

      {loading || !form ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          <fieldset disabled={!canEdit} className="space-y-6 min-w-0">
            <div className="grid xl:grid-cols-2 gap-6 w-full">
              <SettingsPanel title="Finance defaults" icon={Banknote}>
                <div className="p-5 space-y-4">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Defaults used by the POS hire-purchase wizard for this branch.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Interest method</label>
                      <select className="input-field" value={form.defaultInterestType ?? 'FLAT'} onChange={field('defaultInterestType')}>
                        <option value="NONE">No Interest</option>
                        <option value="FLAT">Flat Rate</option>
                        <option value="REDUCING">Reducing Balance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Interest %</label>
                      <input type="number" step="0.01" min="0" className="input-field" value={form.defaultInterestRate ?? 0} onChange={field('defaultInterestRate')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Late fee</label>
                      <input type="number" step="0.01" min="0" className="input-field" value={form.defaultLateFee ?? 0} onChange={field('defaultLateFee')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Grace period (days)</label>
                      <input type="number" min="0" className="input-field" value={form.defaultGracePeriod ?? 3} onChange={field('defaultGracePeriod')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Default due day</label>
                      <input type="number" min="1" max="28" className="input-field" value={form.defaultDueDay ?? 1} onChange={field('defaultDueDay')} />
                    </div>
                  </div>
                </div>
              </SettingsPanel>

              <SettingsPanel title="Reminders" icon={Bell}>
                <div className="p-5 space-y-4">
                  <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      className="rounded mt-0.5"
                      checked={form.reminderSettings?.enabled === true}
                      onChange={e => setForm((p: any) => ({
                        ...p,
                        reminderSettings: {
                          ...(p.reminderSettings ?? {}),
                          enabled: e.target.checked,
                          days: p.reminderSettings?.days ?? [3, 1, 0, -1],
                          channel: p.reminderSettings?.channel ?? 'WHATSAPP',
                        },
                      }))}
                    />
                    <span>Automated payment reminders — send before/after due dates for open installments</span>
                  </label>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Reminder channel</label>
                    <select
                      className="input-field"
                      value={form.reminderSettings?.channel ?? 'WHATSAPP'}
                      onChange={e => setForm((p: any) => ({
                        ...p,
                        reminderSettings: { ...(p.reminderSettings ?? {}), channel: e.target.value },
                      }))}
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="SMS">SMS</option>
                      <option value="EMAIL">Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Reminder offsets (days relative to due)
                    </label>
                    <input
                      className="input-field"
                      value={(form.reminderSettings?.days ?? [3, 1, 0, -1]).join(', ')}
                      onChange={e => {
                        const days = e.target.value
                          .split(',')
                          .map((part: string) => Number(part.trim()))
                          .filter((n: number) => Number.isFinite(n))
                        setForm((p: any) => ({
                          ...p,
                          reminderSettings: { ...(p.reminderSettings ?? {}), days },
                        }))
                      }}
                      placeholder="3, 1, 0, -1"
                    />
                    <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Positive = before due, 0 = due day, negative = overdue days.
                    </p>
                  </div>
                </div>
              </SettingsPanel>
            </div>

            <SettingsPanel title="Penalty rules" icon={AlertTriangle}>
              <div className="p-5 grid gap-4 sm:grid-cols-2">
                <label className="flex items-start gap-3 text-sm cursor-pointer sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    className="rounded mt-0.5"
                    checked={form.penaltyRules?.enabled !== false}
                    onChange={e => setForm((p: any) => ({
                      ...p,
                      penaltyRules: { ...(p.penaltyRules ?? {}), enabled: e.target.checked },
                    }))}
                  />
                  <span>Apply late fees automatically after the grace period (maintenance job)</span>
                </label>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Penalty amount override</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={form.penaltyRules?.amount ?? form.defaultLateFee ?? 0}
                    onChange={e => setForm((p: any) => ({
                      ...p,
                      penaltyRules: { ...(p.penaltyRules ?? {}), amount: e.target.value },
                    }))}
                    placeholder="Uses default late fee when empty"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Max penalties per installment</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.penaltyRules?.maxPerInstallment ?? 1}
                    onChange={e => setForm((p: any) => ({
                      ...p,
                      penaltyRules: { ...(p.penaltyRules ?? {}), maxPerInstallment: Number(e.target.value) || 1 },
                    }))}
                  />
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel title="Role action permissions" icon={Shield}>
              <div className="p-5 space-y-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Fine-grained hire-purchase actions on top of the module View / Edit permission.
                </p>
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                  <table className="min-w-[820px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left">Role</th>
                        {actions.map(action => (
                          <th key={action} className="px-3 py-2 text-center whitespace-nowrap">
                            {action.replaceAll('_', ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {['MANAGER', 'CASHIER', 'TECHNICIAN'].map(role => (
                        <tr key={role} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{role}</td>
                          {actions.map(action => (
                            <td key={action} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={actionEnabled(role, action)}
                                onChange={e => setAction(role, action, e.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </SettingsPanel>

            <div className="grid xl:grid-cols-2 gap-6 w-full">
              <SettingsPanel title="Agreement template" icon={FileText}>
                <div className="p-5 space-y-2">
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Optional agreement wording / clauses
                  </label>
                  <textarea
                    className="input-field min-h-36 text-sm"
                    value={form.agreementTemplate ?? ''}
                    onChange={field('agreementTemplate')}
                    placeholder="Terms printed on the hire purchase agreement…"
                  />
                </div>
              </SettingsPanel>

              <SettingsPanel title="Receipt template" icon={FileText}>
                <div className="p-5 space-y-2">
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Optional collection receipt footer text
                  </label>
                  <textarea
                    className="input-field min-h-36 text-sm"
                    value={form.receiptTemplate ?? ''}
                    onChange={field('receiptTemplate')}
                    placeholder="Thank-you note or payment instructions…"
                  />
                </div>
              </SettingsPanel>
            </div>
          </fieldset>

          {canEdit && (
            <div className="flex justify-end">
              {saveButton}
            </div>
          )}
        </>
      )}
    </div>
  )
}
