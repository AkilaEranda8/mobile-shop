'use client'

import React from 'react'
import {
  ShoppingCart, ScanLine, Bell, X, Smartphone, Headphones, Tablet,
  Laptop, Watch, Package,
} from 'lucide-react'

const C = {
  bg: '#0B0E14',
  panel: '#151921',
  card: '#151921',
  cardHover: '#1a2030',
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
    <div data-pos="dark" className="pos-shell flex h-full w-full overflow-hidden [&_input]:text-white [&_select]:text-white" style={{ background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
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
            <button type="button" onClick={onScanClick} className="h-9 px-3 rounded-xl text-xs font-semibold border shrink-0 flex items-center gap-1.5" style={{ borderColor: C.border, background: C.card, color: C.text }}>
              <ScanLine size={14} style={{ color: C.muted }} /> Scan Barcode
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
            <div className="flex-1 overflow-y-auto px-3 py-2">{productGrid}</div>
            {pagination}
            {bottomActions}
          </div>
          <div className="w-[min(420px,38vw)] shrink-0 flex flex-col border-l min-h-0" style={{ borderColor: C.border, background: C.panel }}>
            {cartPanel}
          </div>
        </div>

        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t text-[11px]" style={{ borderColor: C.border, background: C.panel, color: C.muted }}>
          <span style={{ color: C.muted }}>© Hexa-VIMS POS</span>
          <div className="flex flex-wrap items-center gap-3">
            <span>Terminal: T01</span>
            <span>|</span>
            <span>Cashier: {cashierName}</span>
            <span>|</span>
            <span>Session: 01</span>
            <span>|</span>
            <span>Last Sync: {syncTime}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: `${C.green}22`, color: C.green }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} /> Synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export { C as POS_THEME }
