'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Menu, ChevronDown, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import AdminGlobalSearch from '@/components/layout/AdminGlobalSearch'
import { adminAuth, fetchNotifications, type AdminUserInfo } from '@/lib/api'

interface Props {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
  onMenuClick?: () => void
  onLogout?: () => void
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function AdminHeader({ title, breadcrumbs, onMenuClick, onLogout }: Props) {
  const [showProfile, setShowProfile] = useState(false)
  const [user, setUser] = useState<AdminUserInfo | null>(null)
  const [unread, setUnread] = useState(0)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUser(adminAuth.getUser())
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetchNotifications()
        .then((res) => {
          if (cancelled) return
          let read = new Set<string>()
          try {
            read = new Set(JSON.parse(localStorage.getItem('hx_admin_notif_read') ?? '[]'))
          } catch { /* ignore */ }
          setUnread(res.data.filter((n) => !read.has(n.id)).length)
        })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    if (!showProfile) return
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showProfile])

  const displayName = user?.name || 'Admin'
  const displayEmail = user?.email || ''

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0">
      <button onClick={onMenuClick} className="lg:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
        <Menu size={18} />
      </button>

      <div className="flex-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">/</span>}
                {b.href ? (
                  <Link href={b.href} className="text-gray-500 hover:text-gray-700">{b.label}</Link>
                ) : (
                  <span className="font-medium text-gray-900">{b.label}</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <h1 className="text-[15px] font-semibold text-gray-900 truncate">{title}</h1>
        )}
      </div>

      <AdminGlobalSearch />

      <Link href="/notifications" className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>

      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">{initials(displayName)}</span>
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[140px] truncate">{displayName}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {showProfile && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-500 truncate">{displayEmail || 'Platform admin'}</p>
            </div>
            <Link href="/settings" onClick={() => setShowProfile(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Settings size={14} />Settings
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowProfile(false)
                onLogout?.()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={14} />Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
