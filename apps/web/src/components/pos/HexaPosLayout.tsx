'use client'

import React from 'react'
import {
  ShoppingCart, ShoppingBag, BarChart3, Users, ScanLine, Wrench,
  Package, FileText, Receipt, RotateCcw, Settings, Wifi, Bell,
  ChevronDown, Menu, TrendingUp, Smartphone, Headphones, Tablet,
  Laptop, Watch, Grid3X3, List, SlidersHorizontal, MoreHorizontal,
  Archive, Banknote, Clock, Cloud,
} from 'lucide-react'

const C = {
  bg: '#0a0e17',
  panel: '#0f1520',
  card: '#151c2c',
  border: '#1e2a3f',
  muted: '#6b7f9e',
  text: '#e8edf5',
  purple: '#7c3aed',
  purpleDark: '#5b21b6',
}

export const POS_NAV = [
  { id: 'products', label: 'Products', icon: ShoppingBag },
  { id: 'sales', label: 'Sales', icon: BarChart3 },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'imei', label: 'IMEI / Serial', icon: ScanLine },
  { id: 'repairs', label: 'Repairs', icon: Wrench },
  { id: 'purchase', label: 'Purchase', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'tradeins', label: 'Trade-ins', icon: RotateCcw },
  { id: 'layaway', label: 'Layaway', icon: Clock },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export type PosNavId = (typeof POS_NAV)[number]['id']

const SHORTCUTS = [
  { key: 'F1', label: 'Search Products' },
  { key: 'F2', label: 'Select Customer' },
  { key: 'F3', label: 'Payment' },
  { key: 'F4', label: 'Hold Sale' },
  { key: 'F5', label: 'Print Invoice' },
]

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
  activeNav: PosNavId
  onNavChange: (id: PosNavId) => void
  onClose: () => void
  todayRevenue: number
  todayOrders: number
  lowStockCount: number
  cartCount: number
  cashierName: string
  syncTime: string
  search: string
  onSearchChange: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  onScanClick: () => void
  imeiSlot?: React.ReactNode
  customerSlot: React.ReactNode
  categoryBar: React.ReactNode
  productGrid: React.ReactNode
  pagination: React.ReactNode
  bottomActions: React.ReactNode
  cartPanel: React.ReactNode
  mainOverlay?: React.ReactNode
}

function StatCard({ label, value, trend, accent }: { label: string; value: string; trend?: string; accent?: string }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl px-4 py-3 border" style={{ background: C.card, borderColor: C.border }}>
      <p className="text-[11px] font-medium mb-1" style={{ color: C.muted }}>{label}</p>
      <p className="text-lg font-bold leading-tight" style={{ color: accent || C.text }}>{value}</p>
      {trend && (
        <p className="text-[10px] font-semibold mt-1" style={{ color: trend.startsWith('+') ? '#10b981' : '#ef4444' }}>{trend}</p>
      )}
    </div>
  )
}

