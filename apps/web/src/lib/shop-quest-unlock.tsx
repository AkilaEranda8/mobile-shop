'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ALL_UNLOCK_IDS,
  INITIAL_UNLOCKS,
  type QuestUnlockId,
} from '@/lib/onboarding-quest'

type ShopQuestUnlockContextValue = {
  isQuestActive: boolean
  unlocked: Set<QuestUnlockId>
  xp: number
  missionIndex: number
  missionTotal: number
  setQuestActive: (active: boolean) => void
  setProgress: (opts: { xp: number; missionIndex: number; missionTotal: number }) => void
  unlock: (id: QuestUnlockId) => void
  unlockMany: (ids: QuestUnlockId[]) => void
  unlockAll: () => void
  resetUnlocks: (ids?: QuestUnlockId[]) => void
  isUnlocked: (id: QuestUnlockId) => boolean
  /** During quest, unmapped nav is locked; after quest everything open. */
  isNavLocked: (id: QuestUnlockId | undefined) => boolean
}

const ShopQuestUnlockContext = createContext<ShopQuestUnlockContextValue | null>(null)

export function ShopQuestUnlockProvider({ children }: { children: ReactNode }) {
  const [isQuestActive, setQuestActive] = useState(false)
  const [unlocked, setUnlocked] = useState<Set<QuestUnlockId>>(() => new Set(ALL_UNLOCK_IDS))
  const [xp, setXp] = useState(0)
  const [missionIndex, setMissionIndex] = useState(0)
  const [missionTotal, setMissionTotal] = useState(0)

  const unlock = useCallback((id: QuestUnlockId) => {
    setUnlocked((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const unlockMany = useCallback((ids: QuestUnlockId[]) => {
    setUnlocked((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  const unlockAll = useCallback(() => {
    setUnlocked(new Set(ALL_UNLOCK_IDS))
    setQuestActive(false)
  }, [])

  const resetUnlocks = useCallback((ids: QuestUnlockId[] = INITIAL_UNLOCKS) => {
    setUnlocked(new Set(ids))
  }, [])

  const setProgress = useCallback((opts: { xp: number; missionIndex: number; missionTotal: number }) => {
    setXp(opts.xp)
    setMissionIndex(opts.missionIndex)
    setMissionTotal(opts.missionTotal)
  }, [])

  const isUnlocked = useCallback(
    (id: QuestUnlockId) => !isQuestActive || unlocked.has(id),
    [isQuestActive, unlocked],
  )

  const isNavLocked = useCallback(
    (id: QuestUnlockId | undefined) => {
      if (!isQuestActive) return false
      if (!id) return true
      return !unlocked.has(id)
    },
    [isQuestActive, unlocked],
  )

  const value = useMemo(
    () => ({
      isQuestActive,
      unlocked,
      xp,
      missionIndex,
      missionTotal,
      setQuestActive,
      setProgress,
      unlock,
      unlockMany,
      unlockAll,
      resetUnlocks,
      isUnlocked,
      isNavLocked,
    }),
    [
      isQuestActive,
      unlocked,
      xp,
      missionIndex,
      missionTotal,
      unlock,
      unlockMany,
      unlockAll,
      resetUnlocks,
      isUnlocked,
      isNavLocked,
      setProgress,
    ],
  )

  return (
    <ShopQuestUnlockContext.Provider value={value}>
      {children}
    </ShopQuestUnlockContext.Provider>
  )
}

export function useShopQuestUnlock() {
  const ctx = useContext(ShopQuestUnlockContext)
  if (!ctx) {
    return {
      isQuestActive: false,
      unlocked: new Set(ALL_UNLOCK_IDS),
      xp: 0,
      missionIndex: 0,
      missionTotal: 0,
      setQuestActive: () => {},
      setProgress: () => {},
      unlock: () => {},
      unlockMany: () => {},
      unlockAll: () => {},
      resetUnlocks: () => {},
      isUnlocked: () => true,
      isNavLocked: () => false,
    } satisfies ShopQuestUnlockContextValue
  }
  return ctx
}

/** Map sidebar/header nav routes to quest unlock ids. */
export function questUnlockForHref(href: string, openPos?: boolean): QuestUnlockId | undefined {
  if (openPos || href.includes('/pos')) return 'pos'
  if (href === '/dashboard' || href === '/dashboard/') return 'dashboard'
  if (href.startsWith('/inventory') || href.includes('/inventory')) return 'inventory'
  if (href.includes('/repairs')) return 'repairs'
  if (href.includes('/settings')) return 'settings'
  return undefined
}
