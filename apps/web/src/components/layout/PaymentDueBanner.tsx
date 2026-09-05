'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CreditCard, X } from 'lucide-react'
import { billingApi, tenantApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

function sessionKey(tenantId?: string) {
  return tenantId ? `hx_payment_due_banner_dismissed:${tenantId}` : null
}

/**
 * Non-blocking overdue / payment-due banner.
 * During grace period shows remaining days; links to Billing.
 */
export function PaymentDueBanner() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [grace, setGrace] = useState<{ daysRemaining: number; amount: number; invoiceNumber?: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(() => {
    tenantApi.me()
      .then(async (r: any) => {
        const data = (r?.data ?? r) as Tenant
        setTenant(data)
        try {
          const key = sessionKey(data?.id)
          if (key && sessionStorage.getItem(key) === '1' && (data?.paymentDue || data?.status === 'SUSPENDED')) {
            setDismissed(true)
          } else {
            setDismissed(false)
          }
        } catch {
          setDismissed(false)
        }

        if (data?.paymentDue || data?.status === 'SUSPENDED') {
          try {
            const o: any = await billingApi.overview()
            const overview = o?.data ?? o
            if (overview?.graceWarning) {
              setGrace({
                daysRemaining: overview.graceWarning.daysRemaining,
                amount: overview.graceWarning.amount,
                invoiceNumber: overview.graceWarning.invoiceNumber,
              })
            } else {
              setGrace(null)
            }
          } catch {
            setGrace(null)
          }
        } else {
          setGrace(null)
        }
      })
      .catch(() => setTenant(null))
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 60_000)
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  const show = tenant && (tenant.paymentDue || tenant.status === 'SUSPENDED' || grace)
  if (!show || dismissed) return null

  const amount = grace?.amount ?? (tenant.paymentDueAmount != null ? tenant.paymentDueAmount : null)
  const invoiceNo = grace?.invoiceNumber ?? tenant.paymentDueInvoiceNo
  const suspended = tenant.status === 'SUSPENDED'

  const dismiss = () => {
    setDismissed(true)
    try {
      const key = sessionKey(tenant.id)
      if (key) sessionStorage.setItem(key, '1')
    } catch { /* ignore */ }
  }

  return (
    <div
      className="px-4 lg:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-b"
      style={{
        background: suspended ? 'rgba(239,68,68,0.08)' : 'var(--status-warn-soft)',
        borderColor: suspended ? 'rgba(239,68,68,0.28)' : 'var(--status-warn-border)',
        color: 'var(--text-primary)',
      }}
      role="alert"
    >
      <div className="flex items-center gap-2 shrink-0">
        <AlertTriangle
          size={15}
          className={suspended ? 'text-red-500' : 'text-amber-500'}
          aria-hidden
        />
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: suspended ? 'var(--status-error)' : 'var(--status-warning)' }}
        >
          {suspended ? 'Suspended' : grace ? 'Payment Overdue' : 'Payment Due'}
        </span>
      </div>
      <p className="text-[12px] sm:text-[13px] min-w-0 flex-1 leading-snug">
        {suspended ? (
          <>
            <span className="font-medium">Account suspended for unpaid subscription.</span>
            {' '}
            <span style={{ color: 'var(--text-muted)' }}>
              {amount != null ? `Outstanding ${formatCurrency(amount)}. ` : ''}
              {invoiceNo ? `Invoice ${invoiceNo}. ` : ''}
              Pay now to restore access.
            </span>
          </>
        ) : grace ? (
          <>
            <span className="font-medium">Your Hexalyte subscription payment is due.</span>
            {' '}
            <span style={{ color: 'var(--text-muted)' }}>
              {grace.daysRemaining} day{grace.daysRemaining === 1 ? '' : 's'} remaining before suspension.
              {amount != null ? ` Outstanding: ${formatCurrency(amount)}.` : ''}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Your Hexalyte subscription payment is due.</span>
            {' '}
            <span style={{ color: 'var(--text-muted)' }}>
              {amount != null ? `Amount: ${formatCurrency(amount)}. ` : ''}
              {invoiceNo ? `Invoice ${invoiceNo}. ` : ''}
              Submit payment from Billing.
            </span>
          </>
        )}
      </p>
      <Link
        href="/dashboard/settings?tab=billing"
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold h-8 px-3 rounded-lg shrink-0 ${
          suspended
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        }`}
      >
        <CreditCard size={12} />
        Pay Now
      </Link>
      <button
        type="button"
        onClick={dismiss}
        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[color:var(--text-muted)] shrink-0"
        title="Hide for this session"
        aria-label="Hide payment due banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
