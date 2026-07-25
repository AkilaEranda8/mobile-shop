'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle, Banknote, Calendar, CalendarDays, CheckCircle2, Clock3,
  Download, Eye, FileText, Hash, Loader2, Phone, Printer, Settings,
  ShieldCheck, Smartphone, User, Users, Wallet, X,
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
    methods: Array<{ method: string; amount: number }>
  }>
  guarantors?: Array<{ id: string; name: string; nic: string; phone: string; relationship?: string }>
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
  const printableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    hirePurchaseApi.agreement(id)
      .then((res: any) => setRow(res.data ?? res))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [id])

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
                            <th className="px-3 py-2 text-right">Amount</th>
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
                              <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(payment.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionTable>
                )}
              </div>

              <div className="space-y-4">
                {(row.guarantors?.length ?? 0) > 0 && (
                  <SectionTable title="Guarantors">
                    <div className="p-3 space-y-3">
                      {row.guarantors!.map(g => (
                        <div key={g.id} className="text-[12px] space-y-1 border-b last:border-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border-subtle)' }}>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{g.name}</p>
                          <p style={{ color: 'var(--text-muted)' }}>{g.nic} · {g.phone}</p>
                          {g.relationship && <p style={{ color: 'var(--text-muted)' }}>{g.relationship}</p>}
                        </div>
                      ))}
                    </div>
                  </SectionTable>
                )}

                {canEdit && (
                  <SectionTable title="Documents">
                    <div className="p-3 space-y-3 print:hidden">
                      <label className="btn-secondary inline-flex cursor-pointer text-xs items-center gap-2">
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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
    try {
      await hirePurchaseApi.updateStatus(row.id, status)
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
  const { rows, reload } = useAgreements()
  const payMethods = usePaymentMethods()
  const { canEdit } = useModuleAccess()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Agreement | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [splitMethod, setSplitMethod] = useState('')
  const [splitAmount, setSplitAmount] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)

  const candidates = useMemo(() =>
    rows.filter(r =>
      ['ACTIVE', 'DEFAULTED'].includes(r.status)
      && [r.agreementNumber, r.customer.name, r.customer.phone, r.imei].some(v => v.toLowerCase().includes(query.toLowerCase())),
    ),
  [rows, query])

  useEffect(() => {
    if (selected) setAmount(selected.outstandingBalance.toFixed(2))
  }, [selected])

  const submit = async () => {
    if (!canEdit) return viewOnlyToast('hire purchase')
    if (!selected || Number(amount) <= 0) return
    setLoading(true)
    try {
      const split = Math.max(0, Number(splitAmount) || 0)
      const methods = splitMethod && split > 0
        ? [{ method, amount: Number(amount) - split }, { method: splitMethod, amount: split }]
        : undefined
      await hirePurchaseApi.collectPayment(selected.id, { amount: Number(amount), method, methods, reference })
      toast.success('Payment recorded')
      setSelected(null)
      setQuery('')
      setSplitMethod('')
      setSplitAmount('')
      setReference('')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Collection"
        subtitle="Find an agreement and allocate full, partial or advance payments"
      />

      <ToolbarSearch
        value={query}
        onChange={v => { setQuery(v); setSelected(null) }}
        placeholder="Agreement, customer, phone or IMEI…"
        className="max-w-xl"
      />

      {query && !selected && (
        <div className="card overflow-hidden max-w-xl">
          {candidates.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>No open agreements found</p>
          ) : candidates.slice(0, 8).map(row => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="flex w-full items-center justify-between border-b last:border-0 px-4 py-3 text-left hover:bg-[var(--bg-subtle)] transition-colors"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span>
                <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{row.agreementNumber}</span>
                <span className="block text-sm" style={{ color: 'var(--text-primary)' }}>{row.customer.name}</span>
                <span className="block text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{row.imei}</span>
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(row.outstandingBalance)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="max-w-3xl rounded-xl border shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <Banknote size={14} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Record Payment</h3>
                <p className="text-[11px] font-mono text-emerald-600">{selected.agreementNumber}</p>
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-[12px] rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div>
                <p style={{ color: 'var(--text-muted)' }}>Customer</p>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.customer.name}</p>
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
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Reference</label>
                <input className="input-field" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional note / slip no." />
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

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button type="button" onClick={() => setSelected(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                disabled={loading || Number(amount) <= 0 || Number(amount) > selected.outstandingBalance}
                onClick={submit}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
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
      const res: any = await hirePurchaseApi.sendReminders(ids)
      toast.success(`${res.data?.sent ?? 0} reminders sent`)
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
          <button type="button" onClick={sendReminders} disabled={sending || !rows.length} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
            Send WhatsApp Reminders
          </button>
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
      const res: any = await hirePurchaseApi.report(type)
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    hirePurchaseApi.settings()
      .then((r: any) => setForm(r.data ?? r))
      .catch((e: any) => toast.error(e.message))
  }, [])

  if (!form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-emerald-500" />
      </div>
    )
  }

  const field = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p: any) => ({ ...p, [key]: e.target.value }))

  const save = async () => {
    if (!canEdit) return viewOnlyToast('hire purchase settings')
    setSaving(true)
    try {
      await hirePurchaseApi.updateSettings({
        ...form,
        defaultInterestRate: Number(form.defaultInterestRate),
        defaultLateFee: Number(form.defaultLateFee),
        defaultGracePeriod: Number(form.defaultGracePeriod),
        defaultDueDay: Number(form.defaultDueDay),
      })
      toast.success('Settings saved')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const actions = ['CREATE', 'EDIT', 'DELETE', 'APPROVE', 'RECEIVE_PAYMENT', 'CANCEL', 'EXPORT_REPORTS'] as const
  const defaults: Record<string, string[]> = {
    MANAGER: [...actions],
    CASHIER: ['CREATE', 'RECEIVE_PAYMENT'],
    TECHNICIAN: [],
  }
  const actionEnabled = (role: string, action: string) =>
    form.rolePermissions?.[role]?.[action] ?? defaults[role]?.includes(action) ?? false
  const setAction = (role: string, action: string, enabled: boolean) =>
    setForm((p: any) => ({
      ...p,
      rolePermissions: {
        ...(p.rolePermissions ?? {}),
        [role]: { ...(p.rolePermissions?.[role] ?? {}), [action]: enabled },
      },
    }))

  return (
    <div className="space-y-6">
      <PageHeader title="HP Settings" subtitle="Branch defaults, agreement text, reminders and penalty rules" />

      <div className="max-w-4xl card p-5 space-y-5">
        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Finance defaults</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Interest method</label>
              <select className="input-field" value={form.defaultInterestType} onChange={field('defaultInterestType')}>
                <option value="NONE">No Interest</option>
                <option value="FLAT">Flat Rate</option>
                <option value="REDUCING">Reducing Balance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Interest %</label>
              <input type="number" className="input-field" value={form.defaultInterestRate} onChange={field('defaultInterestRate')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Late fee</label>
              <input type="number" className="input-field" value={form.defaultLateFee} onChange={field('defaultLateFee')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Grace period (days)</label>
              <input type="number" className="input-field" value={form.defaultGracePeriod} onChange={field('defaultGracePeriod')} />
            </div>
          </div>
        </div>

        <div className="border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Reminders</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={form.reminderSettings?.enabled === true}
                onChange={e => setForm((p: any) => ({
                  ...p,
                  reminderSettings: {
                    ...(p.reminderSettings ?? {}),
                    enabled: e.target.checked,
                    days: p.reminderSettings?.days ?? [3, 1, 0, -1],
                  },
                }))}
              />
              Automated payment reminders
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
                <option value="EMAIL">Email</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Role action permissions</p>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="min-w-[720px] w-full text-[11px]">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th className="p-2.5 text-left">Role</th>
                  {actions.map(action => (
                    <th key={action} className="p-2.5 text-center">{action.replace('_', ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['MANAGER', 'CASHIER', 'TECHNICIAN'].map(role => (
                  <tr key={role} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="p-2.5 font-semibold">{role}</td>
                    {actions.map(action => (
                      <td key={action} className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={actionEnabled(role, action)}
                          onChange={e => setAction(role, action, e.target.checked)}
                          disabled={!canEdit}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Agreement template</label>
          <textarea
            className="input-field min-h-32"
            value={form.agreementTemplate ?? ''}
            onChange={field('agreementTemplate')}
            placeholder="Optional agreement wording / clauses…"
          />
        </div>

        {canEdit && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
            Save Settings
          </button>
        )}
      </div>
    </div>
  )
}
