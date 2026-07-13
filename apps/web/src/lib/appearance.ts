export const APPEARANCE_KEY = 'hx_appearance'
export const THEME_STORAGE_KEY = 'hexalyte-theme'

export type AccentKey = 'violet' | 'blue' | 'cyan' | 'emerald' | 'rose' | 'orange'

export interface AccentPalette {
  primary: string
  light: string
  glow: string
  glowDark: string
  borderActive: string
  primaryHover: string
  primaryLight: string
  sidebarActiveBg: string
  sidebarActiveBgDark: string
  sidebarActiveText: string
  sidebarActiveTextDark: string
  sidebarActiveBorder: string
  sidebarActiveBorderDark: string
  gradientFrom: string
  gradientTo: string
  kpiGradient: string
  secondaryHoverBg: string
}

export const ACCENT_PALETTES: Record<AccentKey, AccentPalette> = {
  violet: {
    primary: '#7c3aed',
    light: '#8b5cf6',
    glow: 'rgba(124,58,237,0.15)',
    glowDark: 'rgba(124,58,237,0.30)',
    borderActive: '#7c3aed',
    primaryHover: '#5b21b6',
    primaryLight: '#6d28d9',
    sidebarActiveBg: 'rgba(109,40,217,0.16)',
    sidebarActiveBgDark: 'rgba(109,40,217,0.20)',
    sidebarActiveText: '#6d28d9',
    sidebarActiveTextDark: '#c4b5fd',
    sidebarActiveBorder: 'rgba(109,40,217,0.42)',
    sidebarActiveBorderDark: 'rgba(109,40,217,0.30)',
    gradientFrom: '#7c3aed',
    gradientTo: '#4f46e5',
    kpiGradient: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    secondaryHoverBg: '#f5f3ff',
  },
  blue: {
    primary: '#2563eb',
    light: '#3b82f6',
    glow: 'rgba(37,99,235,0.15)',
    glowDark: 'rgba(37,99,235,0.30)',
    borderActive: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#1d4ed8',
    sidebarActiveBg: 'rgba(37,99,235,0.14)',
    sidebarActiveBgDark: 'rgba(37,99,235,0.20)',
    sidebarActiveText: '#1d4ed8',
    sidebarActiveTextDark: '#93c5fd',
    sidebarActiveBorder: 'rgba(37,99,235,0.40)',
    sidebarActiveBorderDark: 'rgba(37,99,235,0.30)',
    gradientFrom: '#2563eb',
    gradientTo: '#1d4ed8',
    kpiGradient: 'linear-gradient(90deg, #2563eb, #60a5fa)',
    secondaryHoverBg: '#eff6ff',
  },
  cyan: {
    primary: '#0891b2',
    light: '#06b6d4',
    glow: 'rgba(8,145,178,0.15)',
    glowDark: 'rgba(8,145,178,0.30)',
    borderActive: '#0891b2',
    primaryHover: '#0e7490',
    primaryLight: '#0e7490',
    sidebarActiveBg: 'rgba(8,145,178,0.14)',
    sidebarActiveBgDark: 'rgba(8,145,178,0.20)',
    sidebarActiveText: '#0e7490',
    sidebarActiveTextDark: '#67e8f9',
    sidebarActiveBorder: 'rgba(8,145,178,0.40)',
    sidebarActiveBorderDark: 'rgba(8,145,178,0.30)',
    gradientFrom: '#0891b2',
    gradientTo: '#06b6d4',
    kpiGradient: 'linear-gradient(90deg, #0891b2, #22d3ee)',
    secondaryHoverBg: '#ecfeff',
  },
  emerald: {
    primary: '#059669',
    light: '#10b981',
    glow: 'rgba(5,150,105,0.15)',
    glowDark: 'rgba(5,150,105,0.30)',
    borderActive: '#059669',
    primaryHover: '#047857',
    primaryLight: '#047857',
    sidebarActiveBg: 'rgba(5,150,105,0.14)',
    sidebarActiveBgDark: 'rgba(5,150,105,0.20)',
    sidebarActiveText: '#047857',
    sidebarActiveTextDark: '#6ee7b7',
    sidebarActiveBorder: 'rgba(5,150,105,0.40)',
    sidebarActiveBorderDark: 'rgba(5,150,105,0.30)',
    gradientFrom: '#059669',
    gradientTo: '#10b981',
    kpiGradient: 'linear-gradient(90deg, #059669, #34d399)',
    secondaryHoverBg: '#ecfdf5',
  },
  rose: {
    primary: '#e11d48',
    light: '#f43f5e',
    glow: 'rgba(225,29,72,0.15)',
    glowDark: 'rgba(225,29,72,0.30)',
    borderActive: '#e11d48',
    primaryHover: '#be123c',
    primaryLight: '#be123c',
    sidebarActiveBg: 'rgba(225,29,72,0.14)',
    sidebarActiveBgDark: 'rgba(225,29,72,0.20)',
    sidebarActiveText: '#be123c',
    sidebarActiveTextDark: '#fda4af',
    sidebarActiveBorder: 'rgba(225,29,72,0.40)',
    sidebarActiveBorderDark: 'rgba(225,29,72,0.30)',
    gradientFrom: '#e11d48',
    gradientTo: '#f43f5e',
    kpiGradient: 'linear-gradient(90deg, #e11d48, #fb7185)',
    secondaryHoverBg: '#fff1f2',
  },
  orange: {
    primary: '#ea580c',
    light: '#f97316',
    glow: 'rgba(234,88,12,0.15)',
    glowDark: 'rgba(234,88,12,0.30)',
    borderActive: '#ea580c',
    primaryHover: '#c2410c',
    primaryLight: '#c2410c',
    sidebarActiveBg: 'rgba(234,88,12,0.14)',
    sidebarActiveBgDark: 'rgba(234,88,12,0.20)',
    sidebarActiveText: '#c2410c',
    sidebarActiveTextDark: '#fdba74',
    sidebarActiveBorder: 'rgba(234,88,12,0.40)',
    sidebarActiveBorderDark: 'rgba(234,88,12,0.30)',
    gradientFrom: '#ea580c',
    gradientTo: '#f97316',
    kpiGradient: 'linear-gradient(90deg, #ea580c, #fb923c)',
    secondaryHoverBg: '#fff7ed',
  },
}

