'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, LogOut,
  CreditCard, Smartphone,   FileText, Building2,
  UserCheck, ChevronLeft, ChevronRight, ChevronDown, Receipt, MessageSquare, PackageCheck, RotateCcw, ArrowLeftRight, Layers, RefreshCw, Lock, PieChart, Sparkles, BookOpen, TrendingUp, Landmark, Wallet, Calendar, ReceiptText, Plus, ClipboardList,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi, tenantApi } from '@/lib/api'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
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
      { href: '/dashboard/suppliers?tab=suppliers', icon: Truck, label: 'Suppliers', feature: 'SUPPLIERS' },
      { href: '/dashboard/suppliers?tab=orders', icon: ClipboardList, label: 'Purchase Orders', feature: 'SUPPLIERS' },
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
      { href: '/dashboard/reports',          icon: BarChart3, label: 'Reports & Analytics', feature: 'REPORTS' },
      { href: '/dashboard/category-report',  icon: FileText, label: 'Category Report', badge: 'NEW', feature: 'REPORTS' },
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
      { href: '/dashboard/branches', icon: Building2, label: 'Branches', badge: 'NEW', ownerOnly: true },
      { href: '/dashboard/settings', icon: Settings,  label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

const PLAN_COLOR: Record<string, string> = {
  TRIAL:      'text-amber-400',
  STARTER:    'text-slate-400',
  PRO:        'text-blue-400',
  ENTERPRISE: 'text-violet-400',
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = authStorage.getUser()
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
  }, [pathname])

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    const inv = getInvoiceSettings()
    if (inv.shopName) setShopName(inv.shopName)
    if (inv.logo)     setLogo(inv.logo)
    if (user?.tenantId) {
      tenantApi.get(user.tenantId).then((res: any) => {
        const t = res.data ?? res
        if (t.plan) setPlan(t.plan)
        if (!inv.shopName && t.name) setShopName(t.name)
      }).catch(() => {})
      import('@/lib/invoiceSettings').then(({ fetchInvoiceSettings }) =>
        fetchInvoiceSettings(user.tenantId!).then(s => {
          if (s.shopName) setShopName(s.shopName)
          if (s.logo)     setLogo(s.logo)
        })
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    authStorage.clear()
    router.replace('/login')
  }

  const isActive = (href: string) => {
    const [path, query] = href.split('?')
    if (path === '/dashboard/suppliers' || path === '/suppliers') {
      const onSuppliersPage =
        pathname === '/dashboard/suppliers' ||
        pathname.startsWith('/dashboard/suppliers/') ||
        pathname === '/suppliers' ||
        pathname.startsWith('/suppliers/')
      if (!onSuppliersPage) return false
      const tab = new URLSearchParams(query ?? '').get('tab') ?? 'suppliers'
      const currentTab = searchParams.get('tab') ?? 'suppliers'
      return tab === currentTab
    }
    if (path === '/dashboard') return pathname === '/dashboard'
    if (path === '/dashboard/accounting') {
      return pathname === '/dashboard/accounting' || pathname === '/dashboard/accounting/'
    }
    if (path === '/inventory') {
      return pathname === '/inventory' || pathname.startsWith('/dashboard/inventory')
    }
    if (path === '/inventory/add-product') {
      return pathname === '/inventory/add-product' || pathname === '/dashboard/inventory/add-product'
    }
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const inventorySectionPaths = ['/inventory', '/dashboard/inventory', '/dashboard/stock-transfer']

  return (
    <aside className={cn(
      'flex flex-col h-full border-r transition-all duration-300 relative',
      collapsed ? 'w-16' : 'w-60'
    )}
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 z-10 w-6 h-6 border rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-violet-500/40 transition-all shadow-lg hidden lg:flex"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg" style={{ background: logo ? 'transparent' : undefined }}>
          {logo
            ? <img src={logo} alt={shopName} className="w-full h-full object-contain" />
            : <div className="w-full h-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center"><span className="text-white font-black text-sm">{(shopName || 'H').charAt(0).toUpperCase()}</span></div>
          }
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-white font-bold text-base truncate block">{shopName || 'My Shop'}</span>
            {plan && <span className={`block text-xs -mt-0.5 font-medium capitalize ${PLAN_COLOR[plan] ?? 'text-slate-400'}`}>{plan.charAt(0) + plan.slice(1).toLowerCase()}</span>}
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
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-1 mt-1">
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
                  const sectionActive =
                    (item.href === '/inventory' && inventorySectionPaths.some(p => pathname === p || pathname.startsWith(`${p}/`)))
                    || visibleSubmenu.some(s => isActive(s.href))
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
                        <item.icon size={17} className={cn('flex-shrink-0', sectionActive ? 'text-violet-400' : 'text-slate-500')} />
                      </Link>
                    )
                  }

                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        onClick={() => toggleMenu(menuKey)}
                        className={cn(
                          'sidebar-item group w-full text-left',
                          sectionActive && 'sidebar-item-active',
                        )}
                      >
                        <item.icon size={17} className={cn('flex-shrink-0 transition-colors', sectionActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300')} />
                        <span className="text-sm font-medium flex-1 truncate text-left">{item.label}</span>
                        {item.badge && (
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
                                <sub.icon size={15} className={cn('flex-shrink-0', subActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300')} />
                                <span className="text-sm font-medium flex-1 truncate">{sub.label}</span>
                                {sub.badge && (
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
                    <item.icon size={17} className={cn('flex-shrink-0 transition-colors', active ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300')} />
                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                        {'badge' in item && item.badge && (
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0',
                            item.badge === 'NEW'
                              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                              : 'bg-violet-600/20 text-violet-400 border border-violet-500/20'
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
