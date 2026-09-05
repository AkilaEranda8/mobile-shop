import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { AppearanceProvider } from '@/components/appearance-provider'
import { ServiceWorkerRegister } from '@/components/offline/ServiceWorkerRegister'
import { AppToaster } from '@/components/AppToaster'
import { DesktopUpdateBanner } from '@/components/DesktopUpdateBanner'
import { DesktopDownloadOverlay } from '@/components/DesktopDownloadOverlay'
import { APPEARANCE_INIT_SCRIPT } from '@/lib/appearance'

export const metadata: Metadata = {
  title: {
    default: 'Hexalyte — Retail & Repair SaaS',
    template: '%s | Hexalyte',
  },
  description: 'The complete all-in-one platform for retail shops, computer & electronics stores, repair centers, and multi-branch operations.',
  keywords: ['retail POS', 'shop management', 'repair management', 'inventory', 'SaaS', 'serial tracking', 'warranty management', 'computer shop'],
  authors: [{ name: 'Hexalyte Technologies' }],
  creator: 'Hexalyte Technologies',
  metadataBase: new URL('https://app.hexalyte.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://app.hexalyte.com',
    title: 'Hexalyte — Retail & Repair SaaS',
    description: 'Manage inventory, repairs, POS, and customers in one powerful platform.',
    siteName: 'Hexalyte',
  },
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AppearanceProvider>
            <ServiceWorkerRegister />
            <AppToaster />
            <DesktopUpdateBanner />
            <DesktopDownloadOverlay />
            {children}
          </AppearanceProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
