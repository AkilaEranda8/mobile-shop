'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, LogOut,
  CreditCard, Smartphone,   FileText, Building2,
  UserCheck, ChevronLeft, ChevronRight, ChevronDown, Receipt, MessageSquare, MessageSquarePlus, PackageCheck, RotateCcw, ArrowLeftRight, Layers, RefreshCw, Lock, PieChart, Sparkles, BookOpen, TrendingUp, Landmark, Wallet, Calendar, ReceiptText, Plus, ClipboardList, DollarSign, Activity, PhoneCall, Tag,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi, tenantApi } from '@/lib/api'
import { fetchInvoiceSettings, getInvoiceSettings } from '@/lib/invoiceSettings'
import { useTenantFeatures } from '@/lib/hooks'
import { usePos } from '@/lib/use-pos'
import type { LucideIcon } from 'lucide-react'

type NavSubItem = { href: string; icon: LucideIcon; label: string; feature?: string; badge?: string }

type NavItem = {
  href: string
  icon: LucideIcon
  label: string
  badge?: string
  feature?: string
  openPos?: boolean
  ownerOnly?: boolean
  submenu?: NavSubItem[]
}

type NavGroup = { label: string; items: NavItem[] }

const inventorySubmenu: NavSubItem[] = [
  { href: '/inventory', icon: Package, label: 'All Products' },
  { href: '/inventory/add-product', icon: Plus, label: 'Add Product' },
  { href: '/dashboard/stock-transfer', icon: ArrowLeftRight, label: 'Stock Transfer', badge: 'NEW' },
]

const suppliersSubmenu: NavSubItem[] = [
  { href: '/dashboard/suppliers', icon: Truck, label: 'All Suppliers' },
  { href: '/dashboard/supplier-payments', icon: Wallet, label: 'Supplier Payments', badge: 'NEW' },
]

const accountingSubmenu: NavSubItem[] = [
  { href: '/dashboard/accounting', icon: BookOpen, label: 'Overview' },
  { href: '/dashboard/accounting/journals', icon: FileText, label: 'GL Journals' },
  { href: '/dashboard/accounting/reports', icon: BarChart3, label: 'GL Reports' },
  { href: '/dashboard/accounting/ar-ap', icon: Users, label: 'AR / AP' },
  { href: '/dashboard/accounting/cash-bank', icon: Landmark, label: 'Cash & Bank' },
  { href: '/dashboard/accounting/tax', icon: ReceiptText, label: 'VAT / Tax' },
  { href: '/dashboard/accounting/petty-cash', icon: Wallet, label: 'Petty Cash' },
  { href: '/dashboard/accounting/payroll', icon: Users, label: 'Payroll' },
  { href: '/dashboard/accounting/periods', icon: Calendar, label: 'Periods' },
  { href: '/dashboard/accounting/audit', icon: Shield, label: 'Audit Trail' },
  { href: '/dashboard/accounting/settings', icon: Settings, label: 'Settings' },
]

const reportsSubmenu: NavSubItem[] = [
  { href: '/dashboard/reports/overview', icon: BarChart3, label: 'Overview', feature: 'REPORTS' },
  { href: '/dashboard/reports/sales', icon: ShoppingCart, label: 'Sales', feature: 'REPORTS' },
  { href: '/dashboard/reports/pl', icon: DollarSign, label: 'P&L Report', feature: 'REPORTS' },
  { href: '/dashboard/reports/cashflow', icon: Activity, label: 'Cash Flow', feature: 'REPORTS' },
  { href: '/dashboard/reports/inventory', icon: Package, label: 'Inventory', feature: 'REPORTS' },
  { href: '/dashboard/reports/repairs', icon: Wrench, label: 'Repairs', feature: 'REPORTS' },
  { href: '/dashboard/reports/delivery', icon: Truck, label: 'Delivery', feature: 'REPORTS' },
  { href: '/dashboard/daily-reload-report', icon: PhoneCall, label: 'Daily Reload Report', badge: 'NEW', feature: 'DAILY_RELOAD' },
  { href: '/dashboard/category-report', icon: Tag, label: 'Category Report', badge: 'NEW', feature: 'REPORTS' },
  { href: '/dashboard/customer-report', icon: Users, label: 'Customer Report', badge: 'NEW', feature: 'REPORTS' },
  { href: '/dashboard/purchase-report', icon: ClipboardList, label: 'Purchase Report', badge: 'NEW', feature: 'REPORTS' },
]

