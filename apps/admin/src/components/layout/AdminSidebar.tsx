'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, CreditCard, KeyRound, Activity,
  BarChart3, ScrollText, Bell, Megaphone, Wrench, Settings,
  Shield, ChevronRight, LogOut, X
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',            icon: LayoutDashboard, badge: null },
  { href: '/tenants',         label: 'Tenants',              icon: Building2,        badge: '214' },
  { href: '/subscriptions',   label: 'Subscriptions',        icon: CreditCard,       badge: '2 overdue' },
  { href: '/auth-iam',        label: 'Auth / IAM',           icon: KeyRound,         badge: null },
  { href: '/system-health',   label: 'System Health',        icon: Activity,         badge: '2 issues' },
  { href: '/analytics',       label: 'Analytics',            icon: BarChart3,        badge: null },
  { href: '/activity-logs',   label: 'Activity Logs',        icon: ScrollText,       badge: null },
  { href: '/notifications',   label: 'Notifications',        icon: Bell,             badge: '5' },
  { href: '/announcements',   label: 'Announcements',        icon: Megaphone,        badge: null },
  { href: '/support-tools',   label: 'Support Tools',        icon: Wrench,           badge: null },
  { href: '/settings',        label: 'Settings',             icon: Settings,         badge: null },
]

interface Props {
  onClose?: () => void
}

export default function AdminSidebar({ onClose }: Props) {
  const path = usePathname()

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-[220px] flex-shrink-0">
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {NAV.map(item => {
            const active = path === item.href || path.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={active ? 'sidebar-item-active' : 'sidebar-item'}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    item.badge.includes('issues') || item.badge.includes('overdue')
                      ? active ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'
                      : active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Admin profile */}
      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
          <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white">SA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">Super Admin</p>
            <p className="text-[10px] text-gray-400 truncate">super@hexalyte.com</p>
          </div>
          <LogOut size={13} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
        </div>
      </div>
    </aside>
  )
}
