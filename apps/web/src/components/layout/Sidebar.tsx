'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, Building2, LogOut,
  ChevronDown, CreditCard, Zap
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
      { href: '/dashboard/customers', icon: Users, label: 'Customers' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/dashboard/inventory', icon: Package, label: 'Inventory' },
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
      { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
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

export default function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [branchOpen, setBranchOpen] = useState(false)
  const user = authStorage.getUser()

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    authStorage.clear()
    router.replace('/login')
  }

  return (
    <aside className={cn(
      'flex flex-col h-full bg-[#0a0f1a] border-r border-white/5 transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-sm">H</span>
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-bold text-base">Hexalyte</span>
            <span className="block text-xs text-violet-400 -mt-0.5">Pro Plan</span>
          </div>
        )}
      </div>

      {/* Branch Selector */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-white/5">
          <button
            onClick={() => setBranchOpen(!branchOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-colors"
          >
            <Building2 size={14} className="text-violet-400" />
            <span className="flex-1 text-left text-sm text-slate-300 truncate">Main Branch - Anna Nagar</span>
            <ChevronDown size={12} className={`text-slate-500 transition-transform ${branchOpen ? 'rotate-180' : ''}`} />
          </button>
          {branchOpen && (
            <div className="mt-1 bg-[#0f1623] border border-white/5 rounded-lg overflow-hidden">
              {['Main Branch - Anna Nagar', 'T Nagar Showroom', 'Velachery Branch'].map((branch) => (
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
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navItems.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'sidebar-item',
                      isActive && 'sidebar-item-active',
                      collapsed && 'justify-center px-2'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className={cn('flex-shrink-0', isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300')} />
                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium flex-1">{item.label}</span>
                        {'badge' in item && item.badge && (
                          <span className="text-[10px] bg-violet-600/20 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded font-semibold">
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
          <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors text-xs">
            <Zap size={14} className="text-amber-400" />
            <span>Platform Admin Console</span>
          </Link>
        </div>
      )}

      {/* User section */}
      <div className={cn('border-t border-white/5 p-3', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <button className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
            S
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name ?? 'User'}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.toLowerCase() ?? ''}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-600 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
