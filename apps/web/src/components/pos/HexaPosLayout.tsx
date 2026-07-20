'use client'

import React from 'react'
import {
  ShoppingCart, ScanLine, Archive, X, Smartphone, Headphones, Tablet,
  Laptop, Watch, Package, LayoutGrid, Receipt, Users,
  RotateCcw, Settings,
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

const NAV_ITEMS: PosNavItem[] = [
  { id: 'products', label: 'Products', icon: LayoutGrid },
  { id: 'sales', label: 'Sales', icon: Receipt },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
]

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
  hasDailyReload?: boolean
  /** Phone/tablet single-pane mode: products or cart */
  mobileView?: 'products' | 'cart'
  cartItemCount?: number
  onMobileViewChange?: (view: 'products' | 'cart') => void
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
  mobileView = 'products',
  cartItemCount = 0,
  onMobileViewChange,
}: HexaPosLayoutProps) {
  const sidebarItems: PosNavItem[] = navItems ?? NAV_ITEMS
  const showProductsPane = mobileView === 'products'
  const showCartPane = mobileView === 'cart'

  return (
    <div
      data-pos="dark"
      className="pos-shell flex h-full w-full min-h-0 overflow-hidden [&_input]:text-white [&_select]:text-white"
      style={{ background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif" }}
    >
      {/* ── Left Sidebar — compact POS rail (icon + label always visible) ── */}
      <aside
        className="pos-aside hidden lg:flex w-[84px] shrink-0 flex-col border-r"
        style={{ borderColor: C.border, background: C.card }}
      >
        <div className="flex flex-col items-center gap-1.5 px-2 py-3 border-b" style={{ borderColor: C.border }}>
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})`, boxShadow: `0 6px 16px ${C.purple}40` }}
          >
            <ShoppingCart size={17} className="text-white" />
          </div>
          <div className="text-center w-full min-w-0">
            <p className="text-[10px] font-extrabold tracking-wide text-white leading-tight">POS</p>
            <p className="text-[8px] leading-tight truncate px-0.5" style={{ color: C.muted }} title={shopName}>{shopName}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-2 px-1.5 space-y-1">
          {sidebarItems.map(({ id, label, icon: Icon }) => {
            const active = id === activeNavId
            const short =
              id === 'imei' ? 'IMEI'
              : id === 'cash' ? 'Cash'
              : id === 'customers' ? 'Customer'
              : id === 'products' ? 'Products'
              : id === 'sales' ? 'Sales'
              : id === 'returns' ? 'Returns'
              : id === 'reload' ? 'Reload'
              : label
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => onNavAction?.(id)}
                className="w-full flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-all touch-manipulation"
                style={active
                  ? { background: `${C.purple}28`, color: C.text, boxShadow: `inset 0 0 0 1px ${C.purple}66` }
                  : { color: C.muted }}
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: active ? `${C.purple}40` : C.bg }}
                >
                  <Icon size={16} style={{ color: active ? '#c4b5fd' : C.muted }} />
                </span>
                <span
                  className="text-[9px] font-bold leading-tight text-center w-full px-0.5"
                  style={{ color: active ? C.text : C.muted }}
                >
                  {short}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="px-1.5 py-2.5 border-t space-y-1.5" style={{ borderColor: C.border }}>
          <button
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={() => onNavAction?.('settings')}
            className="w-full flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-colors hover:bg-white/5"
            style={{ color: C.muted }}
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.bg }}>
              <Settings size={15} style={{ color: C.muted }} />
            </span>
            <span className="text-[9px] font-bold">Settings</span>
          </button>
          <div className="flex flex-col items-center gap-1 pt-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
            <span className="text-[8px] font-semibold" style={{ color: C.green }}>Online</span>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top toolbar */}
        <div className="shrink-0 px-2 sm:px-3 py-2 border-b" style={{ borderColor: C.border, background: C.panel }}>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-white touch-manipulation"
              title="Close POS"
              aria-label="Close POS"
            >
              <X size={16} />
            </button>
            <button type="button" onClick={onScanClick} className="h-9 px-2 sm:px-3 rounded-xl text-xs font-semibold border shrink-0 flex items-center gap-1.5 touch-manipulation" style={{ borderColor: C.border, background: C.card, color: C.text }}>
              <ScanLine size={14} style={{ color: C.muted }} />
              <span className="hidden md:inline">Scan IMEI</span>
            </button>
            {imeiSlot}
            <div className="flex-1 min-w-0 basis-full sm:basis-[12rem] md:basis-auto sm:min-w-[140px] lg:min-w-[180px] relative order-last sm:order-none w-full sm:w-auto sm:max-w-none lg:max-w-xl xl:max-w-2xl">
              <ScanLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search name, SKU, barcode, IMEI…"
                className="w-full h-9 pl-9 pr-3 sm:pr-12 rounded-xl text-sm outline-none border text-white placeholder:text-white/40"
                style={{ background: C.card, borderColor: C.border }}
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded font-mono hidden sm:inline" style={{ background: C.bg, color: C.muted }}>F1</kbd>
            </div>
            <button type="button" onClick={onFiltersClick}
              className="h-9 px-2 sm:px-3 rounded-xl text-xs font-semibold border shrink-0 flex items-center gap-1.5 transition-colors touch-manipulation"
              style={{
                borderColor: filtersActive ? C.purple : C.border,
                background: filtersActive ? `${C.purple}22` : C.card,
                color: filtersActive ? C.text : C.muted,
              }}>
              <SlidersHorizontal size={14} />
              <span className="hidden md:inline">Filters</span>
            </button>
            {toolbarActions}
            <button
              type="button"
              onClick={() => onMobileViewChange?.('cart')}
              className="lg:hidden relative h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-white/5 touch-manipulation"
              style={{ borderColor: showCartPane ? C.purple : C.border, background: showCartPane ? `${C.purple}22` : C.card }}
              title="Cart"
              aria-label="Open cart"
            >
              <ShoppingCart size={15} className="text-white" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: C.purple }}>
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>
            <button type="button" onClick={onBellClick} className="relative h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-white/5 touch-manipulation" style={{ borderColor: C.border, background: C.card }} title="Held carts" aria-label="Held carts">
              <Archive size={15} className="text-white" />
              {heldBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: C.red }}>
                  {heldBadgeCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => onNavAction?.('settings')} className="hidden sm:flex h-9 w-9 rounded-xl border items-center justify-center shrink-0 hover:bg-white/5 touch-manipulation" style={{ borderColor: C.border, background: C.card }}>
              <Settings size={15} style={{ color: C.muted }} />
            </button>
            <div className="shrink-0 max-w-[40vw] sm:max-w-none">{customerSlot}</div>
          </div>
        </div>

        {filtersPanel}

        <div className="flex flex-1 min-h-0 relative">
          {mainOverlay}
          <div
            className={`flex-1 flex-col min-w-0 min-h-0 ${showProductsPane ? 'flex' : 'hidden'} lg:flex`}
            style={{ background: C.bg }}
          >
            {categoryBar}
            <div className={`flex-1 overflow-y-auto overscroll-contain px-2 sm:px-3 py-2 sm:py-3 lg:pb-3 ${cartItemCount > 0 && showProductsPane ? 'pb-4' : 'pb-3'}`}>{productGrid}</div>
            {pagination}
            {bottomActions}
          </div>
          <div
            className={`flex-col border-l min-h-0 min-w-0 ${
              showCartPane ? 'flex' : 'hidden'
            } lg:flex w-full lg:w-[min(340px,38vw)] xl:w-[380px] 2xl:w-[420px] shrink-0`}
            style={{ borderColor: C.border, background: C.card }}
          >
            {cartPanel}
          </div>
        </div>

        {/* Mobile / tablet bottom nav (< lg) */}
        <div
          className="lg:hidden shrink-0 grid grid-cols-2 gap-1 px-2 py-2 border-t"
          style={{ borderColor: C.border, background: C.card, paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => onMobileViewChange?.('products')}
            className="h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 touch-manipulation"
            style={showProductsPane
              ? { background: `${C.purple}33`, color: C.text, border: `1px solid ${C.purple}66` }
              : { background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}
          >
            <LayoutGrid size={15} /> Products
          </button>
          <button
            type="button"
            onClick={() => onMobileViewChange?.('cart')}
            className="h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 touch-manipulation relative"
            style={showCartPane
              ? { background: `${C.purple}33`, color: C.text, border: `1px solid ${C.purple}66` }
              : { background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}
          >
            <ShoppingCart size={15} /> Cart
            {cartItemCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: C.purple }}>
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </button>
        </div>

        <footer className="hidden lg:flex shrink-0 flex-wrap items-center justify-between gap-2 xl:gap-3 px-3 xl:px-5 py-2 xl:py-3.5 border-t text-[10px] xl:text-xs" style={{ borderColor: C.border, background: C.card, color: C.muted }}>
          <span className="font-medium truncate">© 2026 Hexa POS</span>
          <div className="flex flex-wrap items-center gap-2 xl:gap-3 min-w-0">
            <span className="truncate">Cashier: {cashierName}</span>
            <span className="hidden xl:inline">|</span>
            <span className="hidden xl:inline">Last Sync: {syncTime}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-full text-[10px] xl:text-[11px] font-bold" style={{ background: `${C.green}22`, color: C.green }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} /> Synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export { C as POS_THEME }
