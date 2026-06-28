'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import { authApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { enableFirstLoginOnboarding } from '@/lib/trialOnboarding'

const plans = [
  { id: 'starter', apiPlan: 'STARTER' as const, name: 'Starter', price: 'Rs. 2,999/mo', desc: '1 branch, 3 users' },
  { id: 'pro', apiPlan: 'PRO' as const, name: 'Pro', price: 'Rs. 4,999/mo', desc: '5 branches, 15 users', popular: true },
  { id: 'enterprise', apiPlan: 'ENTERPRISE' as const, name: 'Enterprise', price: 'Custom', desc: 'Unlimited everything' },
]

const PLAN_FROM_QUERY: Record<string, string> = {
  starter: 'starter',
  pro: 'pro',
  enterprise: 'enterprise',
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [form, setForm] = useState({
    shopName: '', ownerName: '', email: '', phone: '', password: '', city: '',
  })

  useEffect(() => {
    const q = searchParams.get('plan')?.toLowerCase()
    if (q && PLAN_FROM_QUERY[q]) setSelectedPlan(PLAN_FROM_QUERY[q])
  }, [searchParams])

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const planDef = plans.find(p => p.id === selectedPlan) ?? plans[1]
    try {
      const res = await authApi.register({
        ownerName: form.ownerName.trim(),
        ownerEmail: form.email.trim().toLowerCase(),
        password: form.password,
        shopName: form.shopName.trim(),
        plan: planDef.apiPlan,
        phone: form.phone.trim(),
        city: form.city.trim(),
      })
      authStorage.save(res.data.accessToken, res.data.refreshToken, res.data.user)
      enableFirstLoginOnboarding()
      try { localStorage.removeItem('hx_tenant_features') } catch { /* noop */ }
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-6">
            <img
              src="/logo.png"
              alt="Hexalyte Innovation"
              className="h-16 w-auto object-contain"
              style={{ mixBlendMode: 'screen' }}
            />
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 ? 'Start your free trial' : 'Choose a plan'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">14 days free, no credit card required</p>
        </div>

        <div className="flex items-center gap-2 mb-6 justify-center">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${s <= step ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-500'}`}>
                {s < step ? <CheckCircle size={14} /> : s}
              </div>
              {s < 2 && <div className={`w-12 h-px ${s < step ? 'bg-violet-600' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-[#0f1623] border border-white/5 rounded-2xl p-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Owner Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    className="input-field"
                    value={form.ownerName}
                    onChange={e => setForm({ ...form, ownerName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Shop Name</label>
                  <input
                    type="text"
                    placeholder="Mobile Hub"
                    className="input-field"
                    value={form.shopName}
                    onChange={e => setForm({ ...form, shopName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="owner@yourshop.com"
                  className="input-field"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+94 77 123 4567"
                  className="input-field"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">City</label>
                <input
                  type="text"
                  placeholder="Colombo"
                  className="input-field"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    className="input-field pr-10"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                Continue <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selectedPlan === plan.id ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2 right-3 text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Popular</span>
                    )}
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? 'border-violet-500' : 'border-white/30'}`}>
                        {selectedPlan === plan.id && <div className="w-2 h-2 bg-violet-500 rounded-full" />}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.desc}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white">{plan.price}</span>
                  </div>
                ))}
              </div>

              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                <p className="text-xs text-violet-300 text-center">
                  14-day free trial on all plans. No credit card needed.
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1" disabled={loading}>
                  Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Start Trial'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
