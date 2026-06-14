'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, LogOut,
  CreditCard, Smartphone, FileText, Building2,
  UserCheck, ChevronLeft, ChevronRight, Receipt, MessageSquare, PackageCheck, RotateCcw, ArrowLeftRight, Layers, RefreshCw, Lock, PieChart
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi, tenantApi } from '@/lib/api'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { useTenantFeatures } from '@/lib/hooks'
import { usePos } from '@/lib/use-pos'

const navItems = [
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
      { href: '/dashboard/inventory',  icon: Package,    label: 'Inventory' },
      { href: '/dashboard/imei',       icon: Smartphone, label: 'IMEI Tracker',    badge: 'NEW', feature: 'IMEI' },
      { href: '/dashboard/suppliers',  icon: Truck,      label: 'Suppliers & PO',              feature: 'SUPPLIERS' },
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
      { href: '/dashboard/expenses',  icon: Receipt,    label: 'Expenses',  badge: 'NEW', feature: 'FINANCE' },
      { href: '/dashboard/profit-allocation', icon: PieChart, label: 'Profit Allocation', badge: 'NEW', feature: 'PROFIT_ALLOCATION' },
      { href: '/dashboard/daily-closing', icon: Lock,   label: 'Daily Closing', badge: 'NEW', feature: 'DAILY_CLOSING' },
      { href: '/dashboard/analytics', icon: BarChart3,  label: 'Analytics', feature: 'ANALYTICS' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/dashboard/reports',          icon: FileText, label: 'Reports',          badge: 'NEW', feature: 'REPORTS' },
      { href: '/dashboard/category-report',  icon: BarChart3, label: 'Category Report', badge: 'NEW', feature: 'REPORTS' },
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
      { href: '/dashboard/branches', icon: Building2, label: 'Branches', badge: 'NEW' },
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
  const user = authStorage.getUser()
  const [shopName, setShopName] = useState('')
  const [plan, setPlan]         = useState('')
  const [logo, setLogo]         = useState('')
  const { hasFeature }          = useTenantFeatures()
  const { openPos, posOpen }    = usePos()

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
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

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
          const visibleItems = group.items.filter(item => !('feature' in item) || !(item as any).feature || hasFeature((item as any).feature as string))
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