export function HexaPosLayout({
  shopName,
  activeNav,
  onNavChange,
  onClose,
  todayRevenue,
  todayOrders,
  lowStockCount,
  cartCount,
  cashierName,
  syncTime,
  search,
  onSearchChange,
  searchRef,
  onScanClick,
  imeiSlot,
  customerSlot,
  categoryBar,
  productGrid,
  pagination,
  bottomActions,
  cartPanel,
  mainOverlay,
}: HexaPosLayoutProps) {
  const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r" style={{ background: C.panel, borderColor: C.border }}>
        <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})` }}>
              <ShoppingCart size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">POS Terminal</p>
              <p className="text-[11px] mt-0.5 truncate max-w-[130px]" style={{ color: C.muted }}>{shopName || 'Hexa Mobile Store'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {POS_NAV.map(item => {
            const active = activeNav === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavChange(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all relative"
                style={{
                  background: active ? `linear-gradient(90deg, rgba(124,58,237,0.35), rgba(124,58,237,0.08))` : 'transparent',
                  color: active ? '#fff' : C.muted,
                }}
              >
                {active && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: C.purple }} />}
                <Icon size={16} style={{ color: active ? '#c4b5fd' : C.muted }} />
                <span className="truncate">{item.label}</span>
                {item.id === 'products' && cartCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: C.purple }}>{cartCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t" style={{ borderColor: C.border }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Shortcuts</p>
          <div className="space-y-1">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center justify-between text-[11px]" style={{ color: C.muted }}>
                <span>{s.label}</span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: C.card, color: '#a0aec0' }}>{s.key}</kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: C.border }}>
          <Cloud size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">Terminal Online</span>
          <Wifi size={12} className="ml-auto text-emerald-500/70" />
        </div>
      </aside>

      {/* ── MAIN + CART ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Stats + header actions */}
        <div className="shrink-0 px-4 pt-3 pb-2 border-b" style={{ borderColor: C.border, background: C.panel }}>
          <div className="flex flex-wrap items-stretch gap-3 mb-3">
            <StatCard label="Today's Sales" value={fmt(todayRevenue)} trend="+12.5%" />
            <StatCard label="Profit" value={fmt(Math.round(todayRevenue * 0.14))} trend="+8.3%" accent="#a78bfa" />
            <StatCard label="Orders" value={String(todayOrders)} trend="+5.7%" />
            <div className="flex-1 min-w-[140px] rounded-xl px-4 py-3 border flex flex-col justify-center" style={{ background: C.card, borderColor: C.border }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: C.muted }}>Low Stock Items</p>
              <p className="text-lg font-bold text-red-400">{lowStockCount}</p>
              {lowStockCount > 0 && <button type="button" className="text-[10px] text-red-400/80 text-left mt-1 hover:underline">View all</button>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 lg:hidden" title="Menu"><Menu size={16} style={{ color: C.muted }} /></button>
            <button type="button" onClick={onScanClick} className="h-9 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-2 shrink-0" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})` }}>
              <ScanLine size={14} /> Scan (F1)
            </button>
            {imeiSlot}
            <div className="flex-1 min-w-[200px] relative">
              <ScanLine size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search products by name, SKU, IMEI, Serial number..."
                className="w-full h-9 pl-9 pr-3 rounded-xl text-sm outline-none border"
                style={{ background: C.card, borderColor: C.border, color: C.text }}
              />
            </div>
            <button type="button" onClick={onScanClick} className="h-9 px-3 rounded-xl text-xs font-semibold border shrink-0" style={{ borderColor: C.border, color: C.muted, background: C.card }}>
              Scan Barcode
            </button>
            <button type="button" className="relative h-9 w-9 rounded-xl border flex items-center justify-center shrink-0" style={{ borderColor: C.border, background: C.card }}>
              <Bell size={15} style={{ color: C.muted }} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">3</span>
            </button>
            <button type="button" className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0" style={{ borderColor: C.border, background: C.card }}>
              <Settings size={15} style={{ color: C.muted }} />
            </button>
            {customerSlot}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 relative">
          {mainOverlay}
          {/* Center column */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: C.bg }}>
            {categoryBar}
            <div className="flex-1 overflow-y-auto px-4 py-3">{productGrid}</div>
            {pagination}
            {bottomActions}
          </div>
          {/* Cart */}
          <div className="w-[min(420px,38vw)] shrink-0 flex flex-col border-l min-h-0" style={{ borderColor: C.border, background: C.panel }}>
            {cartPanel}
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t text-[11px]" style={{ borderColor: C.border, background: C.panel, color: C.muted }}>
          <span>© 2024 Hexa-VIMS POS System</span>
          <div className="flex flex-wrap items-center gap-3">
            <span>Terminal: T01</span>
            <span>|</span>
            <span>Cashier: {cashierName}</span>
            <span>|</span>
            <span>Session: 01</span>
            <span>|</span>
            <span>Last Sync: {syncTime}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export { C as POS_THEME }
