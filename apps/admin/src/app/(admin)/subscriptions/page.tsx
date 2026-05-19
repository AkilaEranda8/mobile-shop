'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  DollarSign, TrendingUp, Users, AlertTriangle, CreditCard,
  Send, ArrowUpDown, XCircle, CheckCircle, Clock, Search,
  RefreshCw, ChevronRight, X, Loader2, FileText, Printer, Pencil, Plus, Trash2,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  fetchSubscriptions, fetchStats, fetchMrrChart, updateSubscription,
  fetchPlatformConfig, savePlatformConfig,
  type SubscriptionRow, type PlatformStats, type MrrPoint,
} from '@/lib/api'
import { LOGO_BASE64 } from '@/lib/logo-base64'

/* ── helpers ─────────────────────────────────────────────────── */
const PLAN_BADGE: Record<string, string> = {
  STARTER: 'badge-gray', PRO: 'badge-blue', ENTERPRISE: 'badge-purple', TRIAL: 'badge-yellow',
}
const DEFAULT_MRR: Record<string, number> = { STARTER: 1199, PRO: 4799, ENTERPRISE: 14399 }
const DEFAULT_FEATURES: Record<string, string[]> = {
  STARTER:    ['3 users', '1 branch', 'POS & Repairs', 'Basic reports'],
  PRO:        ['10 users', '3 branches', 'Analytics', 'Warranty', 'Delivery'],
  ENTERPRISE: ['Unlimited users', 'Unlimited branches', 'API access', 'White-label', 'Priority support'],
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmt(n: number) {
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${n}`
}
function daysOverdue(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

/* ── Change Plan Modal ───────────────────────────────────────── */
function defaultSubEnd(months = 12) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function ChangePlanModal({ sub, onClose, onSaved, planMrr, planFeatures }: {
  sub: SubscriptionRow; onClose: () => void; onSaved: () => void
  planMrr: Record<string, number>; planFeatures: Record<string, string[]>
}) {
  const [plan, setPlan]     = useState(sub.plan === 'TRIAL' ? 'PRO' : sub.plan)
  const [months, setMonths] = useState('12')
  const [subEnd, setSubEnd] = useState(defaultSubEnd(12))
  const [saving, setSave]   = useState(false)
  const [err, setErr]       = useState('')

  const handleSave = async () => {
    setSave(true); setErr('')
    try {
      await updateSubscription(sub.id, {
        plan,
        mrr: planMrr[plan] ?? DEFAULT_MRR[plan] ?? sub.mrr ?? 0,
        status: 'ACTIVE',
        subscriptionEndsAt: new Date(subEnd).toISOString(),
      })
      onSaved(); onClose()
    } catch (e: any) { setErr(e.message ?? 'Failed') }
    finally { setSave(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Change Plan — {sub.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="space-y-2 mb-5">
          {(['STARTER', 'PRO', 'ENTERPRISE'] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${plan === p ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div>
                <p className="text-sm font-semibold text-gray-900">{p.charAt(0) + p.slice(1).toLowerCase()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(planFeatures[p] ?? DEFAULT_FEATURES[p]).slice(0, 2).join(' · ')}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900">Rs.{(planMrr[p] ?? DEFAULT_MRR[p]).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">/mo</p>
              </div>
              {plan === p && <CheckCircle size={14} className="text-gray-900 ml-2 flex-shrink-0" />}
            </button>
          ))}
        </div>
        {/* Duration */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-2">Subscription Duration</label>
          <div className="flex gap-2">
            {[1, 3, 6, 12].map(m => (
              <button key={m} onClick={() => { setMonths(String(m)); setSubEnd(defaultSubEnd(m)) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${months === String(m) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {m}mo
              </button>
            ))}
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subscription Ends</label>
          <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
            value={subEnd} onChange={e => { setSubEnd(e.target.value); setMonths('') }} />
        </div>
        {/* Summary */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-600 font-semibold">{plan} Plan · ACTIVE</p>
            <p className="text-[11px] text-blue-400">Ends {new Date(subEnd).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <p className="text-sm font-bold text-blue-700">Rs.{(planMrr[plan] ?? DEFAULT_MRR[plan] ?? 0).toLocaleString()}/mo</p>
        </div>
        {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : null} Activate Plan
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Invoice Modal ───────────────────────────────────────────── */
function InvoiceModal({ sub, onClose }: { sub: SubscriptionRow; onClose: () => void }) {
  const invoiceNo = `HX-${new Date().getFullYear()}-${String(sub.id).slice(-5).toUpperCase()}`
  const now       = new Date()
  const issueDate = now.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
  const endDate   = sub.subscriptionEndsAt ? new Date(sub.subscriptionEndsAt) : null
  const dueDate   = endDate
    ? endDate.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  // Calculate months covered by this subscription period
  const months = endDate
    ? Math.max(1, Math.round((endDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
    : 1
  const mrr       = sub.mrr ?? 0
  const total     = mrr * months
  const planLabel = sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()
  const periodLabel = months === 12 ? '1 Year' : months === 1 ? '1 Month' : `${months} Months`

  const handlePrint = () => {
    const el = document.getElementById('hx-invoice-print')
    if (!el) return
    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) return
    // Use innerHTML so we bypass the fixed-595px wrapper
    w.document.write(`<html><head><title>Invoice ${invoiceNo}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        *, *::before, *::after { box-sizing: border-box; }
        html, body {
          width: 210mm;
          margin: 0; padding: 0;
          background: #fff; color: #111;
          font-family: system-ui, -apple-system, sans-serif;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .hx-print-wrap {
          width: 100%;
          padding: 14mm 16mm;
        }
      </style>
    </head><body><div class="hx-print-wrap">${el.innerHTML}</div></body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gray-600" />
            <span className="text-sm font-bold text-gray-800">Subscription Invoice — {invoiceNo}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors font-medium">
              <Printer size={12} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
          </div>
        </div>

        {/* Printable invoice body */}
        <div className="overflow-y-auto flex-1 bg-gray-100 p-6">
        <div id="hx-invoice-print" style={{ width: 595, margin: '0 auto', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 48px' }}>
          <div style={{ fontFamily: 'system-ui, sans-serif', width: '100%', background: '#fff', color: '#111' }}>
            {/* Top: logo + invoice label */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_BASE64} alt="Hexalyte Innovation" style={{ height: 100, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>Hexalyte Innovation (Pvt) Ltd</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>www.hexalyte.com</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>info@hexalyte.com</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>+94 70 3130100</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: -1 }}>INVOICE</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>#{invoiceNo}</div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 2, background: '#f3f4f6', marginBottom: 28 }} />

            {/* Bill to + dates */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{sub.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub.ownerEmail}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Issue Date</div>
                  <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{issueDate}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Valid Until</div>
                  <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{dueDate}</div>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #e5e7eb' }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #e5e7eb' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #e5e7eb' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '14px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Hexalyte {planLabel} Plan</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{periodLabel} subscription · Rs. {mrr.toLocaleString()} / month</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{months}</td>
                  <td style={{ textAlign: 'right', padding: '14px', fontSize: 13, fontWeight: 700, color: '#111', borderBottom: '1px solid #f3f4f6' }}>Rs. {total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
              <div style={{ width: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: '#6b7280' }}>
                  <span>Subtotal ({months} × Rs. {mrr.toLocaleString()})</span><span>Rs. {total.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: '#6b7280' }}>
                  <span>Tax (0%)</span><span>Rs. 0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', marginTop: 4, background: '#111', borderRadius: 8, fontSize: 14, fontWeight: 800, color: '#fff' }}>
                  <span>Total ({periodLabel})</span><span>Rs. {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Bank Transfer Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  ['Bank',           'Commercial Bank'],
                  ['Account Name',   'Akila Eranda Gankewela'],
                  ['Account Number', '2000124779'],
                  ['SWIFT Code',     'CCEYLKLX'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 110 }}>{label}:</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              Thank you for choosing Hexalyte Innovation (Pvt) Ltd · info@hexalyte.com · +94 70 3130100 · www.hexalyte.com
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Plan Modal ────────────────────────────────────────── */
function EditPlanModal({
  plan, mrr, features, onClose, onSaved,
}: { plan: string; mrr: number; features: string[]; onClose: () => void; onSaved: (mrr: number, features: string[]) => void }) {
  const [price, setPrice]   = useState(String(mrr))
  const [feats, setFeats]   = useState<string[]>([...features])
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const updateFeat = (i: number, val: string) =>
    setFeats(f => f.map((x, j) => j === i ? val : x))
  const removeFeat = (i: number) =>
    setFeats(f => f.filter((_, j) => j !== i))
  const addFeat = () => setFeats(f => [...f, ''])

  const handleSave = async () => {
    const numPrice = parseInt(price)
    if (isNaN(numPrice) || numPrice < 0) { setErr('Enter a valid price'); return }
    setSaving(true); setErr('')
    try {
      const cfg = await fetchPlatformConfig().catch(() => ({} as Record<string, string>))
      cfg[`plan_mrr_${plan}`]      = String(numPrice)
      cfg[`plan_features_${plan}`] = JSON.stringify(feats.filter(Boolean))
      await savePlatformConfig(cfg)
      onSaved(numPrice, feats.filter(Boolean))
      onClose()
    } catch (e: any) { setErr(e.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Edit {plan} Plan</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
        {/* Price */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Price (Rs.)</label>
          <input type="number" min="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
            value={price} onChange={e => setPrice(e.target.value)} />
        </div>
        {/* Features */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Features</label>
          <div className="space-y-1.5">
            {feats.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
                  value={f} onChange={e => updateFeat(i, e.target.value)} />
                <button onClick={() => removeFeat(i)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
              </div>
            ))}
            <button onClick={addFeat} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1">
              <Plus size={12} /> Add feature
            </button>
          </div>
        </div>
        {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Extend Modal ────────────────────────────────────────────── */
function ExtendModal({ sub, onClose, onSaved }: { sub: SubscriptionRow; onClose: () => void; onSaved: () => void }) {
  const [date, setDate]   = useState(sub.subscriptionEndsAt ? sub.subscriptionEndsAt.split('T')[0] : '')
  const [saving, setSave] = useState(false)

  const handleSave = async () => {
    setSave(true)
    try {
      await updateSubscription(sub.id, { subscriptionEndsAt: new Date(date).toISOString(), status: 'ACTIVE' })
      onSaved(); onClose()
    } catch {}
    finally { setSave(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Extend Subscription — {sub.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">New Expiry Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving || !date} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : null} Extend
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function SubscriptionsPage() {
  const [tab, setTab]           = useState<'overview' | 'subscriptions' | 'plans' | 'overdue'>('overview')
  const [search, setSearch]     = useState('')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [subs, setSubs]         = useState<SubscriptionRow[]>([])
  const [overdue, setOverdue]   = useState<SubscriptionRow[]>([])
  const [stats, setStats]       = useState<PlatformStats | null>(null)
  const [mrrChart, setMrrChart] = useState<MrrPoint[]>([])
  const [loading, setLoading]   = useState(true)
  const [changePlan, setChangePlan] = useState<SubscriptionRow | null>(null)
  const [extendSub, setExtendSub]   = useState<SubscriptionRow | null>(null)
  const [invoiceSub, setInvoiceSub] = useState<SubscriptionRow | null>(null)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [planMrr, setPlanMrr]         = useState<Record<string, number>>({ ...DEFAULT_MRR })
  const [planFeatures, setPlanFeatures] = useState<Record<string, string[]>>({ ...DEFAULT_FEATURES })

  // Load saved plan config from platform config
  useEffect(() => {
    fetchPlatformConfig().then(cfg => {
      const mrr  = { ...DEFAULT_MRR }
      const feat = { ...DEFAULT_FEATURES }
      for (const p of ['STARTER', 'PRO', 'ENTERPRISE']) {
        if (cfg[`plan_mrr_${p}`])      mrr[p]  = parseInt(cfg[`plan_mrr_${p}`])
        if (cfg[`plan_features_${p}`]) feat[p] = JSON.parse(cfg[`plan_features_${p}`])
      }
      setPlanMrr(mrr); setPlanFeatures(feat)
    }).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    Promise.all([fetchSubscriptions(), fetchSubscriptions('OVERDUE'), fetchStats(), fetchMrrChart()])
      .then(([all, ov, st, mc]) => {
        setSubs(all.data); setOverdue(ov.data); setStats(st); setMrrChart(mc)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const mrr     = stats?.mrr ?? 0
  const arpu    = Math.round(mrr / (stats?.activeTenants || 1))
  const churnMrr = Math.round(mrr * (stats?.churnRate ?? 0) / 100)

  /* revenue by plan — computed from real subs */
  const planRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    subs.forEach(s => { if (s.mrr) map[s.plan] = (map[s.plan] ?? 0) + s.mrr })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [subs])

  const planCounts = useMemo(() => {
    const map: Record<string, number> = {}
    subs.forEach(s => { map[s.plan] = (map[s.plan] ?? 0) + 1 })
    return map
  }, [subs])

  const filtered = useMemo(() =>
    subs.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) &&
      (planFilter === 'ALL' || s.plan === planFilter)
    ), [subs, search, planFilter])

  const totalMrr = subs.reduce((s, t) => s + (t.mrr ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* Modals */}
      {changePlan && <ChangePlanModal sub={changePlan} onClose={() => setChangePlan(null)} onSaved={load} planMrr={planMrr} planFeatures={planFeatures} />}
      {extendSub  && <ExtendModal    sub={extendSub}  onClose={() => setExtendSub(null)}  onSaved={load} />}
      {invoiceSub && <InvoiceModal   sub={invoiceSub} onClose={() => setInvoiceSub(null)} />}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          mrr={planMrr[editingPlan] ?? 0}
          features={planFeatures[editingPlan] ?? []}
          onClose={() => setEditingPlan(null)}
          onSaved={(mrr, feats) => {
            setPlanMrr(m => ({ ...m, [editingPlan]: mrr }))
            setPlanFeatures(f => ({ ...f, [editingPlan]: feats }))
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">Subscriptions & Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${subs.length} tenants · ${overdue.length} overdue · MRR ${fmt(totalMrr)}`}
          </p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={load} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'MRR',        value: fmt(mrr),    sub: stats ? `+${stats.mrrDelta}% vs last month` : '—', icon: DollarSign,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'ARR',        value: fmt(mrr*12), sub: 'Annualised run rate',                              icon: TrendingUp,   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
          { label: 'ARPU',       value: fmt(arpu),   sub: 'Per active tenant',                                icon: Users,        color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Churn MRR',  value: fmt(churnMrr), sub: `${stats?.churnRate ?? 0}% monthly churn`,       icon: AlertTriangle,color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100'    },
        ].map(m => (
          <div key={m.label} className={`card p-5 flex items-center gap-4 border ${m.border}`}>
            <div className={`w-11 h-11 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
              <m.icon size={20} className={m.color} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-0.5">{m.label}</p>
              <p className="text-2xl font-bold text-gray-900 leading-none">{m.value}</p>
              <p className="text-[10px] text-gray-400 mt-1">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {(['overview', 'subscriptions', 'plans', 'overdue'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'overdue'
              ? <span className="flex items-center gap-1.5">Overdue {overdue.length > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{overdue.length}</span>}</span>
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid xl:grid-cols-3 gap-5">
          {/* MRR trend chart — spans 2 cols */}
          <div className="xl:col-span-2 card p-5">
            <h2 className="section-title">MRR Trend — Last 12 Months</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mrrChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#111827" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={60} />
                <Tooltip formatter={(v: number) => [fmt(v), 'MRR']} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="#111827" fill="url(#gMrr)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by plan */}
          <div className="card p-5">
            <h2 className="section-title">Revenue by Plan</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={planRevenue} barSize={36} margin={{ left: 0, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={55} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="value" name="Revenue" fill="#111827" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key metrics list */}
          <div className="card p-5">
            <h2 className="section-title">Revenue Metrics</h2>
            <div className="space-y-0 divide-y divide-gray-50">
              {[
                { label: 'MRR Growth Rate',             value: stats ? `+${stats.mrrDelta}%` : '—',                                              up: true  },
                { label: 'Net Revenue Retention',       value: '108%',                                                                           up: true  },
                { label: 'Trial → Paid Conversion',     value: '68%',                                                                            up: true  },
                { label: 'ARPU',                        value: stats ? fmt(arpu) : '—',                                                          up: true  },
                { label: 'Churn Rate',                  value: stats ? `${stats.churnRate}%` : '—',                                              up: false },
                { label: 'Active Tenants',              value: String(stats?.activeTenants ?? '—'),                                              up: true  },
                { label: 'Trial Tenants',               value: String(stats?.trialTenants  ?? '—'),                                              up: null  },
                { label: 'Overdue',                     value: String(overdue.length),                                                           up: overdue.length === 0 },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-gray-600">{r.label}</span>
                  <span className={`text-sm font-bold ${r.up === true ? 'text-emerald-600' : r.up === false ? 'text-red-500' : 'text-gray-700'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plan distribution */}
          <div className="xl:col-span-2 card p-5">
            <h2 className="section-title">Plan Distribution</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {(['STARTER','PRO','ENTERPRISE'] as const).map((p, i) => {
                const count = planCounts[p] ?? 0
                const rev   = (DEFAULT_MRR[p] ?? 0) * count
                const colors = [
                  { bg: 'bg-gray-50', border: 'border-gray-200', accent: 'bg-gray-900', text: 'text-gray-900' },
                  { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-600', text: 'text-blue-700' },
                  { bg: 'bg-purple-50', border: 'border-purple-200', accent: 'bg-purple-600', text: 'text-purple-700' },
                ]
                const c = colors[i]
                return (
                  <div key={p} className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{p}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white font-semibold ${c.accent}`}>{count}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{fmt(rev)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">/month</p>
                    <div className="mt-3 text-[10px] text-gray-500 space-y-0.5">
                      {(DEFAULT_FEATURES[p] as string[]).map(f => (
                        <div key={f} className="flex items-center gap-1">
                          <CheckCircle size={9} className={c.text} /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTIONS TABLE ───────────────────────────────── */}
      {tab === 'subscriptions' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8 text-sm" placeholder="Search shop or email..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {(['ALL','STARTER','PRO','ENTERPRISE'] as const).map(p => (
                <button key={p} onClick={() => setPlanFilter(p)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${planFilter === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p === 'ALL' ? 'All' : p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} results</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th">Shop</th>
                  <th className="th">Plan</th>
                  <th className="th">MRR</th>
                  <th className="th">Status</th>
                  <th className="th">Next Billing</th>
                  <th className="th">Owner</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-400">{loading ? 'Loading...' : 'No results'}</td></tr>
                )}
                {filtered.map(s => {
                  const isExpiringSoon = s.subscriptionEndsAt && daysOverdue(s.subscriptionEndsAt) < 0 && Math.abs(daysOverdue(s.subscriptionEndsAt)) < 7
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-gray-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="td"><span className={PLAN_BADGE[s.plan] ?? 'badge-gray'}>{s.plan}</span></td>
                      <td className="td text-xs font-semibold text-gray-800">{s.mrr != null ? `Rs.${s.mrr.toLocaleString()}` : '—'}</td>
                      <td className="td">
                        <span className={s.status === 'ACTIVE' ? 'badge-green' : s.status === 'TRIAL' ? 'badge-yellow' : 'badge-red'}>
                          {s.status}
                        </span>
                      </td>
                      <td className="td text-xs text-gray-500">
                        {s.subscriptionEndsAt
                          ? <span className={isExpiringSoon ? 'text-amber-600 font-medium' : ''}>{fmtDate(s.subscriptionEndsAt)}</span>
                          : '—'}
                      </td>
                      <td className="td text-xs text-gray-400">{s.ownerEmail}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setChangePlan(s)} title="Change Plan"
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-colors font-medium">
                            <ArrowUpDown size={11} /> Plan
                          </button>
                          <button onClick={() => setExtendSub(s)} title="Extend subscription"
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors font-medium">
                            <Clock size={11} /> Extend
                          </button>
                          <button onClick={() => setInvoiceSub(s)} title="Generate Invoice"
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors font-medium">
                            <FileText size={11} /> Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-400">Total MRR: <span className="font-semibold text-gray-700">{fmt(filtered.reduce((s, t) => s + (t.mrr ?? 0), 0))}</span></p>
              <p className="text-xs text-gray-400">{filtered.length} of {subs.length} tenants</p>
            </div>
          )}
        </div>
      )}

      {/* ── PLANS ────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div className="grid sm:grid-cols-3 gap-5">
          {(['STARTER','PRO','ENTERPRISE'] as const).map((p, i) => {
            const count = planCounts[p] ?? 0
            const configs = [
              { color: 'border-gray-200 bg-white',         accent: 'bg-gray-900 text-white',   label: 'text-gray-900' },
              { color: 'border-blue-200 bg-blue-50/40',    accent: 'bg-blue-600 text-white',   label: 'text-blue-700' },
              { color: 'border-purple-200 bg-purple-50/40',accent: 'bg-purple-600 text-white', label: 'text-purple-700' },
            ]
            const cfg = configs[i]
            return (
              <div key={p} className={`card border-2 ${cfg.color} p-6 flex flex-col gap-4`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-widest ${cfg.label}`}>{p}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.accent}`}>{count} tenants</span>
                    <button onClick={() => setEditingPlan(p)}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Edit Plan">
                      <Pencil size={12} />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-black text-gray-900">Rs.{(planMrr[p] ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">per month</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {(planFeatures[p] ?? []).map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle size={13} className={cfg.label} /> {f}
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Monthly Revenue</span>
                    <span className="font-bold text-gray-900">{fmt((planMrr[p] ?? 0) * count)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>ARR Contribution</span>
                    <span className="font-bold text-gray-900">{fmt((planMrr[p] ?? 0) * count * 12)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── OVERDUE ──────────────────────────────────────────── */}
      {tab === 'overdue' && (
        <div>
          {overdue.length === 0 ? (
            <div className="card p-16 text-center">
              <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">No overdue subscriptions</p>
              <p className="text-xs text-gray-400 mt-1">All tenants are paid up to date</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-red-100 bg-red-50">
                <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-700">{overdue.length} overdue subscription{overdue.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-400 ml-auto">At-risk MRR: {fmt(overdue.reduce((s, t) => s + (t.mrr ?? 0), 0))}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="th">Shop</th>
                      <th className="th">Plan</th>
                      <th className="th">MRR at Risk</th>
                      <th className="th">Expired On</th>
                      <th className="th">Days Overdue</th>
                      <th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {overdue.map(s => {
                      const days = s.subscriptionEndsAt ? daysOverdue(s.subscriptionEndsAt) : 0
                      return (
                        <tr key={s.id} className="hover:bg-red-50/30 transition-colors">
                          <td className="td">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-900">{s.name}</p>
                                <p className="text-[10px] text-gray-400">{s.ownerEmail}</p>
                              </div>
                            </div>
                          </td>
                          <td className="td"><span className={PLAN_BADGE[s.plan] ?? 'badge-gray'}>{s.plan}</span></td>
                          <td className="td text-xs font-semibold text-red-600">{s.mrr != null ? `Rs.${s.mrr.toLocaleString()}` : '—'}</td>
                          <td className="td text-xs text-gray-500">{s.subscriptionEndsAt ? fmtDate(s.subscriptionEndsAt) : '—'}</td>
                          <td className="td">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${days > 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {days}d overdue
                            </span>
                          </td>
                          <td className="td">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setExtendSub(s)}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium">
                                <Clock size={11} /> Extend
                              </button>
                              <button onClick={() => setChangePlan(s)}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                                <ArrowUpDown size={11} /> Plan
                              </button>
                              <button title="Send reminder"
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors">
                                <Send size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
