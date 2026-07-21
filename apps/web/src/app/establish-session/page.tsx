'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { initializeSessionBranch } from '@/lib/active-branch'
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'

async function establishSession(code: string) {
  const res = await fetch(`${getApiBaseUrl()}/auth/session-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || 'Invalid or expired session link')
  }
  const { data } = await res.json()
  const loginUser = initializeSessionBranch(data.user as any)
  authStorage.save(data.accessToken, data.refreshToken, loginUser)
}

function EstablishSessionInner() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      setStatus('error')
      setMessage('No session code provided. Please register again or sign in.')
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
            <p className="text-slate-300 text-sm">Opening your shop workspace…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-slate-300 text-sm">Welcome! Redirecting to your dashboard…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-red-400 text-sm font-medium">{message}</p>
            <a href="/login" className="text-violet-400 text-xs underline">Go to login</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function EstablishSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    }>
      <EstablishSessionInner />
    </Suspense>
  )
}
