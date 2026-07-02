import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support access',
  robots: { index: false, follow: false, nocache: true },
}

export default function SupportSessionLayout({ children }: { children: React.ReactNode }) {
  return children
}
