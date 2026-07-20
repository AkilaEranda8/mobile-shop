import { useEffect, useState } from 'react'
import { tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'

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

export const POS_BOTTOM_ACTION_LABELS: Record<PosBottomActionId, string> = {
  newSale: 'New Sale',
  hold: 'Hold Sales',
  recent: 'Recent Sales',
  reload: 'Reload',
  dayStart: 'Day Start',
  dayEnd: 'Day End',
  cashFlow: 'Cash In/Out',
  more: 'More',
}

export const POS_SHORTCUT_ACTION_LABELS: Record<PosShortcutActionId, string> = {
  focusSearch: 'Focus search',
  customer: 'Customer picker',
  payNow: 'Pay now',
  hold: 'Hold sales',
  recent: 'Recent sales',
  reload: 'Reload',
  dayStart: 'Day start',
  cashFlow: 'Cash in/out',
  checkout: 'Checkout',
  newSale: 'New sale',
  dayEnd: 'Day end',
  calculator: 'Calculator',
}

/** Map F-key → action using tenant shortcuts (falls back to defaults). */
export function resolvePosShortcutAction(
  key: string,
  settings: PosUiSettings,
): PosShortcutActionId | null {
  const k = key.toUpperCase() as PosShortcutKey
  if (!POS_SHORTCUT_KEYS.includes(k as PosShortcutKey)) return null
  return (
    settings.shortcuts[k] ??
    DEFAULT_POS_UI_SETTINGS.shortcuts[k] ??
    null
  )
}

export function gridColsClass(columns: 3 | 4 | 5 | 6): string {
  switch (columns) {
    case 3: return 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-2 sm:gap-2.5'
    case 4: return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-2 sm:gap-2.5'
    case 6: return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-2 sm:gap-2.5'
    default: return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5'
  }
}

function coerce(raw: unknown): PosUiSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_POS_UI_SETTINGS, productGrid: { ...DEFAULT_POS_UI_SETTINGS.productGrid }, layout: { ...DEFAULT_POS_UI_SETTINGS.layout }, bottomActions: { visible: [...DEFAULT_POS_UI_SETTINGS.bottomActions.visible] }, shortcuts: { ...DEFAULT_POS_UI_SETTINGS.shortcuts }, behavior: { ...DEFAULT_POS_UI_SETTINGS.behavior } }
  const s = raw as Partial<PosUiSettings>
  const theme: PosUiThemeId =
    s.theme === 'hexa-light' ? 'hexa-light'
    : s.theme === 'studio' ? 'studio'
    : 'hexa-dark'
  return {
    ...DEFAULT_POS_UI_SETTINGS,
    ...s,
    theme,
    productGrid: { ...DEFAULT_POS_UI_SETTINGS.productGrid, ...(s.productGrid ?? {}) },
    layout: { ...DEFAULT_POS_UI_SETTINGS.layout, ...(s.layout ?? {}) },
    bottomActions: {
      visible: Array.isArray(s.bottomActions?.visible)
        ? (s.bottomActions!.visible as PosBottomActionId[])
        : [...DEFAULT_POS_UI_SETTINGS.bottomActions.visible],
    },
    shortcuts: { ...DEFAULT_POS_UI_SETTINGS.shortcuts, ...(s.shortcuts ?? {}) },
    behavior: { ...DEFAULT_POS_UI_SETTINGS.behavior, ...(s.behavior ?? {}) },
  }
}

export async function fetchPosUiSettings(): Promise<PosUiSettings> {
  const tenantId = authStorage.getUser()?.tenantId
  if (!tenantId) return coerce(null)
  try {
    const res: any = await tenantApi.getPosUiSettings(tenantId)
    return coerce(res?.data ?? res)
  } catch {
    return coerce(null)
  }
}

export async function pushPosUiSettings(settings: PosUiSettings): Promise<PosUiSettings> {
  const tenantId = authStorage.getUser()?.tenantId
  if (!tenantId) return coerce(settings)
  const res: any = await tenantApi.updatePosUiSettings(tenantId, settings)
  return coerce(res?.data ?? res)
}

export function usePosUiSettings(): PosUiSettings {
  const [settings, setSettings] = useState<PosUiSettings>(() => coerce(null))
  useEffect(() => {
    let alive = true
    fetchPosUiSettings().then(s => { if (alive) setSettings(s) })
    return () => { alive = false }
  }, [])
  return settings
}
