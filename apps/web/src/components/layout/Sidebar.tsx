'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, Building2, LogOut,
  ChevronDown, CreditCard, Zap, Smartphone, FileText,
  UserCheck, DollarSign, ChevronLeft, ChevronRight,
  PieChart, Receipt, Activity, Tag
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi } from '@/lib/api'

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
      { href: '/dashboard/pos', icon: ShoppingCart, label: 'Point of Sale', badge: 'POS' },
      { href: '/dashboard/sales', icon: Receipt, label: 'Sales History' },
      { href: '/dashboard/customers', icon: Users, label: 'Customers' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/dashboard/inventory', icon: Package, label: 'Inventory' },
      { href: '/dashboard/imei', icon: Smartphone, label: 'IMEI Tracker', badge: 'NEW' },
      { href: '/dashboard/suppliers', icon: Truck, label: 'Suppliers & PO' },
    ],
  },
  {
    label: 'Service',
    items: [
      { href: '/dashboard/repairs', icon: Wrench, label: 'Repair Jobs' },
      { href: '/dashboard/warranty', icon: Shield, label: 'Warranty' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/finance', icon: CreditCard, label: 'Finance' },
      { href: '/dashboard/expenses', icon: Receipt, label: 'Expenses', badge: 'NEW' },
      { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/dashboard/reports', icon: FileText, label: 'Reports', badge: 'NEW' },
    ],
  },
  {
    label: 'HR & Staff',
    items: [
      { href: '/dashboard/staff', icon: UserCheck, label: 'Staff & Roles', badge: 'NEW' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [branchOpen, setBranchOpen] = useState(false)
  const user = authStorage.getUser()

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
      'flex flex-col h-full bg-[#0a0f1a] border-r border-white/5 transition-all duration-300 relative',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 z-10 w-6 h-6 bg-[#0f1623] border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-violet-500/40 transition-all shadow-lg hidden lg:flex"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
          <span className="text-white font-black text-sm">H</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-white font-bold text-base">Hexalyte</span>
            <span className="block text-xs text-violet-400 -mt-0.5">Enterprise</span>
          </div>
        )}
      </div>

      {/* Branch Selector */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-white/5">
          <button
            onClick={() => setBranchOpen(!branchOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5 hover:border-violet-500/20 transition-colors"
          >
            <Building2 size={14} className="text-violet-400 flex-shrink-0" />
            <span className="flex-1 text-left text-xs text-slate-300 truncate">Main Branch</span>
            <ChevronDown size={11} className={`text-slate-500 transition-transform flex-shrink-0 ${branchOpen ? 'rotate-180' : ''}`} />
          </button>
          {branchOpen && (
            <div className="mt-1 bg-[#0f1623] border border-white/5 rounded-lg overflow-hidden shadow-xl">
              {['Main Branch', 'T Nagar Showroom', 'Velachery Branch'].map((branch) => (
                <button
                  key={branch}
                  className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => setBranchOpen(false)}
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3 scrollbar-thin">
        {navItems.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-1 mt-1">
                {group.label}
              </p>
            )}
            {collapsed && <div className="my-1 h-px bg-white/5 mx-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
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
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin Console Link */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-white/5">
          <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:text-amber-300 hover:bg-amber-500/5 transition-colors text-xs">
            <Zap size={13} className="text-amber-400" />
            <span>Platform Admin</span>
          </Link>
        </div>
      )}

      {/* User section */}
      <div className={cn('border-t border-white/5 p-3', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            title="Logout"
          >
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name ?? 'User'}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.toLowerCase() ?? ''}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0" title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
