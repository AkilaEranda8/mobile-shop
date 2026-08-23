/** Shop Quest — mission definitions, XP, and localStorage persistence. */

export type QuestUnlockId =
  | 'sidebar'
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'repairs'
  | 'branch'
  | 'settings'

export type QuestMissionCode =
  | 'map'
  | 'hq'
  | 'sell'
  | 'stock'
  | 'fix'
  | 'branch'
  | 'setup'

export type QuestPersistStatus = 'done' | 'skipped'

export type QuestSaved = {
  status: QuestPersistStatus
  xp?: number
  unlocked?: QuestUnlockId[]
  completedAt?: string
}

export type QuestMission = {
  code: QuestMissionCode
  unlock: QuestUnlockId
  spotlight: string
  xp: number
  title: string
  objective: string
  description: string
  tipSi: string
  unlockLabel: string
  unlockBlurb: string
  icon: 'map' | 'dashboard' | 'cart' | 'package' | 'wrench' | 'branch' | 'settings'
}

export const ALL_UNLOCK_IDS: QuestUnlockId[] = [
  'sidebar',
  'dashboard',
  'pos',
  'inventory',
  'repairs',
  'branch',
  'settings',
]

/** Unlock ids open when the quest starts (dashboard only — rest unlock by mission). */
export const INITIAL_UNLOCKS: QuestUnlockId[] = ['dashboard']

export const QUEST_MISSIONS: QuestMission[] = [
  {
    code: 'map',
    unlock: 'sidebar',
    spotlight: '[data-tour="sidebar"]',
    xp: 40,
    title: 'MAP',
    objective: 'Learn your shop map',
    description: 'The sidebar is your map — every module lives here. Scroll and open what you need.',
    tipSi: 'සිංහල tip: මෙනුවෙන් shop එකේ සියලුම කොටස් වෙත යන්න.',
    unlockLabel: 'Sidebar Unlocked',
    unlockBlurb: 'You can navigate using the sidebar menu.',
    icon: 'map',
  },
  {
    code: 'hq',
    unlock: 'dashboard',
    spotlight: '[data-tour="nav-dashboard"]',
    xp: 40,
    title: 'HQ',
    objective: 'Check your daily pulse',
    description: 'Dashboard shows sales, repairs, stock alerts and today’s performance at a glance.',
    tipSi: 'සිංහල tip: දිනයේ sales සහ alerts Dashboard එකෙන් බලන්න.',
    unlockLabel: 'Dashboard Unlocked',
    unlockBlurb: 'Your HQ overview is ready.',
    icon: 'dashboard',
  },
  {
    code: 'sell',
    unlock: 'pos',
    spotlight: '[data-tour="nav-pos"]',
    xp: 60,
    title: 'SELL',
    objective: 'Make your first sale',
    description: 'POS is where you create, manage and complete sales for your customers.',
    tipSi: 'සිංහල tip: පළමු විකිණීම POS එකෙන් ආරම්භ කරන්න.',
    unlockLabel: 'POS Unlocked',
    unlockBlurb: 'You can now access POS from the menu.',
    icon: 'cart',
  },
  {
    code: 'stock',
    unlock: 'inventory',
    spotlight: '[data-tour="nav-inventory"]',
    xp: 60,
    title: 'STOCK',
    objective: 'Add products to inventory',
    description: 'Inventory holds phones, parts and accessories — add stock before you sell.',
    tipSi: 'සිංහල tip: විකුණන්න කලින් Inventory එකට products එකතු කරන්න.',
    unlockLabel: 'Inventory Unlocked',
    unlockBlurb: 'Manage products and stock from Inventory.',
    icon: 'package',
  },
  {
    code: 'fix',
    unlock: 'repairs',
    spotlight: '[data-tour="nav-repairs"]',
    xp: 50,
    title: 'FIX',
    objective: 'Open a repair ticket',
    description: 'Repair Jobs track devices in for service — from receive to delivery.',
    tipSi: 'සිංහල tip: Repair ticket එකක් open කර device track කරන්න.',
    unlockLabel: 'Repairs Unlocked',
    unlockBlurb: 'Create and manage repair tickets.',
    icon: 'wrench',
  },
  {
    code: 'branch',
    unlock: 'branch',
    spotlight: '[data-tour="header-branch"]',
    xp: 40,
    title: 'BRANCH',
    objective: 'Know your active branch',
    description: 'Branch control sets which store’s stock and sales you are working on.',
    tipSi: 'සිංහල tip: Header එකේ branch එක select කර නිවැරදි shop එකේ වැඩ කරන්න.',
    unlockLabel: 'Branch Control Unlocked',
    unlockBlurb: 'Switch branches from the header.',
    icon: 'branch',
  },
  {
    code: 'setup',
    unlock: 'settings',
    spotlight: '[data-tour="nav-settings"]',
    xp: 60,
    title: 'SETUP',
    objective: 'Finish shop setup',
    description: 'Settings holds shop info, invoice layout, features and staff permissions.',
    tipSi: 'සිංහල tip: Shop Info සහ Invoice Settings complete කරන්න.',
    unlockLabel: 'Settings Unlocked',
    unlockBlurb: 'Configure your shop from Settings.',
    icon: 'settings',
  },
]

export const QUEST_VICTORY_XP = 50

export const QUEST_TOTAL_XP =
  QUEST_MISSIONS.reduce((s, m) => s + m.xp, 0) + QUEST_VICTORY_XP

export function questLevelLabel(xp: number): string {
  if (xp >= QUEST_TOTAL_XP) return 'Owner Ready'
  if (xp >= 250) return 'Shop Pro'
  if (xp >= 100) return 'Cashier'
  return 'Rookie'
}

function storageKey(userId: string) {
  return `hexalyte_shop_quest_v1_${userId}`
}

export function getQuestSaved(userId: string | undefined | null): QuestSaved | null {
  if (!userId || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuestSaved
    if (parsed?.status === 'done' || parsed?.status === 'skipped') return parsed
    return null
  } catch {
    return null
  }
}

export function saveQuest(userId: string, data: QuestSaved) {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(data))
}

export function clearQuestSaved(userId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(storageKey(userId))
}

/** Missions whose spotlight element exists in the DOM (feature-gated skip). */
export function visibleMissions(): QuestMission[] {
  if (typeof document === 'undefined') return QUEST_MISSIONS
  return QUEST_MISSIONS.filter((m) => {
    if (m.code === 'map') return true
    return !!document.querySelector(m.spotlight)
  })
}

export function xpUpToMission(missions: QuestMission[], index: number): number {
  return missions.slice(0, Math.max(0, index)).reduce((s, m) => s + m.xp, 0)
}

export const QUEST_REPLAY_EVENT = 'hexalyte-shop-quest-replay'
export const QUEST_SKIP_EVENT = 'hexalyte-shop-quest-skip'

export function replayShopQuestFromUi() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(QUEST_REPLAY_EVENT))
}

export function skipShopQuestFromUi() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(QUEST_SKIP_EVENT))
}
