'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, ChevronUp,
  Circle, Lightbulb, MapPin, PartyPopper, Rocket, Sparkles, X,
} from 'lucide-react'
import { useTrialOnboarding } from '@/hooks/useTrialOnboarding'
import { usePos } from '@/lib/use-pos'
import {
  getPageContextTip,
  onboardingExpandedKey,
  type OnboardingStepDef,
} from '@/lib/trialOnboarding'
import { authStorage } from '@/lib/auth'
import TrialWelcomeModal from '@/components/onboarding/TrialWelcomeModal'

function StepAction({
  step,
  onPosOpen,
  compact,
}: {
  step: OnboardingStepDef
  onPosOpen: () => void
  compact?: boolean
}) {
  const cls = compact
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 bg-violet-600 text-white hover:bg-violet-500 dark:bg-white dark:text-violet-700 dark:hover:bg-violet-50 shadow-sm'
    : 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors shadow-md shadow-violet-600/15 shrink-0'

  if (step.opensPos) {
    return (
      <button type="button" onClick={onPosOpen} className={cls}>
        {step.actionEn}
        {!compact && <ArrowRight size={15} />}
      </button>
    )
  }

  return (
    <Link href={step.href ?? '/dashboard'} className={cls}>
      {step.actionEn}
      {!compact && <ArrowRight size={15} />}
    </Link>
  )
}

