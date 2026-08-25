'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, Lock, X } from 'lucide-react'
import { authApi } from '@/lib/api'
import { authStorage, type AuthUser } from '@/lib/auth'
import { initializeSessionBranch } from '@/lib/active-branch'
import { POS_THEME } from './pos-theme'
import { PosPinKeypad } from './PosPinKeypad'

export type PosPinGateMode = 'unlock' | 'switch'

export type PosPinSettingsClient = {
  enabled: boolean
  pinLength: 4 | 6
  idleTimeoutSeconds: number
  requirePasswordAfterLock: boolean
  allowColdPinLogin: boolean
  maxFailedAttempts: number
  lockoutSeconds: number
}

type Props = {
  mode: PosPinGateMode
  pinLength: 4 | 6
  cashierName?: string
  /** Idle lock cannot be dismissed without PIN */
  dismissible?: boolean
  onClose?: () => void
  onUnlocked?: () => void
  onSwitched?: (user: AuthUser) => void
  /** Offer switch from unlock when wrong PIN might be another cashier */
  onRequestSwitch?: () => void
}

export function applyPosPinSession(data: {
  accessToken: string
  refreshToken: string
  user: AuthUser
}): AuthUser {
  const loginUser = initializeSessionBranch(data.user as any)
  authStorage.save(data.accessToken, data.refreshToken, loginUser)
  try {
    localStorage.removeItem('hx_tenant_features')
    const slug = (loginUser.tenantSlug || '').trim().toLowerCase()
    if (slug && slug !== 'platform') localStorage.setItem('hx_pin_shop_slug', slug)
  } catch { /* noop */ }
  return loginUser
}

export function PosPinGate({
  mode,
  pinLength,
  cashierName,
  dismissible,
  onClose,
  onUnlocked,
  onSwitched,
  onRequestSwitch,
}: Props) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPin('')
    setError('')
  }, [mode])

  useEffect(() => {
    if (pin.length === pinLength && !loading) {
      void submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinLength])

  const submit = async () => {
    if (pin.length !== pinLength || loading) return
    setLoading(true)
    setError('')
    try {
      if (mode === 'unlock') {
        await authApi.posPinUnlock(pin)
        onUnlocked?.()
      } else {
        const res = await authApi.posPinSwitch(pin)
        const user = applyPosPinSession(res.data)
        onSwitched?.(user)
      }
      setPin('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-[130] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className="w-full max-w-sm rounded-3xl border p-6 shadow-2xl"
        style={{ background: POS_THEME.panel, borderColor: POS_THEME.border }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${POS_THEME.purple}22`, border: `1px solid ${POS_THEME.purple}44` }}
            >
              {mode === 'unlock' ? <Lock size={16} style={{ color: POS_THEME.purple }} /> : <ArrowLeftRight size={16} style={{ color: POS_THEME.purple }} />}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: POS_THEME.text }}>
                {mode === 'unlock' ? 'POS locked' : 'Switch cashier'}
              </p>
              <p className="text-[11px]" style={{ color: POS_THEME.muted }}>
                {mode === 'unlock'
                  ? `Enter PIN for ${cashierName || 'current cashier'}`
                  : 'Enter the next cashier’s PIN'}
              </p>
            </div>
          </div>
          {dismissible && onClose && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: POS_THEME.muted }}>
              <X size={14} />
            </button>
          )}
        </div>

        <PosPinKeypad
          value={pin}
          maxLength={pinLength}
          onChange={setPin}
          onSubmit={submit}
          loading={loading}
          error={error}
        />

        {mode === 'unlock' && onRequestSwitch && (
          <button
            type="button"
            onClick={onRequestSwitch}
            className="mt-4 w-full text-center text-xs font-semibold"
            style={{ color: POS_THEME.purple }}
          >
            Switch to another cashier instead
          </button>
        )}
      </div>
    </div>
  )
}
