'use client'

import { useState, useEffect } from 'react'
import { Bell, Search, Menu, X, ChevronDown, Settings, LogOut, User, Wifi, WifiOff, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

interface HeaderProps {
  onMenuToggle: () => void
  sidebarOpen: boolean
}

export default function Header({ onMenuToggle, sidebarOpen }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const isOnline = true

  useEffect(() => setMounted(true), [])

  const notifications = [
    { id: 1, type: 'warning', message: '3 items are running low on stock', time: '5m ago', read: false },
    { id: 2, type: 'success', message: 'Repair REP-24048 is ready for pickup', time: '12m ago', read: false },
    { id: 3, type: 'info', message: 'Warranty WRN-2023-00089 expires in 30 days', time: '1h ago', read: true },
    { id: 4, type: 'success', message: 'PO-2405-001 received successfully', time: '3h ago', read: true },
  ]

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="h-14 flex items-center px-4 gap-4 sticky top-0 z-40 border-b transition-colors"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
      {/* Menu toggle (mobile) */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        {searchOpen ? (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              type="text"
              placeholder="Search products, customers, repairs..."
              className="input-field pl-9 py-2 text-sm"
              onBlur={() => setSearchOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all w-full max-w-xs border"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            <Search size={14} />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] border rounded px-1.5 py-0.5" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>⌘K</kbd>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Online status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Theme toggle */}
        <div className="flex items-center rounded-xl border p-0.5 gap-0.5"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
          <button
            onClick={() => setTheme('light')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: theme === 'light' ? '#ffffff' : 'transparent',
              color: theme === 'light' ? '#7c3aed' : 'var(--text-muted)',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            <Sun size={13} />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: theme === 'dark' ? '#1e1b4b' : 'transparent',
              color: theme === 'dark' ? '#a78bfa' : 'var(--text-muted)',
              boxShadow: theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            <Moon size={13} />
            <span className="hidden sm:inline">Dark</span>
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false) }}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-violet-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl z-50 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <span className="text-sm font-semibold text-white">Notifications</span>
                <button className="text-xs text-violet-400 hover:text-violet-300">Mark all read</button>
              </div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 flex gap-3 ${!n.read ? 'bg-white/2' : ''}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'warning' ? 'bg-yellow-400' : n.type === 'success' ? 'bg-green-400' : 'bg-blue-400'}`} />
                    <div>
                      <p className="text-xs text-slate-300">{n.message}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{n.time}</p>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 bg-violet-500 rounded-full ml-auto mt-1.5" />}
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-white/5">
                <button className="text-xs text-slate-400 hover:text-slate-200 w-full text-center">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(!userOpen); setNotifOpen(false) }}
            className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded-xl transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs">
              S
            </div>
            <ChevronDown size={13} className="text-slate-500" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl shadow-xl z-50 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-sm font-semibold text-white">Subramaniam R</p>
                <p className="text-xs text-slate-500">owner@mobilehub.com</p>
                <span className="inline-block mt-1 text-xs bg-violet-600/20 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full">Owner</span>
              </div>
              <div className="p-1">
                {[
                  { icon: User, label: 'My Profile' },
                  { icon: Settings, label: 'Settings' },
                ].map((item) => (
                  <button key={item.label} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                    <item.icon size={15} />
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 p-1">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close */}
      {(notifOpen || userOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setUserOpen(false) }} />
      )}
    </header>
  )
}
