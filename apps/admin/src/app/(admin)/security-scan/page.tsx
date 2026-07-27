'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  fetchSecurityScan,
  type SecurityScanCheck,
  type SecurityScanResult,
} from '@/lib/api'

const STATUS_UI: Record<
  SecurityScanCheck['status'],
  { label: string; badge: string; Icon: typeof CheckCircle2; icon: string }
> = {
  pass: {
    label: 'Pass',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle2,
    icon: 'text-emerald-600',
  },
  warn: {
    label: 'Warn',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: AlertTriangle,
    icon: 'text-amber-600',
  },
  fail: {
    label: 'Fail',
    badge: 'bg-red-50 text-red-700 border-red-200',
    Icon: XCircle,
    icon: 'text-red-600',
  },
  info: {
    label: 'Info',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    Icon: Info,
    icon: 'text-sky-600',
  },
}

const GRADE_UI = {
  SECURE: {
    title: 'Secure',
    desc: 'No critical failures. Keep monitoring regularly.',
    box: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    Icon: ShieldCheck,
    icon: 'text-emerald-600',
  },
  NEEDS_ATTENTION: {
    title: 'Needs attention',
    desc: 'Warnings found — review and harden before they escalate.',
    box: 'bg-amber-50 border-amber-200',
    text: 'text-amber-900',
    Icon: ShieldAlert,
    icon: 'text-amber-600',
  },
  AT_RISK: {
    title: 'At risk',
    desc: 'One or more critical checks failed. Fix immediately.',
    box: 'bg-red-50 border-red-200',
    text: 'text-red-900',
    Icon: ShieldAlert,
    icon: 'text-red-600',
  },
} as const

export default function SecurityScanPage() {
  const [data, setData] = useState<SecurityScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'ALL' | SecurityScanCheck['status']>('ALL')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchSecurityScan()
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Security scan failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    run()
  }, [run])

  const categories = useMemo(() => {
    if (!data) return [] as string[]
    return [...new Set(data.checks.map((c) => c.category))]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return [] as SecurityScanCheck[]
    if (filter === 'ALL') return data.checks
    return data.checks.filter((c) => c.status === filter)
  }, [data, filter])

  const grade = data ? GRADE_UI[data.grade] : null

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield size={20} className="text-gray-700" />
            Security Scan
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live platform posture check — secrets, access control, tenants, and sessions
          </p>
        </div>
        <div className="sm:ml-auto">
          <button type="button" onClick={run} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Scanning…' : 'Run scan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="card p-12 flex justify-center">
          <Loader2 size={22} className="animate-spin text-gray-400" />
        </div>
      ) : data && grade ? (
        <>
          <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${grade.box}`}>
            <div className="w-12 h-12 rounded-2xl bg-white/80 border border-black/5 flex items-center justify-center">
              <grade.Icon size={22} className={grade.icon} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${grade.text}`}>{grade.title}</p>
              <p className={`text-xs mt-0.5 ${grade.text} opacity-80`}>{grade.desc}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Scanned {new Date(data.scannedAt).toLocaleString('en-LK')} · {data.durationMs}ms
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Score</p>
              <p className={`text-3xl font-black leading-none ${grade.text}`}>{data.score}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'pass' as const, label: 'Passed', value: data.summary.pass, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { key: 'warn' as const, label: 'Warnings', value: data.summary.warn, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
              { key: 'fail' as const, label: 'Failed', value: data.summary.fail, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
              { key: 'info' as const, label: 'Info', value: data.summary.info, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-100' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setFilter((f) => (f === m.key ? 'ALL' : m.key))}
                className={`card p-4 text-left border ${m.border} ${m.bg} ${filter === m.key ? 'ring-2 ring-gray-900' : ''}`}
              >
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{m.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${m.color}`}>{m.value}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                filter === 'ALL' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              All ({data.summary.total})
            </button>
            {(['fail', 'warn', 'pass', 'info'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  filter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {STATUS_UI[s].label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {categories.map((cat) => {
              const items = filtered.filter((c) => c.category === cat)
              if (!items.length) return null
              return (
                <div key={cat} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{cat}</h3>
                    <span className="text-[11px] text-gray-500">{items.length} check{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map((c) => {
                      const ui = STATUS_UI[c.status]
                      const Icon = ui.Icon
                      return (
                        <div key={c.id} className="p-4 flex gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={16} className={ui.icon} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ui.badge}`}>
                                {ui.label}
                              </span>
                              <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                                {c.severity}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1 font-mono break-all">{c.detail}</p>
                            {c.recommendation && (
                              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
                                {c.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="card p-10 text-center text-sm text-gray-400">No checks in this filter</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
