import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Hexalyte — Mobile Shop & Repair SaaS',
    template: '%s | Hexalyte',
  },
  description: 'The complete all-in-one platform for mobile phone shops, repair centers, accessory stores, and multi-branch retail operations.',
  keywords: ['mobile shop', 'repair management', 'POS', 'inventory', 'SaaS', 'IMEI tracking', 'warranty management'],
  authors: [{ name: 'Hexalyte Technologies' }],
  creator: 'Hexalyte Technologies',
  metadataBase: new URL('https://hexalyte.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://hexalyte.com',
    title: 'Hexalyte — Mobile Shop & Repair SaaS',
    description: 'Manage inventory, repairs, POS, and customers in one powerful platform.',
    siteName: 'Hexalyte',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-200 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
