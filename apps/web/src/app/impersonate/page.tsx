'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

function ImpersonateInner() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); setMessage('No token provided.'); return }

    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Invalid or expired token')
        const { data } = await res.json()
        authStorage.save(token, token, {
          id: data.id, email: data.email, name: data.name,
          role: data.role, tenantId: data.tenantId, branchIds: data.branchIds ?? [],
        })
        setStatus('success')
        setTimeout(() => { window.location.href = '/dashboard' }, 1200)
      } catch (e) {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'Failed to authenticate')
      }
    })()
  }, [params])

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
            <p className="text-slate-300 text-sm">Establishing support session…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-slate-300 text-sm">Session ready — redirecting to dashboard…</p>
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

export default function ImpersonatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    }>
      <ImpersonateInner />
    </Suspense>
  )
}
