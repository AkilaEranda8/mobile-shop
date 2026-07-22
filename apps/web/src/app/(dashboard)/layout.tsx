'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { POSOverlay } from '@/components/pos/POSOverlay'
import { PosGlobalShortcuts } from '@/components/pos/PosGlobalShortcuts'
import { HexTableProvider } from '@/components/table/hex-table-provider'
import { authStorage } from '@/lib/auth'
import { usePlatformStatus } from '@/lib/hooks'
import { MaintenanceBanner } from '@/components/layout/MaintenanceBanner'
import { AnnouncementBanners } from '@/components/layout/AnnouncementBanners'
import { ReleaseNotesPopup } from '@/components/layout/ReleaseNotesPopup'
import { SessionBranchBootstrap } from '@/components/layout/SessionBranchBootstrap'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { RoleAccessGuard } from '@/components/layout/RoleAccessGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const platformStatus = usePlatformStatus()
  const maintenance = platformStatus?.maintenance

  useEffect(() => {
    if (!authStorage.isLoggedIn()) {
      router.replace('/login')
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className={`hidden lg:flex flex-col flex-shrink-0 transition-all duration-300`}>
        <Suspense fallback={null}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </Suspense>
      </div>

      {/* Sidebar - mobile */}
      <div className={`fixed left-0 top-0 h-full z-40 lg:hidden transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Suspense fallback={null}>
          <Sidebar collapsed={false} />
        </Suspense>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          sidebarOpen={mobileSidebarOpen}
          maintenance={maintenance}
        />
        <OfflineBanner />
        <SessionBranchBootstrap />
        <AnnouncementBanners />
        <ReleaseNotesPopup />
        {maintenance?.enabled && <MaintenanceBanner message={maintenance.message} />}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ color: 'var(--text-primary)' }}>
          <HexTableProvider>
            <RoleAccessGuard>{children}</RoleAccessGuard>
          </HexTableProvider>
        </main>
      </div>

      <PosGlobalShortcuts />
      <POSOverlay />
    </div>
  )
}
