import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { AppearanceProvider } from '@/components/appearance-provider'
import { ServiceWorkerRegister } from '@/components/offline/ServiceWorkerRegister'
import { APPEARANCE_INIT_SCRIPT } from '@/lib/appearance'

export const metadata: Metadata = {
  title: {
    default: 'Hexalyte — Mobile Shop & Repair SaaS',
    template: '%s | Hexalyte',
  },
  description: 'The complete all-in-one platform for mobile phone shops, repair centers, accessory stores, and multi-branch retail operations.',
  keywords: ['mobile shop', 'repair management', 'POS', 'inventory', 'SaaS', 'IMEI tracking', 'warranty management'],
  authors: [{ name: 'Hexalyte Technologies' }],
  creator: 'Hexalyte Technologies',
  metadataBase: new URL('https://app.hexalyte.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://app.hexalyte.com',
    title: 'Hexalyte — Mobile Shop & Repair SaaS',
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
            {children}
          </AppearanceProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
