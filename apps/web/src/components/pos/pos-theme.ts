/** Shared POS chrome color tokens (Hexa + Studio + Nova skins). */

export type PosThemeId = 'hexa-dark' | 'hexa-light' | 'studio' | 'nova'

export type PosThemeTokens = {
  bg: string
  panel: string
  card: string
  cardHover: string
  border: string
  muted: string
  text: string
  purple: string
  purpleDark: string
  green: string
  greenDark: string
  blue: string
  blueDark: string
  amber: string
  amberDark: string
  red: string
  redDark: string
  teal: string
  tealDark: string
}

const HEXA_DARK: PosThemeTokens = {
  bg: '#0B0E14',
  panel: '#0B0E14',
  card: '#161B22',
  cardHover: '#1c2333',
  border: '#2a3344',
  muted: '#9CA3AF',
  text: '#FFFFFF',
  /* primary accent slot (legacy name; blue — no purple chrome) */
  purple: '#3B82F6',
  purpleDark: '#2563EB',
  green: '#10B981',
  greenDark: '#059669',
  blue: '#3B82F6',
  blueDark: '#2563EB',
  amber: '#F59E0B',
  amberDark: '#D97706',
  red: '#EF4444',
  redDark: '#DC2626',
  teal: '#0D9488',
  tealDark: '#047857',
}

const HEXA_LIGHT: PosThemeTokens = {
  bg: '#F4F6FA',
  panel: '#EEF1F7',
  card: '#FFFFFF',
  cardHover: '#F8FAFC',
  border: '#D8DEE9',
  muted: '#64748B',
  text: '#0F172A',
  purple: '#2563EB',
  purpleDark: '#1D4ED8',
  green: '#059669',
  greenDark: '#047857',
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  /* Light POS: no yellow — sky for warnings / attention */
  amber: '#0284C7',
  amberDark: '#0369A1',
  red: '#DC2626',
  redDark: '#B91C1C',
  teal: '#0F766E',
  tealDark: '#115E59',
}

/** Cool ink + teal — distinct from Hexa blue rail chrome. */
const STUDIO: PosThemeTokens = {
  bg: '#081012',
  panel: '#0C1618',
  card: '#122022',
  cardHover: '#173033',
  border: '#2A3F44',
  muted: '#8BA8AE',
  text: '#F3FAFB',
  purple: '#14B8A6',
  purpleDark: '#0F766E',
  green: '#34D399',
  greenDark: '#059669',
  blue: '#38BDF8',
  blueDark: '#0284C7',
  amber: '#FBBF24',
  amberDark: '#D97706',
  red: '#F87171',
  redDark: '#DC2626',
  teal: '#2DD4BF',
  tealDark: '#0F766E',
}

/** Top-bar counter template — 2026 premium retail terminal. */
const NOVA: PosThemeTokens = {
  bg: '#080B12',
  panel: '#0D1119',
  card: '#141A24',
  cardHover: '#1A2230',
  border: '#1E2633',
  muted: '#94A3B8',
  text: '#F8FAFC',
  /* primary accent slot (legacy name) */
  purple: '#3B82F6',
  purpleDark: '#2563EB',
  green: '#22C55E',
  greenDark: '#16A34A',
  blue: '#3B82F6',
  blueDark: '#2563EB',
  amber: '#F59E0B',
  amberDark: '#D97706',
  red: '#EF4444',
  redDark: '#DC2626',
  teal: '#0D9488',
  tealDark: '#0F766E',
}

function isHexAccent(v?: string): v is string {
  return !!v && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)
}

/** Legacy Hexa purple accents — ignore so Nova/Hexa blue skins stay blue. */
const LEGACY_PURPLE_ACCENTS = new Set([
  '#7C3AED', '#6D28D9', '#5B21B6', '#8B5CF6', '#A855F7', '#7C3AEDFF',
].map((s) => s.toUpperCase()))

export function resolvePosTheme(theme?: PosThemeId | string, accent?: string): PosThemeTokens {
  const base =
    theme === 'studio' ? STUDIO
    : theme === 'nova' ? NOVA
    : theme === 'hexa-light' ? HEXA_LIGHT
    : HEXA_DARK

  if (!isHexAccent(accent) || LEGACY_PURPLE_ACCENTS.has(accent.toUpperCase())) {
    return { ...base }
  }
  return {
    ...base,
    purple: accent,
    purpleDark: accent,
    ...(theme === 'nova' ? { blue: accent, blueDark: accent } : {}),
  }
}

/** Mutable default tokens — POSOverlay syncs active skin here so shared helpers stay in sync. */
export const POS_THEME: PosThemeTokens = { ...HEXA_DARK }

export function syncPosThemeRuntime(theme?: PosThemeId | string, accent?: string): PosThemeTokens {
  const next = resolvePosTheme(theme, accent)
  // App light mode: never surface yellow/amber — use sky for attention states.
  if (typeof document !== 'undefined' && !document.documentElement.classList.contains('dark')) {
    next.amber = '#0284C7'
    next.amberDark = '#0369A1'
  }
  Object.assign(POS_THEME, next)
  return next
}