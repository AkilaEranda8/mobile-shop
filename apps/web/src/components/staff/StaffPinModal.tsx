'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { authApi, usersApi } from '@/lib/api'
import toast from 'react-hot-toast'

type Mode = 'self-set' | 'admin-reset'

type Props = {
  mode: Mode
  /** Required for admin-reset */
  userId?: string
  userName?: string
  pinLength?: 4 | 6
  /** Hide cancel — used after admin reset */
  force?: boolean
  onClose: () => void
  onDone?: () => void
}

export function StaffPinModal({
  mode,
  userId,
  userName,
  pinLength = 6,
  force,
  onClose,
  onDone,
}: Props) {
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [hasPin, setHasPin] = useState(false)
  const [mustChange, setMustChange] = useState(true)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(mode === 'self-set')

  useEffect(() => {
    if (mode !== 'self-set') return
    setStatusLoading(true)
    authApi.posPinMyStatus()
      .then(res => setHasPin(!!res.data?.enabled))
      .catch(() => setHasPin(false))
      .finally(() => setStatusLoading(false))
  }, [mode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== pinLength || !/^\d+$/.test(pin)) {
      toast.error(`PIN must be ${pinLength} digits`)
      return
    }
    if (pin !== pinConfirm) {
      toast.error('PINs do not match')
      return
    }
    setLoading(true)
    try {
      if (mode === 'self-set') {
        await authApi.setOwnPosPin({
          pin,
          ...(hasPin
            ? (currentPin ? { currentPin } : { currentPassword })
            : { currentPassword }),
        })
        toast.success('POS PIN saved')
      } else {
        if (!userId) throw new Error('Missing user')
        await usersApi.resetPosPin(userId, { pin, mustChange })
        toast.success(`PIN set for ${userName || 'staff'}`)
      }
      onDone?.()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save PIN')
    } finally {
      setLoading(false)
    }
  }

  const disablePin = async () => {
    if (mode !== 'admin-reset' || !userId) return
    if (!window.confirm('Disable POS PIN for this staff member?')) return
    setLoading(true)
    try {
      await usersApi.disablePosPin(userId)
      toast.success('PIN disabled')
      onDone?.()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <KeyRound size={14} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {mode === 'self-set' ? 'My POS PIN' : `Set PIN — ${userName || 'Staff'}`}
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {pinLength}-digit PIN · unique within this shop
            </p>
          </div>
        </div>

        {statusLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            {mode === 'self-set' && (
              hasPin ? (
                <>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Current PIN</label>
                    <input
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={pinLength}
                      className="input-field"
                      value={currentPin}
                      onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
                      placeholder={`${pinLength} digits`}
                    />
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Or verify with password instead:</p>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Current password</label>
                    <input
                      type="password"
                      className="input-field"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Password (required to enable PIN)</label>
                  <input
                    type="password"
                    required
                    className="input-field"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                  />
                </div>
              )
            )}

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>New PIN</label>
              <input
                required
                inputMode="numeric"
                pattern="\d*"
                maxLength={pinLength}
                className="input-field tracking-[0.3em] font-mono text-center text-lg"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
                placeholder={'•'.repeat(pinLength)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Confirm PIN</label>
              <input
                required
                inputMode="numeric"
                pattern="\d*"
                maxLength={pinLength}
                className="input-field tracking-[0.3em] font-mono text-center text-lg"
                value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
                placeholder={'•'.repeat(pinLength)}
              />
            </div>

            {mode === 'admin-reset' && (
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={mustChange} onChange={e => setMustChange(e.target.checked)} />
                Require staff to change PIN on next use
              </label>
            )}

            <div className="flex gap-2 pt-2">
              {!force && (
                <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
              )}
              <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Save PIN
              </button>
            </div>

            {mode === 'admin-reset' && (
              <button type="button" onClick={disablePin} disabled={loading} className="w-full text-xs text-red-400 hover:text-red-300 pt-1">
                Disable PIN for this user
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
