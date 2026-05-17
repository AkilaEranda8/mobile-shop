'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Lock } from 'lucide-react'
import { authApi } from '@/lib/api'

function ResetPasswordForm() {
  const searchParams  = useSearchParams()
  const token         = searchParams.get('token') ?? ''

  const [form, setForm]       = useState({ newPassword: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!token) setError('Reset link is missing or invalid. Please request a new one.')
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword(token, form.newPassword)
      setDone(true)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. The link may have expired.')
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

          {done ? (
            /* ── Success state ── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <CheckCircle2 size={30} style={{ color: '#4ade80' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Password updated!</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#64748b' }}>
                Your password has been reset successfully. All existing sessions have been signed out for security.
              </p>
              <Link href="/login"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #0e7490)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
                <span>Sign in now</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-7">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <Lock size={20} style={{ color: '#a78bfa' }} />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Set new password</h1>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                  Choose a strong password for your account
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
                  <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>New Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      required
                      autoFocus
                      value={form.newPassword}
                      onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                      className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all border"
                      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                    />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: '#64748b' }}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>Confirm Password</label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    required
                    value={form.confirm}
                    onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all border"
                    style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>

                {/* Strength hint */}
                <div className="flex gap-1.5">
                  {[1,2,3,4].map(n => (
                    <div key={n} className="h-1 flex-1 rounded-full transition-all"
                      style={{ background: form.newPassword.length >= n * 2
                        ? n <= 1 ? '#ef4444' : n <= 2 ? '#f97316' : n <= 3 ? '#eab308' : '#22c55e'
                        : 'rgba(255,255,255,0.08)' }} />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #0e7490)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}
                >
                  {loading
                    ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                    : <><span>Reset password</span><ArrowRight size={15} /></>
                  }
                </button>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        {!done && (
          <div className="mt-5 text-center">
            <Link href="/login"
              className="inline-flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: '#64748b' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
              <ArrowLeft size={13} />
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
