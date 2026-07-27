'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import AdminHeader from '@/components/layout/AdminHeader'
import { hubSession } from '@/lib/hub-session'
import { getProduct, type HubProduct } from '@/lib/products'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tenants': 'Tenants',
  '/subscriptions': 'Subscriptions & Billing',
  '/whatsapp': 'WhatsApp',
  '/auth-iam': 'Auth / IAM',
  '/system-health': 'System Health',
  '/security-scan': 'Security Scan',
  '/analytics': 'Analytics',
  '/activity-logs': 'Activity Logs',
  '/notifications': 'Notifications',
  '/feature-suggestions': 'Feature Suggestions',
  '/announcements': 'Announcements',
  '/release-notes': 'Release Notes',
  '/master-catalog': 'Master Catalog',
  '/support-tools': 'Support Tools',
  '/settings': 'Settings',
  '/fashion/dashboard': 'Fashion · Dashboard',
  '/fashion/tenants': 'Fashion · Tenants',
  '/fashion/subscriptions': 'Fashion · Subscriptions',
  '/fashion/whatsapp': 'Fashion · WhatsApp',
  '/fashion/auth-iam': 'Fashion · Auth / IAM',
  '/fashion/system-health': 'Fashion · System Health',
  '/fashion/analytics': 'Fashion · Analytics',
  '/fashion/activity-logs': 'Fashion · Activity Logs',
  '/fashion/notifications': 'Fashion · Notifications',
  '/fashion/feature-suggestions': 'Fashion · Feature Suggestions',
  '/fashion/announcements': 'Fashion · Announcements',
  '/fashion/release-notes': 'Fashion · Release Notes',
  '/fashion/master-catalog': 'Fashion · Master Catalog',
  '/fashion/support-tools': 'Fashion · Support Tools',
  '/fashion/settings': 'Fashion · Settings',
  '/salon/dashboard': 'Salon · Dashboard',
  '/salon/tenants': 'Salon · Tenants',
  '/salon/subscriptions': 'Salon · Subscriptions',
  '/salon/whatsapp': 'Salon · WhatsApp',
  '/salon/auth-iam': 'Salon · Auth / IAM',
  '/salon/system-health': 'Salon · System Health',
  '/salon/analytics': 'Salon · Analytics',
  '/salon/activity-logs': 'Salon · Activity Logs',
  '/salon/notifications': 'Salon · Notifications',
  '/salon/feature-suggestions': 'Salon · Feature Suggestions',
  '/salon/announcements': 'Salon · Announcements',
  '/salon/release-notes': 'Salon · Release Notes',
  '/salon/master-catalog': 'Salon · Master Catalog',
  '/salon/support-tools': 'Salon · Support Tools',
  '/salon/settings': 'Salon · Settings',
}

function inferProductFromPath(path: string | null): HubProduct | null {
  if (!path) return null
  if (path.startsWith('/fashion')) return 'fashion'
  if (path.startsWith('/salon')) return 'salon'
  return 'enterprise'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const path = usePathname()
  const router = useRouter()

  useEffect(() => {
    const pathProduct = inferProductFromPath(path)
    const stored = hubSession.getProduct()
    const product = pathProduct ?? stored

    if (!hubSession.hasSession(product)) {
      router.replace(`/login?product=${product}&from=${encodeURIComponent(path || '/')}`)
      return
    }

    if (pathProduct && pathProduct !== stored) {
      hubSession.setProduct(pathProduct)
    }

    setReady(true)
  }, [router, path])

  function handleLogout() {
    hubSession.logoutActive()
    router.replace('/login')
  }

  const title =
    PAGE_TITLES[path ?? ''] ||
    PAGE_TITLES['/' + (path ?? '').split('/').slice(1, 3).join('/')] ||
    `${getProduct(hubSession.getProduct()).shortLabel} Admin`

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <AdminSidebar
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </div>

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
