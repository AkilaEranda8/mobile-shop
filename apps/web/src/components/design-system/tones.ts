/** Semantic accent tones for Hexalyte enterprise UI (not decorative). */
export type AccentTone =
  | 'brand'
  | 'blue'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'slate'
  /** @deprecated Maps to brand */
  | 'violet'
  /** @deprecated Maps to success */
  | 'green'
  | 'emerald'
  /** @deprecated Maps to warning */
  | 'amber'
  | 'yellow'
  /** @deprecated Maps to danger */
  | 'red'
  | 'rose'
  /** @deprecated Maps to info */
  | 'sky'
  | 'cyan'
  | 'purple'

export type ToneClasses = {
  iconWrap: string
  icon: string
  text: string
  softBg: string
  softBorder: string
}

const TONES: Record<string, ToneClasses> = {
  brand: {
    iconWrap: 'bg-brand-500/10 border-brand-500/20',
    icon: 'text-brand-600 dark:text-brand-400',
    text: 'text-brand-700 dark:text-brand-300',
    softBg: 'bg-brand-500/10',
    softBorder: 'border-brand-500/25',
  },
  blue: {
    iconWrap: 'bg-brand-500/10 border-brand-500/20',
    icon: 'text-brand-600 dark:text-brand-400',
    text: 'text-brand-700 dark:text-brand-300',
    softBg: 'bg-brand-500/10',
    softBorder: 'border-brand-500/25',
  },
  success: {
    iconWrap: 'bg-emerald-500/10 border-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    softBg: 'bg-emerald-500/10',
    softBorder: 'border-emerald-500/25',
  },
  warning: {
    iconWrap: 'bg-amber-500/10 border-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    softBg: 'bg-amber-500/10',
    softBorder: 'border-amber-500/25',
  },
  danger: {
    iconWrap: 'bg-red-500/10 border-red-500/20',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-700 dark:text-red-300',
    softBg: 'bg-red-500/10',
    softBorder: 'border-red-500/25',
  },
  info: {
    iconWrap: 'bg-sky-500/10 border-sky-500/20',
    icon: 'text-sky-600 dark:text-sky-400',
    text: 'text-sky-700 dark:text-sky-300',
    softBg: 'bg-sky-500/10',
    softBorder: 'border-sky-500/25',
  },
  neutral: {
    iconWrap: 'bg-slate-500/10 border-slate-500/20',
    icon: 'text-slate-600 dark:text-slate-400',
    text: 'text-slate-700 dark:text-slate-300',
    softBg: 'bg-slate-500/10',
    softBorder: 'border-slate-500/25',
  },
  slate: {
    iconWrap: 'bg-slate-500/10 border-slate-500/20',
    icon: 'text-slate-600 dark:text-slate-400',
    text: 'text-slate-700 dark:text-slate-300',
    softBg: 'bg-slate-500/10',
    softBorder: 'border-slate-500/25',
  },
}

const ALIASES: Record<string, keyof typeof TONES> = {
  violet: 'brand',
  purple: 'brand',
  green: 'success',
  emerald: 'success',
  amber: 'warning',
  yellow: 'warning',
  red: 'danger',
  rose: 'danger',
  sky: 'info',
  cyan: 'info',
}

export function resolveTone(tone: AccentTone | string | undefined): ToneClasses {
  const key = tone ?? 'brand'
  const mapped = ALIASES[key] ?? (TONES[key] ? key : 'brand')
  return TONES[mapped] ?? TONES.brand
}
