'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home, LayoutDashboard } from 'lucide-react'

const Lottie = dynamic(
  () => import('lottie-react').then((mod) => mod.Lottie),
  { ssr: false },
)

export default function NotFoundClient() {
  const router = useRouter()

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Soft brand atmosphere — not neon */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,99,235,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(6,182,212,0.08), transparent 50%)',
        }}
      />

      <header className="relative z-10 px-5 sm:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold leading-none">H</span>
          </div>
          <span className="text-lg font-bold tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            Hexalyte
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 pb-16 pt-4 text-center">
        <div className="w-full max-w-[420px] sm:max-w-[480px] mx-auto -mb-2 sm:-mb-4">
          <div className="aspect-[950/847] w-full">
            <Lottie
              src="/lottie/404-cat.json"
              autoplay
              loop
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 mb-2">
          Error 404
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          Page not found
        </h1>
        <p className="text-sm sm:text-[15px] max-w-md mx-auto leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
          This page wandered off — like our cat. Check the URL, or head back to somewhere safe.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full max-w-sm sm:max-w-none sm:w-auto">
          <Link href="/dashboard" className="btn-primary h-11 px-5 text-sm inline-flex items-center justify-center gap-2">
            <LayoutDashboard size={16} />
            Go to Dashboard
          </Link>
          <Link href="/" className="btn-secondary h-11 px-5 text-sm inline-flex items-center justify-center gap-2">
            <Home size={16} />
            Home
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-ghost h-11 px-5 text-sm inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>
      </main>

      <footer className="relative z-10 px-5 py-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} Hexalyte · Retail &amp; Repair SaaS
      </footer>
    </div>
  )
}
