'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, RefreshCw, Users, Truck, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingKpiCard,
  AccountingPageHeader,
  AccountingPanel,
  AccountingTable,
  AccountingTabs,
  AccountingTd,
  AccountingTh,
  VIOLET_ACCENT,
} from '@/components/accounting/accounting-ui'

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

  if (!hasAccess) return <AccountingFeatureGate />

  const rows = summary?.rows ?? []

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="AR / AP Subledgers"
        subtitle={`Balances from GL control accounts · As of ${asOf}`}
        icon={tab === 'ar' ? Users : Truck}
        actions={
          <button type="button" onClick={loadSummary} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <AccountingTabs
        tabs={[
          { id: 'ar' as const, label: 'Accounts Receivable' },
          { id: 'ap' as const, label: 'Accounts Payable' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <AccountingKpiCard label="Total" value={formatCurrency(summary.totals.balance)} accent={VIOLET_ACCENT} />
          <AccountingKpiCard label="0–30 days" value={formatCurrency(summary.totals.aging.current)} accent={VIOLET_ACCENT} />
          <AccountingKpiCard label="31–60" value={formatCurrency(summary.totals.aging.days31_60)} accent={VIOLET_ACCENT} />
          <AccountingKpiCard label="61–90" value={formatCurrency(summary.totals.aging.days61_90)} accent={VIOLET_ACCENT} />
          <AccountingKpiCard label="90+" value={formatCurrency(summary.totals.aging.over90)} accent={VIOLET_ACCENT} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
      ) : (
        <div className="grid xl:grid-cols-12 gap-4 w-full">
          <AccountingPanel
            title={`${tab === 'ar' ? 'Customers' : 'Suppliers'} · GL ${formatCurrency(summary?.glControlBalance ?? 0)}`}
            className="xl:col-span-5"
          >
            {summary && Math.abs(summary.unallocated) >= 0.01 && (
              <p className="px-4 pt-2 text-xs text-amber-400">Unallocated {formatCurrency(summary.unallocated)}</p>
            )}
            <ul className="max-h-[400px] overflow-y-auto">
              {rows.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No open balances</li>
              ) : rows.map((r: ArRow | ApRow) => {
                const id = tab === 'ar' ? (r as ArRow).customerId : (r as ApRow).supplierId
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setDetailId(id)}
                      className={`w-full flex items-center justify-between px-4 py-3 border-b hover:bg-white/[0.03] text-left transition-colors ${detailId === id ? 'bg-violet-500/10' : ''}`}
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(r.balance)}</span>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </AccountingPanel>

          <div className="xl:col-span-7 card p-4">
            {!detail ? (
              <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>
                Select a {tab === 'ar' ? 'customer' : 'supplier'} to view GL transactions
              </p>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{detail.name}</h2>
                    <p className="text-sm text-violet-400 font-mono">{formatCurrency(detail.balance)}</p>
                  </div>
                </div>

                {detail.balance > 0 && (
                  <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-violet-300 flex items-center gap-1.5">
                      <Banknote size={14} />
                      Record {tab === 'ar' ? 'Receipt' : 'Payment'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input type="number" min="0" step="0.01" placeholder="Amount" value={payAmount}
                        onChange={e => setPayAmount(e.target.value)} className="input-field flex-1 min-w-[100px] text-sm" />
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field text-sm">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input type="text" placeholder="Reference" value={payRef}
                        onChange={e => setPayRef(e.target.value)} className="input-field flex-1 min-w-[80px] text-sm" />
                      <button type="button" disabled={payLoading} onClick={handleRecordPayment}
                        className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                        {payLoading ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
                      </button>
                    </div>
                    {(detail.openInvoices?.length ?? 0) > 0 && tab === 'ar' && (
                      <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Allocate to invoices (optional)</p>
                        {detail.openInvoices!.map(inv => (
                          <div key={inv.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{inv.invoiceNumber} · due {formatCurrency(inv.dueAmount)}</span>
                            <input type="number" placeholder="0" value={allocations[inv.id] ?? ''}
                              onChange={e => setAllocations(prev => ({ ...prev, [inv.id]: e.target.value }))}
                              className="input-field w-20 text-right text-xs py-1" />
                          </div>
                        ))}
                      </div>
                    )}
                    {(detail.openPurchaseOrders?.length ?? 0) > 0 && tab === 'ap' && (
                      <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Allocate to POs (optional)</p>
                        {detail.openPurchaseOrders!.map(po => (
                          <div key={po.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{po.poNumber} · due {formatCurrency(po.dueAmount)}</span>
                            <input type="number" placeholder="0" value={allocations[po.id] ?? ''}
                              onChange={e => setAllocations(prev => ({ ...prev, [po.id]: e.target.value }))}
                              className="input-field w-20 text-right text-xs py-1" />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {tab === 'ar' ? 'Dr Cash · Cr AR' : 'Dr AP · Cr Cash'} — posts directly to GL
                    </p>
                  </div>
                )}

                <div className="max-h-[280px] overflow-y-auto">
                  <AccountingTable>
                    <thead>
                      <tr>
                        <AccountingTh>Date</AccountingTh>
                        <AccountingTh>JE#</AccountingTh>
                        <AccountingTh align="right">Dr</AccountingTh>
                        <AccountingTh align="right">Cr</AccountingTh>
                        <AccountingTh align="right">Balance</AccountingTh>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l, i) => (
                        <tr key={i}>
                          <AccountingTd>{l.entryDate}</AccountingTd>
                          <AccountingTd>{l.entryNo}</AccountingTd>
                          <AccountingTd align="right" mono>{l.debit > 0 ? formatCurrency(l.debit) : '—'}</AccountingTd>
                          <AccountingTd align="right" mono>{l.credit > 0 ? formatCurrency(l.credit) : '—'}</AccountingTd>
                          <AccountingTd align="right" mono>{formatCurrency(l.runningBalance)}</AccountingTd>
                        </tr>
                      ))}
                    </tbody>
                  </AccountingTable>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AccountingPageShell>
  )
}
