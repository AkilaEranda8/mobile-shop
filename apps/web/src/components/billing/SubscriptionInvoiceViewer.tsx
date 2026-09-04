'use client'

import { Download, Printer, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export type BillingInvoiceViewModel = {
  id: string
  invoiceNumber: string
  billingPeriodStart: string
  billingPeriodEnd: string
  issueDate: string
  dueDate: string
  total: number
  subtotal?: number
  discount?: number
  tax?: number
  status: string
  effectiveStatus?: string
  paidAt?: string | null
  paidByName?: string | null
  paidByEmail?: string | null
  approvedByName?: string | null
  plan?: string
  months?: number
  mrrSnapshot?: number
  tenantName?: string
  ownerName?: string
  ownerEmail?: string
  bank?: {
    bankName?: string
    accountName?: string
    accountNumber?: string
    branch?: string
    swift?: string
  }
  payments?: Array<{
    id: string
    status: string
    transactionRef?: string | null
    rejectionReason?: string | null
    paymentDate: string
    amount: number
    channel: string
    slipUrl?: string | null
    paidByName?: string | null
    paidByEmail?: string | null
    approvedByName?: string | null
    submittedBy?: { id: string; name: string; email: string } | null
  }>
}

function fmt(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function planLabel(plan?: string) {
  if (!plan) return 'Subscription'
  return plan.charAt(0) + plan.slice(1).toLowerCase()
}

type Props = {
  invoice: BillingInvoiceViewModel
  onClose: () => void
  onDownload: () => void
  downloading?: boolean
}

/** Full Hexalyte subscription invoice preview with download */
export default function SubscriptionInvoiceViewer({ invoice, onClose, onDownload, downloading }: Props) {
  const status = invoice.effectiveStatus || invoice.status
  const months = invoice.months ?? 1
  const mrr = invoice.mrrSnapshot ?? invoice.total
  const subtotal = invoice.subtotal ?? invoice.total
  const discount = invoice.discount ?? 0
  const tax = invoice.tax ?? 0
  const bank = invoice.bank

  const printInvoice = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[94vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 print:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">View Invoice</p>
            <p className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printInvoice}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <Printer size={13} /> Print
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <Download size={13} /> {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 bg-gray-100 print:bg-white print:p-0">
          <div
            id="hx-billing-invoice-print"
            className="mx-auto bg-white text-gray-900 shadow-sm print:shadow-none"
            style={{ width: '100%', maxWidth: 595, padding: '36px 40px', fontFamily: 'system-ui, sans-serif' }}
          >
            <div className="flex justify-between items-start gap-4 mb-8">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Hexalyte" className="h-14 w-auto object-contain" />
                <div className="border-l border-gray-200 pl-3">
                  <p className="text-sm font-bold">Hexalyte Innovation (Pvt) Ltd</p>
                  <p className="text-[11px] text-gray-500 mt-1">www.hexalyte.com</p>
                  <p className="text-[11px] text-gray-500">info@hexalyte.com · +94 70 3130100</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tracking-tight">INVOICE</p>
                <p className="text-xs text-gray-500 mt-1">#{invoice.invoiceNumber}</p>
                <p className="text-[11px] font-bold mt-2 uppercase tracking-wide"
                  style={{ color: status === 'PAID' ? '#059669' : status === 'OVERDUE' ? '#dc2626' : '#d97706' }}
                >
                  {status}
                </p>
              </div>
            </div>

            <div className="h-0.5 bg-gray-100 mb-6" />

            <div className="flex justify-between gap-6 mb-8 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Bill To</p>
                <p className="font-bold">{invoice.tenantName || '—'}</p>
                {invoice.ownerName && <p className="text-xs text-gray-500 mt-0.5">{invoice.ownerName}</p>}
                {invoice.ownerEmail && <p className="text-xs text-gray-500">{invoice.ownerEmail}</p>}
              </div>
              <div className="text-right space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Issue Date</p>
                  <p className="text-xs font-semibold">{fmt(invoice.issueDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Due Date</p>
                  <p className="text-xs font-semibold">{fmt(invoice.dueDate)}</p>
                </div>
                {invoice.paidAt && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Paid Date</p>
                    <p className="text-xs font-semibold text-emerald-700">{fmt(invoice.paidAt)}</p>
                  </div>
                )}
                {(invoice.paidByName || invoice.payments?.find(p => p.status === 'APPROVED')?.paidByName) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Paid By</p>
                    <p className="text-xs font-semibold text-emerald-700">
                      {invoice.paidByName
                        || invoice.payments?.find(p => p.status === 'APPROVED')?.paidByName}
                    </p>
                    {(invoice.paidByEmail
                      || invoice.payments?.find(p => p.status === 'APPROVED')?.paidByEmail) && (
                      <p className="text-[11px] text-gray-500">
                        {invoice.paidByEmail
                          || invoice.payments?.find(p => p.status === 'APPROVED')?.paidByEmail}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 text-[11px] uppercase tracking-wide text-gray-500">Description</th>
                  <th className="text-center p-3 text-[11px] uppercase tracking-wide text-gray-500">Qty</th>
                  <th className="text-right p-3 text-[11px] uppercase tracking-wide text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="p-3">
                    <p className="font-bold">Hexalyte {planLabel(invoice.plan)} Plan</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {months === 1 ? '1 Month' : `${months} Months`} subscription · {formatCurrency(mrr)} / month
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Period: {fmt(invoice.billingPeriodStart)} → {fmt(invoice.billingPeriodEnd)}
                    </p>
                  </td>
                  <td className="p-3 text-center">{months}</td>
                  <td className="p-3 text-right font-bold">{formatCurrency(subtotal)}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <span>{formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-white bg-gray-900 rounded-lg px-3 py-2 mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>

            {bank && (bank.bankName || bank.accountNumber) && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Bank Transfer Details</p>
                <div className="grid sm:grid-cols-2 gap-1 text-xs text-gray-700">
                  <p>Bank: {bank.bankName || '—'}</p>
                  <p>Branch: {bank.branch || '—'}</p>
                  <p>Account Name: {bank.accountName || '—'}</p>
                  <p>SWIFT: {bank.swift || '—'}</p>
                  <p className="sm:col-span-2">Account Number: {bank.accountNumber || '—'}</p>
                </div>
              </div>
            )}

            {(invoice.payments?.length ?? 0) > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Payment Details</p>
                <div className="space-y-2">
                  {invoice.payments!.map((p) => (
                    <div key={p.id} className="text-xs rounded-lg border border-gray-100 p-2.5">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{formatCurrency(p.amount)} · {p.channel.replace(/_/g, ' ')}</span>
                        <span className="font-bold uppercase text-[10px]">{p.status}</span>
                      </div>
                      <p className="text-gray-500 mt-0.5">
                        {fmt(p.paymentDate)} · Ref {p.transactionRef || '—'}
                      </p>
                      {(p.paidByName || p.submittedBy?.name) && (
                        <p className="text-gray-700 mt-0.5 font-medium">
                          Paid by: {p.paidByName || p.submittedBy?.name}
                          {(p.paidByEmail || p.submittedBy?.email)
                            ? ` (${p.paidByEmail || p.submittedBy?.email})`
                            : ''}
                        </p>
                      )}
                      {p.approvedByName && (
                        <p className="text-gray-500 mt-0.5">Approved by: {p.approvedByName}</p>
                      )}
                      {p.rejectionReason && <p className="text-red-600 mt-1">Rejected: {p.rejectionReason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-6">
              Thank you for choosing Hexalyte Innovation (Pvt) Ltd. Subscription access is extended after payment confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
