'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Building2, CreditCard, KeyRound, Activity,
  BarChart3, ScrollText, Bell, Megaphone, Wrench, Settings,
  Shield, LogOut, X, Sparkles, MessageCircle, Smartphone, Lightbulb,
} from 'lucide-react'
import {
  adminAuth,
  featureSuggestionsAdminApi,
  fetchStats,
  fetchSubscriptions,
  fetchHealth,
  fetchNotifications,
  type AdminUserInfo,
} from '@/lib/api'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenants', icon: Building2 },
  { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/auth-iam', label: 'Auth / IAM', icon: KeyRound },
  { href: '/system-health', label: 'System Health', icon: Activity },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/activity-logs', label: 'Activity Logs', icon: ScrollText },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/feature-suggestions', label: 'Feature Suggestions', icon: Lightbulb },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/release-notes', label: 'Release Notes', icon: Sparkles },
  { href: '/master-catalog', label: 'Master Catalog', icon: Smartphone },
  { href: '/support-tools', label: 'Support Tools', icon: Wrench },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface Props {
  onClose?: () => void
  onLogout?: () => void
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function fmtBadgeCount(n: number) {
  if (n <= 0) return null
  return n > 99 ? '99+' : String(n)
}

export default function AdminSidebar({ onClose, onLogout }: Props) {
  const path = usePathname()
  const [user, setUser] = useState<AdminUserInfo | null>(null)
  const [badges, setBadges] = useState<Record<string, string | null>>({})

  useEffect(() => {
    setUser(adminAuth.getUser())
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const next: Record<string, string | null> = {}
      try {
        const [stats, overdue, health, notifs, suggestions] = await Promise.all([
          fetchStats().catch(() => null),
          fetchSubscriptions('OVERDUE').catch(() => null),
          fetchHealth().catch(() => null),
          fetchNotifications().catch(() => null),
          featureSuggestionsAdminApi.summary().catch(() => null),
        ])
        if (cancelled) return

        if (stats) next['/tenants'] = fmtBadgeCount(stats.totalTenants)

        const overdueCount = overdue?.data?.length ?? 0
        next['/subscriptions'] = overdueCount > 0 ? `${overdueCount} overdue` : null

        if (health) {
          const issues = Object.values(health).filter(
            (s) => s && typeof s === 'object' && 'status' in s && s.status !== 'HEALTHY',
          ).length
          next['/system-health'] = issues > 0 ? `${issues} issue${issues === 1 ? '' : 's'}` : null
        }

        let unread = 0
        if (notifs?.data?.length) {
          let read = new Set<string>()
          try {
            read = new Set(JSON.parse(localStorage.getItem('hx_admin_notif_read') ?? '[]'))
          } catch { /* ignore */ }
          unread = notifs.data.filter((n) => !read.has(n.id)).length
        }
        next['/notifications'] = fmtBadgeCount(unread)

        const newSuggestions = suggestions?.new ?? 0
        next['/feature-suggestions'] = newSuggestions > 0 ? `NEW ${newSuggestions}` : null

        setBadges(next)
      } catch {
        /* keep previous badges */
      }
    }

    load()
    const t = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const displayName = user?.name || 'Admin'
  const displayEmail = user?.email || ''

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-[220px] flex-shrink-0">
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-gray-900 leading-tight">Hexalyte</p>
            <p className="text-[10px] text-gray-400 leading-tight">Platform Admin</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {NAV.map(item => {
            const active = path === item.href || !!path?.startsWith(item.href + '/')
            const Icon = item.icon
            const badge = badges[item.href] ?? null
            const alertBadge = !!badge && (
              badge.includes('issue') ||
              badge.includes('overdue') ||
              item.href === '/feature-suggestions' ||
              item.href === '/notifications'
            )
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={active ? 'sidebar-item-active' : 'sidebar-item'}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    alertBadge
                      ? active ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'
                      : active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 group text-left"
        >
          <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white">{initials(displayName)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
            <p className="text-[10px] text-gray-400 truncate">{displayEmail || 'Signed in'}</p>
          </div>
          <LogOut size={13} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
        </button>
      </div>
    </aside>
  )
}