export const DEFAULT_ACCENT: AccentKey = 'blue'

export type TextSizeKey = 'sm' | 'md' | 'lg' | 'xl'

export const TEXT_SIZE_SCALE: Record<TextSizeKey, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.12,
  xl: 1.25,
}

export const TEXT_SIZE_OPTIONS: { key: TextSizeKey; label: string; hint: string }[] = [
  { key: 'sm', label: 'Small', hint: '90%' },
  { key: 'md', label: 'Default', hint: '100%' },
  { key: 'lg', label: 'Large', hint: '112%' },
  { key: 'xl', label: 'Extra Large', hint: '125%' },
]

/** Curated Google Fonts for system UI */
export type UiFontKey =
  | 'inter'
  | 'roboto'
  | 'open-sans'
  | 'lato'
  | 'poppins'
  | 'nunito'
  | 'source-sans'
  | 'dm-sans'
  | 'manrope'
  | 'rubik'
  | 'ibm-plex'
  | 'noto-sans'

export interface UiFontOption {
  key: UiFontKey
  label: string
  /** CSS font-family value */
  family: string
  /** Google Fonts CSS2 family query segment (empty = system stack only) */
  googleFamily: string
}

export const UI_FONT_OPTIONS: UiFontOption[] = [
  { key: 'inter', label: 'Inter', family: "'Inter', system-ui, sans-serif", googleFamily: 'Inter:wght@300;400;500;600;700;800;900' },
  { key: 'roboto', label: 'Roboto', family: "'Roboto', system-ui, sans-serif", googleFamily: 'Roboto:wght@300;400;500;700' },
  { key: 'open-sans', label: 'Open Sans', family: "'Open Sans', system-ui, sans-serif", googleFamily: 'Open+Sans:wght@300;400;500;600;700;800' },
  { key: 'lato', label: 'Lato', family: "'Lato', system-ui, sans-serif", googleFamily: 'Lato:wght@300;400;700;900' },
  { key: 'poppins', label: 'Poppins', family: "'Poppins', system-ui, sans-serif", googleFamily: 'Poppins:wght@300;400;500;600;700;800' },
  { key: 'nunito', label: 'Nunito', family: "'Nunito', system-ui, sans-serif", googleFamily: 'Nunito:wght@300;400;500;600;700;800' },
  { key: 'source-sans', label: 'Source Sans 3', family: "'Source Sans 3', system-ui, sans-serif", googleFamily: 'Source+Sans+3:wght@300;400;500;600;700' },
  { key: 'dm-sans', label: 'DM Sans', family: "'DM Sans', system-ui, sans-serif", googleFamily: 'DM+Sans:wght@300;400;500;600;700' },
  { key: 'manrope', label: 'Manrope', family: "'Manrope', system-ui, sans-serif", googleFamily: 'Manrope:wght@300;400;500;600;700;800' },
  { key: 'rubik', label: 'Rubik', family: "'Rubik', system-ui, sans-serif", googleFamily: 'Rubik:wght@300;400;500;600;700' },
  { key: 'ibm-plex', label: 'IBM Plex Sans', family: "'IBM Plex Sans', system-ui, sans-serif", googleFamily: 'IBM+Plex+Sans:wght@300;400;500;600;700' },
  { key: 'noto-sans', label: 'Noto Sans', family: "'Noto Sans', system-ui, sans-serif", googleFamily: 'Noto+Sans:wght@300;400;500;600;700' },
]

