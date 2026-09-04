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

function splitAmount(formatted: string) {
  // e.g. "LKR 5,000" / "LKR 5,050.50" → currency + figure
  const m = formatted.match(/^([A-Za-z]+)\s+(.+)$/)
  if (!m) return { currency: '', figure: formatted }
  return { currency: m[1], figure: m[2] }
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
  const { currency, figure } = splitAmount(formatCurrency(payable))

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
          className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={paid ? onClose : undefined}
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0, y: 36, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 440, damping: 36 }}
          className="relative w-full max-w-[392px] max-h-[min(94vh,740px)] flex flex-col rounded-t-[26px] sm:rounded-[26px] shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] border overflow-hidden"
          style={{
            background: 'var(--surface-elevated, #ffffff)',
            borderColor: 'var(--border-subtle, #e2e8f0)',
            color: 'var(--text-primary, #0f172a)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Soft brand wash */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-36 opacity-90"
            style={{
              background:
                'radial-gradient(ellipse 90% 80% at 50% -10%, rgba(16,185,129,0.16), transparent 70%)',
            }}
          />

          <div className="sm:hidden relative flex justify-center pt-2.5 pb-0.5 shrink-0">
            <div className="h-1 w-9 rounded-full bg-black/12 dark:bg-white/20" />
          </div>

          <div className="relative flex items-center justify-between gap-3 px-5 pt-3 sm:pt-5 pb-2 shrink-0">
            <div className="min-w-0 flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/15">
                <QrCode size={16} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                  LankaQR
                </p>
                <h2 id={titleId} className="text-[13px] font-semibold tracking-tight truncate opacity-70">
                  {invoiceNumber}
                </h2>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/10 transition opacity-45 hover:opacity-100"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1 space-y-3.5">
            {loading && (
              <div className="flex flex-col items-center gap-4 py-12" aria-busy="true" aria-live="polite">
                <div
                  className="w-[216px] aspect-square rounded-[22px] border border-dashed animate-pulse"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle, #f8fafc)' }}
                />
                <div className="flex items-center gap-2 text-sm opacity-55">
                  <Loader2 size={15} className="animate-spin text-emerald-600" />
                  Preparing your QR…
                </div>
              </div>
            )}

            {!loading && paid && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-3 py-5"
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
                  <p className="text-lg font-bold tracking-tight">Payment received</p>
                  <p className="mt-1 text-sm opacity-50">Subscription updated · closing…</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-sm font-bold py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition"
                  style={{ color: '#ffffff' }}
                >
                  Done
                </button>
              </motion.div>
            )}

            {!loading && !paid && session && (
              <>
                {/* Amount + QR as one block */}
                <div className="rounded-[22px] border px-4 pt-5 pb-4 space-y-4"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'linear-gradient(180deg, rgba(16,185,129,0.04) 0%, transparent 42%)',
                  }}
                >
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-40">
                      Amount to pay
                    </p>
                    <p className="mt-1.5 flex items-baseline justify-center gap-1.5 tabular-nums">
                      {currency ? (
                        <span className="text-sm font-bold opacity-45 tracking-wide">{currency}</span>
                      ) : null}
                      <span className="text-[2.15rem] leading-none font-black tracking-tight">
                        {figure || formatCurrency(payable)}
                      </span>
                    </p>
                    {showFee ? (
                      <p className="text-[11px] opacity-50 mt-2">
                        Plan {formatCurrency(session.subscriptionAmount ?? session.amount)}
                        {' + '}
                        fee {formatCurrency(session.processingFee ?? 0)}
                      </p>
                    ) : (
                      <p className="text-[11px] opacity-45 mt-2">
                        Scan with HelaPay or any LankaQR app
                      </p>
                    )}
                  </div>

                  {showFee && (
                    <details
                      className="rounded-xl border text-[12px]"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle, rgba(255,255,255,0.6))' }}
                    >
                      <summary className="cursor-pointer list-none px-3 py-2 font-medium opacity-65 select-none">
                        Fee breakdown
                      </summary>
                      <div className="px-3 pb-2.5 space-y-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex justify-between pt-2 opacity-65">
                          <span>Subscription</span>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(
                              session.subscriptionAmount ??
                                (session.amount - (session.processingFee || 0)),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between opacity-65">
                          <span>Processing fee</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {formatCurrency(session.processingFee ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold pt-0.5">
                          <span>Total</span>
                          <span>{formatCurrency(payable)}</span>
                        </div>
                      </div>
                    </details>
                  )}

                  <div className="relative mx-auto w-[220px]">
                    <div
                      className={`rounded-[20px] bg-white p-2.5 ring-1 ring-slate-200/90 shadow-[0_12px_40px_-18px_rgba(16,185,129,0.55)] transition ${
                        countdown.expired ? 'opacity-35 grayscale' : ''
                      }`}
                    >
                      {qrImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrImage}
                          alt={`LankaQR for ${invoiceNumber}`}
                          className="w-full aspect-square rounded-[12px]"
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
                          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[20px] bg-white/92 dark:bg-slate-950/88 backdrop-blur-[2px] p-4 text-center"
                        >
                          <p className="text-sm font-bold">QR expired</p>
                          <p className="text-[11px] opacity-55 -mt-1">Generate a new code to continue</p>
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
                </div>

                {!countdown.expired && (
                  <div className="space-y-1.5" aria-live="polite" role="status">
                    <div
                      className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] ${
                        countdown.urgent
                          ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25'
                          : 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/70 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/20'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0 font-medium">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span
                            className={`absolute inset-0 rounded-full animate-ping opacity-40 ${
                              countdown.urgent ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span
                            className={`relative rounded-full h-2 w-2 ${
                              countdown.urgent ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        </span>
                        <span className="truncate">
                          {countdown.urgent ? 'Expiring soon — finish scan' : 'Waiting for payment'}
                        </span>
                      </span>
                      {countdown.label && (
                        <span className="font-mono font-bold tabular-nums text-[13px] shrink-0 tracking-tight">
                          {countdown.label}
                        </span>
                      )}
                    </div>
                    {session.expiresAt && (
                      <div className="h-1 rounded-full bg-black/[0.05] dark:bg-white/10 overflow-hidden">
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

                <button
                  type="button"
                  onClick={() => void copyRef()}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition active:scale-[0.99]"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle, transparent)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide opacity-40 font-bold">Reference</p>
                    <p className="text-[11px] font-mono truncate opacity-75 mt-0.5">{session.reference}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold shrink-0 px-2 py-1 rounded-lg ${
                      copied
                        ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                        : 'text-emerald-700/90 dark:text-emerald-400'
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onSwitchBank}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium py-1.5 opacity-45 hover:opacity-80 transition"
                >
                  <CreditCard size={12} />
                  Prefer bank transfer?
                </button>

                {session.mock && (
                  <div className="rounded-2xl border border-dashed border-amber-300/70 bg-amber-50/70 dark:bg-amber-400/[0.07] dark:border-amber-400/25 px-3.5 py-3 space-y-2">
                    <p className="text-[11px] leading-snug text-amber-900/70 dark:text-amber-100/65">
                      Sandbox — bank apps won’t settle this QR.
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
