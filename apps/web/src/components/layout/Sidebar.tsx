'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, LogOut,
  CreditCard, Smartphone,   FileText, Building2,
  UserCheck, ChevronLeft, ChevronRight, ChevronDown, Receipt, MessageSquare, MessageSquarePlus, PackageCheck, RotateCcw, ArrowLeftRight, Layers, RefreshCw, Lock, PieChart, Sparkles, BookOpen, TrendingUp, Landmark, Wallet, Calendar, ReceiptText, Plus, ClipboardList, DollarSign, Activity, PhoneCall, Tag,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi, tenantApi } from '@/lib/api'
import { fetchInvoiceSettings, getInvoiceSettings } from '@/lib/invoiceSettings'
import { useTenantFeatures, useRolePermissions } from '@/lib/hooks'
import { usePos } from '@/lib/use-pos'
import { getActiveBranchId, getBranchLabel, getVisibleBranches } from '@/lib/active-branch'
import type { RolePermissionModuleKey } from '@/lib/role-permissions'
import type { LucideIcon } from 'lucide-react'

type NavSubItem = {
  href: string
  icon: LucideIcon
  label: string
  feature?: string
  badge?: string
  /** Role permission module key */
  permission?: string
  /** Require Edit (hide from View-only roles) */
  requiresEdit?: boolean
}

type NavItem = {
  href: string
  icon: LucideIcon
  label: string
  badge?: string
  feature?: string
  openPos?: boolean
  ownerOnly?: boolean
  permission?: string
  requiresEdit?: boolean
  submenu?: NavSubItem[]
}

type NavGroup = { label: string; items: NavItem[] }

const inventorySubmenu: NavSubItem[] = [
  { href: '/inventory', icon: Package, label: 'All Products', permission: 'INVENTORY' },
  { href: '/inventory/add-product', icon: Plus, label: 'Add Product', permission: 'INVENTORY', requiresEdit: true },
  { href: '/dashboard/stock-transfer', icon: ArrowLeftRight, label: 'Stock Transfer', badge: 'NEW', permission: 'INVENTORY', requiresEdit: true },
]

const suppliersSubmenu: NavSubItem[] = [
  { href: '/dashboard/suppliers', icon: Truck, label: 'All Suppliers', permission: 'SUPPLIERS' },
  { href: '/dashboard/supplier-payments', icon: Wallet, label: 'Supplier Payments', badge: 'NEW', permission: 'SUPPLIERS', requiresEdit: true },
]

const accountingSubmenu: NavSubItem[] = [
  { href: '/dashboard/accounting', icon: BookOpen, label: 'Overview', permission: 'ACCOUNTING' },
  { href: '/dashboard/accounting/journals', icon: FileText, label: 'GL Journals', permission: 'ACCOUNTING', requiresEdit: true },
  { href: '/dashboard/accounting/reports', icon: BarChart3, label: 'GL Reports', permission: 'ACCOUNTING' },
  { href: '/dashboard/accounting/ar-ap', icon: Users, label: 'AR / AP', permission: 'ACCOUNTING' },
  { href: '/dashboard/accounting/cash-bank', icon: Landmark, label: 'Cash & Bank', permission: 'ACCOUNTING' },
  { href: '/dashboard/accounting/tax', icon: ReceiptText, label: 'VAT / Tax', permission: 'ACCOUNTING' },
  { href: '/dashboard/accounting/petty-cash', icon: Wallet, label: 'Petty Cash', permission: 'ACCOUNTING', requiresEdit: true },
  { href: '/dashboard/accounting/payroll', icon: Users, label: 'Payroll', permission: 'ACCOUNTING', requiresEdit: true },
  { href: '/dashboard/accounting/periods', icon: Calendar, label: 'Periods', permission: 'ACCOUNTING', requiresEdit: true },
  { href: '/dashboard/accounting/audit', icon: Shield, label: 'Audit Trail', permission: 'ACCOUNTING' },
  { href: '/dashboard/accounting/settings', icon: Settings, label: 'Settings', permission: 'ACCOUNTING', requiresEdit: true },
]

