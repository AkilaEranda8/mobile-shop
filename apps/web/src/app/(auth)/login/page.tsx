'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Eye, EyeOff, ArrowRight, AlertCircle, AlertTriangle, ShoppingCart,
  Wrench, BarChart3, Shield, Users, Package, KeyRound, Lock, Store,
  Headset,
} from 'lucide-react'
import { authApi, fetchPlatformStatus } from '@/lib/api'
import { authStorage, type AuthUser, type BranchSummary } from '@/lib/auth'
import { initializeSessionBranch, resolveAutoBranchId, setActiveBranchId } from '@/lib/active-branch'
import { canUsePinLoginOnHost, getTenantSlugFromHost, resolvePinShopSlug } from '@/lib/tenant-url'
import { PosPinKeypad } from '@/components/pos/PosPinKeypad'
import { applyPosPinSession } from '@/components/pos/PosPinGate'

const features = [
  { icon: ShoppingCart, label: 'Point of Sale',    desc: 'Fast POS with invoice generation'   },
  { icon: Wrench,       label: 'Repair Management',desc: 'Track jobs, parts & status updates'  },
  { icon: BarChart3,    label: 'Analytics',         desc: 'Revenue, profit & trend insights'   },
  { icon: Package,      label: 'Inventory',         desc: 'Stock control with low-stock alerts'},
  { icon: Users,        label: 'CRM',               desc: 'Customer history & loyalty points'  },
  { icon: Shield,       label: 'Warranty Tracking', desc: 'Full warranty lifecycle management' },
]

const SHOP_SLUG_KEY = 'hx_pin_shop_slug'
const BLUE = '#2563EB'
const BLUE_DARK = '#1D4ED8'

/** Branches this staff member may open after PIN login (any shop role). */
function selectableBranchesForUser(user: AuthUser): BranchSummary[] {
  const all = (user.branches ?? []).filter(b => b.isActive !== false)
  if (user.role === 'OWNER') return all
  const allowed = new Set(user.branchIds ?? [])
  if (!allowed.size) return all
  return all.filter(b => allowed.has(b.id))
}

function goDashboard() {
  window.location.href = '/dashboard'
}

