import type { Metadata } from 'next'
import NotFoundClient from '@/components/NotFoundClient'

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return <NotFoundClient />
}
