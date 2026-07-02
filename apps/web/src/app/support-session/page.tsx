'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { initializeSessionBranch } from '@/lib/active-branch'
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

async function establishSession(code: string) {
  const res = await fetch(`${API_URL}/auth/impersonate-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || 'Invalid or expired support link')
  }
  const { data } = await res.json()
  const loginUser = initializeSessionBranch(data.user as any)
  authStorage.save(data.accessToken, data.refreshToken, loginUser)
}

function SupportSessionInner() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      setStatus('error')
      setMessage('No support access code provided. Request a new link from Hexalyte support.')
      return
    }

    ;(async () => {
      try {
        await establishSession(code)
        setStatus('success')
        setTimeout(() => { window.location.href = '/dashboard' }, 300)
      } catch (e) {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'Failed to authenticate')
      }
    })()
  }, [params])

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
            <p className="text-slate-300 text-sm">Verifying authorised support access…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-slate-300 text-sm">Access verified — opening your workspace…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-red-400 text-sm font-medium">{message}</p>
            <a href="/login" className="text-violet-400 text-xs underline">Back to login</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function SupportSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    }>
      <SupportSessionInner />
    </Suspense>
  )
}