export const UI_FONT_MAP: Record<UiFontKey, UiFontOption> = Object.fromEntries(
  UI_FONT_OPTIONS.map(f => [f.key, f]),
) as Record<UiFontKey, UiFontOption>

const GOOGLE_FONT_LINK_ID = 'hx-google-ui-font'

export function googleFontsHref(googleFamily: string): string {
  return `https://fonts.googleapis.com/css2?family=${googleFamily}&display=swap`
}

export interface AppearanceSettings {
  accent: AccentKey
  textSize: TextSizeKey
  uiFont: UiFontKey
  compactMode: boolean
  animations: boolean
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  accent: DEFAULT_ACCENT,
  textSize: 'lg',
  uiFont: 'inter',
  compactMode: false,
  animations: true,
}

export function isAccentKey(value: unknown): value is AccentKey {
  return typeof value === 'string' && value in ACCENT_PALETTES
}

export function isTextSizeKey(value: unknown): value is TextSizeKey {
  return typeof value === 'string' && value in TEXT_SIZE_SCALE
}

export function isUiFontKey(value: unknown): value is UiFontKey {
  return typeof value === 'string' && value in UI_FONT_MAP
}

export function getStoredAppearance(): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>
    return {
      ...DEFAULT_APPEARANCE,
      ...parsed,
      accent: isAccentKey(parsed.accent) ? parsed.accent : DEFAULT_ACCENT,
      textSize: isTextSizeKey(parsed.textSize) ? parsed.textSize : DEFAULT_APPEARANCE.textSize,
      uiFont: isUiFontKey(parsed.uiFont) ? parsed.uiFont : DEFAULT_APPEARANCE.uiFont,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function isDocumentDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export function applyAccentToDocument(accent: AccentKey, forceDark?: boolean) {
  if (typeof document === 'undefined') return
  const palette = ACCENT_PALETTES[accent]
  const root = document.documentElement
  const isDark = forceDark ?? root.classList.contains('dark')

  root.dataset.accent = accent
  root.style.setProperty('--brand-primary', palette.primary)
  root.style.setProperty('--brand-light', palette.light)
  root.style.setProperty('--brand-glow', isDark ? palette.glowDark : palette.glow)
  root.style.setProperty('--border-active', palette.borderActive)
  root.style.setProperty('--brand-hover', palette.primaryHover)
  root.style.setProperty('--brand-primary-light', isDark ? palette.light : palette.primaryLight)
  root.style.setProperty('--sidebar-active-bg', isDark ? palette.sidebarActiveBgDark : palette.sidebarActiveBg)
  root.style.setProperty('--sidebar-active-text', isDark ? palette.sidebarActiveTextDark : palette.sidebarActiveText)
  root.style.setProperty('--sidebar-active-border', isDark ? palette.sidebarActiveBorderDark : palette.sidebarActiveBorder)
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${palette.gradientFrom}, ${palette.gradientTo})`)
  root.style.setProperty('--kpi-accent', palette.kpiGradient)
  root.style.setProperty(
    '--secondary-hover-bg',
    isDark ? `color-mix(in srgb, ${palette.primary} 14%, transparent)` : palette.secondaryHoverBg,
  )

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', palette.primary)
}

export function applyTextSizeToDocument(textSize: TextSizeKey) {
  if (typeof document === 'undefined') return
  const scale = TEXT_SIZE_SCALE[textSize] ?? 1
  const root = document.documentElement
  root.dataset.textSize = textSize
  root.style.setProperty('--ui-scale', String(scale))
  root.style.fontSize = `${16 * scale}px`
}

export function ensureAllUiFontsLoaded() {
  if (typeof document === 'undefined') return
  const id = 'hx-google-ui-font-all'
  if (document.getElementById(id)) return
  const families = UI_FONT_OPTIONS.map(f => `family=${f.googleFamily}`).join('&')
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  document.head.appendChild(link)
}

export function applyUiFontToDocument(uiFont: UiFontKey) {
  if (typeof document === 'undefined') return
  const font = UI_FONT_MAP[uiFont] ?? UI_FONT_MAP.inter
  const root = document.documentElement
  root.dataset.uiFont = font.key
  root.style.setProperty('--font-sans', font.family)
  root.style.fontFamily = font.family

  if (font.googleFamily) {
    let link = document.getElementById(GOOGLE_FONT_LINK_ID) as HTMLLinkElement | null
    const href = googleFontsHref(font.googleFamily)
    if (!link) {
      link = document.createElement('link')
      link.id = GOOGLE_FONT_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }
}

export function applyAppearanceToDocument(settings: AppearanceSettings = getStoredAppearance()) {
  applyAccentToDocument(settings.accent)
  applyTextSizeToDocument(settings.textSize)
  applyUiFontToDocument(settings.uiFont)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.compact = settings.compactMode ? 'true' : 'false'
    document.documentElement.dataset.animations = settings.animations ? 'true' : 'false'
  }
}

export function saveAppearance(settings: AppearanceSettings) {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings))
  applyAppearanceToDocument(settings)
}

/**
 * Blocking first-paint script: syncs theme class + accent + text scale + Google font
 */
export const APPEARANCE_INIT_SCRIPT = `(function(){try{var tk='${THEME_STORAGE_KEY}';var k='${APPEARANCE_KEY}';var d=${JSON.stringify(ACCENT_PALETTES)};var scales=${JSON.stringify(TEXT_SIZE_SCALE)};var fonts=${JSON.stringify(UI_FONT_OPTIONS)};var a='${DEFAULT_ACCENT}';var ts='${DEFAULT_APPEARANCE.textSize}';var uf='${DEFAULT_APPEARANCE.uiFont}';var r=document.documentElement;var t=localStorage.getItem(tk);var dark=t==='dark';if(dark)r.classList.add('dark');else r.classList.remove('dark');var s=localStorage.getItem(k);if(s){var p=JSON.parse(s);if(p&&p.accent&&d[p.accent])a=p.accent;if(p&&p.textSize&&scales[p.textSize])ts=p.textSize;if(p&&p.uiFont){for(var i=0;i<fonts.length;i++){if(fonts[i].key===p.uiFont){uf=p.uiFont;break;}}}if(p){r.dataset.compact=p.compactMode?'true':'false';r.dataset.animations=p.animations===false?'false':'true';}}var c=d[a];var sc=scales[ts]||1;var font=fonts[0];for(var j=0;j<fonts.length;j++){if(fonts[j].key===uf){font=fonts[j];break;}}r.dataset.accent=a;r.dataset.textSize=ts;r.dataset.uiFont=font.key;r.style.setProperty('--ui-scale',String(sc));r.style.fontSize=(16*sc)+'px';r.style.setProperty('--font-sans',font.family);r.style.fontFamily=font.family;if(font.googleFamily){var link=document.getElementById('${GOOGLE_FONT_LINK_ID}');if(!link){link=document.createElement('link');link.id='${GOOGLE_FONT_LINK_ID}';link.rel='stylesheet';document.head.appendChild(link);}link.href='https://fonts.googleapis.com/css2?family='+font.googleFamily+'&display=swap';}r.style.setProperty('--brand-primary',c.primary);r.style.setProperty('--brand-light',c.light);r.style.setProperty('--brand-glow',dark?c.glowDark:c.glow);r.style.setProperty('--border-active',c.borderActive);r.style.setProperty('--brand-hover',c.primaryHover);r.style.setProperty('--brand-primary-light',dark?c.light:c.primaryLight);r.style.setProperty('--sidebar-active-bg',dark?c.sidebarActiveBgDark:c.sidebarActiveBg);r.style.setProperty('--sidebar-active-text',dark?c.sidebarActiveTextDark:c.sidebarActiveText);r.style.setProperty('--sidebar-active-border',dark?c.sidebarActiveBorderDark:c.sidebarActiveBorder);r.style.setProperty('--brand-gradient','linear-gradient(135deg,'+c.gradientFrom+','+c.gradientTo+')');r.style.setProperty('--kpi-accent',c.kpiGradient);r.style.setProperty('--secondary-hover-bg',dark?('color-mix(in srgb,'+c.primary+' 14%,transparent)'):c.secondaryHoverBg);}catch(e){}})();`
