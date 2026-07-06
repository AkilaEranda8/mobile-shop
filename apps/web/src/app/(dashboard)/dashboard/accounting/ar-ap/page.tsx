'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, Loader2, RefreshCw, Users, Truck, Banknote,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'

const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET'] as const

type Aging = { current: number; days31_60: number; days61_90: number; over90: number }

type ArRow = {
  customerId: string
  name: string
  phone: string
  operationalDue: number
  balance: number
  aging: Aging
}

type ApRow = {
  supplierId: string
  name: string
  phone: string
  operationalDue: number
  balance: number
  aging: Aging
}

type Summary = {
  asOf: string
  totals: { balance: number; aging: Aging }
  glControlBalance: number
  unallocated: number
  rows: ArRow[] | ApRow[]
}

type DetailLine = {
  entryNo: string
  entryDate: string
  memo: string | null
  description: string | null
  debit: number
  credit: number
  runningBalance: number
}

export default function ArApPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const [tab, setTab] = useState<'ar' | 'ap'>('ar')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    name: string
    balance: number
    lines: DetailLine[]
    openInvoices?: Array<{ id: string; invoiceNumber: string; dueAmount: number }>
    openPurchaseOrders?: Array<{ id: string; poNumber: string; dueAmount: number }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string>('CASH')
  const [payRef, setPayRef] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  const asOf = businessToday()
  const branchId = getActiveBranchId() ?? ''

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setDetailId(null)
    setDetail(null)
    try {
      const res = tab === 'ar'
        ? await accountingApi.arSummary({ asOf }) as { data: Summary }
        : await accountingApi.apSummary({ asOf }) as { data: Summary }
      setSummary(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load subledger')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [tab, asOf])

  const loadDetail = useCallback(async (id: string) => {
    try {
      if (tab === 'ar') {
        const res = await accountingApi.arCustomer(id, { asOf }) as {
          data: { customer: { name: string }; balance: number; lines: DetailLine[]; openInvoices?: Array<{ id: string; invoiceNumber: string; dueAmount: number }> }
        }
        setDetail({ name: res.data.customer.name, balance: res.data.balance, lines: res.data.lines, openInvoices: res.data.openInvoices })
        const init: Record<string, string> = {}
        for (const inv of res.data.openInvoices ?? []) init[inv.id] = ''
        setAllocations(init)
      } else {
        const res = await accountingApi.apSupplier(id, { asOf }) as {
          data: { supplier: { name: string }; balance: number; lines: DetailLine[]; openPurchaseOrders?: Array<{ id: string; poNumber: string; dueAmount: number }> }
        }
        setDetail({ name: res.data.supplier.name, balance: res.data.balance, lines: res.data.lines, openPurchaseOrders: res.data.openPurchaseOrders })
        const init: Record<string, string> = {}
        for (const po of res.data.openPurchaseOrders ?? []) init[po.id] = ''
        setAllocations(init)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load detail')
    }
  }, [tab, asOf])

  useEffect(() => { if (hasAccess) loadSummary() }, [hasAccess, loadSummary])

  useEffect(() => {
    if (detailId) loadDetail(detailId)
    else setDetail(null)
  }, [detailId, loadDetail])

  async function handleRecordPayment() {
    if (!detailId) return
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setPayLoading(true)
    try {
      const body = {
        amount,
        paymentMethod: payMethod,
        reference: payRef || undefined,
        ...(branchId ? { branchId } : {}),
      }
      const allocEntries = Object.entries(allocations)
        .filter(([, v]) => Number(v) > 0)
        .map(([id, v]) => ({ amount: Number(v), ...(tab === 'ar' ? { saleId: id } : { purchaseOrderId: id }) }))
      if (tab === 'ar') {
        await accountingApi.recordArPayment({
          ...body,
          customerId: detailId,
          ...(allocEntries.length ? { allocations: allocEntries as Array<{ saleId: string; amount: number }> } : {}),
        })
      } else {
        await accountingApi.recordApPayment({
          ...body,
          supplierId: detailId,
          ...(allocEntries.length ? { allocations: allocEntries as Array<{ purchaseOrderId: string; amount: number }> } : {}),
        })
      }
      toast.success('Payment posted to GL')
      setPayAmount('')
      setPayRef('')
      await loadSummary()
      await loadDetail(detailId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setPayLoading(false)
    }
  }

  if (!hasAccess) {
    return <div className="p-6 text-center text-slate-400"><Link href="/settings" className="text-violet-400">Enable Accounting</Link></div>
  }

  const rows = summary?.rows ?? []

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/accounting" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2">
            <ArrowLeft size={12} /> Accounting
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {tab === 'ar' ? <Users className="text-violet-400" size={24} /> : <Truck className="text-violet-400" size={24} />}
            AR / AP Subledgers
          </h1>
          <p className="text-sm text-slate-400 mt-1">Balances from GL control accounts · As of {asOf}</p>
        </div>
        <button type="button" onClick={loadSummary} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(['ar', 'ap'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab === t ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'border-white/10 text-slate-400'}`}
          >
            {t === 'ar' ? 'Accounts Receivable' : 'Accounts Payable'}
          </button>
        ))}
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
          <AgingCard label="Total" value={summary.totals.balance} />
          <AgingCard label="0–30 days" value={summary.totals.aging.current} />
          <AgingCard label="31–60" value={summary.totals.aging.days31_60} />
          <AgingCard label="61–90" value={summary.totals.aging.days61_90} />
          <AgingCard label="90+" value={summary.totals.aging.over90} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 text-xs text-slate-400">
              {tab === 'ar' ? 'Customers' : 'Suppliers'} · GL {formatCurrency(summary?.glControlBalance ?? 0)}
              {summary && Math.abs(summary.unallocated) >= 0.01 && (
                <span className="text-amber-400 ml-2">Unallocated {formatCurrency(summary.unallocated)}</span>
              )}
            </div>
            <ul className="max-h-[400px] overflow-y-auto">
              {rows.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-500">No open balances</li>
              ) : rows.map((r: ArRow | ApRow) => {
                const id = tab === 'ar' ? (r as ArRow).customerId : (r as ApRow).supplierId
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setDetailId(id)}
                      className={`w-full flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] text-left ${detailId === id ? 'bg-violet-500/10' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{r.name}</p>
                        <p className="text-[11px] text-slate-500">{r.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-200">{formatCurrency(r.balance)}</span>
                        <ChevronRight size={14} className="text-slate-600" />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 p-4">
            {!detail ? (
              <p className="text-sm text-slate-500 text-center py-12">Select a {tab === 'ar' ? 'customer' : 'supplier'} to view GL transactions</p>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{detail.name}</h2>
                    <p className="text-sm text-violet-300 font-mono">{formatCurrency(detail.balance)}</p>
                  </div>
                </div>

                {detail.balance > 0 && (
                  <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-violet-300 flex items-center gap-1.5">
                      <Banknote size={14} />
                      Record {tab === 'ar' ? 'Receipt' : 'Payment'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="flex-1 min-w-[100px] px-2 py-1.5 rounded-lg text-sm bg-slate-900 border border-white/10 text-white"
                      />
                      <select
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value)}
                        className="px-2 py-1.5 rounded-lg text-sm bg-slate-900 border border-white/10 text-white"
                      >
                        {PAYMENT_METHODS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Reference"
                        value={payRef}
                        onChange={e => setPayRef(e.target.value)}
                        className="flex-1 min-w-[80px] px-2 py-1.5 rounded-lg text-sm bg-slate-900 border border-white/10 text-white"
                      />
                      <button
                        type="button"
                        disabled={payLoading}
                        onClick={handleRecordPayment}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                      >
                        {payLoading ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
                      </button>
                    </div>
                    {(detail.openInvoices?.length ?? 0) > 0 && tab === 'ar' && (
                      <div className="space-y-1 pt-2 border-t border-white/10">
                        <p className="text-[10px] text-slate-500">Allocate to invoices (optional)</p>
                        {detail.openInvoices!.map(inv => (
                          <div key={inv.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 text-slate-400">{inv.invoiceNumber} · due {formatCurrency(inv.dueAmount)}</span>
                            <input type="number" placeholder="0" value={allocations[inv.id] ?? ''}
                              onChange={e => setAllocations(prev => ({ ...prev, [inv.id]: e.target.value }))}
                              className="w-20 px-2 py-1 rounded bg-slate-900 border border-white/10 text-white text-right" />
                          </div>
                        ))}
                      </div>
                    )}
                    {(detail.openPurchaseOrders?.length ?? 0) > 0 && tab === 'ap' && (
                      <div className="space-y-1 pt-2 border-t border-white/10">
                        <p className="text-[10px] text-slate-500">Allocate to POs (optional)</p>
                        {detail.openPurchaseOrders!.map(po => (
                          <div key={po.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 text-slate-400">{po.poNumber} · due {formatCurrency(po.dueAmount)}</span>
                            <input type="number" placeholder="0" value={allocations[po.id] ?? ''}
                              onChange={e => setAllocations(prev => ({ ...prev, [po.id]: e.target.value }))}
                              className="w-20 px-2 py-1 rounded bg-slate-900 border border-white/10 text-white text-right" />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500">
                      {tab === 'ar' ? 'Dr Cash · Cr AR' : 'Dr AP · Cr Cash'} — posts directly to GL
                    </p>
                  </div>
                )}

                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 sticky top-0 bg-slate-900">
                      <tr>
                        <th className="text-left py-1.5">Date</th>
                        <th className="text-left py-1.5">JE#</th>
                        <th className="text-right py-1.5">Dr</th>
                        <th className="text-right py-1.5">Cr</th>
                        <th className="text-right py-1.5">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-1.5 text-slate-400">{l.entryDate}</td>
                          <td className="py-1.5 text-slate-300">{l.entryNo}</td>
                          <td className="py-1.5 text-right font-mono">{l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
                          <td className="py-1.5 text-right font-mono">{l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
                          <td className="py-1.5 text-right font-mono text-slate-200">{formatCurrency(l.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AgingCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5">{formatCurrency(value)}</p>
    </div>
  )
}
