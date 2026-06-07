'use client'

import React from 'react'
import {
  ShoppingCart, ScanLine, Bell, X, Smartphone, Headphones, Tablet,
  Laptop, Watch, Package,
} from 'lucide-react'

const C = {
  bg: '#0a0e17',
  panel: '#0f1520',
  card: '#151c2c',
  border: '#1e2a3f',
  muted: '#ffffff',
  text: '#ffffff',
  purple: '#7c3aed',
  purpleDark: '#5b21b6',
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

interface HexaPosLayoutProps {
  shopName: string
  onClose: () => void
  cashierName: string
  syncTime: string
  search: string
  onSearchChange: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  onScanClick: () => void
  onBellClick?: () => void
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
  searchRef,
  onScanClick,
  onBellClick,
  imeiSlot,
  customerSlot,
  categoryBar,
  productGrid,
  pagination,
  bottomActions,
  cartPanel,
  mainOverlay,
}: HexaPosLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden text-white [&_button]:text-white [&_input]:text-white [&_select]:text-white" style={{ background: C.bg, color: '#ffffff', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 border-b" style={{ borderColor: C.border, background: C.panel }}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 shrink-0 mr-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})` }}>
                <ShoppingCart size={15} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold leading-tight">POS Terminal</p>
                <p className="text-[10px] truncate max-w-[120px] text-white/70">{shopName || 'Hexa Mobile Store'}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-white" title="Close POS (Esc)"><X size={16} className="text-white" /></button>
            <button type="button" onClick={onScanClick} className="h-9 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-2 shrink-0" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})` }}>
              <ScanLine size={14} /> Scan (F1)
            </button>
            {imeiSlot}
            <div className="flex-1 min-w-[200px] relative">
              <ScanLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search products by name, SKU, IMEI, Serial number..."
                className="w-full h-9 pl-9 pr-3 rounded-xl text-sm outline-none border text-white placeholder:text-white/50"
                style={{ background: C.card, borderColor: C.border }}
              />
            </div>
            <button type="button" onClick={onScanClick} className="h-9 px-3 rounded-xl text-xs font-semibold border shrink-0 text-white" style={{ borderColor: C.border, background: C.card }}>
              Scan Barcode
            </button>
            <button type="button" onClick={onBellClick} className="relative h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 text-white hover:bg-white/5" style={{ borderColor: C.border, background: C.card }} title="Held carts">
              <Bell size={15} className="text-white" />
            </button>
            {customerSlot}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 relative">
          {mainOverlay}
          <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: C.bg }}>
            {categoryBar}
            <div className="flex-1 overflow-y-auto px-4 py-3">{productGrid}</div>
            {pagination}
            {bottomActions}
          </div>
          <div className="w-[min(420px,38vw)] shrink-0 flex flex-col border-l min-h-0" style={{ borderColor: C.border, background: C.panel }}>
            {cartPanel}
          </div>
        </div>

        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t text-[11px] text-white" style={{ borderColor: C.border, background: C.panel }}>
          <span>© 2024 Hexa-VIMS POS System</span>
          <div className="flex flex-wrap items-center gap-3">
            <span>Terminal: T01</span>
            <span>|</span>
            <span>Cashier: {cashierName}</span>
            <span>|</span>
            <span>Session: 01</span>
            <span>|</span>
            <span>Last Sync: {syncTime}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export { C as POS_THEME }
