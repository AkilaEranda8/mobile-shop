'use client'

import { useMemo, useState } from 'react'
import { CheckCircle, Copy, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { createFashionTenant } from '@/lib/fashion-api'
import { createSalonTenant } from '@/lib/salon-api'

export type HubOnboardProduct = 'fashion' | 'salon'

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function genPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const FASHION_PLANS = [
  { id: 'STARTER', label: 'Starter', desc: 'Core POS + inventory' },
  { id: 'PROFESSIONAL', label: 'Professional', desc: 'Multi-branch + analytics' },
  { id: 'ENTERPRISE', label: 'Enterprise', desc: 'Full suite + priority support' },
]

const FASHION_SHOP_TYPES = [
  'CLOTHING',
  'GROCERY',
  'HARDWARE',
  'AGRICULTURE',
  'SPARE_PARTS',
  'TIRE_SHOP',
  'BAKERY',
  'GENERAL',
]

const SALON_PLANS = [
  { id: 'trial', label: 'Trial', desc: 'Trial period (default)' },
  { id: 'basic', label: 'Basic', desc: 'Single branch starter' },
  { id: 'pro', label: 'Pro', desc: 'Growing salons' },
  { id: 'enterprise', label: 'Enterprise', desc: 'Multi-branch + advanced' },
]

type DoneResult = {
  loginHint: string
  url?: string
  subdomain: string
  email: string
  password: string
  name: string
  plan: string
}

export default function HubOnboardModal({
  product,
  onClose,
  onCreated,
}: {
  product: HubOnboardProduct
  onClose: () => void
  onCreated?: () => void
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<DoneResult | null>(null)

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    subdomain: '',
    password: '',
    plan: product === 'fashion' ? 'STARTER' : 'trial',
    shopType: 'CLOTHING',
    firstName: '',
    lastName: '',
  })

  const plans = product === 'fashion' ? FASHION_PLANS : SALON_PLANS

  const shareMessage = useMemo(() => {
    if (!result) return ''
    return [
      `Welcome to HexaOne ${product === 'fashion' ? 'Fashion ERP' : 'Salon'}!`,
      ``,
      `Shop: ${result.name}`,
      `Plan: ${result.plan}`,
      result.url ? `Login: ${result.url}` : `Workspace: ${result.subdomain}`,
      `Username / Email: ${result.email}`,
      `Password: ${result.password}`,
      ``,
      `Please change your password after first login.`,
    ].join('\n')
  }, [result, product])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'businessName' && !prev.subdomain) {
        next.subdomain = slugify(String(value))
      }
      if (key === 'ownerName' && product === 'fashion') {
        const parts = String(value).trim().split(/\s+/)
        next.firstName = parts[0] || ''
        next.lastName = parts.slice(1).join(' ') || parts[0] || 'Owner'
      }
      return next
    })
  }

  async function provision() {
    setLoading(true)
    setError('')
    try {
      const password = form.password.trim() || genPassword()
      const subdomain = slugify(form.subdomain || form.businessName)
      if (!form.businessName.trim() || !form.email.trim() || !form.ownerName.trim()) {
        throw new Error('Business name, owner name, and email are required')
      }
      if (!subdomain) throw new Error('Subdomain / slug is required')
      if (password.length < 8) throw new Error('Password must be at least 8 characters')

      if (product === 'fashion') {
        const firstName = form.firstName.trim() || form.ownerName.trim().split(/\s+/)[0] || 'Owner'
        const lastName =
          form.lastName.trim() ||
          form.ownerName.trim().split(/\s+/).slice(1).join(' ') ||
          firstName
        const res = await createFashionTenant({
          companyName: form.businessName.trim(),
          subdomain,
          adminEmail: form.email.trim().toLowerCase(),
          adminPassword: password,
          adminFirstName: firstName,
          adminLastName: lastName,
          phone: form.phone.trim() || undefined,
          plan: form.plan,
          shopType: form.shopType,
        })
        setResult({
          name: res.tenant?.name || form.businessName,
          subdomain: res.tenant?.subdomain || subdomain,
          email: res.adminUser?.email || form.email,
          password: res.initialPassword || password,
          plan: form.plan,
          loginHint: `${res.tenant?.subdomain || subdomain} workspace`,
          url: undefined,
        })
      } else {
        const res = await createSalonTenant({
          businessName: form.businessName.trim(),
          ownerName: form.ownerName.trim(),
          ownerEmail: form.email.trim().toLowerCase(),
          password,
          phone: form.phone.trim() || undefined,
          slug: subdomain,
          plan: form.plan,
          branchName: form.businessName.trim(),
        })
        setResult({
          name: res.tenant?.name || form.businessName,
          subdomain: res.tenant?.slug || subdomain,
          email: res.owner?.username || form.email,
          password,
          plan: form.plan,
          loginHint: res.tenant_url || res.tenant?.slug || subdomain,
          url: res.tenant_url,
        })
      }

      setStep(4)
      onCreated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to onboard tenant')
    } finally {
      setLoading(false)
    }
  }

  async function copyShare() {
    if (!shareMessage) return
    await navigator.clipboard.writeText(shareMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Onboard {product === 'fashion' ? 'Fashion' : 'Salon'} tenant
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {['Shop details', 'Plan', 'Create', 'Credentials'][step - 1]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  n <= step ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {n}
              </div>
              {n < 4 && (
                <div className={`h-0.5 w-8 ${n < step ? 'bg-gray-900' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Business name</label>
              <input
                className="input"
                placeholder={product === 'fashion' ? 'e.g. Urban Threads' : 'e.g. Glow Salon'}
                value={form.businessName}
                onChange={(e) => setField('businessName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Owner name</label>
              <input
                className="input"
                placeholder="e.g. Kamal Perera"
                value={form.ownerName}
                onChange={(e) => setField('ownerName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {product === 'salon' ? 'Owner email (login username)' : 'Owner email'}
              </label>
              <input
                className="input"
                type="email"
                placeholder="owner@shop.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                className="input"
                placeholder="+94771234567"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {product === 'fashion' ? 'Subdomain' : 'Slug / URL'}
              </label>
              <input
                className="input font-mono text-sm"
                placeholder="urban-threads"
                value={form.subdomain}
                onChange={(e) => setField('subdomain', slugify(e.target.value) || e.target.value)}
              />
            </div>
            {product === 'fashion' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Shop type</label>
                <select
                  className="input"
                  value={form.shopType}
                  onChange={(e) => setField('shopType', e.target.value)}
                >
                  {FASHION_SHOP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password <span className="text-gray-400 font-normal">(blank = auto)</span>
              </label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {plans.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${
                  form.plan === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  checked={form.plan === p.id}
                  onChange={() => setField('plan', p.id)}
                  className="accent-gray-900"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Confirm provisioning</p>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-1.5 text-xs">
              <p>
                <span className="text-gray-400">Business:</span> {form.businessName}
              </p>
              <p>
                <span className="text-gray-400">Owner:</span> {form.ownerName} · {form.email}
              </p>
              <p>
                <span className="text-gray-400">
                  {product === 'fashion' ? 'Subdomain' : 'Slug'}:
                </span>{' '}
                <span className="font-mono">{slugify(form.subdomain || form.businessName)}</span>
              </p>
              <p>
                <span className="text-gray-400">Plan:</span> {form.plan}
                {product === 'fashion' ? ` · ${form.shopType}` : ''}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              This creates the tenant, default branch, and owner account on{' '}
              {product === 'fashion' ? 'Fashion ERP' : 'Salon'}.
            </p>
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <CheckCircle size={36} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-900">Tenant onboarded</p>
              <p className="text-xs text-gray-500 mt-1">{result.name}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Workspace</span>
                <span className="font-mono font-semibold text-gray-900">{result.subdomain}</span>
              </div>
              {result.url && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400">URL</span>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline truncate max-w-[70%]"
                  >
                    {result.url}
                  </a>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Login</span>
                <span className="font-mono font-semibold text-gray-900">{result.email}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Password</span>
                <span className="font-mono font-semibold text-indigo-700">{result.password}</span>
              </div>
            </div>
            <button type="button" className="btn-secondary w-full justify-center gap-1.5" onClick={copyShare}>
              <Copy size={14} />
              {copied ? 'Copied' : 'Copy credentials message'}
            </button>
          </div>
        )}

        <div className="flex gap-2 mt-6">
          {step > 1 && step < 4 && (
            <button
              type="button"
              className="btn-secondary flex-1 justify-center"
              onClick={() => {
                setError('')
                setStep((s) => s - 1)
              }}
              disabled={loading}
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="btn-primary flex-1 justify-center"
              onClick={() => {
                setError('')
                if (step === 1) {
                  if (!form.businessName.trim() || !form.ownerName.trim() || !form.email.trim()) {
                    setError('Fill business name, owner name, and email')
                    return
                  }
                  if (!slugify(form.subdomain || form.businessName)) {
                    setError('Enter a valid subdomain / slug')
                    return
                  }
                }
                setStep((s) => s + 1)
              }}
            >
              Continue
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn-primary flex-1 justify-center"
              disabled={loading}
              onClick={provision}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Creating…' : 'Create tenant'}
            </button>
          )}
          {step === 4 && (
            <button type="button" className="btn-primary flex-1 justify-center" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
