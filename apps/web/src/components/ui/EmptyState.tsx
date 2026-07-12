import { type LucideIcon, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface QuickAction { label: string; href?: string; onClick?: () => void; primary?: boolean }

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: QuickAction[]
  hints?: string[]
  accentColor?: 'violet' | 'blue' | 'cyan' | 'green' | 'amber'
}

const ACCENT: Record<string, { icon: string; card: string; btn: string; dot: string; text: string }> = {
  violet: { icon: 'bg-violet-500/10 border-violet-500/20 text-violet-400', card: 'border-violet-500/15 from-violet-500/5', btn: 'bg-violet-600 hover:bg-violet-500 text-white', dot: 'bg-violet-400', text: 'text-violet-400' },
  blue:   { icon: 'bg-blue-500/10 border-blue-500/20 text-blue-400',       card: 'border-blue-500/15 from-blue-500/5',   btn: 'bg-blue-600 hover:bg-blue-500 text-white',   dot: 'bg-blue-400',   text: 'text-blue-400'   },
  cyan:   { icon: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',       card: 'border-cyan-500/15 from-cyan-500/5',   btn: 'bg-cyan-600 hover:bg-cyan-500 text-white',   dot: 'bg-cyan-400',   text: 'text-cyan-400'   },
  green:  { icon: 'bg-green-500/10 border-green-500/20 text-green-400',    card: 'border-green-500/15 from-green-500/5', btn: 'bg-green-600 hover:bg-green-500 text-white',  dot: 'bg-green-400',  text: 'text-green-400'  },
  amber:  { icon: 'bg-amber-500/10 border-amber-500/20 text-amber-400',    card: 'border-amber-500/15 from-amber-500/5', btn: 'bg-amber-600 hover:bg-amber-500 text-white',  dot: 'bg-amber-400',  text: 'text-amber-400'  },
}

export function EmptyState({ icon: Icon, title, description, actions = [], hints = [], accentColor = 'violet' }: EmptyStateProps) {
  const a = ACCENT[accentColor]

  return (
    <div className={`card bg-gradient-to-b ${a.card} to-transparent p-10 sm:p-16 flex flex-col items-center text-center gap-6 animate-fade-up`}>
      {/* SVG Illustration */}
      <div className="relative">
        <div className={`w-20 h-20 rounded-3xl border ${a.icon} flex items-center justify-center`}>
          <Icon size={32} />
        </div>
        {/* Decorative dots */}
        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${a.dot} opacity-60`} />
        <span className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full ${a.dot} opacity-30`} />
        <span className="absolute top-1/2 -right-8 w-1.5 h-1.5 rounded-full bg-white/10" />
        <span className="absolute top-2 -left-6 w-1 h-1 rounded-full bg-white/10" />
      </div>

      {/* Text */}
      <div className="max-w-sm">
        <h3 className="text-base font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {actions.map((act, i) =>
            act.href ? (
              <Link key={i} href={act.href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 ${act.primary ? a.btn : 'bg-white/5 hover:bg-white/8 text-slate-300 border border-white/8'}`}>
                {act.label}
                {act.primary && <ArrowRight size={13} />}
              </Link>
            ) : (
              <button key={i} onClick={act.onClick}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 ${act.primary ? a.btn : 'bg-white/5 hover:bg-white/8 text-slate-300 border border-white/8'}`}>
                {act.label}
                {act.primary && <ArrowRight size={13} />}
              </button>
            )
          )}
        </div>
      )}

      {/* Tips / Hints */}
      {hints.length > 0 && (
        <div className="w-full max-w-md border border-white/5 rounded-xl p-4 bg-white/2 text-left">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Quick Tips</p>
          <ul className="space-y-1.5">
            {hints.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-500 dark:text-slate-500">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.dot} opacity-60`} />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
