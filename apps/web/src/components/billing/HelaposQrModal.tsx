'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, CreditCard, Loader2, QrCode, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { billingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import BillingLottie from '@/components/billing/BillingLottie'

const SESSION_TTL_MS = 15 * 60 * 1000
const WARN_MS = 2 * 60 * 1000

export type HelaposQrSession = {
  paymentId: string
  amount: number
  reference: string
  qrPayload: string
  mock: boolean
  invoiceNumber: string
  expiresAt?: string | null
  subscriptionAmount?: number
  processingFee?: number
  customerPayableAmount?: number
  feeApplies?: boolean
}

type Props = {
  invoiceNumber: string
  session: HelaposQrSession | null
  qrImage: string | null
  loading: boolean
  paid: boolean
  onClose: () => void
  onPaid: () => void
  onRefresh: () => void
  onSwitchBank: () => void
}

function useCountdown(expiresAt?: string | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  if (!expiresAt) {
    return { label: null as string | null, expired: false, progress: 1, leftMs: SESSION_TTL_MS, urgent: false }
  }

  const end = new Date(expiresAt).getTime()
  const leftMs = Math.max(0, end - now)
  const expired = leftMs <= 0
  const mins = Math.floor(leftMs / 60000)
  const secs = Math.floor((leftMs % 60000) / 1000)

  return {
    label: expired ? '0:00' : `${mins}:${secs.toString().padStart(2, '0')}`,
    expired,
    progress: Math.min(1, leftMs / SESSION_TTL_MS),
    leftMs,
    urgent: !expired && leftMs <= WARN_MS,
  }
}

