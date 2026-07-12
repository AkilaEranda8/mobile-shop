'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Shield } from 'lucide-react'
import { authApi } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      {/* background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-700/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-cyan-600/08 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Hexalyte" className="h-20 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
        </div>

        <div className="rounded-2xl border p-8"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' }}>

          {sent ? (
            /* ── Success state ── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <CheckCircle2 size={30} style={{ color: '#4ade80' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Check your inbox</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#64748b' }}>
                We sent a password reset link to <br />
                <span style={{ color: 'var(--brand-light)' }}>{email}</span>.<br />
                The link expires in <strong style={{ color: '#94a3b8' }}>15 minutes</strong>.
              </p>
              <p className="text-xs mb-6" style={{ color: '#475569' }}>
                Didn't receive it? Check your spam folder or try again.
              </p>
              <button onClick={() => { setSent(false); setEmail('') }}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all border"
                style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#94a3b8', background: 'rgba(255,255,255,0.04)' }}>
                Try another email
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-7">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)' }}>
                  <Shield size={20} style={{ color: 'var(--brand-light)' }} />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Forgot password?</h1>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl mb-5 text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#f87171' }}>
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#475569' }} />
                    <input
                      type="email"
                      placeholder="you@yourshop.com"
                      required
                      autoFocus
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all border"
                      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: 'var(--brand-gradient)', boxShadow: '0 4px 20px var(--sidebar-active-border)' }}
                >
                  {loading
                    ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                    : <><span>Send reset link</span><ArrowRight size={15} /></>
                  }
                </button>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        <div className="mt-5 text-center">
          <Link href="/login"
            className="inline-flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-light)')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
            <ArrowLeft size={13} />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