export default function TrialOnboardingCoach() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const { openPos, posOpen } = usePos()
  const tenantId = authStorage.getUser()?.tenantId

  const {
    visible, loading, trialDays, stepStates, steps, currentStep, currentStepId,
    completedCount, totalSteps, allComplete, progressPct,
    dismissed, celebrated, dismiss, expand, markCelebrated,
    showWelcome, startSetupGuide, tenant,
  } = useTrialOnboarding()

  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    try {
      setExpanded(localStorage.getItem(onboardingExpandedKey(tenantId)) === '1')
    } catch { /* noop */ }
  }, [tenantId])

  const toggleExpanded = () => {
    if (!tenantId) return
    const next = !expanded
    setExpanded(next)
    try { localStorage.setItem(onboardingExpandedKey(tenantId), next ? '1' : '0') } catch { /* noop */ }
    if (dismissed) expand()
  }

  const handleStartGuide = () => {
    startSetupGuide()
    setExpanded(true)
  }

  if (loading && !visible) return null
  if (!visible) return null
  if (allComplete && celebrated) return null

  if (showWelcome) {
    const welcomeModal = (
      <TrialWelcomeModal
        shopName={tenant?.name}
        trialDays={trialDays}
        onStart={handleStartGuide}
      />
    )
    if (typeof document !== 'undefined') {
      return createPortal(welcomeModal, document.body)
    }
    return welcomeModal
  }

  const pageTip = getPageContextTip(pathname, tab, currentStepId)
  const doneMap = Object.fromEntries(stepStates.map(s => [s.id, s.done])) as Record<string, boolean>

  const compactPosGuide = posOpen && currentStep && pageTip && (
    <div className="fixed top-0 left-0 right-0 z-[101] px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <Sparkles size={14} className="shrink-0 text-violet-200" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">
            Setup · Step {completedCount + 1}/{totalSteps}
          </p>
          <p className="text-xs sm:text-sm font-bold truncate">{pageTip.headlineEn}</p>
        </div>
        {currentStep.opensPos ? null : (
          <StepAction step={currentStep} onPosOpen={() => openPos()} compact />
        )}
      </div>
    </div>
  )

  if (posOpen && compactPosGuide && typeof document !== 'undefined') {
    return createPortal(compactPosGuide, document.body)
  }

  if (allComplete) {
    return (
      <div
        className="mb-3 rounded-2xl overflow-hidden border"
        style={{
          borderColor: 'rgba(16,185,129,0.25)',
          background: 'linear-gradient(to right, rgba(16,185,129,0.08), rgba(20,184,166,0.05))',
        }}
      >
        <div className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
          <PartyPopper size={22} className="text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-black" style={{ color: 'var(--text-primary)' }}>Setup complete!</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">දැන් daily work start කරන්න පුළුවන්.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/user-manual" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1">
              <BookOpen size={14} /> User Manual
            </Link>
            <button type="button" onClick={markCelebrated} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold">
              Got it
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={expand}
        className="mb-3 w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-colors hover:bg-violet-50/80 dark:hover:bg-violet-500/15"
        style={{
          borderColor: 'rgba(124,58,237,0.2)',
          background: 'rgba(124,58,237,0.05)',
        }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <Rocket size={15} />
          Setup guide — {completedCount}/{totalSteps}
        </span>
        <span className="text-xs text-violet-600 dark:text-violet-400">දැන් මොකක්ද කරන්න ඕන? Tap to open</span>
      </button>
    )
  }

  return (
    <div
      className="mb-3 rounded-2xl overflow-hidden border shadow-sm"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header — soft in light mode, rich in dark */}
      <div className="px-4 py-3 sm:px-5 border-b bg-gradient-to-r from-violet-50/90 to-indigo-50/60 dark:from-violet-600 dark:to-indigo-600 dark:text-white"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-violet-600/10 dark:bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-violet-600 dark:text-violet-200" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-200">
                Setup guide · {completedCount}/{totalSteps} · {progressPct}%
              </p>
              {currentStep && (
                <p className="text-sm sm:text-base font-bold truncate text-gray-900 dark:text-white">
                  Step {completedCount + 1}: {currentStep.titleEn}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {trialDays != null && (
              <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-white/15 dark:text-white">
                {trialDays}d left
              </span>
            )}
            {currentStep && (
              <StepAction step={currentStep} onPosOpen={() => openPos()} compact />
            )}
            <button type="button" onClick={toggleExpanded} className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100 dark:text-white dark:hover:bg-white/10" aria-label="Toggle details">
              {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            <button type="button" onClick={dismiss} className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100 dark:text-white dark:hover:bg-white/10" aria-label="Dismiss">
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-violet-200/70 dark:bg-white/20">
          <div className="h-full bg-violet-600 dark:bg-white rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Page tip */}
      {pageTip && (
        <div
          className={`px-4 py-3 sm:px-5 border-b ${pageTip.onRightPage
            ? 'bg-emerald-50/70 dark:bg-emerald-500/5'
            : 'bg-slate-50 dark:bg-amber-500/5'
          }`}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex gap-2.5">
            {pageTip.onRightPage ? (
              <MapPin size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{pageTip.headlineEn}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pageTip.headlineSi}</p>
            </div>
          </div>
        </div>
      )}

      {expanded && currentStep && pageTip && (
        <div className="px-4 py-4 sm:px-5 space-y-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2">
              Instructions for this step
            </p>
            <ul className="space-y-2">
              {pageTip.tipsEn.map((tip, i) => (
                <li key={i} className="text-sm flex gap-2.5 rounded-lg px-3 py-2" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                  <span className="text-violet-600 dark:text-violet-400 font-bold shrink-0">{i + 1}.</span>
                  <span>
                    {tip}
                    {pageTip.tipsSi[i] && (
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pageTip.tipsSi[i]}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <StepAction step={currentStep} onPosOpen={() => openPos()} />
        </div>
      )}

      {expanded && (
        <div className="px-4 py-4 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            All setup steps
          </p>
          <ul className="space-y-1">
            {steps.map((step, i) => {
              const done = doneMap[step.id]
              const isCurrent = currentStep?.id === step.id
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm border ${
                    isCurrent ? 'border-violet-200 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-500/10' : 'border-transparent'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  ) : isCurrent ? (
                    <Circle size={15} className="text-violet-600 dark:text-violet-400 shrink-0 fill-violet-500/15" />
                  ) : (
                    <span className="w-[15px] text-[10px] font-bold text-center shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  )}
                  <span
                    className={`flex-1 ${done ? 'line-through' : 'font-medium'}`}
                    style={{ color: done ? 'var(--text-muted)' : 'var(--text-primary)' }}
                  >
                    {step.titleEn}
                  </span>
                  {done && <Check size={14} className="text-emerald-500 shrink-0" />}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <BookOpen size={12} />
            <Link href="/dashboard/user-manual" className="text-violet-600 dark:text-violet-400 font-semibold hover:underline">
              Full User Manual
            </Link>
          </p>
        </div>
      )}

      {!expanded && pageTip && (
        <button
          type="button"
          onClick={toggleExpanded}
          className="w-full px-4 py-2.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50/60 dark:hover:bg-violet-500/5 transition-colors text-left border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          Show all instructions ({pageTip.tipsEn.length} tips) ↓
        </button>
      )}
    </div>
  )
}
