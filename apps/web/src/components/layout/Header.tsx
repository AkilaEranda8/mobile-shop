'use client'

import { useState, useMemo } from 'react'
import { Bell, Menu, X, ChevronDown, Settings, LogOut, User, Sun, Moon, AlertTriangle, Wrench, ShoppingBag, ShoppingCart, TrendingUp } from 'lucide-react'
import { usePos } from '@/lib/use-pos'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { useAnalyticsDashboard } from '@/lib/hooks'
import { formatCurrency } from '@/lib/utils'
import GlobalSearch from '@/components/layout/GlobalSearch'
import { BranchControl } from '@/components/layout/BranchControl'

interface HeaderProps {
  onMenuToggle: () => void
  sidebarOpen: boolean
  maintenance?: { enabled: boolean; message: string } | null
}

export default function Header({ onMenuToggle, sidebarOpen, maintenance }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen]   = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { openPos, hasPos } = usePos()
  const user = authStorage.getUser()

  const { data: dashData } = useAnalyticsDashboard()
  const dash = dashData as any

  const initials = (user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = (user?.role ?? '').toLowerCase().replace('_', ' ')

  /* build live notifications from real dashboard data */
  const notifications = useMemo(() => {
    const list: { id: number | string; type: string; icon: any; message: string; unread: boolean }[] = []
    if (maintenance?.enabled) {
      list.push({
        id: 'maintenance',
        type: 'warning',
        icon: AlertTriangle,
        message: maintenance.message || 'The system is currently in maintenance mode.',
        unread: true,
      })
    }
    if (dash?.lowStockCount > 0)
      list.push({ id: 1, type: 'warning', icon: AlertTriangle, message: `${dash.lowStockCount} product${dash.lowStockCount > 1 ? 's are' : ' is'} running low on stock`, unread: true })
    if (dash?.activeRepairs > 0)
      list.push({ id: 2, type: 'info', icon: Wrench, message: `${dash.activeRepairs} repair job${dash.activeRepairs > 1 ? 's' : ''} currently in progress`, unread: false })
    if (dash?.todaySalesCount > 0)
      list.push({ id: 3, type: 'success', icon: ShoppingBag, message: `${dash.todaySalesCount} sale${dash.todaySalesCount > 1 ? 's' : ''} today — ${formatCurrency(dash.todayRevenue ?? 0)} revenue`, unread: false })
    if (dash?.totalCustomers > 0)
      list.push({ id: 4, type: 'success', icon: TrendingUp, message: `${dash.totalCustomers} total customers registered`, unread: false })
    return list
  }, [dash, maintenance])

  const unreadCount = notifications.filter(n => n.unread).length

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    authStorage.clear()
    router.replace('/login')
  }

  const typeColor: Record<string, string> = {
    warning: 'bg-yellow-400',
    success: 'bg-green-400',
    info:    'bg-blue-400',
  }

  return (
    <header className="h-14 flex items-center px-4 gap-4 sticky top-0 z-40 border-b transition-colors"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>

      {/* Mobile menu toggle */}
      <button onClick={onMenuToggle} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md relative z-[200] overflow-visible">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <BranchControl />

        {/* POS Terminal */}
        {hasPos && (
          <button
            onClick={() => openPos()}
            title="Open POS (F2)"
            className="btn-accent flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            <ShoppingCart size={14} />
            <span className="hidden sm:inline">POS Terminal</span>
            <kbd className="hidden md:inline text-[9px] opacity-60 font-mono ml-0.5">F2</kbd>
          </button>
        )}

        {/* Theme toggle */}
        <div className="flex items-center rounded-xl border p-0.5 gap-0.5"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
          <button onClick={() => setTheme('light')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
            style={{ background: theme === 'light' ? '#ffffff' : 'transparent', color: theme === 'light' ? '#7c3aed' : 'var(--text-muted)', boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
            <Sun size={13} /><span className="hidden sm:inline">Light</span>
          </button>
          <button onClick={() => setTheme('dark')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
            style={{ background: theme === 'dark' ? '#1e1b4b' : 'transparent', color: theme === 'dark' ? '#a78bfa' : 'var(--text-muted)', boxShadow: theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none' }}>
            <Moon size={13} /><span className="hidden sm:inline">Dark</span>
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false) }}
            className="relative p-2 rounded-xl transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-violet-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl z-50 border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                {unreadCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{unreadCount} new</span>}
              </div>
              <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                {notifications.length === 0 && (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No notifications</p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 flex gap-3 transition-colors hover:bg-white/3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === 'warning' ? 'bg-yellow-500/10' : n.type === 'success' ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                      <n.icon size={13} className={n.type === 'warning' ? 'text-yellow-400' : n.type === 'success' ? 'text-green-400' : 'text-blue-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                    </div>
                    {n.unread && <div className="w-1.5 h-1.5 bg-violet-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button onClick={() => { setUserOpen(!userOpen); setNotifOpen(false) }}
            className="flex items-center gap-2 p-1.5 rounded-xl transition-colors hover:bg-white/5">
            <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs">
              {initials}
            </div>
            <span className="hidden md:block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{user?.name ?? 'User'}</span>
            <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-xl z-50 border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name ?? 'User'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email ?? ''}</p>
                <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full capitalize bg-violet-600/20 text-violet-300 border border-violet-500/20">{roleLabel}</span>
              </div>
              <div className="p-1">
                {[
                  { icon: User, label: 'My Profile' },
                  { icon: Settings, label: 'Settings' },
                ].map((item) => (
                  <button key={item.label} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <item.icon size={15} />{item.label}
                  </button>
                ))}
              </div>
              <div className="border-t p-1" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                  <LogOut size={15} />Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(notifOpen || userOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setUserOpen(false) }} />
      )}
    </header>
  )
}