/** After PIN + branch: counter roles open POS; owners/managers open dashboard. */
function goAfterPinLogin(user: AuthUser) {
  if (user.role === 'CASHIER' || user.role === 'TECHNICIAN') {
    window.location.href = '/dashboard/pos'
    return
  }
  goDashboard()
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [maintenance, setMaintenance]   = useState<{ enabled: boolean; message: string } | null>(null)
  const [form, setForm]                 = useState({ email: '', password: '' })
  const [mode, setMode]                 = useState<'password' | 'pin' | 'branch'>('password')
  const [pin, setPin]                   = useState('')
  const [hostSlug, setHostSlug]         = useState<string | null>(null)
  const [shopSlug, setShopSlug]         = useState('')
  const [showPinOption, setShowPinOption] = useState(false)
  const [branchOptions, setBranchOptions] = useState<BranchSummary[]>([])
  const [pinUserName, setPinUserName] = useState('')
  const [pinLength, setPinLength] = useState<4 | 6>(6)

  useEffect(() => {
    const fromHost = getTenantSlugFromHost()
    setHostSlug(fromHost)
    const hostAllowsPin = canUsePinLoginOnHost()
    const resolved = resolvePinShopSlug()
    if (resolved.slug) setShopSlug(resolved.slug)

    fetchPlatformStatus()
      .then(s => setMaintenance(s.maintenance))
      .catch(() => {})

    // PIN UI only when host allows AND Security policy has PIN + cold login enabled.
    if (!hostAllowsPin) {
      setShowPinOption(false)
      setMode('password')
      return
    }

    const slug = (fromHost || resolved.slug || '').trim().toLowerCase()
    if (!slug) {
      setShowPinOption(false)
      setMode('password')
      return
    }

    let cancelled = false
    authApi.posPinAvailability(slug)
      .then(av => {
        if (cancelled) return
        setPinLength(av.pinLength)
        setShowPinOption(av.available)
        setMode(av.available ? 'pin' : 'password')
      })
      .catch(() => {
        if (cancelled) return
        setShowPinOption(false)
        setMode('password')
      })

    return () => { cancelled = true }
  }, [])

  const effectiveSlug = (hostSlug || shopSlug).trim().toLowerCase()

  const finishLogin = (accessToken: string, refreshToken: string, user: any) => {
    const loginUser = initializeSessionBranch(user)
    authStorage.save(accessToken, refreshToken, loginUser)
    try {
      localStorage.removeItem('hx_tenant_features')
      const slug = (user?.tenantSlug || loginUser?.tenantSlug || '').trim().toLowerCase()
      if (slug && slug !== 'platform') localStorage.setItem(SHOP_SLUG_KEY, slug)
    } catch { /* noop */ }
    goDashboard()
  }

  const finishPinSession = (user: AuthUser) => {
    const options = selectableBranchesForUser(user)
    // Prefer last-used / suggested / default branch (same idea as shop-slug auto-detect).
    const autoId = resolveAutoBranchId(user, options)
    if (autoId) {
      setActiveBranchId(autoId, 'assigned')
      goAfterPinLogin(user)
      return
    }
    if (options.length > 1) {
      setBranchOptions(options)
      setPinUserName(user.name || user.email)
      setMode('branch')
      setPin('')
      setLoading(false)
      return
    }
    goAfterPinLogin(user)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(form.email, form.password)
      finishLogin(res.data.accessToken, res.data.refreshToken, res.data.user)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
      setLoading(false)
    }
  }

  const handlePinLogin = async () => {
    if (pin.length !== pinLength || loading) return
    if (!effectiveSlug) {
      setError('Open your shop URL to use PIN login')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (!hostSlug && shopSlug.trim()) {
        try { localStorage.setItem(SHOP_SLUG_KEY, shopSlug.trim().toLowerCase()) } catch { /* noop */ }
      }
      const res = await authApi.posPinLogin(pin, effectiveSlug)
      const user = applyPosPinSession(res.data)
      finishPinSession(user)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid PIN')
      setPin('')
      setLoading(false)
    }
  }

  const handlePickBranch = (branchId: string) => {
    setActiveBranchId(branchId, 'assigned')
    const user = authStorage.getUser()
    if (user) goAfterPinLogin(user)
    else goDashboard()
  }

  useEffect(() => {
    if (mode === 'pin' && pin.length === pinLength && !loading) {
      void handlePinLogin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, mode])

  // ── After PIN: pick branch when staff has 2+ assigned branches ────────────
  if (mode === 'branch' && showPinOption) {
    return (
      <div className="min-h-screen bg-[#07090f] flex">
        <div className="flex-1 flex items-center justify-center px-5 py-10 relative" style={{ background: '#0c1120' }}>
          <div className="relative w-full max-w-[400px] px-2">
            <div className="flex flex-col items-center text-center mb-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: `linear-gradient(145deg, ${BLUE}, ${BLUE_DARK})`,
                  boxShadow: `0 10px 24px ${BLUE}44`,
                }}
              >
                <Store size={22} style={{ color: '#ffffff' }} strokeWidth={2.25} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffffff' }}>Select branch</h1>
              <p className="text-sm mt-1.5" style={{ color: '#ffffff' }}>
                {pinUserName ? `${pinUserName} — choose branch to continue` : 'Choose branch to continue'}
              </p>
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Cashier / Technician open POS · Owner / Manager open dashboard
              </p>
              {effectiveSlug ? (
                <p className="mt-3 text-xs" style={{ color: '#ffffff' }}>Shop: {effectiveSlug}</p>
              ) : null}
            </div>

            <div className="space-y-2.5">
              {branchOptions.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handlePickBranch(b.id)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition-opacity hover:opacity-90"
                  style={{
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'transparent',
                    color: '#ffffff',
                  }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Store size={16} style={{ color: '#ffffff' }} className="shrink-0" />
                    <span className="font-semibold truncate">{b.name}</span>
                  </span>
                  <ArrowRight size={16} style={{ color: '#ffffff' }} className="shrink-0" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setMode('pin')
                setBranchOptions([])
                setPinUserName('')
                setError('')
                authStorage.clear()
              }}
              className="mt-6 w-full text-center text-sm font-semibold"
              style={{ color: '#ffffff' }}
            >
              Back to PIN
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── PIN login — same split shell as password, white+blue form panel ───────
  if (mode === 'pin' && showPinOption) {
    return (
      <div className="min-h-screen bg-[#07090f] flex">
        <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden px-14 py-12">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-700/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-transparent" />
          </div>

          <div className="relative flex items-center mb-auto">
            <img src="/logo.png" alt="Hexalyte Innovation" className="h-14 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
          </div>

          <div className="relative mt-16 mb-10">
            <h2 className="text-4xl font-bold leading-tight" style={{ color: '#f1f5f9' }}>
              Run your entire<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                mobile shop
              </span><br />
              from one place
            </h2>
            <p className="mt-4 text-sm leading-relaxed max-w-sm" style={{ color: '#94a3b8' }}>
              Fast PIN unlock for every shop role — Owner, Manager, Cashier, Technician.
            </p>
          </div>

          <div className="relative grid grid-cols-2 gap-3 mb-auto">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl border hover:border-blue-500/30 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>{label}</p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#64748b' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-8 flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
            <Shield size={12} />
            <span>256-bit encryption · JWT RS256 · Multi-branch support</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10 relative" style={{ background: '#0c1120' }}>
          <div className="absolute inset-0 lg:border-l border-white/5 pointer-events-none" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full blur-3xl bg-blue-600/15" />
            <div className="absolute bottom-0 left-0 w-[280px] h-[280px] rounded-full blur-3xl bg-cyan-600/10" />
          </div>
          <div className="relative w-full max-w-[400px]">
            <div className="flex lg:hidden justify-center mb-6">
              <img src="/logo.png" alt="Hexalyte Innovation" className="h-10 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
            </div>

            <div className="px-2 py-2 sm:px-4">
              <div className="flex flex-col items-center text-center mb-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(145deg, ${BLUE}, ${BLUE_DARK})`,
                    boxShadow: `0 10px 24px ${BLUE}44`,
                  }}
                >
                  <Lock size={22} style={{ color: '#ffffff' }} strokeWidth={2.25} />
                </div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffffff' }}>Welcome back</h1>
                <p className="text-sm mt-1.5" style={{ color: '#ffffff' }}>
                  Enter PIN · then branch if needed · start work
                </p>

                {effectiveSlug ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium" style={{ color: '#ffffff' }}>
                    <Store size={13} style={{ color: '#ffffff' }} />
                    <span>Shop: {effectiveSlug}</span>
                  </p>
                ) : null}
              </div>

              {maintenance?.enabled && (
                <div className="mb-4 flex items-start gap-2.5 px-1 py-2 text-sm" style={{ color: '#ffffff' }}>
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ffffff' }} />
                  <div>
                    <p className="font-semibold" style={{ color: '#ffffff' }}>Maintenance mode is active</p>
                    <p className="text-xs mt-1" style={{ color: '#ffffff' }}>{maintenance.message}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-center gap-2.5 px-1 py-2 text-sm" style={{ color: '#ffffff' }}>
                  <AlertCircle size={15} className="flex-shrink-0" style={{ color: '#ffffff' }} />
                  <span>{error}</span>
                </div>
              )}

              {effectiveSlug ? (
                <PosPinKeypad
                  value={pin}
                  maxLength={pinLength}
                  onChange={setPin}
                  onSubmit={handlePinLogin}
                  loading={loading || !!maintenance?.enabled}
                  disabled={!!maintenance?.enabled}
                  autoFocus
                  showKeypad
                  showSubmit
                  variant="login"
                />
              ) : (
                <div className="px-1 py-4 text-center space-y-2 mb-4">
                  <p className="text-sm" style={{ color: '#ffffff' }}>Open your shop link to use PIN</p>
                  <p className="text-[11px]" style={{ color: '#ffffff' }}>
                    Example: yourshop.app.hexalyte.com
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <span className="text-xs" style={{ color: '#ffffff' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>

              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); setPin('') }}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: '#ffffff' }}
              >
                <Lock size={14} style={{ color: '#ffffff' }} />
                Password login
              </button>

              <p className="mt-6 flex items-center justify-center gap-2 text-[11px]" style={{ color: '#ffffff' }}>
                <Headset size={13} className="shrink-0" style={{ color: '#ffffff' }} />
                <span>Having trouble? Contact your system administrator</span>
              </p>
            </div>

            <p className="mt-5 text-center text-[11px]" style={{ color: '#ffffff' }}>
              <Link href="/privacy" className="font-medium hover:underline" style={{ color: '#ffffff' }}>Privacy</Link>
              <span className="mx-1.5" style={{ color: '#ffffff' }}>·</span>
              <Link href="/terms" className="font-medium hover:underline" style={{ color: '#ffffff' }}>Terms</Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Password login (split marketing layout) ───────────────────────────────
  return (
    <div className="min-h-screen bg-[#07090f] flex">

      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden px-14 py-12">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-violet-700/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-transparent" />
        </div>

        <div className="relative flex items-center mb-auto">
          <img src="/logo.png" alt="Hexalyte Innovation" className="h-14 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
        </div>

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

        <div className="relative mt-8 flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
          <Shield size={12} />
          <span>256-bit encryption · JWT RS256 · Multi-branch support</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 lg:border-l border-white/5 pointer-events-none" style={{ background: '#0c1120' }} />

        <div className="relative w-full max-w-sm">
          <div className="flex lg:hidden justify-center mb-8">
            <img src="/logo.png" alt="Hexalyte Innovation" className="h-12 w-auto object-contain" style={{ mixBlendMode: 'screen' }} />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
            <p className="text-sm mt-1.5" style={{ color: '#64748b' }}>Sign in to your dashboard</p>
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
                <Link href="/forgot-password" className="text-xs transition-colors" style={{ color: '#7c6aee' }}>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#64748b' }}
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

            {showPinOption && (
              <p className="text-center text-xs" style={{ color: '#64748b' }}>
                <button
                  type="button"
                  onClick={() => { setMode('pin'); setError('') }}
                  className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline transition-colors"
                  style={{ color: '#94a3b8' }}
                >
                  <KeyRound size={12} /> PIN login
                </button>
              </p>
            )}
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