export default function HelaposQrModal({
  invoiceNumber,
  session,
  qrImage,
  loading,
  paid,
  onClose,
  onPaid,
  onRefresh,
  onSwitchBank,
}: Props) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [mockPaying, setMockPaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const countdown = useCountdown(session?.expiresAt)

  // Lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Soft auto-dismiss after success
  useEffect(() => {
    if (!paid) return
    const id = window.setTimeout(() => onCloseRef.current(), 3200)
    return () => window.clearTimeout(id)
  }, [paid])

  const copyRef = async () => {
    if (!session?.reference) return
    try {
      await navigator.clipboard.writeText(session.reference)
      setCopied(true)
      toast.success('Reference copied')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Couldn’t copy — select the reference manually')
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh()
    window.setTimeout(() => setRefreshing(false), 800)
  }

  const payable = session ? (session.customerPayableAmount ?? session.amount) : 0
  const showFee =
    !!session &&
    (session.feeApplies || (session.processingFee != null && session.processingFee > 0))

  const statusTone = countdown.expired
    ? 'rose'
    : countdown.urgent
      ? 'amber'
      : 'emerald'

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={paid ? onClose : undefined}
          // Mid-payment: dismiss only via X / Esc — avoids losing an active QR by accident
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="relative w-full max-w-[400px] max-h-[min(94vh,720px)] flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl border overflow-hidden"
          style={{
            background: 'var(--surface-elevated, #ffffff)',
            borderColor: 'var(--border-subtle, #e2e8f0)',
            color: 'var(--text-primary, #0f172a)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile grab affordance */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pt-2 sm:pt-5 pb-3 shrink-0">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                <QrCode size={13} aria-hidden />
                LankaQR
              </p>
              <h2 id={titleId} className="mt-0.5 text-base font-bold tracking-tight truncate">
                {invoiceNumber}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/10 transition opacity-55 hover:opacity-100"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 space-y-4">
            {loading && (
              <div className="flex flex-col items-center gap-4 py-10" aria-busy="true" aria-live="polite">
                <div className="w-[220px] aspect-square rounded-2xl border border-dashed animate-pulse"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle, #f8fafc)' }}
                />
                <div className="flex items-center gap-2 text-sm opacity-60">
                  <Loader2 size={16} className="animate-spin text-emerald-600" />
                  Preparing your QR code…
                </div>
              </div>
            )}

            {!loading && paid && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-3 py-4"
                role="status"
                aria-live="polite"
              >
                <div className="mx-auto w-[148px] h-[148px]">
                  <BillingLottie
                    src="/lottie/payment-successful.json"
                    loop={false}
                    style={{ width: 148, height: 148 }}
                  />
                </div>
                <div>
                  <p className="text-lg font-bold">Payment received</p>
                  <p className="mt-1 text-sm opacity-55">
                    Your subscription is up to date. Closing shortly…
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-sm font-bold py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 transition"
                  style={{ color: '#ffffff' }}
                >
                  Done
                </button>
              </motion.div>
            )}

            {!loading && !paid && session && (
              <>
                {/* Amount first — what you pay */}
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-45">
                    Amount to pay
                  </p>
                  <p className="text-[2rem] leading-none font-black tracking-tight tabular-nums">
                    {formatCurrency(payable)}
                  </p>
                  {showFee ? (
                    <p className="text-xs opacity-55 pt-1">
                      Plan {formatCurrency(session.subscriptionAmount ?? session.amount)}
                      {' + '}
                      fee {formatCurrency(session.processingFee ?? 0)}
                    </p>
                  ) : (
                    <p className="text-xs opacity-50 pt-1">
                      Open HelaPay or any LankaQR app and scan
                    </p>
                  )}
                </div>

                {showFee && (
                  <details
                    className="rounded-2xl border text-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle, rgba(0,0,0,0.025))' }}
                  >
                    <summary className="cursor-pointer list-none px-3.5 py-2.5 font-medium opacity-75 select-none">
                      Fee breakdown
                    </summary>
                    <div className="px-3.5 pb-3 space-y-1.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex justify-between pt-2 opacity-70">
                        <span>Subscription</span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(
                            session.subscriptionAmount ??
                              (session.amount - (session.processingFee || 0)),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between opacity-70">
                        <span>Processing fee</span>
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                          {formatCurrency(session.processingFee ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-1">
                        <span>Total</span>
                        <span>{formatCurrency(payable)}</span>
                      </div>
                      <p className="text-[11px] opacity-45 leading-snug pt-1">
                        Fee applies only when the plan amount is above LKR 5,000. Your plan price stays the same.
                      </p>
                    </div>
                  </details>
                )}

                {/* QR — primary focus */}
                <div className="relative mx-auto w-[236px]">
                  <div
                    className={`rounded-2xl bg-white p-3 border border-slate-200 shadow-sm transition ${
                      countdown.expired ? 'opacity-35 grayscale' : ''
                    }`}
                  >
                    {qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrImage}
                        alt={`LankaQR for ${invoiceNumber}`}
                        className="w-full aspect-square rounded-lg"
                        draggable={false}
                      />
                    ) : (
                      <div className="aspect-square flex items-center justify-center text-xs text-slate-400">
                        QR unavailable
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {countdown.expired && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 dark:bg-slate-950/85 backdrop-blur-[1px] p-4 text-center"
                      >
                        <p className="text-sm font-bold">This QR expired</p>
                        <p className="text-xs opacity-60 -mt-1">Generate a fresh code to continue</p>
                        <button
                          type="button"
                          onClick={handleRefresh}
                          disabled={refreshing}
                          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 transition"
                          style={{ color: '#ffffff' }}
                        >
                          {refreshing ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RefreshCw size={14} />
                          )}
                          New QR
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Live status */}
                {!countdown.expired && (
                  <div
                    className="space-y-2"
                    aria-live="polite"
                    role="status"
                  >
                    <div
                      className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-sm border ${
                        statusTone === 'amber'
                          ? 'border-amber-300/70 bg-amber-50 text-amber-950 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-100'
                          : 'border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:bg-emerald-400/10 dark:border-emerald-400/25 dark:text-emerald-100'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <Loader2 size={14} className="animate-spin shrink-0 opacity-80" />
                        <span className="font-medium truncate">
                          {countdown.urgent ? 'Expiring soon — finish scanning' : 'Waiting for payment'}
                        </span>
                      </span>
                      {countdown.label && (
                        <span className="font-mono font-bold tabular-nums shrink-0 text-[13px]">
                          {countdown.label}
                        </span>
                      )}
                    </div>
                    {session.expiresAt && (
                      <div className="h-1 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-700 ease-linear ${
                            countdown.urgent ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(3, countdown.progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Reference — secondary */}
                <button
                  type="button"
                  onClick={() => void copyRef()}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left hover:bg-black/[0.025] dark:hover:bg-white/[0.04] transition active:scale-[0.99]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide opacity-45 font-semibold">
                      Payment reference
                    </p>
                    <p className="text-xs font-mono truncate opacity-80 mt-0.5">{session.reference}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                      copied
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-emerald-700/80 dark:text-emerald-400/80'
                    }`}
                  >
                    {copied ? <Check size={13} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </span>
                </button>

                {/* Alternate path */}
                <button
                  type="button"
                  onClick={onSwitchBank}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-2xl border hover:bg-black/[0.025] dark:hover:bg-white/[0.04] transition opacity-70 hover:opacity-100"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <CreditCard size={13} />
                  Pay by bank transfer instead
                </button>

                {session.mock && (
                  <div className="rounded-2xl border border-dashed border-amber-400/50 bg-amber-50/80 dark:bg-amber-400/[0.08] dark:border-amber-400/30 px-3.5 py-3 space-y-2">
                    <p className="text-[11px] leading-snug text-amber-900/75 dark:text-amber-100/70">
                      Sandbox only — bank apps won’t settle this QR. Use simulate to test the flow.
                    </p>
                    <button
                      type="button"
                      disabled={mockPaying || countdown.expired}
                      onClick={async () => {
                        setMockPaying(true)
                        try {
                          await billingApi.helaposMockPay(session.paymentId)
                          toast.success('Payment verified')
                          onPaid()
                        } catch (e: any) {
                          toast.error(e?.message || 'Simulate failed')
                        } finally {
                          setMockPaying(false)
                        }
                      }}
                      className="w-full text-xs font-bold py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 disabled:opacity-45 transition"
                    >
                      {mockPaying ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 size={13} className="animate-spin" /> Verifying…
                        </span>
                      ) : (
                        'Simulate successful payment'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