const reportsSubmenu: NavSubItem[] = [
  { href: '/dashboard/reports/overview', icon: BarChart3, label: 'Overview', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/reports/sales', icon: ShoppingCart, label: 'Sales', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/reports/pl', icon: DollarSign, label: 'P&L Report', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/reports/cashflow', icon: Activity, label: 'Cash Flow', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/reports/inventory', icon: Package, label: 'Inventory', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/reports/repairs', icon: Wrench, label: 'Repairs', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/reports/delivery', icon: Truck, label: 'Delivery', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/daily-reload-report', icon: PhoneCall, label: 'Daily Reload Report', badge: 'NEW', feature: 'DAILY_RELOAD', permission: 'DAILY_RELOAD' },
  { href: '/dashboard/category-report', icon: Tag, label: 'Category Report', badge: 'NEW', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/customer-report', icon: Users, label: 'Customer Report', badge: 'NEW', feature: 'REPORTS', permission: 'REPORTS' },
  { href: '/dashboard/purchase-report', icon: ClipboardList, label: 'Purchase Report', badge: 'NEW', feature: 'REPORTS', permission: 'REPORTS' },
]

const navItems: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: 'DASHBOARD' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/dashboard/pos',       icon: ShoppingCart, label: 'Point of Sale',  badge: 'POS', feature: 'POS', openPos: true, permission: 'POS', requiresEdit: true },
      { href: '/dashboard/sales',     icon: Receipt,      label: 'Sales History',               feature: 'POS', permission: 'POS' },
      { href: '/dashboard/returns',   icon: RotateCcw,    label: 'Returns',                     feature: 'POS', permission: 'POS', requiresEdit: true },
      { href: '/dashboard/customers', icon: Users,        label: 'Customers', permission: 'CUSTOMERS' },
      { href: '/dashboard/services',  icon: Layers,       label: 'Services',      badge: 'NEW', feature: 'SERVICES', permission: 'SERVICES' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        href: '/inventory',
        icon: Package,
        label: 'Inventory',
        permission: 'INVENTORY',
        submenu: inventorySubmenu,
      },
      {
        href: '/dashboard/suppliers',
        icon: Truck,
        label: 'Suppliers',
        feature: 'SUPPLIERS',
        permission: 'SUPPLIERS',
        submenu: suppliersSubmenu,
      },
      { href: '/dashboard/purchase-orders', icon: ClipboardList, label: 'Purchase Orders', feature: 'SUPPLIERS', permission: 'SUPPLIERS' },
      { href: '/dashboard/imei', icon: Smartphone, label: 'IMEI Tracker', badge: 'NEW', feature: 'IMEI', permission: 'IMEI' },
    ],
  },
  {
    label: 'Service',
    items: [
      { href: '/dashboard/repairs',   icon: Wrench,         label: 'Repair Jobs',                 feature: 'REPAIRS', permission: 'REPAIRS' },
      { href: '/dashboard/warranty',  icon: Shield,         label: 'Warranty',                    feature: 'WARRANTY', permission: 'WARRANTY' },
      { href: '/dashboard/exchanges', icon: ArrowLeftRight, label: 'Device Exchange', badge: 'NEW', feature: 'EXCHANGES', permission: 'EXCHANGES' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/finance',   icon: CreditCard, label: 'Finance',   feature: 'FINANCE', permission: 'FINANCE' },
      { href: '/dashboard/profit-loss', icon: TrendingUp, label: 'Profit & Loss', badge: 'NEW', feature: 'FINANCE', permission: 'FINANCE' },
      { href: '/dashboard/expenses',  icon: Receipt,    label: 'Expenses',  badge: 'NEW', feature: 'FINANCE', permission: 'FINANCE' },
      { href: '/dashboard/profit-allocation', icon: PieChart, label: 'Profit Allocation', badge: 'NEW', feature: 'PROFIT_ALLOCATION', permission: 'PROFIT_ALLOCATION' },
      { href: '/dashboard/daily-closing', icon: Lock,   label: 'Daily Closing', badge: 'NEW', feature: 'DAILY_CLOSING', permission: 'DAILY_CLOSING' },
      {
        href: '/dashboard/accounting',
        icon: BookOpen,
        label: 'Accounting',
        badge: 'NEW',
        feature: 'ACCOUNTING',
        permission: 'ACCOUNTING',
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
        permission: 'REPORTS',
        submenu: reportsSubmenu,
      },
    ],
  },
  {
    label: 'HR & Staff',
    items: [
      { href: '/dashboard/staff', icon: UserCheck, label: 'Staff & Roles', feature: 'STAFF', permission: 'STAFF' },
      { href: '/dashboard/role-permissions', icon: Shield, label: 'Role Permissions', badge: 'NEW', feature: 'STAFF', permission: 'STAFF', requiresEdit: true },
      { href: '/dashboard/role-permissions-guide', icon: BookOpen, label: 'Permissions Guide', feature: 'STAFF', permission: 'STAFF' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { href: '/dashboard/delivery', icon: PackageCheck, label: 'Delivery Orders', badge: 'NEW', feature: 'DELIVERY', permission: 'DELIVERY' },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { href: '/dashboard/whatsapp', icon: MessageSquare, label: 'WhatsApp', feature: 'WHATSAPP', permission: 'WHATSAPP' },
    ],
  },
  {
    label: 'Reload',
    items: [
      { href: '/dashboard/daily-reload', icon: RefreshCw, label: 'Daily Reload', badge: 'NEW', feature: 'DAILY_RELOAD', permission: 'DAILY_RELOAD' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/user-manual', icon: BookOpen, label: 'User Manual' },
      { href: '/dashboard/release-notes', icon: Sparkles, label: 'Release Notes', badge: 'NEW' },
      { href: '/dashboard/feature-suggestions', icon: MessageSquarePlus, label: 'Feature Suggestions' },
      { href: '/dashboard/branches', icon: Building2, label: 'Branches', badge: 'NEW', permission: 'BRANCHES' },
      { href: '/dashboard/settings', icon: Settings,  label: 'Settings', permission: 'SETTINGS' },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

const PLAN_STYLE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  TRIAL: {
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/15 dark:bg-amber-500/10',
    border: 'border-amber-500/35 dark:border-amber-500/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  STARTER: {
    text: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-200/80 dark:bg-white/5',
    border: 'border-slate-300 dark:border-white/10',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
  PRO: {
    text: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-500/15 dark:bg-sky-500/10',
    border: 'border-sky-500/40 dark:border-sky-500/25',
    dot: 'bg-sky-600 dark:bg-sky-400',
  },
  ENTERPRISE: {
    text: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-500/15 dark:bg-indigo-500/10',
    border: 'border-indigo-500/40 dark:border-indigo-500/25',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
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
  const [branchTick, setBranchTick] = useState(0)
  const user = useMemo(() => authStorage.getUser(), [branchTick])
  const tenantId = user?.tenantId
  const [shopName, setShopName] = useState('')
  const [plan, setPlan]         = useState('')
  const [logo, setLogo]         = useState('')
  const { hasFeature }          = useTenantFeatures()
  const { canView, canEdit }    = useRolePermissions()
  const { openPos, posOpen }    = usePos()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  const allowsNavAccess = (permission?: string, requiresEdit?: boolean) => {
    if (!permission) return true
    const key = permission as RolePermissionModuleKey
    if (requiresEdit) return canEdit(key)
    return canView(key)
  }

  const visibleBranches = useMemo(() => getVisibleBranches(user), [user])
  const activeBranchName = useMemo(() => {
    if (!user) return ''
    if (user.branchScope === 'all') return 'All Branches'
    const branches = getVisibleBranches(user)
    if (!branches.length) return ''
    return getBranchLabel(branches, getActiveBranchId() ?? branches[0]?.id)
  }, [user])

  /** Multi-branch: show active branch. Single branch: keep shop name (branch as fallback). */
  const displayName = visibleBranches.length > 1
    ? (activeBranchName || shopName || 'My Shop')
    : (shopName || activeBranchName || 'My Shop')
  const displaySubtitle = visibleBranches.length > 1 && shopName && shopName !== displayName
    ? shopName
    : null

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
    const handleBranchChange = () => setBranchTick(t => t + 1)
    window.addEventListener('active-branch-changed', handleBranchChange)
    const handleUserStorage = (event: StorageEvent) => {
      if (event.key === 'hx_user') handleBranchChange()
    }
    window.addEventListener('storage', handleUserStorage)

    return () => {
      cancelled = true
      window.removeEventListener('shop-settings-updated', handleBrandUpdate)
      window.removeEventListener('invoice-settings-updated', handleBrandUpdate)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('active-branch-changed', handleBranchChange)
      window.removeEventListener('storage', handleUserStorage)
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
          className={cn(
            'relative flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden',
            'border border-[var(--border-default)] bg-[var(--bg-card)]',
          )}
        >
          {logo ? (
            <img src={logo} alt={displayName} className="w-full h-full object-contain p-0.5" />
          ) : (
            <div className="w-full h-full accent-gradient-br flex items-center justify-center">
              <span className="text-white font-black text-sm tracking-tight">
                {(displayName || 'H').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="relative min-w-0 flex-1 py-0.5">
            <p
              className="font-semibold text-[15px] leading-snug tracking-tight break-words line-clamp-2"
              style={{ color: 'var(--text-primary)' }}
              title={displayName}
            >
              {displayName}
            </p>
            {displaySubtitle && (
              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }} title={displaySubtitle}>
                {displaySubtitle}
              </p>
            )}
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
            if (!allowsNavAccess(item.permission, item.requiresEdit)) return false
            // Owner can always open Staff & Roles to manage the permission matrix
            if (user?.role === 'OWNER' && item.permission === 'STAFF') return true
            return !('feature' in item) || !(item as any).feature || hasFeature((item as any).feature as string)
          })
          if (visibleItems.length === 0) return null
          return (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5 mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.label}
              </p>
            )}
            {collapsed && <div className="my-1 h-px mx-2" style={{ background: 'var(--border-subtle)' }} />}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                if (item.submenu?.length) {
                  const menuKey = item.label.toLowerCase().replace(/\s+/g, '-')
                  const open = expandedMenus[menuKey] ?? false
                  const visibleSubmenu = item.submenu.filter(sub =>
                    (!sub.feature || hasFeature(sub.feature)) &&
                    allowsNavAccess(sub.permission ?? item.permission, sub.requiresEdit),
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
                        <item.icon size={17} className={cn('flex-shrink-0 transition-colors', open || sectionActive ? 'accent-text' : '')} style={open || sectionActive ? undefined : { color: 'var(--text-muted)' }} />
                        <span className="text-sm font-semibold flex-1 truncate text-left" style={{ color: 'inherit' }}>{item.label}</span>
                        {shouldShowBadge(item.badge) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25">
                            {item.badge}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          className={cn(
                            'flex-shrink-0 transition-transform duration-200',
                            open && 'rotate-180',
                          )}
                          style={{ color: 'var(--text-muted)' }}
                        />
                      </button>
                      {open && (
                        <div className="ml-3 pl-3 space-y-0.5 my-0.5 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
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
                                <sub.icon size={15} className={cn('flex-shrink-0', subActive ? 'accent-text' : '')} style={subActive ? undefined : { color: 'var(--text-muted)' }} />
                                <span className="text-sm font-medium flex-1 truncate">{sub.label}</span>
                                {shouldShowBadge(sub.badge) && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25">
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
                    <item.icon size={17} className={cn('flex-shrink-0 transition-colors', active ? 'accent-text' : '')} style={active ? undefined : { color: 'var(--text-muted)' }} />
                    {!collapsed && (
                      <>
                        <span className="text-sm font-semibold flex-1 truncate">{item.label}</span>
                        {'badge' in item && shouldShowBadge(item.badge) && (
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0',
                            item.badge === 'NEW'
                              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25'
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
