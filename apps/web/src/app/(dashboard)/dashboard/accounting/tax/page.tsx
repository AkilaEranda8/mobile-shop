'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Receipt, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useActiveBranchId, useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { useModuleAccess } from '@/lib/module-access'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingKpiCard,
  AccountingPageHeader,
  AccountingPanel,
  AccountingTable,
  AccountingTd,
  AccountingTh,
  AMBER_ACCENT,
  CYAN_ACCENT,
  VIOLET_ACCENT,
} from '@/components/accounting/accounting-ui'

type VatSummary = { from: string; to: string; outputVat: number; inputVat: number; netPayable: number }

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD'] as const

export default function TaxPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const { canEdit } = useModuleAccess()
  const branchId = useActiveBranchId() ?? ''
  const [summary, setSummary] = useState<VatSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => businessToday().slice(0, 8) + '01')
  const [to, setTo] = useState(businessToday())
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string>('BANK_TRANSFER')
  const [payLoading, setPayLoading] = useState(false)
  const [taxCodes, setTaxCodes] = useState<Array<{ code: string; name: string; rate: number; type: string; glAccount: { code: string } }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, codesRes] = await Promise.all([
        accountingApi.vatSummary({ from, to }) as Promise<{ data: VatSummary }>,
        accountingApi.taxCodes() as Promise<{ data: typeof taxCodes }>,
      ])
      setSummary(sumRes.data)
      setTaxCodes(codesRes.data ?? [])
      setPayAmount(String(Math.max(0, sumRes.data.netPayable)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load VAT summary')
    } finally {
      setLoading(false)
    }
  }, [from, to, branchId])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  async function handleVatPayment() {
    if (!canEdit) return
    const amount = Number(payAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!branchId) { toast.error('Select a branch'); return }
    setPayLoading(true)
    try {
      await accountingApi.vatPayment({ branchId, entryDate: to, amount, paymentMethod: payMethod, from, to })
      toast.success('VAT payment posted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'VAT payment failed')
    } finally {
      setPayLoading(false)
    }
  }

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="VAT / Tax"
        subtitle="Output vs input VAT and remittance"
        icon={Receipt}
        actions={
          <button type="button" onClick={load} className="btn-secondary p-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field w-auto text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field w-auto text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : summary && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AccountingKpiCard label="Output VAT" value={formatCurrency(summary.outputVat)} accent={AMBER_ACCENT} />
            <AccountingKpiCard label="Input VAT" value={formatCurrency(summary.inputVat)} accent={CYAN_ACCENT} />
            <AccountingKpiCard label="Net Payable" value={formatCurrency(summary.netPayable)} accent={VIOLET_ACCENT} />
          </div>

          <AccountingPanel title="Record VAT Payment">
            <fieldset disabled={!canEdit} className="p-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR)</span>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Payment method</span>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </label>
                <div className="flex items-end">
                  <button type="button" onClick={handleVatPayment} disabled={payLoading || !canEdit} className="btn-primary w-full text-sm disabled:opacity-60">
                    {payLoading ? 'Posting…' : 'Post VAT Payment'}
                  </button>
                </div>
              </div>
            </fieldset>
          </AccountingPanel>

          <AccountingPanel title="Tax codes">
            <AccountingTable>
              <thead>
                <tr>
                  <AccountingTh>Code</AccountingTh>
                  <AccountingTh>Name</AccountingTh>
                  <AccountingTh>Rate</AccountingTh>
                  <AccountingTh>GL Account</AccountingTh>
                </tr>
              </thead>
              <tbody>
                {taxCodes.map(t => (
                  <tr key={t.code}>
                    <AccountingTd mono className="text-violet-400">{t.code}</AccountingTd>
                    <AccountingTd>{t.name}</AccountingTd>
                    <AccountingTd>{t.type} · {t.rate}%</AccountingTd>
                    <AccountingTd mono>{t.glAccount.code}</AccountingTd>
                  </tr>
                ))}
              </tbody>
            </AccountingTable>
          </AccountingPanel>
        </>
      )}
    </AccountingPageShell>
  )
}
