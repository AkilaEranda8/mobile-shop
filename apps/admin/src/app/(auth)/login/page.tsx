'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'
import { adminLogin } from '@/lib/api'
import { fashionLogin } from '@/lib/fashion-api'
import { salonLogin } from '@/lib/salon-api'
import { hubSession } from '@/lib/hub-session'
import { PRODUCTS, type HubProduct, getProduct } from '@/lib/products'

function LoginForm() {
  const params = useSearchParams()
  const [product, setProduct] = useState<HubProduct>('enterprise')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = params?.get('product')
    if (p === 'enterprise' || p === 'fashion' || p === 'salon') {
      setProduct(p)
    }
  }, [params])

  const def = getProduct(product)

  function redirectAfterLogin(p: HubProduct) {
    const dest = params?.get('from') || getProduct(p).homePath
    window.location.href = dest
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (product === 'enterprise') {
        await adminLogin(identity, password)
        hubSession.setProduct('enterprise')
      } else if (product === 'fashion') {
        await fashionLogin(identity, password)
      } else {
        await salonLogin(identity, password)
      }
      redirectAfterLogin(product)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-900 rounded-xl mb-4">
            <Shield size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Hexalyte Internal Console</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
          <Lock size={13} />
          Access restricted · Select product, then sign in with that product&apos;s admin account
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product</label>
              <select
                className="input"
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value as HubProduct)
                  setError('')
                }}
              >
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1.5">{def.description}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {def.identityLabel}
              </label>
              <input
                type={def.identityType === 'email' ? 'email' : 'text'}
                className="input"
                placeholder={
                  def.identityType === 'email' ? 'admin@hexalyte.com' : 'platform_admin'
                }
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                `Sign in to ${def.shortLabel}`
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          One admin UI · Enterprise hosts Fashion ERP &amp; Salon
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  )
}
