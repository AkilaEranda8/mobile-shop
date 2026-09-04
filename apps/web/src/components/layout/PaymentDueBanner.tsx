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
      className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3 border-b"
      style={{
        background: suspended ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.12)',
        borderColor: suspended ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)',
        color: 'var(--text-primary)',
      }}
      role="alert"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0 text-white"
          style={{ background: suspended ? '#ef4444' : '#f59e0b' }}
        >
          <CreditCard size={11} color="#ffffff" />
          {suspended ? 'Suspended' : grace ? 'Payment Overdue' : 'Payment Due'}
        </span>
        <AlertTriangle size={14} className={`flex-shrink-0 hidden sm:block ${suspended ? 'text-red-500' : 'text-amber-500'}`} />
        <p className="text-[12px] sm:text-[13px] min-w-0">
          {suspended ? (
            <>
              <span className="font-semibold text-red-700 dark:text-red-300">Account suspended for unpaid subscription.</span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>
                {amount != null ? `Outstanding ${formatCurrency(amount)}. ` : ''}
                {invoiceNo ? `Invoice ${invoiceNo}. ` : ''}
                Pay now to restore access.
              </span>
            </>
          ) : grace ? (
            <>
              <span className="font-semibold text-amber-700 dark:text-amber-300">Subscription Payment Due</span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>
                You have {grace.daysRemaining} day{grace.daysRemaining === 1 ? '' : 's'} remaining before suspension.
                {amount != null ? ` Outstanding: ${formatCurrency(amount)}.` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-amber-700 dark:text-amber-300">Your Hexalyte subscription payment is due.</span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>
                {amount != null ? `Amount: ${formatCurrency(amount)}. ` : ''}
                {invoiceNo ? `Invoice ${invoiceNo}. ` : ''}
                Submit payment from Billing.
              </span>
            </>
          )}
        </p>
      </div>
      <Link
        href="/dashboard/billing"
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex-shrink-0 ${
          suspended
            ? 'border-red-500/40 text-red-800 dark:text-red-200 hover:bg-red-500/10'
            : 'border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10'
        }`}
      >
        Pay / LankaQR
      </Link>
      <button
        type="button"
        onClick={dismiss}
        className="p-1 rounded-md hover:bg-black/5 text-gray-500 flex-shrink-0"
        title="Hide for this session"
        aria-label="Hide payment due banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
