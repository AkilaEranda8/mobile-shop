'use client'

import Link from 'next/link'
import { ArrowRight, MessageSquare } from 'lucide-react'

/** Settings tab shortcut — full SMS hub lives at /dashboard/sms */
export default function SmsSettingsPanel() {
  return (
    <div className="card p-8 max-w-xl space-y-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center mx-auto">
        <MessageSquare size={22} className="text-brand-400" />
      </div>
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>SMS Gateway Hub</h2>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Connection, templates, statistics, and send history are managed in the dedicated SMS hub
          (WhatsApp-style advanced module).
        </p>
      </div>
      <Link href="/dashboard/sms" className="btn-primary inline-flex items-center gap-2">
        Open SMS Hub <ArrowRight size={14} />
      </Link>
    </div>
  )
}
