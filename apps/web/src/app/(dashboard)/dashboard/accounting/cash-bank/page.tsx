'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Loader2, Plus, RefreshCw, Scale } from 'lucide-react'
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
  CashBankSummaryStrip,
  CashBankSidebar,
  CashBankSection,
} from '@/components/accounting/accounting-ui'
import { useModuleAccess } from '@/lib/module-access'

type Register = {
  kind: 'CASH' | 'BANK' | 'CLEARING'
  id: string
  name: string
  branchId: string | null
  branchName: string | null
  code: string
  glName: string
  balance: number
  bankName?: string | null
  accountNo?: string | null
  accountType?: 'CURRENT' | 'SAVINGS'
  clearingType?: 'CARD' | 'UPI'
}

type ModalAction = { type: 'fill' | 'settle'; register: Register }

function findRegister(all: Register[], ...names: string[]) {
  return all.find(r => names.some(n => r.name.toLowerCase() === n.toLowerCase() || r.name.toLowerCase().includes(n.toLowerCase())))
}

function defaultCounterparty(register: Register, type: 'fill' | 'settle', all: Register[]) {
  const mainCash = findRegister(all, 'Main Cash')
  const mainBank = findRegister(all, 'Main Bank')
  const others = all.filter(r => r.id !== register.id && r.kind !== 'CLEARING')

  if (register.name === 'Petty Cash') {
    return type === 'fill' ? mainCash?.id : undefined
  }
  if (register.kind === 'CASH') {
    return type === 'fill' ? (mainBank?.id ?? mainCash?.id) : mainBank?.id
  }
  if (register.kind === 'BANK') {
    return type === 'fill' ? mainCash?.id : mainCash?.id
  }
  return others[0]?.id
}

