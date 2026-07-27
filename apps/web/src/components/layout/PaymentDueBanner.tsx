'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CreditCard, Phone, X } from 'lucide-react'
import { tenantApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

function sessionKey(tenantId?: string) {
  return tenantId ? `hx_payment_due_banner_dismissed:${tenantId}` : null
}

/**
 * Shown to all shop users when platform admin marks Payment Due.
 * Session-dismissible only — reappears on next login / new session.
 */
export function PaymentDueBanner() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(() => {
    tenantApi.me()
      .then((r: any) => {
        const data = (r?.data ?? r) as Tenant
        setTenant(data)
        try {
          const key = sessionKey(data?.id)
          if (key && sessionStorage.getItem(key) === '1' && data?.paymentDue) {
            setDismissed(true)
          } else {
            setDismissed(false)
          }
        } catch {
          setDismissed(false)
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

  if (!tenant?.paymentDue || dismissed) return null

  const amount = tenant.paymentDueAmount != null ? formatCurrency(tenant.paymentDueAmount) : null
  const invoiceNo = tenant.paymentDueInvoiceNo

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
        background: 'rgba(245,158,11,0.12)',
        borderColor: 'rgba(245,158,11,0.35)',
        color: 'var(--text-primary)',
      }}
      role="alert"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: '#f59e0b', color: '#ffffff' }}
        >
          <CreditCard size={11} color="#ffffff" /> Payment Due
        </span>
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 hidden sm:block" />
        <p className="text-[12px] sm:text-[13px] min-w-0">
          <span className="font-semibold text-amber-700 dark:text-amber-300">Your Hexalyte subscription payment is due.</span>
          {' '}
          <span style={{ color: 'var(--text-muted)' }}>
            {amount ? `Amount: ${amount}. ` : ''}
            {invoiceNo ? `Invoice ${invoiceNo}. ` : ''}
            Please settle with Hexalyte to keep your account active.
          </span>
        </p>
      </div>
      <a
        href="tel:+94703130100"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10 flex-shrink-0"
      >
        <Phone size={12} /> +94 70 3130100
      </a>
      <button
        type="button"
        onClick={dismiss}
        className="p-1 rounded-md hover:bg-amber-500/15 text-amber-700/70 dark:text-amber-300/70 flex-shrink-0"
        title="Hide for this session"
        aria-label="Hide payment due banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
