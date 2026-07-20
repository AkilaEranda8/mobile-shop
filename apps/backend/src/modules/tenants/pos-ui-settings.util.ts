/**
 * Tenant POS chrome / display preferences.
 * Defaults mirror current Hexa POS behavior (ADR-004: configuration over forks).
 */

export const POS_BOTTOM_ACTION_IDS = [
  'newSale',
  'hold',
  'recent',
  'reload',
  'dayStart',
  'dayEnd',
  'cashFlow',
  'more',
] as const

export type PosBottomActionId = (typeof POS_BOTTOM_ACTION_IDS)[number]

export const POS_SHORTCUT_KEYS = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
] as const

export type PosShortcutKey = (typeof POS_SHORTCUT_KEYS)[number]

export const POS_SHORTCUT_ACTIONS = [
  'focusSearch',
  'customer',
  'payNow',
  'hold',
  'recent',
  'reload',
  'dayStart',
  'cashFlow',
  'checkout',
  'newSale',
  'dayEnd',
  'calculator',
] as const

export type PosShortcutActionId = (typeof POS_SHORTCUT_ACTIONS)[number]

export type PosUiThemeId = 'hexa-dark' | 'hexa-light' | 'studio'

export type PosUiSettings = {
  theme: PosUiThemeId
  /** Hex accent override; empty = theme default accent */
  accent: string
  density: 'comfortable' | 'compact'
  productGrid: {
    columnsDesktop: 3 | 4 | 5 | 6
    showStockBadge: boolean
    showSku: boolean
    showHotBadge: boolean
    showWarrantyBadge: boolean
  }
  layout: {
    showSidebar: boolean
    showBottomActions: boolean
    cartPosition: 'right' | 'left'
  }
  bottomActions: {
    visible: PosBottomActionId[]
  }
  shortcuts: Partial<Record<PosShortcutKey, PosShortcutActionId>>
  behavior: {
    defaultPriceMode: 'retail' | 'wholesale' | 'credit'
    confirmLeaveWithCart: boolean
    focusSearchOnOpen: boolean
  }
}

export const DEFAULT_POS_UI_SETTINGS: PosUiSettings = {
  theme: 'hexa-dark',
  accent: '',
  density: 'comfortable',
  productGrid: {
    columnsDesktop: 5,
    showStockBadge: true,
    showSku: true,
    showHotBadge: true,
    showWarrantyBadge: true,
  },
  layout: {
    showSidebar: true,
    showBottomActions: true,
    cartPosition: 'right',
  },
  bottomActions: {
    visible: [...POS_BOTTOM_ACTION_IDS],
  },
  shortcuts: {
    F1: 'focusSearch',
    F2: 'customer',
    F3: 'payNow',
    F4: 'hold',
    F5: 'recent',
    F6: 'reload',
    F7: 'dayStart',
    F8: 'cashFlow',
    F9: 'checkout',
    F10: 'newSale',
    F11: 'dayEnd',
    F12: 'calculator',
  },
  behavior: {
    defaultPriceMode: 'retail',
    confirmLeaveWithCart: true,
    focusSearchOnOpen: true,
  },
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}
}

function clampColumns(n: unknown): 3 | 4 | 5 | 6 {
  const v = Number(n)
  if (v === 3 || v === 4 || v === 5 || v === 6) return v
  return DEFAULT_POS_UI_SETTINGS.productGrid.columnsDesktop
}

function normalizeAccent(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.trim()
  if (!s) return ''
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) return s
  return ''
}

function normalizeVisibleActions(raw: unknown): PosBottomActionId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_POS_UI_SETTINGS.bottomActions.visible]
  const allowed = new Set<string>(POS_BOTTOM_ACTION_IDS)
  const out: PosBottomActionId[] = []
  const seen = new Set<string>()
  for (const id of raw) {
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id as PosBottomActionId)
  }
  if (!out.includes('newSale')) out.unshift('newSale')
  return out.length ? out : [...DEFAULT_POS_UI_SETTINGS.bottomActions.visible]
}

function normalizeShortcuts(raw: unknown): PosUiSettings['shortcuts'] {
  const base = { ...DEFAULT_POS_UI_SETTINGS.shortcuts }
  if (!raw || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>
  const actionSet = new Set<string>(POS_SHORTCUT_ACTIONS)
  for (const key of POS_SHORTCUT_KEYS) {
    const v = src[key]
    if (typeof v === 'string' && actionSet.has(v)) {
      base[key] = v as PosShortcutActionId
    }
  }
  return base
}

export function normalizePosUiSettings(raw: unknown): PosUiSettings {
  const src = asRecord(raw)
  const grid = asRecord(src.productGrid)
  const layout = asRecord(src.layout)
  const bottom = asRecord(src.bottomActions)
  const behavior = asRecord(src.behavior)

  const theme: PosUiThemeId =
    src.theme === 'hexa-light' ? 'hexa-light'
    : src.theme === 'studio' ? 'studio'
    : 'hexa-dark'
  const density = src.density === 'compact' ? 'compact' : 'comfortable'
  const cartPosition = layout.cartPosition === 'left' ? 'left' : 'right'
  const priceMode =
    behavior.defaultPriceMode === 'wholesale' || behavior.defaultPriceMode === 'credit'
      ? behavior.defaultPriceMode
      : 'retail'

  return {
    theme,
    accent: normalizeAccent(src.accent),
    density,
    productGrid: {
      columnsDesktop: clampColumns(grid.columnsDesktop),
      showStockBadge: grid.showStockBadge !== false,
      showSku: grid.showSku !== false,
      showHotBadge: grid.showHotBadge !== false,
      showWarrantyBadge: grid.showWarrantyBadge !== false,
    },
    layout: {
      showSidebar: layout.showSidebar !== false,
      showBottomActions: layout.showBottomActions !== false,
      cartPosition,
    },
    bottomActions: {
      visible: normalizeVisibleActions(bottom.visible),
    },
    shortcuts: normalizeShortcuts(src.shortcuts),
    behavior: {
      defaultPriceMode: priceMode,
      confirmLeaveWithCart: behavior.confirmLeaveWithCart !== false,
      focusSearchOnOpen: behavior.focusSearchOnOpen !== false,
    },
  }
}
