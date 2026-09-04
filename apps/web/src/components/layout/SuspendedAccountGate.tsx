'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react'
import { billingApi, tenantApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const ALLOWED_WHEN_SUSPENDED = [
  '/dashboard/billing',
  '/dashboard/settings',
  '/settings',
  '/login',
]

function isAllowedPath(pathname: string) {
  return ALLOWED_WHEN_SUSPENDED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
  )
}

/**
 * When tenant is payment-suspended, block business UI and keep billing accessible.
 * Does not clear the session.
 */
export function SuspendedAccountGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [suspended, setSuspended] = useState(false)
  const [outstanding, setOutstanding] = useState<{ invoiceNumber?: string; amount?: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const r: any = await tenantApi.me()
      const tenant = r?.data ?? r
      const isSusp = tenant?.status === 'SUSPENDED'
      setSuspended(isSusp)
      if (isSusp) {
        try {
          const o: any = await billingApi.overview()
          const data = o?.data ?? o
          const inv = data?.currentInvoice
          setOutstanding(inv ? { invoiceNumber: inv.invoiceNumber, amount: inv.total } : null)
        } catch {
          setOutstanding(
            tenant?.paymentDueAmount != null
              ? { invoiceNumber: tenant.paymentDueInvoiceNo, amount: tenant.paymentDueAmount }
              : null,
          )
        }
      }
    } catch {
      // If /tenants/me fails for other reasons, don't lock the UI
      setSuspended(false)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!suspended || checking) return
    if (!isAllowedPath(pathname)) {
      router.replace('/dashboard/settings?tab=billing&suspended=1')
    }
  }, [suspended, checking, pathname, router])

  if (checking) return <>{children}</>

  if (suspended && !isAllowedPath(pathname)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="text-red-600" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Account Suspended</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your subscription payment is overdue past the grace period. Settle the outstanding invoice to restore access.
            </p>
            {outstanding && (
              <p className="text-sm font-semibold text-gray-800 mt-3">
                {outstanding.invoiceNumber ?? 'Invoice'}
                {outstanding.amount != null ? ` · ${formatCurrency(outstanding.amount)}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.replace('/dashboard/settings?tab=billing&suspended=1')}
            className="inline-flex items-center justify-center gap-2 w-full text-sm font-bold py-2.5 rounded-xl bg-emerald-600 text-white"
          >
            <CreditCard size={15} /> Go to Settings → Billing
          </button>
          <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Checking payment status…
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
