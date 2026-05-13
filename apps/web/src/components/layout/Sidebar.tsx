'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wrench,
  Shield, Truck, BarChart3, Settings, LogOut,
  CreditCard, Zap, Smartphone, FileText,
  UserCheck, ChevronLeft, ChevronRight,
  Receipt, Sun, Moon
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from 'next-themes'
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
  const { theme, setTheme } = useTheme()
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

      {/* Platform Admin — top of sidebar */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Link
          href="/admin"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:text-amber-300 hover:bg-amber-500/5 transition-colors text-xs',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Platform Admin' : undefined}
        >
          <Zap size={13} className="text-amber-400 flex-shrink-0" />
          {!collapsed && <span>Platform Admin</span>}
        </Link>
      </div>

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

      {/* Dark / Light Mode Toggle */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        {collapsed ? (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex justify-center p-2 rounded-lg transition-colors hover:bg-white/5"
            title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          >
            {theme === 'dark'
              ? <Sun size={15} className="text-amber-400" />
              : <Moon size={15} className="text-violet-400" />
            }
          </button>
        ) : (
          <div className="flex items-center rounded-xl border p-0.5 gap-0.5" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
            <button
              onClick={() => setTheme('light')}
              className="flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: theme === 'light' ? '#ffffff' : 'transparent',
                color: theme === 'light' ? '#7c3aed' : 'var(--text-muted)',
                boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              <Sun size={12} />Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className="flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: theme === 'dark' ? '#1e1b4b' : 'transparent',
                color: theme === 'dark' ? '#a78bfa' : 'var(--text-muted)',
                boxShadow: theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              <Moon size={12} />Dark
            </button>
          </div>
        )}
      </div>

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
