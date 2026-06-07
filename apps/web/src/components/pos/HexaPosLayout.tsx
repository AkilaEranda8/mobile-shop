'use client'

import React from 'react'
import {
  ShoppingCart, ScanLine, Bell, X, Smartphone, Headphones, Tablet,
  Laptop, Watch, Package, LayoutGrid, Receipt, Users, Hash,
  Wallet, RotateCcw, Settings, Phone,
  SlidersHorizontal, type LucideIcon,
} from 'lucide-react'

const C = {
  bg: '#0B0E14',
  panel: '#0B0E14',
  card: '#161B22',
  cardHover: '#1c2333',
  border: '#2a3344',
  muted: '#9CA3AF',
  text: '#FFFFFF',
  purple: '#7C3AED',
  purpleDark: '#6D28D9',
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

export function categoryIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('phone') || n.includes('mobile') || n.includes('smart')) return Smartphone
  if (n.includes('accessor') || n.includes('audio') || n.includes('head')) return Headphones
  if (n.includes('tablet')) return Tablet
  if (n.includes('laptop')) return Laptop
  if (n.includes('watch')) return Watch
  return Package
}

const NAV_ITEMS = [
  { id: 'products', label: 'Products', icon: LayoutGrid },
  { id: 'sales', label: 'Sales', icon: Receipt },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'imei', label: 'IMEI / Serial', icon: Hash },
  { id: 'cash', label: 'Cash In/Out', icon: Wallet },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'reload', label: 'Reload', icon: Phone },
] as const

export type PosNavItem = { id: string; label: string; icon: LucideIcon }

interface HexaPosLayoutProps {
  shopName: string
  onClose: () => void
  cashierName: string
  syncTime: string
  search: string
  onSearchChange: (v: string) => void
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  onScanClick: () => void
  onBellClick?: () => void
  onNavAction?: (id: string) => void
  navItems?: PosNavItem[]
  activeNavId?: string
  heldBadgeCount?: number
  onFiltersClick?: () => void
  filtersActive?: boolean
  filtersPanel?: React.ReactNode
  toolbarActions?: React.ReactNode
  imeiSlot?: React.ReactNode
  customerSlot: React.ReactNode
  categoryBar: React.ReactNode
  productGrid: React.ReactNode
  pagination: React.ReactNode
  bottomActions: React.ReactNode
  cartPanel: React.ReactNode
  mainOverlay?: React.ReactNode
}

