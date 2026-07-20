import {
  LayoutGrid, Receipt, Users, Hash, Wallet, RotateCcw, PhoneCall,
  Package, Wrench, type LucideIcon,
} from 'lucide-react'
import type { PosNavItem } from './HexaPosLayout'
import type { PosFeatureFlags } from './types'
import { POS_THEME } from './HexaPosLayout'

export interface CategoryTab {
  id: string
  name: string
  icon: LucideIcon
}

export function buildPosNavItems(flags: Pick<PosFeatureFlags, 'hasIMEI' | 'hasFinance' | 'hasDailyReload'>): PosNavItem[] {
  const items: PosNavItem[] = [
    { id: 'products', label: 'Products', icon: LayoutGrid },
    { id: 'sales', label: 'Sales', icon: Receipt },
    { id: 'customers', label: 'Customers', icon: Users },
  ]
  if (flags.hasIMEI) items.push({ id: 'imei', label: 'IMEI / Serial', icon: Hash })
  if (flags.hasFinance) items.push({ id: 'cash', label: 'Cash In/Out', icon: Wallet })
  items.push({ id: 'returns', label: 'Returns', icon: RotateCcw })
  if (flags.hasDailyReload) items.push({ id: 'reload', label: 'Reload', icon: PhoneCall })
  return items
}

export function buildCategoryTabs(
  flags: Pick<PosFeatureFlags, 'hasServices' | 'hasDailyReload'>,
  categories: { id: string; name: string }[],
  getCategoryIcon: (name: string) => LucideIcon,
): CategoryTab[] {
  return [
    { id: 'ALL', name: 'All', icon: Package },
    ...(flags.hasServices ? [{ id: 'SERVICES', name: 'Services', icon: Wrench }] : []),
    ...(flags.hasDailyReload ? [{ id: 'RELOAD', name: 'Reload', icon: PhoneCall }] : []),
    ...categories.map(c => ({ id: c.id, name: c.name, icon: getCategoryIcon(c.name) })),
  ]
}

export interface BottomAction {
  label: string
  onClick: () => void
  bg: string
}

export function buildBottomActions(opts: {
  flags: Pick<PosFeatureFlags, 'hasDailyReload' | 'hasDailyClosing'>
  heldCount: number
  dayStarted: boolean
  dayIsClosed: boolean
  /** When set, only these action ids are shown (order preserved). */
  visibleIds?: Array<'newSale' | 'hold' | 'recent' | 'reload' | 'dayStart' | 'dayEnd' | 'cashFlow' | 'more'>
  handlers: {
    newSale: () => void
    holdSales: () => void
    recentSales: () => void
    reload: () => void
    dayStart: () => void
    dayEnd: () => void
    cashFlow: () => void
    moreMenu: () => void
  }
}): BottomAction[] {
  const { flags, heldCount, dayStarted, dayIsClosed, handlers, visibleIds } = opts

  const catalog: Record<string, BottomAction | null> = {
    newSale: { label: 'New Sale (F10)', onClick: handlers.newSale, bg: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` },
    hold: { label: 'Hold Sales (F4)', onClick: handlers.holdSales, bg: `linear-gradient(135deg, ${POS_THEME.blue}, ${POS_THEME.blueDark})` },
    recent: { label: 'Recent Sales (F5)', onClick: handlers.recentSales, bg: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` },
    reload: flags.hasDailyReload
      ? { label: 'Reload (F6)', onClick: handlers.reload, bg: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` }
      : null,
    dayStart: flags.hasDailyClosing
      ? { label: dayStarted ? 'Day Started ✓ (F7)' : 'Day Start (F7)', onClick: handlers.dayStart, bg: `linear-gradient(135deg, ${POS_THEME.green}, ${POS_THEME.greenDark})` }
      : { label: 'Opening Cash (F7)', onClick: handlers.dayStart, bg: `linear-gradient(135deg, ${POS_THEME.amber}, ${POS_THEME.amberDark})` },
    dayEnd: flags.hasDailyClosing
      ? { label: dayIsClosed ? 'Day Closed ✓ (F11)' : 'Day End (F11)', onClick: handlers.dayEnd, bg: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` }
      : null,
    cashFlow: { label: 'Cash In/Out (F8)', onClick: handlers.cashFlow, bg: POS_THEME.card },
    more: { label: heldCount > 0 ? `More (${heldCount})` : 'More', onClick: handlers.moreMenu, bg: POS_THEME.card },
  }

  const order = visibleIds?.length
    ? visibleIds
    : (['newSale', 'hold', 'recent', 'reload', 'dayStart', 'dayEnd', 'cashFlow', 'more'] as const)

  return order.map(id => catalog[id]).filter((a): a is BottomAction => !!a)
}
