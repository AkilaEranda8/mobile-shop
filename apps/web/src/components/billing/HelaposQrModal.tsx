'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { billingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const SESSION_TTL_MS = 15 * 60 * 1000

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
  if (!expiresAt) return { label: null as string | null, expired: false, progress: 1 }
  const end = new Date(expiresAt).getTime()
  const left = Math.max(0, end - now)
  const expired = left <= 0
  const mins = Math.floor(left / 60000)
  const secs = Math.floor((left % 60000) / 1000)
  const progress = Math.min(1, left / SESSION_TTL_MS)
  return {
    label: expired ? 'Expired' : `${mins}:${secs.toString().padStart(2, '0')}`,
    expired,
    progress,
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
  const [mockPaying, setMockPaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const countdown = useCountdown(session?.expiresAt)

  const step = useMemo(() => {
    if (paid) return 3
    if (loading || !session) return 1
    return 2
  }, [paid, loading, session])

  const copyRef = async () => {
    if (!session?.reference) return
    try {
      await navigator.clipboard.writeText(session.reference)
      setCopied(true)
      toast.success('Reference copied')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Pay with LankaQR"
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="relative w-full max-w-[400px] max-h-[94vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] shadow-2xl border border-white/10"
          style={{ background: 'linear-gradient(165deg, #0b1f17 0%, #102820 42%, #0c1512 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-40 pointer-events-none opacity-60"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.35), transparent 70%)' }}
          />

          <div className="relative p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                  <QrCode size={11} /> LankaQR checkout
                </div>
                <h2 className="mt-2 text-xl font-black tracking-tight text-white">{invoiceNumber}</h2>
                <p className="text-xs text-emerald-100/55 mt-0.5">Instant settlement · bank-grade verify</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: 1, label: 'Create' },
                { n: 2, label: 'Scan' },
                { n: 3, label: 'Confirm' },
              ].map((s) => {
                const active = step === s.n
                const done = step > s.n
                return (
                  <div
                    key={s.n}
                    className={`rounded-xl px-2 py-2 text-center border transition ${
                      done
                        ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                        : active
                          ? 'border-emerald-300/50 bg-emerald-300/10 text-white'
                          : 'border-white/8 bg-white/[0.03] text-white/35'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide">{s.label}</p>
                  </div>
                )
              })}
            </div>

            {loading && (
              <div className="flex flex-col items-center gap-3 py-14 text-emerald-100/70">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <Loader2 size={28} className="text-emerald-400" />
                </motion.div>
                <p className="text-sm font-medium">Securing payment session…</p>
              </div>
            )}

            {!loading && paid && (
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-7 text-center space-y-3"
              >
                <motion.div
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                >
                  <CheckCircle2 className="mx-auto text-emerald-400" size={44} />
                </motion.div>
                <p className="text-lg font-black text-white">Payment verified</p>
                <p className="text-xs text-emerald-100/65 leading-relaxed">
                  Webhook signature checked · invoice marked paid · subscription extended.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-1 w-full text-sm font-bold py-3 rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                >
                  Done
                </button>
              </motion.div>
            )}

            {!loading && !paid && session && (
              <>
                <div className="text-center space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-emerald-200/50">Total payable</p>
                  <p className="text-4xl font-black text-white tracking-tight">
                    {formatCurrency(session.customerPayableAmount ?? session.amount)}
                  </p>
                  <p className="text-xs text-emerald-100/50">Scan with HelaPay or any LankaQR app</p>
                </div>

                {(session.feeApplies || (session.processingFee != null && session.processingFee > 0)) && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3 text-emerald-100/70">
                      <span>Subscription</span>
                      <span className="font-semibold text-white/90">
                        {formatCurrency(session.subscriptionAmount ?? (session.amount - (session.processingFee || 0)))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-emerald-100/70">
                      <span>Payment processing fee</span>
                      <span className="font-semibold text-amber-200">
                        {formatCurrency(session.processingFee ?? 0)}
                      </span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex items-center justify-between gap-3 text-white font-bold">
                      <span>Total payable</span>
                      <span>{formatCurrency(session.customerPayableAmount ?? session.amount)}</span>
                    </div>
                    <p className="text-[10px] text-emerald-100/40 leading-snug">
                      HelaPOS deducts ~1% above LKR 5,000. Your plan price stays{' '}
                      {formatCurrency(session.subscriptionAmount ?? session.amount)} — the fee is not subscription revenue.
                    </p>
                  </div>
                )}

                <div className="relative mx-auto w-[272px] h-[272px]">
                  {!countdown.expired && (
                    <motion.div
                      className="absolute -inset-2 rounded-[28px] border border-emerald-400/30"
                      animate={{ opacity: [0.25, 0.7, 0.25], scale: [1, 1.02, 1] }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                    />
                  )}
                  <div className={`relative rounded-[24px] bg-white p-3.5 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.55)] ${countdown.expired ? 'opacity-40 grayscale' : ''}`}>
                    {qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrImage} alt="LankaQR code" className="w-full h-full rounded-xl" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-xs text-slate-400">
                        QR unavailable
                      </div>
                    )}
                  </div>
                </div>

                {session.expiresAt && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-emerald-100/55">
                      <span>Session timer</span>
                      <span className={`font-mono font-bold ${countdown.expired ? 'text-rose-300' : 'text-emerald-200'}`}>
                        {countdown.label}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${countdown.expired ? 'bg-rose-400' : 'bg-emerald-400'}`}
                        animate={{ width: `${Math.max(2, countdown.progress * 100)}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                )}

                {countdown.expired ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-2xl bg-white text-slate-900 hover:bg-emerald-50 transition"
                  >
                    <RefreshCw size={15} /> Generate new QR
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-xs text-emerald-100/55">
                    <Loader2 className="animate-spin text-emerald-400" size={12} />
                    Listening for secure payment webhook…
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void copyRef()}
                  className="w-full flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left hover:bg-white/[0.07] transition"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-emerald-100/45 font-semibold">Payment reference</p>
                    <p className="text-xs font-mono text-emerald-50 truncate">{session.reference}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-200/80">
                    <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 flex items-start gap-2">
                    <ShieldCheck size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-white/90">Signed webhook</p>
                      <p className="text-[10px] text-white/40 leading-snug">HMAC verified server-side</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 flex items-start gap-2">
                    <Lock size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-white/90">Anti-replay</p>
                      <p className="text-[10px] text-white/40 leading-snug">TTL + txn idempotency</p>
                    </div>
                  </div>
                </div>

                {session.mock && (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3.5 space-y-2">
                    <p className="text-[11px] font-semibold text-amber-100">Sandbox / mock mode — no live HelaPOS settlement</p>
                    <button
                      type="button"
                      disabled={mockPaying || countdown.expired}
                      onClick={async () => {
                        setMockPaying(true)
                        try {
                          await billingApi.helaposMockPay(session.paymentId)
                          toast.success('Mock payment verified')
                          onPaid()
                        } catch (e: any) {
                          toast.error(e?.message || 'Mock pay failed')
                        } finally {
                          setMockPaying(false)
                        }
                      }}
                      className="w-full text-xs font-bold py-2.5 rounded-xl bg-amber-400 text-amber-950 hover:bg-amber-300 disabled:opacity-50 transition"
                    >
                      {mockPaying ? 'Verifying…' : 'Simulate successful payment'}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onSwitchBank}
                  className="w-full text-xs font-semibold py-2.5 rounded-2xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition"
                >
                  Use bank transfer instead
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
