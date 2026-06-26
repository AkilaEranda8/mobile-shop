'use client'

import { useRef, useState, useMemo } from 'react'
import { X, Loader2, MessageCircle, FileText } from 'lucide-react'
import type { SubscriptionRow } from '@/lib/api'
import { sendSubscriptionInvoice } from '@/lib/api'
import { buildSubscriptionInvoice, buildSubscriptionInvoiceMessage } from '@/lib/subscription-invoice'
import { captureElementAsPdfBase64 } from '@/lib/invoice-pdf'
import SubscriptionInvoicePrint from './SubscriptionInvoicePrint'

export default function SendSubscriptionInvoiceModal({
  sub,
  onClose,
  onSent,
}: {
  sub: SubscriptionRow
  onClose: () => void
  onSent?: () => void
}) {
  const printRef = useRef<HTMLDivElement>(null)
  const inv = useMemo(() => buildSubscriptionInvoice(sub), [sub])
  const defaultMessage = useMemo(() => buildSubscriptionInvoiceMessage(sub, inv), [sub, inv])
  const [phone, setPhone] = useState(sub.ownerPhone ?? '')
  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const handleSend = async () => {
    if (!phone.trim()) { setErr('Enter owner WhatsApp number'); return }
    setSending(true)
    setErr('')
    try {
      const el = printRef.current?.querySelector('#hx-invoice-send-capture') as HTMLElement | null
      if (!el) throw new Error('Invoice preview not ready')

      await new Promise(r => setTimeout(r, 200))
      const pdf = await captureElementAsPdfBase64(el, `Subscription-${inv.invoiceNo}.pdf`)

      await sendSubscriptionInvoice(sub.id, {
        phone: phone.trim(),
        orderId: inv.invoiceNo,
        customerName: sub.ownerName,
        amount: inv.total,
        message,
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename,
      })
      onSent?.()
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-green-600" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">Send Invoice via WhatsApp</h3>
              <p className="text-xs text-gray-500">{sub.name} · {inv.invoiceNo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Owner WhatsApp Number</label>
            <input
              type="tel"
              className="input w-full text-sm"
              placeholder="0771234567 or +94771234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Sent from Hexalyte business WhatsApp (Settings → WhatsApp). Shop does not need WhatsApp connected.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message (PDF attached)</label>
            <textarea
              rows={8}
              className="input w-full text-xs font-mono resize-none"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            <FileText size={13} className="text-emerald-600 flex-shrink-0" />
            <span>Subscription invoice PDF ({inv.invoiceNo}) will be attached automatically.</span>
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="button" onClick={handleSend} disabled={sending} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {sending ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
              {sending ? 'Sending…' : 'Send Invoice + PDF'}
            </button>
          </div>
        </div>

        {/* Off-screen invoice for PDF capture */}
        <div ref={printRef} style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }} aria-hidden>
          <SubscriptionInvoicePrint sub={sub} inv={inv} id="hx-invoice-send-capture" />
        </div>
      </div>
    </div>
  )
}
