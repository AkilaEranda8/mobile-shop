'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-violet-700 text-xs font-bold hover:bg-violet-50 transition-colors shrink-0'
    : 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors shadow-lg shadow-violet-500/20 shrink-0'

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
  const { openPos } = usePos()
  const tenantId = authStorage.getUser()?.tenantId

  const {
    visible, loading, trialDays, stepStates, steps, currentStep, currentStepId,
    completedCount, totalSteps, allComplete, progressPct,
    dismissed, celebrated, dismiss, expand, markCelebrated,
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

  if (loading || !visible) return null
  if (allComplete && celebrated) return null

  const pageTip = getPageContextTip(pathname, tab, currentStepId)
  const doneMap = Object.fromEntries(stepStates.map(s => [s.id, s.done])) as Record<string, boolean>

  if (allComplete) {
    return (
      <div className="mb-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/5 overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
          <PartyPopper size={22} className="text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 dark:text-white">Setup complete!</p>
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
        className="mb-4 w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-left hover:bg-violet-100 dark:hover:bg-violet-500/15 transition-colors"
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
    <div className="mb-4 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      {/* Sticky-style top bar — visible on every page */}
      <div className="px-4 py-3 sm:px-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sparkles size={16} className="shrink-0 text-violet-200" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">
                Trial setup · {completedCount}/{totalSteps} · {progressPct}%
              </p>
              {currentStep && (
                <p className="text-sm sm:text-base font-black truncate">
                  Next: {currentStep.titleEn}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {trialDays != null && (
              <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15">
                {trialDays}d left
              </span>
            )}
            {currentStep && (
              <StepAction step={currentStep} onPosOpen={() => openPos()} compact />
            )}
            <button type="button" onClick={toggleExpanded} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Toggle details">
              {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            <button type="button" onClick={dismiss} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Dismiss">
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Page-specific guidance */}
      {pageTip && (
        <div className={`px-4 py-3 sm:px-5 border-b border-gray-100 dark:border-slate-700 ${pageTip.onRightPage ? 'bg-emerald-50/80 dark:bg-emerald-500/5' : 'bg-amber-50/80 dark:bg-amber-500/5'}`}>
          <div className="flex gap-2.5">
            {pageTip.onRightPage ? (
              <MapPin size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{pageTip.headlineEn}</p>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{pageTip.headlineSi}</p>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: full checklist + all hints */}
      {expanded && currentStep && pageTip && (
        <div className="px-4 py-4 sm:px-5 space-y-4 border-b border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2">
              Instructions for this step
            </p>
            <ul className="space-y-1.5">
              {pageTip.tipsEn.map((tip, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-slate-300 flex gap-2">
                  <span className="text-violet-500 font-bold shrink-0">{i + 1}.</span>
                  <span>
                    {tip}
                    {pageTip.tipsSi[i] && (
                      <span className="block text-xs text-gray-500 dark:text-slate-500 mt-0.5">{pageTip.tipsSi[i]}</span>
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
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2">
            All setup steps
          </p>
          <ul className="space-y-1.5">
            {steps.map((step, i) => {
              const done = doneMap[step.id]
              const isCurrent = currentStep?.id === step.id
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                    isCurrent ? 'bg-violet-50 dark:bg-violet-500/10' : ''
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  ) : isCurrent ? (
                    <Circle size={15} className="text-violet-500 shrink-0 fill-violet-500/20" />
                  ) : (
                    <span className="w-[15px] text-[10px] font-bold text-gray-400 text-center shrink-0">{i + 1}</span>
                  )}
                  <span className={`flex-1 ${done ? 'line-through text-gray-400' : 'font-medium text-gray-800 dark:text-slate-200'}`}>
                    {step.titleEn}
                  </span>
                  {done && <Check size={14} className="text-emerald-500 shrink-0" />}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
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
          className="w-full px-4 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-colors text-left"
        >
          Show all instructions ({pageTip.tipsEn.length} tips) ↓
        </button>
      )}
    </div>
  )
}
