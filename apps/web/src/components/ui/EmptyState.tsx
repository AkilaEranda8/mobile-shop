import { type LucideIcon, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface QuickAction { label: string; href?: string; onClick?: () => void; primary?: boolean }

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: QuickAction[]
  hints?: string[]
  /** @deprecated 'violet' is accepted as an alias of 'blue' (Hexalyte brand) */
  accentColor?: 'violet' | 'blue' | 'cyan' | 'green' | 'amber'
}

const ACCENT: Record<string, { icon: string; card: string; btn: string; dot: string; text: string }> = {
  blue:   { icon: 'bg-brand-500/10 border-brand-500/20 text-brand-500', card: 'border-brand-500/15 from-brand-500/5', btn: 'bg-brand-600 hover:bg-brand-700 text-white', dot: 'bg-brand-500', text: 'text-brand-600' },
  cyan:   { icon: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500', card: 'border-cyan-500/15 from-cyan-500/5', btn: 'bg-cyan-600 hover:bg-cyan-500 text-white', dot: 'bg-cyan-400', text: 'text-cyan-600' },
  green:  { icon: 'bg-green-500/10 border-green-500/20 text-green-500', card: 'border-green-500/15 from-green-500/5', btn: 'bg-green-600 hover:bg-green-500 text-white', dot: 'bg-green-400', text: 'text-green-600' },
  amber:  { icon: 'bg-amber-500/10 border-amber-500/20 text-amber-500', card: 'border-amber-500/15 from-amber-500/5', btn: 'bg-amber-600 hover:bg-amber-500 text-white', dot: 'bg-amber-400', text: 'text-amber-600' },
}
ACCENT.violet = ACCENT.blue

export function EmptyState({ icon: Icon, title, description, actions = [], hints = [], accentColor = 'blue' }: EmptyStateProps) {
  const a = ACCENT[accentColor] ?? ACCENT.blue

  return (
    <div className={`card bg-gradient-to-b ${a.card} to-transparent p-10 sm:p-16 flex flex-col items-center text-center gap-6 animate-fade-up`}>
      <div className="relative">
        <div className={`w-20 h-20 rounded-3xl border ${a.icon} flex items-center justify-center`}>
          <Icon size={32} />
        </div>
        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${a.dot} opacity-60`} />
        <span className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full ${a.dot} opacity-30`} />
        <span className="absolute top-1/2 -right-8 w-1.5 h-1.5 rounded-full bg-white/10" />
        <span className="absolute top-2 -left-6 w-1 h-1 rounded-full bg-white/10" />
      </div>

      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions.map((action) => {
            const cls = action.primary
              ? `inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ${a.btn}`
              : 'inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium'
            if (action.href) {
              return (
                <Link key={action.label} href={action.href} className={cls} style={!action.primary ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : undefined}>
                  {action.label} <ArrowRight size={14} />
                </Link>
              )
            }
            return (
              <button key={action.label} type="button" onClick={action.onClick} className={cls} style={!action.primary ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : undefined}>
                {action.label}
              </button>
            )
          })}
        </div>
      )}

      {hints.length > 0 && (
        <ul className="text-left space-y-1 max-w-sm w-full">
          {hints.map((h) => (
            <li key={h} className={`text-xs flex items-start gap-2 ${a.text}`}>
              <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${a.dot}`} />
              <span style={{ color: 'var(--text-muted)' }}>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
