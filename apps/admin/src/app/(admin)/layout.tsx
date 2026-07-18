'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import AdminHeader from '@/components/layout/AdminHeader'
import { adminAuth } from '@/lib/api'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/tenants':        'Tenants',
  '/subscriptions':  'Subscriptions & Billing',
  '/auth-iam':       'Auth / IAM',
  '/system-health':  'System Health',
  '/analytics':      'Analytics',
  '/activity-logs':  'Activity Logs',
  '/notifications':  'Notifications',
  '/feature-suggestions': 'Feature Suggestions',
  '/announcements':  'Announcements',
  '/release-notes':  'Release Notes',
  '/master-catalog': 'Master Catalog',
  '/support-tools':  'Support Tools',
  '/settings':       'Settings',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const path = usePathname()
  const router = useRouter()

  useEffect(() => {
    const token = adminAuth.getToken()
    if (!token) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [router])

  function handleLogout() {
    adminAuth.clear()
    router.replace('/login')
  }

  const baseRoute = '/' + (path ?? '').split('/')[1]
  const title = PAGE_TITLES[baseRoute] ?? 'Admin'

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