function registerSubtitle(r: Register) {
  if (r.kind === 'BANK') {
    const parts = [
      r.accountType === 'SAVINGS' ? 'Savings' : r.accountType === 'CURRENT' ? 'Current' : null,
      r.accountNo ? `#${r.accountNo}` : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'Bank account'
  }
  if (r.kind === 'CLEARING') {
    return r.clearingType === 'UPI' ? 'Wallet / UPI clearing' : 'Card clearing'
  }
  return r.branchName ?? undefined
}

function RegisterCards({
  registers,
  onFill,
  onSettle,
  canEdit,
}: {
  registers: Register[]
  onFill: (r: Register) => void
  onSettle: (r: Register) => void
  canEdit: boolean
}) {
  return (
    <>
      {registers.map(r => (
        <CashFlowRegisterCard
          key={`${r.kind}-${r.id}`}
          name={r.name}
          balance={r.balance}
          kind={r.kind}
          subtitle={registerSubtitle(r)}
          onFill={canEdit && r.kind !== 'CLEARING' ? () => onFill(r) : undefined}
          onSettle={canEdit ? () => onSettle(r) : undefined}
        />
      ))}
    </>
  )
}

export default function CashBankPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const { canEdit } = useModuleAccess()
  const branchId = getActiveBranchId() ?? ''
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modal, setModal] = useState<ModalAction | null>(null)
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(businessToday())
  const [counterpartyId, setCounterpartyId] = useState('')
  const [settleBankId, setSettleBankId] = useState('')
  const [description, setDescription] = useState('')
  const [newBankName, setNewBankName] = useState('')
  const [newAccountType, setNewAccountType] = useState<'CURRENT' | 'SAVINGS'>('CURRENT')
  const [newAccountNo, setNewAccountNo] = useState('')
  const [showAddBank, setShowAddBank] = useState(false)
  const [stmtBalance, setStmtBalance] = useState('')
  const [showReconcile, setShowReconcile] = useState(false)
  const [reconcileBankId, setReconcileBankId] = useState('')

  const cashRegisters = useMemo(() => registers.filter(r => r.kind === 'CASH'), [registers])
  const bankRegisters = useMemo(() => registers.filter(r => r.kind === 'BANK'), [registers])
  const clearingRegisters = useMemo(() => registers.filter(r => r.kind === 'CLEARING'), [registers])

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

  useEffect(() => {
    if (!reconcileBankId && bankRegisters.length) {
      const main = bankRegisters.find(b => b.name === 'Main Bank') ?? bankRegisters[0]
      setReconcileBankId(main.id)
    }
  }, [bankRegisters, reconcileBankId])

  const totals = useMemo(() => ({
    cash: cashRegisters.reduce((s, r) => s + r.balance, 0),
    bank: bankRegisters.reduce((s, r) => s + r.balance, 0),
    clearing: clearingRegisters.reduce((s, r) => s + r.balance, 0),
  }), [cashRegisters, bankRegisters, clearingRegisters])

  function openModal(type: 'fill' | 'settle', register: Register) {
    setModal({ type, register })
    setAmount('')
    setDescription('')
    const def = defaultCounterparty(register, type, registers)
    setCounterpartyId(def ?? registers.find(r => r.id !== register.id && r.kind !== 'CLEARING')?.id ?? '')
    const mainBank = bankRegisters.find(b => b.name === 'Main Bank') ?? bankRegisters[0]
    setSettleBankId(mainBank?.id ?? '')
  }

  function registerType(r: Register): 'CASH' | 'BANK' | 'CARD_CLEARING' | 'UPI_CLEARING' {
    if (r.kind === 'CLEARING') return r.clearingType === 'UPI' ? 'UPI_CLEARING' : 'CARD_CLEARING'
    return r.kind
  }

  function opBranchId(register: Register) {
    return register.branchId ?? branchId
  }

  async function handleModalSubmit() {
    if (!modal) return
    const { type, register } = modal
    const effectiveBranch = opBranchId(register)
    if (!effectiveBranch) { toast.error('Select an active branch first'); return }

    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }

    setSubmitting(true)
    try {
      if (register.kind === 'CLEARING' && type === 'settle') {
        if (!settleBankId) { toast.error('Select destination bank'); return }
        await accountingApi.settleClearing({
          branchId: effectiveBranch,
          entryDate,
          clearingType: register.clearingType ?? 'CARD',
          amount: amt,
          bankAccountId: settleBankId,
          memo: description || undefined,
        })
        toast.success('Clearing settled to bank')
      } else if (register.name === 'Petty Cash' && type === 'fill') {
        await accountingApi.replenishPettyCash({
          branchId: effectiveBranch,
          entryDate,
          amount: amt,
          memo: description || 'Petty cash fill',
        })
        toast.success('Petty cash filled')
      } else if (register.name === 'Petty Cash' && type === 'settle') {
        await accountingApi.pettyCashExpense({
          branchId: effectiveBranch,
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
        const xferBranch = from.branchId ?? to.branchId ?? effectiveBranch

        await accountingApi.cashBankTransfer({
          branchId: xferBranch,
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
    if (!newBankName.trim()) { toast.error('Enter bank name (e.g. HNB, KOKO)'); return }
    setSubmitting(true)
    try {
      await accountingApi.createBankAccount({
        bankName: newBankName.trim(),
        accountType: newAccountType,
        ...(newAccountNo.trim() ? { accountNo: newAccountNo.trim() } : {}),
        ...(branchId ? { branchId } : {}),
      })
      toast.success('Bank account added')
      setNewBankName('')
      setNewAccountType('CURRENT')
      setNewAccountNo('')
      setShowAddBank(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const previewBankName = newBankName.trim()
    ? `${newBankName.trim()} ${newAccountType === 'SAVINGS' ? 'Savings Account' : 'Current Account'}`
    : ''

  async function handleReconcile() {
    const bal = Number(stmtBalance)
    if (!branchId || Number.isNaN(bal)) { toast.error('Enter statement balance'); return }
    if (!reconcileBankId && bankRegisters.length > 1) { toast.error('Select a bank account'); return }
    setSubmitting(true)
    try {
      const res = await accountingApi.reconcileBank({
        branchId,
        entryDate,
        statementBalance: bal,
        ...(reconcileBankId ? { bankAccountId: reconcileBankId } : {}),
      }) as { data: { balanced: boolean; adjustment: number } }
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
        title="Cash & Bank"
        subtitle="Live liquidity board — tap Fill or Settle on any account"
        icon={Landmark}
        actions={
          <div className="flex items-center gap-2 lg:hidden">
            {canEdit && <>
              <button type="button" onClick={() => setShowAddBank(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={14} /> Add bank
              </button>
              <button type="button" onClick={() => setShowReconcile(true)} className="btn-secondary flex items-center gap-2 text-sm">
                <Scale size={14} /> Reconcile
              </button>
            </>}
            <button type="button" onClick={load} className="btn-secondary p-2.5 rounded-lg" aria-label="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : registers.length === 0 ? (
        <AccountingPanel>
          <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No cash or bank registers. Initialize accounting first.
          </p>
        </AccountingPanel>
      ) : (
        <div className="grid lg:grid-cols-[minmax(260px,280px)_1fr] gap-5 items-start">
          <div className="lg:hidden">
            <CashBankSummaryStrip cash={totals.cash} bank={totals.bank} clearing={totals.clearing} />
          </div>

          <div className="hidden lg:block">
            <CashBankSidebar
              cash={totals.cash}
              bank={totals.bank}
              clearing={totals.clearing}
              counts={{
                cash: cashRegisters.length,
                bank: bankRegisters.length,
                clearing: clearingRegisters.length,
              }}
              onAddBank={canEdit ? () => setShowAddBank(true) : undefined}
              onReconcile={canEdit ? () => setShowReconcile(true) : undefined}
              onRefresh={load}
              loading={loading}
            />
          </div>

          <div className="space-y-5 min-w-0">
            {cashRegisters.length > 0 && (
              <CashBankSection id="cash-section" title="Cash registers" kind="CASH" count={cashRegisters.length} compact>
                <RegisterCards registers={cashRegisters} onFill={r => openModal('fill', r)} onSettle={r => openModal('settle', r)} canEdit={canEdit} />
              </CashBankSection>
            )}
            {bankRegisters.length > 0 && (
              <CashBankSection id="bank-section" title="Bank accounts" kind="BANK" count={bankRegisters.length} compact>
                <RegisterCards registers={bankRegisters} onFill={r => openModal('fill', r)} onSettle={r => openModal('settle', r)} canEdit={canEdit} />
              </CashBankSection>
            )}
            {clearingRegisters.length > 0 && (
              <CashBankSection id="clearing-section" title="Clearing accounts" kind="CLEARING" count={clearingRegisters.length} compact>
                <RegisterCards registers={clearingRegisters} onFill={r => openModal('fill', r)} onSettle={r => openModal('settle', r)} canEdit={canEdit} />
              </CashBankSection>
            )}
          </div>
        </div>
      )}

      {modal && (
        <AccountingModal
          title={`${modal.type === 'fill' ? 'Fill account' : 'Settle account'}`}
          icon={Landmark}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <div
              className="rounded-xl px-4 py-3 border"
              style={{
                background: modal.type === 'fill' ? 'rgba(22,163,74,0.08)' : 'rgba(225,29,72,0.08)',
                borderColor: modal.type === 'fill' ? 'rgba(22,163,74,0.25)' : 'rgba(225,29,72,0.25)',
              }}
            >
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{modal.register.name}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Balance:{' '}
                <span className={`font-semibold ${modal.register.balance < 0 ? 'text-rose-500' : ''}`} style={modal.register.balance >= 0 ? { color: 'var(--text-primary)' } : undefined}>
                  LKR {modal.register.balance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            </div>

            {modal.register.kind === 'CLEARING' && modal.type === 'settle' ? (
              <>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Move {modal.register.clearingType ?? 'card'} clearing balance to a bank account.
                </p>
                {bankRegisters.length > 0 && (
                  <label className="block">
                    <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Deposit to bank</span>
                    <select value={settleBankId} onChange={e => setSettleBankId(e.target.value)} className="input-field text-sm w-full">
                      {bankRegisters.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : modal.register.name === 'Petty Cash' ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {modal.type === 'fill' ? 'Replenish petty cash from main cash register.' : 'Record a petty cash expense.'}
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
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="input-field text-sm" autoFocus />
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
            <label className="block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bank name</span>
              <input type="text" placeholder="e.g. HNB, KOKO, Commercial Bank" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="input-field text-sm" autoFocus />
            </label>
            <label className="block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Account type</span>
              <select value={newAccountType} onChange={e => setNewAccountType(e.target.value as 'CURRENT' | 'SAVINGS')} className="input-field text-sm w-full">
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Account number (optional)</span>
              <input type="text" placeholder="e.g. 1234567890" value={newAccountNo} onChange={e => setNewAccountNo(e.target.value)} className="input-field text-sm" />
            </label>
            {previewBankName && (
              <p className="text-xs rounded-lg px-3 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-300">
                Will be saved as: <span className="font-semibold">{previewBankName}</span>
              </p>
            )}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Each bank account gets its own GL ledger — balances are tracked separately.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddBank(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={handleAddBank} disabled={submitting} className="btn-primary flex-1 text-sm">Add account</button>
            </div>
          </div>
        </AccountingModal>
      )}

      {showReconcile && (
        <AccountingModal title="Bank reconciliation" icon={Landmark} onClose={() => setShowReconcile(false)}>
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter statement balance for the selected bank account.</p>
            {bankRegisters.length > 0 && (
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bank account</span>
                <select value={reconcileBankId} onChange={e => setReconcileBankId(e.target.value)} className="input-field text-sm w-full">
                  {bankRegisters.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <input type="number" step="0.01" placeholder="Statement balance" value={stmtBalance} onChange={e => setStmtBalance(e.target.value)} className="input-field text-sm" />
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
