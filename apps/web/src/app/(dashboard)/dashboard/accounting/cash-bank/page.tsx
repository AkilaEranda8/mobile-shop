'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Loader2, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingPageHeader,
  AccountingPanel,
  AccountingModal,
  CashFlowRegisterCard,
} from '@/components/accounting/accounting-ui'

type Register = {
  kind: 'CASH' | 'BANK' | 'CLEARING'
  id: string
  name: string
  branchId: string | null
  branchName: string | null
  code: string
  glName: string
  balance: number
  clearingType?: 'CARD' | 'UPI'
}

type ModalAction = { type: 'fill' | 'settle'; register: Register }

export default function CashBankPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const branchId = getActiveBranchId() ?? ''
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modal, setModal] = useState<ModalAction | null>(null)
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(businessToday())
  const [counterpartyId, setCounterpartyId] = useState('')
  const [description, setDescription] = useState('')
  const [newBankName, setNewBankName] = useState('')
  const [showAddBank, setShowAddBank] = useState(false)
  const [stmtBalance, setStmtBalance] = useState('')
  const [showReconcile, setShowReconcile] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountingApi.cashBankRegisters() as { data: Register[] }
      setRegisters(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  const totals = useMemo(() => {
    const cash = registers.filter(r => r.kind === 'CASH').reduce((s, r) => s + r.balance, 0)
    const bank = registers.filter(r => r.kind === 'BANK').reduce((s, r) => s + r.balance, 0)
    const clearing = registers.filter(r => r.kind === 'CLEARING').reduce((s, r) => s + r.balance, 0)
    return { cash, bank, clearing, total: cash + bank + clearing }
  }, [registers])

  function openModal(type: 'fill' | 'settle', register: Register) {
    setModal({ type, register })
    setAmount('')
    setDescription('')
    const others = registers.filter(r => r.id !== register.id && r.kind !== 'CLEARING')
    setCounterpartyId(others[0]?.id ?? '')
  }

  function registerType(r: Register): 'CASH' | 'BANK' | 'CARD_CLEARING' | 'UPI_CLEARING' {
    if (r.kind === 'CLEARING') return r.clearingType === 'UPI' ? 'UPI_CLEARING' : 'CARD_CLEARING'
    return r.kind
  }

  async function handleModalSubmit() {
    if (!modal || !branchId) { toast.error('Select a branch'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }

    const { type, register } = modal
    setSubmitting(true)
    try {
      if (register.kind === 'CLEARING' && type === 'settle') {
        await accountingApi.settleClearing({
          branchId,
          entryDate,
          clearingType: register.clearingType ?? 'CARD',
          amount: amt,
          memo: description || undefined,
        })
        toast.success('Clearing settled to bank')
      } else if (register.name === 'Petty Cash' && type === 'fill') {
        await accountingApi.replenishPettyCash({
          branchId,
          entryDate,
          amount: amt,
          memo: description || 'Petty cash fill',
        })
        toast.success('Petty cash filled')
      } else if (register.name === 'Petty Cash' && type === 'settle') {
        await accountingApi.pettyCashExpense({
          branchId,
          entryDate,
          amount: amt,
          description: description || 'Petty cash expense',
        })
        toast.success('Petty cash expense posted')
      } else {
        const counter = registers.find(r => r.id === counterpartyId)
        if (!counter) { toast.error('Select a counterparty account'); return }

        const from = type === 'fill' ? counter : register
        const to = type === 'fill' ? register : counter

        await accountingApi.cashBankTransfer({
          branchId,
          entryDate,
          amount: amt,
          fromType: registerType(from),
          toType: registerType(to),
          fromId: from.kind !== 'CLEARING' ? from.id : undefined,
          toId: to.kind !== 'CLEARING' ? to.id : undefined,
          memo: description || `${type === 'fill' ? 'Fill' : 'Settle'} — ${register.name}`,
        })
        toast.success(type === 'fill' ? 'Funds added' : 'Funds settled')
      }
      setModal(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddBank() {
    if (!newBankName.trim()) { toast.error('Enter bank name'); return }
    setSubmitting(true)
    try {
      await accountingApi.createBankAccount({ name: newBankName, ...(branchId ? { branchId } : {}) })
      toast.success('Bank account added')
      setNewBankName('')
      setShowAddBank(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReconcile() {
    const bal = Number(stmtBalance)
    if (!branchId || Number.isNaN(bal)) { toast.error('Enter statement balance'); return }
    setSubmitting(true)
    try {
      const res = await accountingApi.reconcileBank({ branchId, entryDate, statementBalance: bal }) as { data: { balanced: boolean; adjustment: number } }
      toast.success(res.data.balanced ? 'Already balanced' : `Adjustment posted: ${formatCurrency(res.data.adjustment)}`)
      setStmtBalance('')
      setShowReconcile(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reconciliation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const counterpartyOptions = useMemo(() => {
    if (!modal) return []
    return registers.filter(r => r.id !== modal.register.id && r.kind !== 'CLEARING')
  }, [modal, registers])

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Cash Flow"
        subtitle="Live balances across cash registers, bank accounts and clearing"
        icon={Landmark}
        actions={
          <>
            <button type="button" onClick={() => setShowAddBank(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add bank
            </button>
            <button type="button" onClick={() => setShowReconcile(true)} className="btn-secondary text-sm">
              Reconcile
            </button>
            <button type="button" onClick={load} className="btn-secondary p-2" aria-label="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      {!loading && registers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Cash</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.cash)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Bank</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.bank)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Clearing</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totals.clearing)}</p>
          </div>
          <div className="card p-3 text-center border-violet-500/25 bg-violet-500/5">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-violet-400">Total</p>
            <p className="text-lg font-bold mt-1 text-violet-300">{formatCurrency(totals.total)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : registers.length === 0 ? (
        <AccountingPanel>
          <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No cash or bank registers. Initialize accounting first.
          </p>
        </AccountingPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
          {registers.map(r => (
            <CashFlowRegisterCard
              key={`${r.kind}-${r.id}`}
              name={r.name}
              balance={r.balance}
              kind={r.kind}
              branchName={r.branchName}
              onFill={r.kind === 'CLEARING' ? undefined : () => openModal('fill', r)}
              onSettle={() => openModal('settle', r)}
            />
          ))}
        </div>
      )}

      {modal && (
        <AccountingModal
          title={`${modal.type === 'fill' ? 'Fill' : 'Settle'} — ${modal.register.name}`}
          icon={Landmark}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Current balance: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(modal.register.balance)}</span>
            </p>

            {modal.register.kind === 'CLEARING' && modal.type === 'settle' ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Move {modal.register.clearingType ?? 'card'} clearing balance to the main bank account.
              </p>
            ) : modal.register.name === 'Petty Cash' ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {modal.type === 'fill' ? 'Replenish petty cash from main cash.' : 'Record a petty cash expense.'}
              </p>
            ) : counterpartyOptions.length > 0 && (
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {modal.type === 'fill' ? 'Transfer from' : 'Transfer to'}
                </span>
                <select value={counterpartyId} onChange={e => setCounterpartyId(e.target.value)} className="input-field text-sm w-full">
                  {counterpartyOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.name}{o.branchName ? ` (${o.branchName})` : ''}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR)</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field text-sm" autoFocus />
              </label>
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm" />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Note (optional)</span>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input-field text-sm" />
            </label>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                onClick={handleModalSubmit}
                disabled={submitting}
                className={`flex-1 text-sm text-white font-medium py-2 rounded-lg transition-colors ${modal.type === 'fill' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}
              >
                {submitting ? 'Posting…' : modal.type === 'fill' ? 'Fill' : 'Settle'}
              </button>
            </div>
          </div>
        </AccountingModal>
      )}

      {showAddBank && (
        <AccountingModal title="Add bank account" icon={Plus} onClose={() => setShowAddBank(false)}>
          <div className="space-y-4">
            <input type="text" placeholder="e.g. HNB Current Account" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="input-field text-sm" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddBank(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={handleAddBank} disabled={submitting} className="btn-primary flex-1 text-sm">Add</button>
            </div>
          </div>
        </AccountingModal>
      )}

      {showReconcile && (
        <AccountingModal title="Bank reconciliation" icon={Landmark} onClose={() => setShowReconcile(false)}>
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter your bank statement balance to post a variance adjustment.</p>
            <input type="number" placeholder="Statement balance" value={stmtBalance} onChange={e => setStmtBalance(e.target.value)} className="input-field text-sm" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowReconcile(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={handleReconcile} disabled={submitting} className="btn-primary flex-1 text-sm">Reconcile</button>
            </div>
          </div>
        </AccountingModal>
      )}
    </AccountingPageShell>
  )
}
