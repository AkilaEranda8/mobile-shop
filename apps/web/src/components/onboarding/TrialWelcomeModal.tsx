'use client'

import { ArrowRight, CheckCircle2, Sparkles, Store } from 'lucide-react'
import { TRIAL_ONBOARDING_STEPS } from '@/lib/trialOnboarding'

interface TrialWelcomeModalProps {
  shopName?: string
  trialDays: number | null
  onStart: () => void
}

export default function TrialWelcomeModal({ shopName, trialDays, onStart }: TrialWelcomeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-violet-500/30"
        style={{ background: 'var(--bg-surface, #0f1623)' }}
      >
        <div className="px-6 pt-8 pb-6 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/15 flex items-center justify-center">
            <Store size={28} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-200 mb-2">
            Welcome to Hexalyte
          </p>
          <h2 className="text-2xl sm:text-3xl font-black leading-tight">
            {shopName ? `${shopName}` : 'Your shop'} is ready!
          </h2>
          <p className="mt-3 text-sm text-violet-100 leading-relaxed max-w-md mx-auto">
            මේක තමයි ඔයාගේ shop manage කරන්න ඕනෙ <strong>system එක</strong>.
            පහළ steps 4 ටික follow කරලා setup complete කරන්න — පස්සේ daily work start කරන්න පුළුවන්.
          </p>
          {trialDays != null && (
            <p className="mt-2 text-xs font-semibold text-violet-200">
              {trialDays} day{trialDays === 1 ? '' : 's'} left on your free trial
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 flex items-center gap-1.5">
            <Sparkles size={13} />
            Your setup path (about 15 minutes)
          </p>
          <ol className="space-y-2">
            {TRIAL_ONBOARDING_STEPS.map((step, i) => (
              <li key={step.id} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-slate-200">{step.titleEn}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{step.titleSi}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>
              Guide එක හැම page එකකම top එකේ පෙන්වයි — ඔයා යන තැනට අනුව ඊළඟ step එක කියලා දෙනවා.
            </span>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors shadow-lg shadow-violet-500/25"
          >
            Start setup guide
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
