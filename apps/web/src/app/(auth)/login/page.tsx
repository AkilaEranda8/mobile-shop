'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Eye, EyeOff, ArrowRight, AlertCircle, AlertTriangle, ShoppingCart,
  Wrench, BarChart3, Shield, Users, Package,
} from 'lucide-react'
import { authApi, fetchPlatformStatus } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { initializeSessionBranch } from '@/lib/active-branch'

const features = [
  { icon: ShoppingCart, label: 'Point of Sale',    desc: 'Fast POS with invoice generation'   },
  { icon: Wrench,       label: 'Repair Management',desc: 'Track jobs, parts & status updates'  },
  { icon: BarChart3,    label: 'Analytics',         desc: 'Revenue, profit & trend insights'   },
  { icon: Package,      label: 'Inventory',         desc: 'Stock control with low-stock alerts'},
  { icon: Users,        label: 'CRM',               desc: 'Customer history & loyalty points'  },
  { icon: Shield,       label: 'Warranty Tracking', desc: 'Full warranty lifecycle management' },
]

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [maintenance, setMaintenance]   = useState<{ enabled: boolean; message: string } | null>(null)
  const [form, setForm]                 = useState({ email: '', password: '' })

  useEffect(() => {
    fetchPlatformStatus()
      .then(s => setMaintenance(s.maintenance))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(form.email, form.password)
      const loginUser = initializeSessionBranch(res.data.user as any)
      authStorage.save(res.data.accessToken, res.data.refreshToken, loginUser)
      try { localStorage.removeItem('hx_tenant_features') } catch { /* noop */ }
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden px-14 py-12">
        {/* background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-violet-700/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-transparent" />
        </div>

        {/* logo */}
        <div className="relative flex items-center mb-auto">
          <img src="/logo.png" alt="Hexalyte Innovation" className="h-32 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
        </div>

        {/* headline */}
        <div className="relative mt-16 mb-10">
          <h2 className="text-4xl font-bold leading-tight" style={{ color: '#f1f5f9' }}>
            Run your entire<br />
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              mobile shop
            </span><br />
            from one place
          </h2>
          <p className="mt-4 text-sm leading-relaxed max-w-sm" style={{ color: '#94a3b8' }}>
            Hexalyte brings POS, repairs, inventory, finance and customer management into a single powerful platform.
          </p>
        </div>

        {/* feature grid */}
        <div className="relative grid grid-cols-2 gap-3 mb-auto">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl border hover:border-violet-500/30 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>{label}</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#64748b' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* trust line */}
        <div className="relative mt-8 flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
          <Shield size={12} />
          <span>256-bit encryption · JWT RS256 · Multi-branch support</span>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 lg:border-l border-white/5 pointer-events-none" style={{ background: '#0c1120' }} />

        <div className="relative w-full max-w-sm">
          {/* mobile logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <img src="/logo.png" alt="Hexalyte Innovation" className="h-24 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Welcome back</h1>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>Sign in to your dashboard</p>
          </div>

          {maintenance?.enabled && (
            <div className="mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Maintenance mode is active</p>
                <p className="text-xs mt-1 text-red-200/80">{maintenance.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>Email address</label>
              <input
                type="email"
                placeholder="owner@yourshop.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all border"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: '#94a3b8' }}>Password</label>
                <Link href="/forgot-password" className="text-xs transition-colors"
                  style={{ color: '#7c6aee' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-light)')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#7c6aee')}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all border"
                  style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#64748b' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || maintenance?.enabled}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: 'var(--brand-gradient)', boxShadow: '0 4px 20px var(--sidebar-active-border)' }}
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Sign in</span><ArrowRight size={15} /></>
              }
            </button>
          </form>

          <div className="mt-8 pt-6 text-center space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: '#475569' }}>
              Having trouble? Contact your system administrator
            </p>
            <p className="text-[11px]" style={{ color: '#64748b' }}>
              <Link href="/privacy" className="hover:text-violet-400 transition-colors">Privacy</Link>
              {' · '}
              <Link href="/terms" className="hover:text-violet-400 transition-colors">Terms</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
