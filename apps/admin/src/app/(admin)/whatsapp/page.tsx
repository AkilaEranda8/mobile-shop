'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, CreditCard, Loader2, Wifi, WifiOff, ArrowRight } from 'lucide-react'
import { billingWhatsappApi, type WAStatusInfo } from '@/lib/api'
import TenantWhatsAppPanel from '@/components/tenants/TenantWhatsAppPanel'

const STATUS_LABEL: Record<string, { label: string; color: string; Icon: typeof Wifi }> = {
  connected:    { label: 'Connected',    color: 'text-green-700 bg-green-50 border-green-200', Icon: Wifi },
  disconnected: { label: 'Disconnected', color: 'text-gray-600 bg-gray-50 border-gray-200',    Icon: WifiOff },
  qr_pending:   { label: 'Scan QR',      color: 'text-blue-700 bg-blue-50 border-blue-200',    Icon: MessageCircle },
  connecting:   { label: 'Connecting',   color: 'text-violet-700 bg-violet-50 border-violet-200', Icon: Loader2 },
  token_expired:{ label: 'Token expired', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', Icon: WifiOff },
}

export default function AdminWhatsAppPage() {
  const [status, setStatus] = useState<WAStatusInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    billingWhatsappApi.getStatus()
      .then(setStatus)
      .catch(() => setStatus({ status: 'disconnected' }))
      .finally(() => setLoading(false))
  }, [])

  const st = status?.status ?? 'disconnected'
  const badge = STATUS_LABEL[st] ?? STATUS_LABEL.disconnected
  const BadgeIcon = badge.Icon

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <MessageCircle size={22} className="text-green-600" />
              Platform WhatsApp
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Hexalyte&apos;s business WhatsApp for <strong>platform work only</strong> — subscription invoices,
              billing reminders, and test messages. Shop tenants connect their own number in the shop app.
            </p>
          </div>
          {!loading && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${badge.color}`}>
              <BadgeIcon size={12} className={st === 'connecting' ? 'animate-spin' : ''} />
              {badge.label}
              {status?.phoneNumber && <span className="opacity-70">· {status.phoneNumber}</span>}
            </span>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/subscriptions" className="card p-4 hover:border-green-300 hover:shadow-sm transition-all group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                <CreditCard size={16} className="text-green-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Subscriptions & Billing</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Send subscription invoice PDFs to tenant owners via this WhatsApp number.
                </p>
              </div>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-green-600 mt-1 flex-shrink-0" />
          </div>
        </Link>
        <div className="card p-4 bg-gray-50/80 border-dashed">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={16} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Shop WhatsApp</p>
              <p className="text-xs text-gray-500 mt-0.5">
                POS and repair invoices are sent from each shop&apos;s own connected number — not managed here.
              </p>
            </div>
          </div>
        </div>
      </div>

      <TenantWhatsAppPanel api={billingWhatsappApi} shopName="Hexalyte Billing" />
    </div>
  )
}
