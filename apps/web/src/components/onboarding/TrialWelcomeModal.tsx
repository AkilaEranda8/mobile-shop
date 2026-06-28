'use client'

import { ArrowRight, Sparkles, Store } from 'lucide-react'
import { TRIAL_ONBOARDING_STEPS } from '@/lib/trialOnboarding'

interface TrialWelcomeModalProps {
  shopName?: string
  trialDays: number | null
  onStart: () => void
}

export default function TrialWelcomeModal({ shopName, trialDays, onStart }: TrialWelcomeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden border shadow-2xl"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-default)',
          boxShadow: 'var(--shadow-card-hover)',
        }}
      >
        <div className="px-6 pt-8 pb-6 text-center border-b bg-gradient-to-br from-violet-50 via-white to-indigo-50/90 dark:from-violet-600 dark:via-violet-700 dark:to-indigo-800 dark:border-transparent"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-white/15 border border-violet-200/80 dark:border-white/10 flex items-center justify-center text-violet-600 dark:text-white">
            <Store size={28} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-200 mb-2">
            Welcome to Hexalyte
          </p>
          <h2 className="text-2xl sm:text-3xl font-black leading-tight text-gray-900 dark:text-white">
            {shopName ? `${shopName}` : 'Your shop'} is ready!
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-violet-100 leading-relaxed max-w-md mx-auto">
            මේක තමයි ඔයාගේ shop manage කරන්න ඕනෙ <strong className="text-gray-900 dark:text-white">system එක</strong>.
            පහළ steps 4 ටික follow කරලා setup complete කරන්න — පස්සේ daily work start කරන්න පුළුවන්.
          </p>
          {trialDays != null && (
            <p className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-white/15 dark:text-violet-100">
              {trialDays} day{trialDays === 1 ? '' : 's'} left on your free trial
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4" style={{ background: 'var(--bg-card)' }}>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
            <Sparkles size={13} />
            Your setup path (about 15 minutes)
          </p>
          <ol className="space-y-2.5">
            {TRIAL_ONBOARDING_STEPS.map((step, i) => (
              <li key={step.id} className="flex items-start gap-3 text-sm rounded-xl px-3 py-2.5 border"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
              >
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white dark:bg-violet-500/20 dark:text-violet-200 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{step.titleEn}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.titleSi}</p>
                </div>
              </li>
            ))}
          </ol>

          <div
            className="flex items-start gap-2.5 p-3.5 rounded-xl border text-xs leading-relaxed"
            style={{
              borderColor: 'rgba(124,58,237,0.18)',
              background: 'rgba(124,58,237,0.06)',
              color: 'var(--text-secondary)',
            }}
          >
            <Sparkles size={16} className="shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
            <span>
              Guide එක හැම page එකකම top එකේ පෙන්වයි — ඔයා යන තැනට අනුව ඊළඟ step එක කියලා දෙනවා.
            </span>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors shadow-md shadow-violet-600/20"
          >
            Start setup guide
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
