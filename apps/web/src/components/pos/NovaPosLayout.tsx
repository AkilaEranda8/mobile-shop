'use client'

/**
 * Nova POS — premium top-bar retail counter template.
 * Visual chrome only. Same HexaPosLayoutProps / slots / callbacks as Hexa & Studio.
 */
import React, { useEffect } from 'react'
import {
  Archive,
  History,
  Pause,
  Plus,
  ScanLine,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'
import type { HexaPosLayoutProps } from './HexaPosLayout'
import { resolvePosTheme } from './pos-theme'
import { PosCartResizeHandle, usePosCartResize } from './usePosCartResize'
import './nova-pos-skin.css'

const BTN =
  'relative h-10 px-2.5 sm:px-3 rounded-[10px] text-[11px] font-semibold border flex items-center gap-1.5 touch-manipulation transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none'

export function NovaPosLayout(props: HexaPosLayoutProps) {
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
    onNavAction,
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

  const T = resolvePosTheme(layoutPrefs?.theme ?? 'nova', layoutPrefs?.accent)
  const showProductsPane = mobileView === 'products'
  const showCartPane = mobileView === 'cart'
  const showBottom = layoutPrefs?.showBottomActions !== false
  const cartLeft = layoutPrefs?.cartPosition === 'left'
  const { widthPx, dragging, startResize, resetWidth } = usePosCartResize(
    layoutPrefs?.cartWidth ?? 'wide',
    cartLeft,
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-pos-skin', 'nova')
    return () => {
      if (document.documentElement.getAttribute('data-pos-skin') === 'nova') {
        document.documentElement.removeAttribute('data-pos-skin')
      }
    }
  }, [])

  const topBtn = (opts: {
    id: string
    label: string
    icon: React.ReactNode
    badge?: number
    active?: boolean
  }) => (
    <button
      key={opts.id}
      type="button"
      onClick={() => onNavAction?.(opts.id)}
      className={BTN}
      style={{
        borderColor: opts.active ? T.blue : T.border,
        background: opts.active ? `${T.blue}24` : T.card,
        color: opts.active ? T.text : T.muted,
        outlineColor: T.blue,
      }}
    >
      {opts.icon}
      <span className="hidden md:inline">{opts.label}</span>
      {opts.badge != null && opts.badge > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center ring-2"
          style={{ background: T.red, color: '#fff', boxShadow: `0 0 0 2px ${T.panel}` }}
        >
          {opts.badge > 9 ? '9+' : opts.badge}
        </span>
      )}
    </button>
  )

  const productsCol = (
    <div
      className={`flex-1 flex-col min-w-0 min-h-0 ${showProductsPane ? 'flex' : 'hidden'} lg:flex`}
      style={{ background: T.bg }}
    >
      <div className="nova-category shrink-0">{categoryBar}</div>
      <div
        className={`nova-products flex-1 overflow-y-auto overscroll-contain px-2 sm:px-3 py-2 sm:py-2.5 ${
          cartItemCount > 0 && showProductsPane ? 'pb-4' : 'pb-2.5'
        }`}
      >
        {productGrid}
      </div>
      <div className="nova-pagination shrink-0">{pagination}</div>
      {showBottom ? <div className="nova-bottom shrink-0">{bottomActions}</div> : null}
    </div>
  )

  const cartCol = (
    <div
      className={`nova-cart flex-col min-h-0 min-w-0 ${
        showCartPane ? 'flex' : 'hidden'
      } lg:flex w-full lg:w-[var(--pos-cart-w)] shrink-0 ${cartLeft ? 'border-r' : 'border-l'}`}
      style={{
        borderColor: T.border,
        background: T.card,
        ['--pos-cart-w' as string]: `${widthPx}px`,
      }}
    >
      {cartPanel}
    </div>
  )

  const resizeHandle = (
    <PosCartResizeHandle
      onPointerDown={startResize}
      onDoubleClick={resetWidth}
      dragging={dragging}
      accent={T.blue}
      border={T.border}
    />
  )

  return (
    <div
      data-pos="nova"
      className="pos-shell flex h-full w-full min-h-0 flex-col overflow-hidden [&_input]:text-white [&_select]:text-white"
      style={{
        background: T.bg,
        color: T.text,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        ['--pos-accent' as string]: T.blue,
      }}
    >
      {/* ── Command bar ── */}
      <div
        role="banner"
        className="nova-command shrink-0 border-b z-10"
        style={{ borderColor: T.border, background: T.panel }}
      >
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-2 w-full min-w-0">
          {/* Left: close + brand */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-[10px] flex items-center justify-center border touch-manipulation transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: T.border, color: T.muted, background: T.card, outlineColor: T.blue }}
              title="Close POS"
              aria-label="Close POS"
            >
              <X size={15} />
            </button>

            <div className="nova-brand hidden sm:flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: T.blue }}
                aria-hidden
              >
                <ShoppingCart size={15} style={{ color: '#ffffff' }} />
              </div>
              <div className="min-w-0 leading-tight pr-1">
                <p className="text-[13px] font-extrabold tracking-tight truncate" style={{ color: '#ffffff' }}>
                  Hexa POS
                </p>
                <p
                  className="text-[10px] font-medium truncate max-w-[10rem]"
                  style={{ color: T.muted }}
                  title={shopName}
                >
                  {shopName}
                </p>
              </div>
            </div>
          </div>

          {/* Center: search + scan */}
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1 min-w-0">
              <ScanLine
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: T.muted }}
                aria-hidden
              />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search product name, SKU, barcode, IMEI..."
                className="w-full h-10 pl-10 pr-12 rounded-full text-[13px] outline-none border placeholder:opacity-40 transition-[border-color,box-shadow] focus:border-[color:var(--pos-accent)]"
                style={{
                  background: T.card,
                  borderColor: T.border,
                  color: T.text,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
                aria-label="Search products"
              />
              <kbd
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-md font-mono hidden sm:inline border"
                style={{ background: T.bg, color: T.muted, borderColor: T.border }}
              >
                F1
              </kbd>
            </div>
            <button
              type="button"
              onClick={onScanClick}
              className={`${BTN} shrink-0`}
              style={{ borderColor: T.border, background: T.card, color: T.text, outlineColor: T.blue }}
              title="Scan barcode / IMEI"
              aria-label="Scan"
            >
              <ScanLine size={15} style={{ color: T.blue }} />
              <span className="hidden lg:inline">Scan</span>
            </button>
            {imeiSlot}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {topBtn({ id: 'newSale', label: 'New Sale', icon: <Plus size={14} style={{ color: T.blue }} /> })}
            {topBtn({
              id: 'sales',
              label: 'Sales History',
              icon: <History size={14} />,
              active: activeNavId === 'sales',
            })}
            {topBtn({
              id: 'hold',
              label: 'Hold',
              icon: <Pause size={14} />,
              badge: heldBadgeCount,
            })}
            <button
              type="button"
              onClick={onFiltersClick}
              className={BTN}
              style={{
                borderColor: filtersActive ? T.blue : T.border,
                background: filtersActive ? `${T.blue}24` : T.card,
                color: filtersActive ? T.text : T.muted,
                outlineColor: T.blue,
              }}
              aria-pressed={!!filtersActive}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden lg:inline">Filters</span>
            </button>
            {toolbarActions}
            <button
              type="button"
              onClick={() => onNavAction?.('settings')}
              className="h-10 w-10 rounded-[10px] border flex items-center justify-center touch-manipulation transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: T.border, background: T.card, color: T.muted, outlineColor: T.blue }}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              onClick={() => onMobileViewChange?.('cart')}
              className="lg:hidden relative h-10 w-10 rounded-[10px] border flex items-center justify-center touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: T.border, background: T.card, color: T.text, outlineColor: T.blue }}
              aria-label="Open cart"
            >
              <Archive size={15} />
              {cartItemCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: T.blue, color: '#fff' }}
                >
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </span>
              )}
            </button>
            <div
              className="hidden xl:flex items-center gap-2 pl-2 ml-0.5 border-l min-w-0 max-w-[13rem]"
              style={{ borderColor: T.border }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border"
                style={{ background: `${T.blue}18`, color: T.blue, borderColor: `${T.blue}33` }}
                aria-hidden
              >
                <UserRound size={15} />
              </div>
              <div className="min-w-0 flex-1 nova-customer">{customerSlot}</div>
            </div>
          </div>
        </div>
        {filtersPanel ? <div className="nova-filters border-t" style={{ borderColor: T.border }}>{filtersPanel}</div> : null}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">
        {cartLeft ? (
          <>
            {cartCol}
            {resizeHandle}
            {productsCol}
          </>
        ) : (
          <>
            {productsCol}
            {resizeHandle}
            {cartCol}
          </>
        )}
        {mainOverlay}
      </div>

      {/* ── Status bar ── */}
      <footer
        className="hidden sm:flex shrink-0 items-center justify-between gap-3 px-3 py-1 border-t text-[10px] leading-none"
        style={{ borderColor: T.border, background: '#0b0e14', color: T.muted }}
      >
        <span className="opacity-50 truncate">Hexa POS</span>
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="truncate max-w-[10rem] font-medium" style={{ color: T.text }}>
            {cashierName}
          </span>
          <span className="opacity-30" aria-hidden>
            ·
          </span>
          <span className="truncate">Last sync {syncTime}</span>
          <span
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{ color: T.green }}
            role="status"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T.green }} />
            Synced
          </span>
        </span>
      </footer>
    </div>
  )
}
