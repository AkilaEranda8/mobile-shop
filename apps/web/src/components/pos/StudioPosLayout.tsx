'use client'

import React, { useEffect } from 'react'
import {
  ShoppingCart, ScanLine, Archive, X, LayoutGrid, Settings,
  SlidersHorizontal,
} from 'lucide-react'
import { googleFontsHref } from '@/lib/appearance'
import type { HexaPosLayoutProps, PosNavItem } from './HexaPosLayout'
import { resolvePosTheme } from './pos-theme'

const NAV_FALLBACK: PosNavItem[] = [
  { id: 'products', label: 'Products', icon: LayoutGrid },
]

function ensureStudioFont() {
  if (typeof document === 'undefined') return
  const id = 'hx-pos-studio-font'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = googleFontsHref('Manrope:wght@400;500;600;700;800')
  document.head.appendChild(link)
}

/** Modern POS chrome — selectable via Settings → POS Display → Studio Modern. */
export function StudioPosLayout(props: HexaPosLayoutProps) {
  const {
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
    layoutPrefs,
  } = props

  useEffect(() => { ensureStudioFont() }, [])

  const T = resolvePosTheme(layoutPrefs?.theme, layoutPrefs?.accent)
  const sidebarItems: PosNavItem[] = navItems ?? NAV_FALLBACK
  const showProductsPane = mobileView === 'products'
  const showCartPane = mobileView === 'cart'
  const showNav = layoutPrefs?.showSidebar !== false
  const showBottom = layoutPrefs?.showBottomActions !== false
  const cartLeft = layoutPrefs?.cartPosition === 'left'
  const compact = layoutPrefs?.density === 'compact'

  const productsCol = (
    <div
      className={`flex-1 flex-col min-w-0 min-h-0 ${showProductsPane ? 'flex' : 'hidden'} lg:flex`}
      style={{ background: 'transparent' }}
    >
      <div className="px-3 sm:px-4 pt-3">{categoryBar}</div>
      <div
        className={`flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 ${
          cartItemCount > 0 && showProductsPane ? 'pb-4' : 'pb-3'
        }`}
      >
        {productGrid}
      </div>
      {pagination}
      {showBottom ? (
        <div className="px-3 sm:px-4 pb-3">{bottomActions}</div>
      ) : null}
    </div>
  )

  const cartCol = (
    <div
      className={`flex-col min-h-0 min-w-0 ${
        showCartPane ? 'flex' : 'hidden'
      } lg:flex w-full lg:w-[min(360px,40vw)] xl:w-[400px] 2xl:w-[440px] shrink-0 p-2 lg:p-3`}
    >
      <div
        className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden border"
        style={{
          borderColor: T.border,
          background: T.card,
          boxShadow: `0 18px 40px ${T.bg}99, 0 0 0 1px ${T.border}40`,
        }}
      >
        {cartPanel}
      </div>
    </div>
  )

  return (
    <div
      data-pos="studio"
      className="pos-shell flex h-full w-full min-h-0 overflow-hidden flex-col [&_input]:text-white [&_select]:text-white"
      style={{
        background: `radial-gradient(1200px 600px at 12% -10%, ${T.purple}22 0%, transparent 55%), radial-gradient(900px 500px at 88% 0%, ${T.teal}18 0%, transparent 50%), ${T.bg}`,
        color: T.text,
        fontFamily: "'Manrope', system-ui, sans-serif",
        ['--pos-accent' as string]: T.purple,
      }}
    >
      {/* Top brand bar */}
      <header
        className={`shrink-0 border-b ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
        style={{ borderColor: T.border, background: `${T.panel}cc`, backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 touch-manipulation shrink-0"
            style={{ color: T.muted }}
            title="Close POS"
            aria-label="Close POS"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(145deg, ${T.purple}, ${T.purpleDark})`,
                boxShadow: `0 8px 20px ${T.purple}33`,
              }}
            >
              <ShoppingCart size={16} className="text-white" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: T.purple }}>
                Studio POS
              </p>
              <p className="text-sm font-bold truncate leading-tight" style={{ color: T.text }} title={shopName}>
                {shopName}
              </p>
            </div>
          </div>

          {showNav && (
            <nav className="hidden lg:flex items-center gap-1 ml-2 min-w-0 overflow-x-auto">
              {sidebarItems.map(({ id, label, icon: Icon }: PosNavItem) => {
                const active = id === activeNavId
                return (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => onNavAction?.(id)}
                    className="h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all touch-manipulation whitespace-nowrap"
                    style={
                      active
                        ? { background: `${T.purple}28`, color: T.text, boxShadow: `inset 0 0 0 1px ${T.purple}66` }
                        : { color: T.muted }
                    }
                  >
                    <Icon size={14} style={{ color: active ? T.purple : T.muted }} />
                    {label}
                  </button>
                )
              })}
            </nav>
          )}

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-2 text-[11px] shrink-0" style={{ color: T.muted }}>
            <span className="truncate max-w-[8rem]">{cashierName}</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: `${T.green}22`, color: T.green }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.green }} />
              Live
            </span>
          </div>
        </div>

        {/* Search row */}
        <div className={`flex items-center gap-2 min-w-0 ${compact ? 'mt-2' : 'mt-3'}`}>
          <button
            type="button"
            onClick={onScanClick}
            className="h-11 px-3 rounded-2xl text-xs font-semibold border shrink-0 flex items-center gap-1.5 touch-manipulation"
            style={{ borderColor: T.border, background: T.card, color: T.text }}
          >
            <ScanLine size={15} style={{ color: T.purple }} />
            <span className="hidden sm:inline">Scan</span>
          </button>
          {imeiSlot}
          <div className="flex-1 min-w-0 relative">
            <ScanLine
              size={15}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: T.muted }}
            />
            <input
              ref={searchRef}
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search products, SKU, barcode, IMEI…"
              className="w-full h-11 pl-11 pr-12 rounded-2xl text-sm outline-none border placeholder:opacity-35"
              style={{
                background: T.card,
                borderColor: T.border,
                color: T.text,
                boxShadow: `inset 0 1px 0 ${T.border}40`,
              }}
            />
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded-md font-mono hidden sm:inline"
              style={{ background: T.bg, color: T.muted }}
            >
              F1
            </kbd>
          </div>
          <button
            type="button"
            onClick={onFiltersClick}
            className="h-11 px-3 rounded-2xl text-xs font-semibold border flex items-center gap-1.5 touch-manipulation shrink-0"
            style={{
              borderColor: filtersActive ? T.purple : T.border,
              background: filtersActive ? `${T.purple}22` : T.card,
              color: filtersActive ? T.text : T.muted,
            }}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden md:inline">Filters</span>
          </button>
          {toolbarActions}
          <button
            type="button"
            onClick={() => onMobileViewChange?.('cart')}
            className="lg:hidden relative h-11 w-11 rounded-2xl border flex items-center justify-center touch-manipulation shrink-0"
            style={{
              borderColor: showCartPane ? T.purple : T.border,
              background: showCartPane ? `${T.purple}22` : T.card,
            }}
            title="Cart"
            aria-label="Open cart"
          >
            <ShoppingCart size={16} style={{ color: T.text }} />
            {cartItemCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: T.purple }}
              >
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onBellClick}
            className="relative h-11 w-11 rounded-2xl border flex items-center justify-center touch-manipulation shrink-0"
            style={{ borderColor: T.border, background: T.card }}
            title="Held carts"
            aria-label="Held carts"
          >
            <Archive size={15} style={{ color: T.text }} />
            {heldBadgeCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: T.red }}
              >
                {heldBadgeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavAction?.('settings')}
            className="hidden sm:flex h-11 w-11 rounded-2xl border items-center justify-center touch-manipulation shrink-0"
            style={{ borderColor: T.border, background: T.card }}
          >
            <Settings size={15} style={{ color: T.muted }} />
          </button>
          <div className="w-[11rem] sm:w-[13rem] lg:w-[15rem] shrink-0">{customerSlot}</div>
        </div>
      </header>

      {filtersPanel}

      <div className="flex flex-1 min-h-0 relative">
        {mainOverlay}
        {cartLeft ? (
          <>
            {cartCol}
            {productsCol}
          </>
        ) : (
          <>
            {productsCol}
            {cartCol}
          </>
        )}
      </div>

      <div
        className="lg:hidden shrink-0 grid grid-cols-2 gap-1.5 px-3 py-2 border-t"
        style={{
          borderColor: T.border,
          background: T.panel,
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          onClick={() => onMobileViewChange?.('products')}
          className="h-11 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 touch-manipulation"
          style={
            showProductsPane
              ? { background: `${T.purple}33`, color: T.text, border: `1px solid ${T.purple}66` }
              : { background: T.card, color: T.muted, border: `1px solid ${T.border}` }
          }
        >
          <LayoutGrid size={15} /> Products
        </button>
        <button
          type="button"
          onClick={() => onMobileViewChange?.('cart')}
          className="h-11 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 touch-manipulation relative"
          style={
            showCartPane
              ? { background: `${T.purple}33`, color: T.text, border: `1px solid ${T.purple}66` }
              : { background: T.card, color: T.muted, border: `1px solid ${T.border}` }
          }
        >
          <ShoppingCart size={15} /> Cart
          {cartItemCount > 0 && (
            <span
              className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: T.purple }}
            >
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </span>
          )}
        </button>
      </div>

      <footer
        className="hidden lg:flex shrink-0 items-center justify-between gap-3 px-5 py-2.5 border-t text-[11px]"
        style={{ borderColor: T.border, background: `${T.panel}aa`, color: T.muted }}
      >
        <span className="font-semibold tracking-wide">Studio POS</span>
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate">Cashier: {cashierName}</span>
          <span className="hidden xl:inline">Last sync: {syncTime}</span>
        </div>
      </footer>
    </div>
  )
}