const navItems: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/dashboard/pos',       icon: ShoppingCart, label: 'Point of Sale',  badge: 'POS', feature: 'POS', openPos: true },
      { href: '/dashboard/sales',     icon: Receipt,      label: 'Sales History',               feature: 'POS' },
      { href: '/dashboard/returns',   icon: RotateCcw,    label: 'Returns',                     feature: 'POS' },
      { href: '/dashboard/customers', icon: Users,        label: 'Customers' },
      { href: '/dashboard/services',  icon: Layers,       label: 'Services',      badge: 'NEW', feature: 'SERVICES' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        href: '/inventory',
        icon: Package,
        label: 'Inventory',
        submenu: inventorySubmenu,
      },
      {
        href: '/dashboard/suppliers',
        icon: Truck,
        label: 'Suppliers',
        feature: 'SUPPLIERS',
        submenu: suppliersSubmenu,
      },
      { href: '/dashboard/purchase-orders', icon: ClipboardList, label: 'Purchase Orders', feature: 'SUPPLIERS' },
      { href: '/dashboard/imei', icon: Smartphone, label: 'IMEI Tracker', badge: 'NEW', feature: 'IMEI' },
    ],
  },
  {
    label: 'Service',
    items: [
      { href: '/dashboard/repairs',   icon: Wrench,         label: 'Repair Jobs',                 feature: 'REPAIRS' },
      { href: '/dashboard/warranty',  icon: Shield,         label: 'Warranty',                    feature: 'WARRANTY' },
      { href: '/dashboard/exchanges', icon: ArrowLeftRight, label: 'Device Exchange', badge: 'NEW', feature: 'EXCHANGES' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/finance',   icon: CreditCard, label: 'Finance',   feature: 'FINANCE' },
      { href: '/dashboard/profit-loss', icon: TrendingUp, label: 'Profit & Loss', badge: 'NEW', feature: 'FINANCE' },
      { href: '/dashboard/expenses',  icon: Receipt,    label: 'Expenses',  badge: 'NEW', feature: 'FINANCE' },
      { href: '/dashboard/profit-allocation', icon: PieChart, label: 'Profit Allocation', badge: 'NEW', feature: 'PROFIT_ALLOCATION' },
      { href: '/dashboard/daily-closing', icon: Lock,   label: 'Daily Closing', badge: 'NEW', feature: 'DAILY_CLOSING' },
      {
        href: '/dashboard/accounting',
        icon: BookOpen,
        label: 'Accounting',
        badge: 'NEW',
        feature: 'ACCOUNTING',
        submenu: accountingSubmenu,
      },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        href: '/dashboard/reports/overview',
        icon: BarChart3,
        label: 'Reports & Analytics',
        feature: 'REPORTS',
        submenu: reportsSubmenu,
      },
    ],
  },
  {
    label: 'HR & Staff',
    items: [
      { href: '/dashboard/staff', icon: UserCheck, label: 'Staff & Roles', badge: 'NEW', feature: 'STAFF' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { href: '/dashboard/delivery', icon: PackageCheck, label: 'Delivery Orders', badge: 'NEW', feature: 'DELIVERY' },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { href: '/dashboard/whatsapp', icon: MessageSquare, label: 'WhatsApp', feature: 'WHATSAPP' },
    ],
  },
  {
    label: 'Reload',
    items: [
      { href: '/dashboard/daily-reload', icon: RefreshCw, label: 'Daily Reload', badge: 'NEW', feature: 'DAILY_RELOAD' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/user-manual', icon: BookOpen, label: 'User Manual' },
      { href: '/dashboard/release-notes', icon: Sparkles, label: 'Release Notes', badge: 'NEW' },
      { href: '/dashboard/feature-suggestions', icon: MessageSquarePlus, label: 'Feature Suggestions' },
      { href: '/dashboard/branches', icon: Building2, label: 'Branches', badge: 'NEW', ownerOnly: true },
      { href: '/dashboard/settings', icon: Settings,  label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

const PLAN_STYLE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  TRIAL: {
    text: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
  STARTER: {
    text: 'text-slate-300',
    bg: 'bg-white/5',
    border: 'border-white/10',
    dot: 'bg-slate-400',
  },
  PRO: {
    text: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    dot: 'bg-sky-400',
  },
  ENTERPRISE: {
    text: 'text-indigo-300',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    dot: 'bg-indigo-400',
  },
}

// UX: hide the "NEW" badge across the sidebar.
// Keep other badges (POS/etc) if they exist.
const SHOW_NEW_BADGES = false
const shouldShowBadge = (badge?: string) => !!badge && (badge !== 'NEW' || SHOW_NEW_BADGES)

function isInventoryListPath(path: string) {
  return path === '/inventory' || path === '/dashboard/inventory'
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const navAction = searchParams.get('action')
  const user = authStorage.getUser()
  const tenantId = user?.tenantId
  const [shopName, setShopName] = useState('')
  const [plan, setPlan]         = useState('')
  const [logo, setLogo]         = useState('')
  const { hasFeature }          = useTenantFeatures()
  const { openPos, posOpen }    = usePos()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (pathname.startsWith('/dashboard/accounting')) {
      setExpandedMenus(prev => ({ ...prev, accounting: true }))
    }
    if (
      pathname === '/inventory' ||
      pathname.startsWith('/inventory/') ||
      pathname.startsWith('/dashboard/inventory') ||
      pathname.startsWith('/dashboard/stock-transfer')
    ) {
      setExpandedMenus(prev => ({ ...prev, inventory: true }))
    }
    if (
      pathname.startsWith('/dashboard/suppliers') ||
      pathname.startsWith('/dashboard/supplier-payments')
    ) {
      setExpandedMenus(prev => ({ ...prev, suppliers: true }))
    }
    if (
      pathname.startsWith('/dashboard/reports') ||
      pathname === '/dashboard/category-report' ||
      pathname === '/dashboard/customer-report' ||
      pathname === '/dashboard/purchase-report'
    ) {
      setExpandedMenus(prev => ({ ...prev, 'reports-&-analytics': true }))
    }
  }, [pathname])

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    let cancelled = false

    const applyInvoiceSettings = () => {
      const inv = getInvoiceSettings()
      if (cancelled) return inv
      setShopName(inv.shopName || '')
      setLogo(inv.logo || '')
      return inv
    }

    const loadBrand = async () => {
      const inv = applyInvoiceSettings()
      if (!tenantId) return

      try {
        const res: any = await tenantApi.get(tenantId)
        if (cancelled) return
        const t = res.data ?? res
        if (t.plan) setPlan(t.plan)
        if (!inv.shopName && t.name) setShopName(t.name)
      } catch {
        // Local invoice settings are enough for the sidebar if tenant fetch fails.
      }

      try {
        const s = await fetchInvoiceSettings(tenantId)
        if (cancelled) return
        setShopName(s.shopName || '')
        setLogo(s.logo || '')
      } catch {
        applyInvoiceSettings()
      }
    }

    loadBrand()

    const handleBrandUpdate = () => {
      void loadBrand()
    }
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'hx_invoice_settings') handleBrandUpdate()
    }

    window.addEventListener('shop-settings-updated', handleBrandUpdate)
    window.addEventListener('invoice-settings-updated', handleBrandUpdate)
    window.addEventListener('storage', handleStorage)

    return () => {
      cancelled = true
      window.removeEventListener('shop-settings-updated', handleBrandUpdate)
      window.removeEventListener('invoice-settings-updated', handleBrandUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [tenantId])

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    authStorage.clear()
    router.replace('/login')
  }

  const isActive = (href: string) => {
    const path = href.split('?')[0]
    if (path === '/dashboard') return pathname === '/dashboard'
    if (path === '/dashboard/accounting') {
      return pathname === '/dashboard/accounting' || pathname === '/dashboard/accounting/'
    }
    if (path === '/inventory') {
      if (navAction === 'add-product' || navAction === 'add') return false
      if (pathname === '/inventory/add-product' || pathname === '/dashboard/inventory/add-product') return false
      return isInventoryListPath(pathname)
    }
    if (path === '/inventory/add-product') {
      if (navAction === 'add-product' || navAction === 'add') {
        return isInventoryListPath(pathname)
      }
      return pathname === '/inventory/add-product' || pathname === '/dashboard/inventory/add-product'
    }
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const inventorySectionPaths = ['/inventory', '/dashboard/inventory', '/dashboard/stock-transfer']
  const planStyle = PLAN_STYLE[plan] ?? PLAN_STYLE.STARTER

  return (
    <aside className={cn(
      'flex flex-col h-full border-r transition-all duration-300 relative',
      collapsed ? 'w-16' : 'w-64'
    )}
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 z-10 w-6 h-6 border rounded-full flex items-center justify-center text-slate-500 hover:accent-text dark:hover:text-white accent-border transition-all shadow-lg hidden lg:flex"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Brand header */}
      <div
        className={cn(
          'relative flex items-center border-b min-h-[76px] overflow-hidden',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3.5',
        )}
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 90% 140% at 8% 50%, var(--brand-glow), transparent 62%)',
          }}
        />

        <div
          className={cn(
            'relative flex-shrink-0 w-10 h-10 rounded-2xl overflow-hidden',
            'ring-1 ring-white/12 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)]',
            'bg-[color-mix(in_srgb,var(--bg-card)_88%,transparent)]',
          )}
        >
          {logo ? (
            <img src={logo} alt={shopName || 'Shop'} className="w-full h-full object-contain p-0.5" />
          ) : (
            <div className="w-full h-full accent-gradient-br flex items-center justify-center">
              <span className="text-white font-black text-sm tracking-tight">
                {(shopName || 'H').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="relative min-w-0 flex-1 py-0.5">
            <p
              className="font-semibold text-[15px] leading-snug tracking-tight break-words line-clamp-2"
              style={{ color: 'var(--text-primary)' }}
              title={shopName || 'My Shop'}
            >
              {shopName || 'My Shop'}
            </p>
            {plan && (
              <span
                className={cn(
                  'mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5',
                  'text-[10px] font-semibold uppercase tracking-[0.06em] leading-none',
                  planStyle.text,
                  planStyle.bg,
                  planStyle.border,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', planStyle.dot)} />
                {plan.charAt(0) + plan.slice(1).toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3 scrollbar-thin">
        {navItems.map((group) => {
          const visibleItems = group.items.filter(item => {
            if ('ownerOnly' in item && (item as { ownerOnly?: boolean }).ownerOnly && user?.role !== 'OWNER') return false
            return !('feature' in item) || !(item as any).feature || hasFeature((item as any).feature as string)
          })
          if (visibleItems.length === 0) return null
          return (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold uppercase tracking-widest px-3 mb-1 mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.72 }}>
                {group.label}
              </p>
            )}
            {collapsed && <div className="my-1 h-px bg-white/5 mx-2" />}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                if (item.submenu?.length) {
                  const menuKey = item.label.toLowerCase().replace(/\s+/g, '-')
                  const open = expandedMenus[menuKey] ?? false
                  const visibleSubmenu = item.submenu.filter(sub =>
                    !sub.feature || hasFeature(sub.feature),
                  )
                  if (visibleSubmenu.length === 0) return null
                  const submenuActive = visibleSubmenu.some(s => isActive(s.href))
                  const reportsSectionActive =
                    item.href.startsWith('/dashboard/reports') &&
                    (pathname === '/dashboard/reports' || pathname.startsWith('/dashboard/reports/') ||
                      pathname === '/dashboard/category-report' ||
                      pathname === '/dashboard/customer-report' ||
                      pathname === '/dashboard/purchase-report')
                  const sectionActive =
                    (item.href === '/inventory' && inventorySectionPaths.some(p => pathname === p || pathname.startsWith(`${p}/`)))
                    || submenuActive
                    || reportsSectionActive
                    || isActive(item.href)

                  if (collapsed) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'sidebar-item group justify-center px-2',
                          sectionActive && 'sidebar-item-active',
                        )}
                        title={item.label}
                      >
                        <item.icon size={17} className={cn('flex-shrink-0', sectionActive ? 'accent-text' : '')} style={sectionActive ? undefined : { color: 'var(--text-muted)' }} />
                      </Link>
                    )
                  }

                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        onClick={() => toggleMenu(menuKey)}
                        className="sidebar-item group w-full text-left"
                      >
                        <item.icon size={17} className={cn('flex-shrink-0 transition-colors', open || sectionActive ? 'accent-text' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300')} />
                        <span className="text-sm font-medium flex-1 truncate text-left">{item.label}</span>
                        {shouldShowBadge(item.badge) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                            {item.badge}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          className={cn(
                            'flex-shrink-0 text-slate-500 transition-transform duration-200',
                            open && 'rotate-180',
                          )}
                        />
                      </button>
                      {open && (
                        <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 my-0.5">
                          {visibleSubmenu.map(sub => {
                            const subActive = isActive(sub.href)
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={cn(
                                  'sidebar-item group py-2',
                                  subActive && 'sidebar-item-active',
                                )}
                              >
                                <sub.icon size={15} className={cn('flex-shrink-0', subActive ? 'accent-text' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300')} />
                                <span className="text-sm font-medium flex-1 truncate">{sub.label}</span>
                                {shouldShowBadge(sub.badge) && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                                    {sub.badge}
                                  </span>
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                const active = ('openPos' in item && item.openPos) ? posOpen : isActive(item.href)
                const inner = (
                  <>
                    <item.icon size={17} className={cn('flex-shrink-0 transition-colors', active ? 'accent-text' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300')} />
                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                        {'badge' in item && shouldShowBadge(item.badge) && (
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0',
                            item.badge === 'NEW'
                              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                              : 'accent-badge'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </>
                )
                if ('openPos' in item && item.openPos) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => openPos()}
                      className={cn(
                        'sidebar-item group w-full text-left',
                        active && 'sidebar-item-active',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {inner}
                    </button>
                  )
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'sidebar-item group',
                      active && 'sidebar-item-active',
                      collapsed && 'justify-center px-2'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {inner}
                  </Link>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>

      {/* User section — no avatar */}
      <div className={cn('border-t p-3', collapsed && 'flex justify-center')} style={{ borderColor: 'var(--border-subtle)' }}>
        {collapsed ? (
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name ?? 'User'}</p>
              <p className="text-xs truncate capitalize" style={{ color: 'var(--text-muted)' }}>{user?.role?.toLowerCase() ?? ''}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