export function HexaPosLayout({
  shopName,
  onClose,
  cashierName,
  syncTime,
  search,
  onSearchChange,
  onSearchKeyDown,
  searchRef,
  onScanClick,
  onBellClick,
  onNavAction,
  navItems,
  activeNavId = 'products',
  heldBadgeCount = 0,
  onFiltersClick,
  filtersActive = false,
  filtersPanel,
  toolbarActions,
  imeiSlot,
  customerSlot,
  categoryBar,
  productGrid,
  pagination,
  bottomActions,
  cartPanel,
  mainOverlay,
}: HexaPosLayoutProps) {
  const sidebarItems: PosNavItem[] = navItems ?? NAV_ITEMS.map(({ id, label, icon }) => ({ id, label, icon }))

  return (
    <div
      data-pos="dark"
      className="pos-shell flex h-full w-full overflow-hidden [&_input]:text-white [&_select]:text-white"
      style={{ background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif" }}
    >
      {/* ── Left Sidebar ── */}
      <aside
        className="hidden lg:flex w-[200px] shrink-0 flex-col border-r"
        style={{ borderColor: C.border, background: C.card }}
      >
        <div className="flex items-center gap-2.5 px-4 py-4 border-b" style={{ borderColor: C.border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})` }}>
            <ShoppingCart size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">Hexa POS</p>
            <p className="text-[10px] truncate" style={{ color: C.muted }}>{shopName}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {sidebarItems.map(({ id, label, icon: Icon }) => {
            const active = id === activeNavId
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavAction?.(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[11px] font-semibold transition-colors"
                style={active
                  ? { background: `${C.purple}33`, color: C.text, borderLeft: `3px solid ${C.purple}` }
                  : { color: C.muted, borderLeft: '3px solid transparent' }}
              >
                <Icon size={14} style={{ color: active ? C.purple : C.muted }} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: C.border }}>
          <p className="text-[9px] font-bold uppercase tracking-wider px-1" style={{ color: C.muted }}>Shortcuts</p>
          {[
            ['F1', 'Search'],
            ['F2', 'Customer'],
            ['F3', 'Checkout / Pay'],
            ['F4', 'Hold Sale'],
            ['F6', 'Held Carts'],
            ['F10', 'New Sale'],
            ['Esc', 'Back / Close'],
            ['1 / 2 / 3', 'Pay method'],
            ['O', 'Old balance'],
            ['Enter', 'Pay now'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between text-[10px] px-1" style={{ color: C.muted }}>
              <span>{label}</span>
              <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: C.bg, color: C.text }}>{key}</kbd>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-2 px-1 text-[10px]" style={{ color: C.green }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
            Terminal T01 · Online
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top toolbar */}
        <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: C.border, background: C.panel }}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-white" title="Close POS"><X size={16} /></button>
            <button type="button" onClick={onScanClick} className="h-9 px-3 rounded-xl text-xs font-semibold border shrink-0 flex items-center gap-1.5" style={{ borderColor: C.border, background: C.card, color: C.text }}>
              <ScanLine size={14} style={{ color: C.muted }} /> Scan IMEI
            </button>
            {imeiSlot}
            <div className="flex-1 min-w-[180px] relative">
              <ScanLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search products by name, SKU, IMEI..."
                className="w-full h-9 pl-9 pr-12 rounded-xl text-sm outline-none border text-white placeholder:text-white/40"
                style={{ background: C.card, borderColor: C.border }}
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded font-mono hidden sm:inline" style={{ background: C.bg, color: C.muted }}>F1</kbd>
            </div>
            <button type="button" onClick={onFiltersClick}
              className="h-9 px-3 rounded-xl text-xs font-semibold border shrink-0 flex items-center gap-1.5 transition-colors"
              style={{
                borderColor: filtersActive ? C.purple : C.border,
                background: filtersActive ? `${C.purple}22` : C.card,
                color: filtersActive ? C.text : C.muted,
              }}>
              <SlidersHorizontal size={14} /> Filters
            </button>
            {toolbarActions}
            <button type="button" onClick={onBellClick} className="relative h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-white/5" style={{ borderColor: C.border, background: C.card }}>
              <Bell size={15} className="text-white" />
              {heldBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: C.red }}>
                  {heldBadgeCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => onNavAction?.('settings')} className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-white/5" style={{ borderColor: C.border, background: C.card }}>
              <Settings size={15} style={{ color: C.muted }} />
            </button>
            {customerSlot}
          </div>
        </div>

        {filtersPanel}

        <div className="flex flex-1 min-h-0 relative">
          {mainOverlay}
          <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: C.bg }}>
            {categoryBar}
            <div className="flex-1 overflow-y-auto px-3 py-3">{productGrid}</div>
            {pagination}
            {bottomActions}
          </div>
          <div className="w-[min(400px,36vw)] shrink-0 flex flex-col border-l min-h-0" style={{ borderColor: C.border, background: C.card }}>
            {cartPanel}
          </div>
        </div>

        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t text-xs" style={{ borderColor: C.border, background: C.card, color: C.muted }}>
          <span className="font-medium">© 2026 Hexa-Mobile-Shop POS System</span>
          <div className="flex flex-wrap items-center gap-3">
            <span>Terminal: T01</span>
            <span>|</span>
            <span>Cashier: {cashierName}</span>
            <span>|</span>
            <span>Session: 01</span>
            <span>|</span>
            <span>Last Sync: {syncTime}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${C.green}22`, color: C.green }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} /> Synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export { C as POS_THEME }
