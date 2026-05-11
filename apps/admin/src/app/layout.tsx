import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hexalyte Admin Console',
  description: 'Platform administration for Hexalyte SaaS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
