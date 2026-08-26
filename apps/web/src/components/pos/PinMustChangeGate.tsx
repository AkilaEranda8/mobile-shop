'use client'

import { useEffect, useState } from 'react'
import { authStorage } from '@/lib/auth'
import { tenantApi } from '@/lib/api'
import { useFeatureFlag } from '@/lib/hooks'
import { StaffPinModal } from '@/components/staff/StaffPinModal'

/** Forces PIN change for any role (including OWNER/MANAGER) after admin reset. */
export function PinMustChangeGate() {
  const hasQuickPin = useFeatureFlag('POS_QUICK_PIN')
  const [open, setOpen] = useState(false)
  const [pinLength, setPinLength] = useState<4 | 6>(6)

  useEffect(() => {
    if (!hasQuickPin) return
    const user = authStorage.getUser()
    if (!user?.pinMustChange) {
      setOpen(false)
      return
    }
    setOpen(true)
    const tid = user.tenantId
    if (!tid) return
    tenantApi.getPosPinSettings(tid)
      .then((res: any) => {
        const s = res?.data ?? res
        setPinLength(s?.pinLength === 4 ? 4 : 6)
      })
      .catch(() => {})
  }, [hasQuickPin])

  if (!open) return null

  return (
    <StaffPinModal
      mode="self-set"
      pinLength={pinLength}
      force
      onClose={() => {}}
      onDone={() => {
        authStorage.updateUser({ pinMustChange: false })
        setOpen(false)
      }}
    />
  )
}
