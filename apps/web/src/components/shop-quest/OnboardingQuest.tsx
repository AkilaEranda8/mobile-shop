'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import toast from 'react-hot-toast'
import { authStorage } from '@/lib/auth'
import { tenantApi } from '@/lib/api'
import {
  getQuestSaved,
  INITIAL_UNLOCKS,
  QUEST_MISSIONS,
  QUEST_REPLAY_EVENT,
  QUEST_SKIP_EVENT,
  QUEST_TOTAL_XP,
  QUEST_VICTORY_XP,
  saveQuest,
  visibleMissions,
  xpUpToMission,
  type QuestMission,
} from '@/lib/onboarding-quest'
import { useShopQuestUnlock } from '@/lib/shop-quest-unlock'
import { QuestWelcome } from './QuestWelcome'
import { QuestMissionModal } from './QuestMissionModal'
import { QuestMissionComplete } from './QuestMissionComplete'
import { QuestVictory } from './QuestVictory'
import { QuestAbandonButton } from './QuestAbandonButton'

type Phase = 'idle' | 'welcome' | 'mission' | 'complete' | 'victory'

export function OnboardingQuest() {
  const user = authStorage.getUser()
  const userId = user?.id
  const {
    setQuestActive,
    setQuestUiOpen,
    setProgress,
    unlock,
    unlockAll,
    resetUnlocks,
  } = useShopQuestUnlock()

  const [phase, setPhase] = useState<Phase>('idle')
  const [missions, setMissions] = useState<QuestMission[]>(QUEST_MISSIONS)
  const [index, setIndex] = useState(0)
  const [xp, setXp] = useState(0)
  const [autoProgress, setAutoProgress] = useState(0)
  const driverRef = useRef<Driver | null>(null)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const replayOnlyRef = useRef(false)

  const destroyDriver = useCallback(() => {
    try {
      driverRef.current?.destroy()
    } catch { /* noop */ }
    driverRef.current = null
  }, [])

  const highlight = useCallback((selector: string) => {
    destroyDriver()
    const el = document.querySelector(selector)
    if (!el) return
    const d = driver({
      popoverClass: 'shop-quest-driver-hidden',
      stagePadding: 8,
      stageRadius: 12,
      overlayOpacity: 0.55,
      allowClose: false,
      animate: true,
      showButtons: [],
    })
    driverRef.current = d
    d.highlight({ element: selector })
  }, [destroyDriver])

  const persistSkipOrDone = useCallback((status: 'done' | 'skipped', finalXp: number) => {
    if (!userId) return
    saveQuest(userId, {
      status,
      xp: finalXp,
      completedAt: new Date().toISOString(),
    })
  }, [userId])

  const finishFullAccess = useCallback((status: 'done' | 'skipped', finalXp: number) => {
    destroyDriver()
    if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    unlockAll()
    setQuestActive(false)
    setQuestUiOpen(false)
    setProgress({ xp: 0, missionIndex: 0, missionTotal: 0 })
    persistSkipOrDone(status, finalXp)
    setPhase('idle')
    replayOnlyRef.current = false
  }, [destroyDriver, unlockAll, setQuestActive, setQuestUiOpen, setProgress, persistSkipOrDone])

  const syncProgress = useCallback((i: number, list: QuestMission[], currentXp: number) => {
    setProgress({
      xp: currentXp,
      missionIndex: i,
      missionTotal: list.length,
    })
  }, [setProgress])

  const startQuest = useCallback(() => {
    const list = visibleMissions()
    setMissions(list)
    setIndex(0)
    setXp(0)
    replayOnlyRef.current = false
    resetUnlocks(INITIAL_UNLOCKS)
    setQuestActive(true)
    syncProgress(0, list, 0)
    setPhase('mission')
    const first = list[0]
    if (first) {
      requestAnimationFrame(() => highlight(first.spotlight))
    }
  }, [resetUnlocks, setQuestActive, syncProgress, highlight])

  const skipEntirely = useCallback(() => {
    finishFullAccess('skipped', xp)
    toast.success('All features unlocked — enjoy Hexalyte Shop')
  }, [finishFullAccess, xp])

  const goMission = useCallback((nextIndex: number, list: QuestMission[], currentXp: number) => {
    if (nextIndex >= list.length) {
      destroyDriver()
      setXp(currentXp + QUEST_VICTORY_XP)
      setPhase('victory')
      return
    }
    setIndex(nextIndex)
    syncProgress(nextIndex, list, currentXp)
    setPhase('mission')
    const m = list[nextIndex]
    requestAnimationFrame(() => highlight(m.spotlight))
  }, [destroyDriver, highlight, syncProgress])

  const onMissionContinue = useCallback(() => {
    const m = missions[index]
    if (!m) return
    destroyDriver()
    if (!replayOnlyRef.current) {
      unlock(m.unlock)
    }
    const nextXp = xp + m.xp
    setXp(nextXp)
    syncProgress(index, missions, nextXp)
    setPhase('complete')
    setAutoProgress(0)
    if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    const started = Date.now()
    autoTimerRef.current = setInterval(() => {
      const t = (Date.now() - started) / 1100
      setAutoProgress(Math.min(1, t))
      if (t >= 1) {
        if (autoTimerRef.current) clearInterval(autoTimerRef.current)
        goMission(index + 1, missions, nextXp)
      }
    }, 50)
  }, [missions, index, xp, destroyDriver, unlock, syncProgress, goMission])

  const onCompleteContinue = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    goMission(index + 1, missions, xp)
  }, [goMission, index, missions, xp])

  const onSkipMission = useCallback(() => {
    const m = missions[index]
    if (m && !replayOnlyRef.current) unlock(m.unlock)
    const nextXp = xp + (m?.xp ?? 0)
    setXp(nextXp)
    goMission(index + 1, missions, nextXp)
  }, [missions, index, xp, unlock, goMission])

  const onBack = useCallback(() => {
    if (index <= 0) return
    goMission(index - 1, missions, xpUpToMission(missions, index - 1))
    setXp(xpUpToMission(missions, index - 1))
  }, [index, missions, goMission])

  const onClaimVictory = useCallback(() => {
    const finalXp = Math.max(xp, QUEST_TOTAL_XP)
    if (replayOnlyRef.current) {
      destroyDriver()
      setPhase('idle')
      setQuestUiOpen(false)
      replayOnlyRef.current = false
      return
    }
    finishFullAccess('done', finalXp)
    toast.success('Shop Ready — badge claimed!')
  }, [xp, finishFullAccess, destroyDriver, setQuestUiOpen])

  const onShare = useCallback(async () => {
    const text = `I completed Hexalyte Shop Quest and unlocked my shop! ${QUEST_TOTAL_XP} XP 🏆`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Achievement copied')
    } catch {
      toast(text)
    }
  }, [])

  const startReplay = useCallback(() => {
    const list = visibleMissions()
    setMissions(list)
    setIndex(0)
    setXp(0)
    replayOnlyRef.current = true
    // Do not lock UI on replay
    setQuestActive(false)
    setPhase('welcome')
  }, [setQuestActive])

  // Keep competing popups (e.g. What's New) closed while any quest screen is open
  useEffect(() => {
    setQuestUiOpen(phase !== 'idle')
  }, [phase, setQuestUiOpen])

  // Auto-start only for TRIAL tenants — ACTIVE shops skip onboard
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let welcomeTimer: number | undefined

    const saved = getQuestSaved(userId)
    if (saved) {
      unlockAll()
      setQuestActive(false)
      return
    }

    ;(async () => {
      let isTrial = false
      try {
        const r: any = await tenantApi.me()
        const tenant = r?.data ?? r
        isTrial = String(tenant?.status ?? '').toUpperCase() === 'TRIAL'
      } catch {
        // If status is unknown, do not lock an established shop
        isTrial = false
      }
      if (cancelled) return

      if (!isTrial) {
        saveQuest(userId, {
          status: 'skipped',
          completedAt: new Date().toISOString(),
        })
        unlockAll()
        setQuestActive(false)
        return
      }

      // Wait for chrome + release notes
      welcomeTimer = window.setTimeout(() => {
        if (cancelled) return
        if (getQuestSaved(userId)) return
        setPhase('welcome')
      }, 900) as unknown as number
    })()

    return () => {
      cancelled = true
      if (welcomeTimer !== undefined) window.clearTimeout(welcomeTimer)
    }
  }, [userId, unlockAll, setQuestActive])

  // Replay event from User Manual
  useEffect(() => {
    const onReplay = () => {
      if (!userId) return
      startReplay()
    }
    window.addEventListener(QUEST_REPLAY_EVENT, onReplay)
    return () => window.removeEventListener(QUEST_REPLAY_EVENT, onReplay)
  }, [userId, startReplay])

  useEffect(() => () => {
    destroyDriver()
    if (autoTimerRef.current) clearInterval(autoTimerRef.current)
  }, [destroyDriver])

  // Expose skip for sidebar card via custom event
  useEffect(() => {
    const onSkip = () => skipEntirely()
    window.addEventListener(QUEST_SKIP_EVENT, onSkip)
    return () => window.removeEventListener(QUEST_SKIP_EVENT, onSkip)
  }, [skipEntirely])

  if (phase === 'idle') return null

  const mission = missions[index]

  return (
    <>
      {phase === 'welcome' && (
        <QuestWelcome
          onStart={() => {
            if (replayOnlyRef.current) {
              const list = visibleMissions()
              setMissions(list)
              setIndex(0)
              setXp(0)
              setQuestActive(false)
              syncProgress(0, list, 0)
              setPhase('mission')
              if (list[0]) requestAnimationFrame(() => highlight(list[0].spotlight))
            } else {
              startQuest()
            }
          }}
          onSkip={() => {
            if (replayOnlyRef.current) {
              setPhase('idle')
              replayOnlyRef.current = false
              return
            }
            skipEntirely()
          }}
        />
      )}

      {phase === 'mission' && mission && (
        <>
          <div className="shop-quest-dim" aria-hidden />
          <QuestMissionModal
            mission={mission}
            index={index}
            total={missions.length}
            canGoBack={index > 0}
            onBack={onBack}
            onContinue={onMissionContinue}
            onSkipMission={onSkipMission}
          />
          {!replayOnlyRef.current && (
            <QuestAbandonButton onAbandon={skipEntirely} />
          )}
        </>
      )}

      {phase === 'complete' && mission && (
        <QuestMissionComplete
          mission={mission}
          onContinue={onCompleteContinue}
          autoProgress={autoProgress}
        />
      )}

      {phase === 'victory' && (
        <QuestVictory
          missionCount={missions.length}
          xp={xp}
          onClaim={onClaimVictory}
          onShare={onShare}
        />
      )}
    </>
  )
}
