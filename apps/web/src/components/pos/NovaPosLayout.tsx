'use client'

/**
 * Nova POS — 2026 premium mobile-shop checkout terminal.
 * Visual chrome only. Same HexaPosLayoutProps / slots / callbacks as Hexa & Studio.
 */
import React, { useEffect } from 'react'
import {
  Archive,
  History,
  Pause,
  Plus,
  ScanLine,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { HexaPosLayoutProps } from './HexaPosLayout'
import { resolvePosTheme } from './pos-theme'
import { PosCartResizeHandle, usePosCartResize } from './usePosCartResize'
import './nova-pos-skin.css'

const CTRL =
  'relative h-10 px-3 rounded-[10px] text-[12px] font-semibold border flex items-center gap-1.5 touch-manipulation transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]'

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

  const surfaceBtn = (opts: {
    id: string
    label: string
    icon: React.ReactNode
    badge?: number
    active?: boolean
    primary?: boolean
  }) => {
    const on = !!opts.active
    const primary = !!opts.primary
    return (
      <button
        key={opts.id}
        type="button"
        onClick={() => onNavAction?.(opts.id)}
        className={`${CTRL} nova-ctrl ${primary ? 'nova-ctrl--primary' : ''} ${on ? 'nova-ctrl--active' : ''}`}
        aria-pressed={on || undefined}
      >
        {opts.icon}
        <span className="hidden lg:inline">{opts.label}</span>
        {opts.badge != null && opts.badge > 0 && (
          <span className="nova-badge absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
            {opts.badge > 9 ? '9+' : opts.badge}
          </span>
        )}
      </button>
    )
  }

  const productsCol = (
    <div
      className={`nova-catalog flex-1 flex-col min-w-0 min-h-0 ${showProductsPane ? 'flex' : 'hidden'} lg:flex`}
    >
      <div className="nova-category shrink-0">{categoryBar}</div>
      <div
        className={`nova-products flex-1 overflow-y-auto overscroll-contain px-2 sm:px-3 py-2 ${
          cartItemCount > 0 && showProductsPane ? 'pb-3' : 'pb-2'
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
      border="#1E2633"
    />
  )

  return (
    <div
      data-pos="nova"
      className="pos-shell nova-shell flex h-full w-full min-h-0 flex-col overflow-hidden [&_input]:text-white [&_select]:text-white"
      style={{
        ['--pos-accent' as string]: T.blue,
      }}
    >
      {/* ── Command header ── */}
      <div role="banner" className="nova-command shrink-0 z-20">
        <div className="nova-command-row flex items-center gap-2 px-2 sm:px-3 py-2 w-full min-w-0">
          {/* Brand */}
          <div className="nova-brand-block flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <div className="nova-brand hidden sm:flex items-center gap-2.5 min-w-0">
              <div className="nova-brand-mark w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" aria-hidden>
                <ShoppingCart size={16} strokeWidth={2.25} />
              </div>
              <div className="min-w-0 leading-tight pr-0.5">
                <p className="nova-brand-title text-[13px] font-extrabold tracking-tight truncate">
                  Hexa POS
                </p>
                <p className="nova-brand-shop text-[11px] font-medium truncate max-w-[9rem] lg:max-w-[12rem]" title={shopName}>
                  {shopName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`${CTRL} nova-ctrl w-10 px-0 justify-center`}
              title="Close POS"
              aria-label="Close POS"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search / Scan */}
          <div className="nova-search-cluster flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 max-w-3xl mx-auto">
            <div className="nova-search relative flex-1 min-w-0">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none nova-search-icon"
                aria-hidden
              />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search product name, SKU, barcode, IMEI..."
                className="nova-search-input w-full h-10 pl-10 pr-12 rounded-[10px] text-[13px] outline-none border placeholder:opacity-40"
                aria-label="Search products"
              />
              <kbd className="nova-kbd absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-md font-mono hidden sm:inline border">
                F1
              </kbd>
            </div>
            <button
              type="button"
              onClick={onScanClick}
              className={`${CTRL} nova-ctrl shrink-0`}
              title="Scan barcode / IMEI"
              aria-label="Scan"
            >
              <ScanLine size={15} />
              <span className="hidden lg:inline">Scan</span>
            </button>
            {imeiSlot}
          </div>

          {/* Actions */}
          <div className="nova-actions flex items-center gap-1.5 shrink-0">
            {surfaceBtn({
              id: 'newSale',
              label: 'New Sale',
              icon: <Plus size={14} />,
              primary: true,
            })}
            {surfaceBtn({
              id: 'sales',
              label: 'Sales History',
              icon: <History size={14} />,
              active: activeNavId === 'sales',
            })}
            {surfaceBtn({
              id: 'hold',
              label: 'Hold',
              icon: <Pause size={14} />,
              badge: heldBadgeCount,
            })}
            <button
              type="button"
              onClick={onFiltersClick}
              className={`${CTRL} nova-ctrl ${filtersActive ? 'nova-ctrl--active' : ''}`}
              aria-pressed={!!filtersActive}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden lg:inline">Filters</span>
            </button>
            <div className="nova-toolbar flex items-center gap-1.5">{toolbarActions}</div>
            <div className="hidden xl:block w-[15rem] 2xl:w-[17rem] shrink-0">
              <div className="nova-customer w-full">{customerSlot}</div>
            </div>
            <button
              type="button"
              onClick={() => onNavAction?.('settings')}
              className={`${CTRL} nova-ctrl w-10 px-0 justify-center`}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              onClick={() => onMobileViewChange?.('cart')}
              className={`${CTRL} nova-ctrl lg:hidden relative w-10 px-0 justify-center`}
              aria-label="Open cart"
            >
              <Archive size={15} />
              {cartItemCount > 0 && (
                <span className="nova-badge absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {filtersPanel ? <div className="nova-filters">{filtersPanel}</div> : null}
      </div>

      {/* ── Body ── */}
      <div className="nova-body flex-1 flex min-h-0 min-w-0 relative">
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

      {/* ── Status ── */}
      <footer className="nova-status hidden sm:flex shrink-0 items-center justify-between gap-3 px-3 text-[11px] leading-none">
        <span className="nova-status-muted truncate">Hexa POS · Terminal</span>
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="truncate max-w-[10rem] font-semibold nova-status-text">{cashierName}</span>
          <span className="nova-status-dot" aria-hidden>·</span>
          <span className="nova-status-muted truncate">Last sync {syncTime}</span>
          <span className="nova-status-live inline-flex items-center gap-1.5 font-semibold" role="status">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" />
            Synced
          </span>
        </span>
      </footer>
    </div>
  )
}
