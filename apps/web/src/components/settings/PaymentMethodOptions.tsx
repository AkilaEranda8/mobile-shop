'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { salesApi } from '@/lib/api'
import type { PaymentFeeType, TenantPaymentMethod } from '@/lib/payment-methods'

export type ClearingAccountOption = { id: string; code: string; name: string }

/** Loads clearing GL accounts once per Settings visit (Owner/Manager only; empty otherwise). */
export function useClearingAccountOptions() {
  const [state, setState] = useState<{ accountingActive: boolean; clearingAccounts: ClearingAccountOption[] }>({
    accountingActive: false,
    clearingAccounts: [],
  })
  useEffect(() => {
    let alive = true
    salesApi.paymentClearanceOptions()
      .then((r: any) => {
        const d = r?.data ?? r
        if (alive && d) setState({ accountingActive: !!d.accountingActive, clearingAccounts: Array.isArray(d.clearingAccounts) ? d.clearingAccounts : [] })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return state
}

function summary(m: TenantPaymentMethod): string {
  const parts: string[] = []
  if (m.enabled === false) parts.push('Disabled')
  if (m.fee?.enabled && m.fee.rate > 0) parts.push(`Fee ${m.fee.type === 'FIXED' ? m.fee.rate : `${m.fee.rate}%`}`)
  if (m.clearance?.required) parts.push('Needs clearance')
  return parts.join(' · ')
}

export function PaymentMethodOptions({
  method,
  canEdit,
  accountingActive,
  clearingAccounts,
  onChange,
}: {
  method: TenantPaymentMethod
  canEdit: boolean
  accountingActive: boolean
  clearingAccounts: ClearingAccountOption[]
  onChange: (next: TenantPaymentMethod) => void
}) {
  const [open, setOpen] = useState(false)
  const isCash = method.key === 'CASH'
  const fee = method.fee ?? { enabled: false, type: 'PERCENT' as PaymentFeeType, rate: 0 }
  const clearance = method.clearance ?? { required: false }
  const info = summary(method)

  const setFee = (patch: Partial<typeof fee>) => onChange({ ...method, fee: { ...fee, ...patch } })
  const setClearance = (patch: Partial<typeof clearance>) => onChange({ ...method, clearance: { ...clearance, ...patch } })

  if (isCash) return null

  return (
    <div className="pl-11">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium"
        style={{ color: 'var(--text-muted)' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Fee &amp; clearance options
        {info && <span className="ml-2 rounded-md px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-subtle-md)' }}>{info}</span>}
      </button>

      {open && (
        <div className="mt-3 grid gap-4 rounded-xl border p-4 sm:grid-cols-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Show at checkout</p>
            <div className="flex items-center gap-2">
              <Switch checked={method.enabled !== false} disabled={!canEdit} onChange={v => onChange({ ...method, enabled: v })} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{method.enabled === false ? 'Hidden (history kept)' : 'Enabled'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Customer fee</p>
            <div className="flex items-center gap-2">
              <Switch checked={fee.enabled} disabled={!canEdit} onChange={v => setFee({ enabled: v })} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Added on top of the bill</span>
            </div>
            {fee.enabled && (
              <div className="flex gap-2">
                <select
                  className="input-field h-9 text-sm w-24"
                  value={fee.type}
                  disabled={!canEdit}
                  onChange={e => setFee({ type: e.target.value === 'FIXED' ? 'FIXED' : 'PERCENT' })}
                >
                  <option value="PERCENT">%</option>
                  <option value="FIXED">Fixed</option>
                </select>
                <input
                  className="input-field h-9 text-sm flex-1"
                  inputMode="decimal"
                  value={Number.isFinite(fee.rate) ? String(fee.rate) : ''}
                  disabled={!canEdit}
                  onChange={e => {
                    const n = Number(e.target.value)
                    setFee({ rate: Number.isFinite(n) && n >= 0 ? n : 0 })
                  }}
                  placeholder={fee.type === 'PERCENT' ? 'e.g. 3' : 'e.g. 100'}
                />
              </div>
            )}
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Rate changes apply to new sales only.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Clearance</p>
            <div className="flex items-center gap-2">
              <Switch checked={clearance.required} disabled={!canEdit} onChange={v => setClearance({ required: v })} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Money arrives later (settlement)</span>
            </div>
            {clearance.required && (
              <>
                {accountingActive && (
                  <select
                    className="input-field h-9 text-sm w-full"
                    value={clearance.glAccountId ?? ''}
                    disabled={!canEdit}
                    onChange={e => setClearance({ glAccountId: e.target.value || undefined })}
                  >
                    <option value="">Pending Payment Clearance (default)</option>
                    {clearingAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                )}
                <input
                  className="input-field h-9 text-sm w-full"
                  inputMode="decimal"
                  value={clearance.expectedDeductionRate != null ? String(clearance.expectedDeductionRate) : ''}
                  disabled={!canEdit}
                  onChange={e => {
                    const n = Number(e.target.value)
                    setClearance({ expectedDeductionRate: e.target.value && Number.isFinite(n) && n > 0 ? n : undefined })
                  }}
                  placeholder="Expected provider deduction % (optional)"
                />
              </>
            )}
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pending money stays out of Main Cash / Bank until marked as cleared.</p>
          </div>
        </div>
      )}
    </div>
  )
}
