'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Hourglass, Sparkles } from 'lucide-react'
import { tenantApi } from '@/lib/api'
import type { Tenant } from '@/types'
import { BILLING_PAID_EVENT } from '@/lib/billing-events'

const BILLING_HREF = '/dashboard/settings?tab=billing'
const DAY_MS = 24 * 60 * 60 * 1000

let trialEndCache: { value: number | null; at: number } | null = null
let trialEndInFlight: Promise<number | null> | null = null

function loadTrialEnd(force = false): Promise<number | null> {
  if (!force && trialEndCache && Date.now() - trialEndCache.at < 5 * 60_000) {
    return Promise.resolve(trialEndCache.value)
  }
  trialEndInFlight ??= tenantApi.me()
    .then((r: any) => {
      const t = (r?.data ?? r) as Tenant
      const end = t?.status === 'TRIAL' && t.trialEndsAt ? new Date(t.trialEndsAt).getTime() : null
      trialEndCache = { value: Number.isFinite(end) ? end : null, at: Date.now() }
      return trialEndCache.value
    })
    .catch(() => trialEndCache?.value ?? null)
    .finally(() => { trialEndInFlight = null })
  return trialEndInFlight
}

/** Live trial countdown: `msLeft` is null when the tenant is not on a trial. */
function useTrialCountdown() {
  const [trialEnd, setTrialEnd] = useState<number | null>(trialEndCache?.value ?? null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const load = (force = false) => loadTrialEnd(force).then(v => { if (alive) setTrialEnd(v) })
    load()
    const refresh = window.setInterval(() => load(), 5 * 60_000)
    const onPaid = () => load(true)
    window.addEventListener(BILLING_PAID_EVENT, onPaid)
    return () => {
      alive = false
      window.clearInterval(refresh)
      window.removeEventListener(BILLING_PAID_EVENT, onPaid)
    }
  }, [])

  const lastDay = trialEnd != null && trialEnd - now <= DAY_MS

  useEffect(() => {
    if (trialEnd == null) return
    const id = window.setInterval(() => setNow(Date.now()), lastDay ? 1000 : 60_000)
    return () => window.clearInterval(id)
  }, [trialEnd, lastDay])

  const msLeft = trialEnd == null ? null : Math.max(0, trialEnd - now)
  return { msLeft, lastDay }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatLeft(ms: number, lastDay: boolean) {
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (lastDay) return `${pad(h)}:${pad(m)}:${pad(s)}`
  if (d > 0) return `${d}d ${h}h`
  return `${h}h ${m}m`
}

export function TrialHeaderChip() {
  const { msLeft, lastDay } = useTrialCountdown()
  if (msLeft == null) return null

  const days = Math.ceil(msLeft / DAY_MS)
  return (
    <Link
      href={BILLING_HREF}
      title={lastDay ? 'Your trial ends today — upgrade now' : `Free trial: ${days} day${days === 1 ? '' : 's'} left — click to upgrade`}
      className={`inline-flex items-center gap-1 sm:gap-1.5 h-8 px-2 xl:px-3 rounded-xl text-xs font-semibold border transition-all hover:opacity-90 whitespace-nowrap ${
        lastDay
          ? 'bg-red-600 border-red-500 text-white animate-pulse'
          : 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
      }`}
    >
      <Hourglass size={14} />
      <span className="hidden sm:inline">{lastDay ? 'Trial ends in' : 'Trial'}</span>
      <span className="font-mono tabular-nums">{formatLeft(msLeft, lastDay)}</span>
    </Link>
  )
}

/** Red frame + banner shown during the final 24 hours of a trial. */
export function TrialEndingBanner() {
  const { msLeft, lastDay } = useTrialCountdown()
  if (msLeft == null || !lastDay) return null

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{ boxShadow: 'inset 0 0 0 3px rgba(220,38,38,0.85), inset 0 0 40px rgba(220,38,38,0.25)' }}
      />
      <div
        role="alert"
        className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-red-600 border-red-700 text-white"
      >
        <AlertTriangle size={16} className="shrink-0" aria-hidden />
        <p className="text-[12px] sm:text-[13px] min-w-0 flex-1 leading-snug">
          <span className="font-bold">Your free trial ends today.</span>{' '}
          <span className="opacity-90">
            The system will be locked in <span className="font-mono tabular-nums font-semibold">{formatLeft(msLeft, true)}</span>.
            Upgrade now to keep using Hexalyte without interruption.
          </span>
        </p>
        <Link
          href={BILLING_HREF}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold h-8 px-3 rounded-lg shrink-0 bg-white text-red-700 hover:bg-red-50"
        >
          <Sparkles size={12} />
          Upgrade Now
        </Link>
      </div>
    </>
  )
}
