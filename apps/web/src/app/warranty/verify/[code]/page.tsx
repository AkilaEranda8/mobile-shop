'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Shield, CheckCircle2, XCircle, Clock, Smartphone } from 'lucide-react'
import { warrantyApi } from '@/lib/api'

type VerifyResult = {
  warrantyCode: string
  status: string
  productName: string
  brandName: string
  imei?: string | null
  customerName: string
  startDate: string
  endDate: string
  monthsDuration: number
  invoiceNumber?: string | null
  shopName: string
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  ACTIVE:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Active' },
  EXPIRED: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Expired' },
  CLAIMED: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Claim in progress' },
  VOID:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Void' },
}

export default function WarrantyVerifyPage() {
  const params = useParams()
  const code = String(params?.code ?? '').toUpperCase()
  const [data, setData] = useState<VerifyResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    warrantyApi.verifyPublic(code)
      .then(setData)
      .catch((e: Error) => setError(e.message || 'Warranty not found'))
      .finally(() => setLoading(false))
  }, [code])

  const style = STATUS_STYLE[data?.status ?? ''] ?? STATUS_STYLE.VOID

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base, #0f1117)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{ background: 'var(--bg-card, #1a1f2e)', borderColor: 'var(--border-default, #2a3142)' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.15)' }}>
            <Shield size={22} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Warranty Verification</h1>
            <p className="text-xs text-slate-400 font-mono">{code}</p>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-400 text-center py-8">Verifying…</p>}

        {error && !loading && (
          <div className="text-center py-8">
            <XCircle size={40} className="mx-auto text-red-400 mb-3" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold" style={{ color: style.color, background: style.bg }}>
                {data.status === 'ACTIVE' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                {style.label}
              </span>
            </div>

            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <Row icon={Smartphone} label="Product" value={`${data.brandName} ${data.productName}`.trim()} />
              {data.imei && <Row label="IMEI" value={data.imei} mono />}
              <Row label="Customer" value={data.customerName} />
              <Row label="Shop" value={data.shopName} />
              <Row label="Valid from" value={fmtDate(data.startDate)} />
              <Row label="Valid until" value={fmtDate(data.endDate)} />
              <Row label="Duration" value={`${data.monthsDuration} month${data.monthsDuration !== 1 ? 's' : ''}`} />
              {data.invoiceNumber && <Row label="Invoice" value={data.invoiceNumber} mono />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon?: typeof Shield; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`text-sm text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })
}
