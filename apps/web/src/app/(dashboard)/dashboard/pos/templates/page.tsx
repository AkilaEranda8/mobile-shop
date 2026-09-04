'use client'

/**
 * Visual template gallery for POS skins — does not change live POS until you pick a theme in Settings.
 */
import Link from 'next/link'
import { ArrowLeft, Check, LayoutTemplate } from 'lucide-react'

const TEMPLATES = [
  {
    id: 'hexa-dark',
    name: 'Hexa Dark',
    blurb: 'Classic left rail + purple accent. Default Hexalyte POS.',
    status: 'Live',
    accent: '#7C3AED',
  },
  {
    id: 'hexa-light',
    name: 'Hexa Light',
    blurb: 'Same Hexa chrome in light surfaces.',
    status: 'Live',
    accent: '#2563EB',
  },
  {
    id: 'studio',
    name: 'Studio Modern',
    blurb: 'Teal studio skin with Manrope chrome.',
    status: 'Live',
    accent: '#14B8A6',
  },
  {
    id: 'nova',
    name: 'Nova Counter',
    blurb: 'New top-bar template (no left rail) — screenshot-style counter layout.',
    status: 'New',
    accent: '#3B82F6',
  },
] as const

export default function PosTemplatesPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8" style={{ color: 'var(--text-primary)' }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard/pos"
              className="inline-flex items-center gap-1.5 text-xs font-semibold opacity-55 hover:opacity-90 transition mb-2"
            >
              <ArrowLeft size={13} /> Back to POS
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutTemplate size={22} className="text-blue-500" />
              POS UI templates
            </h1>
            <p className="mt-1 text-sm opacity-55 max-w-xl">
              Existing Hexa / Studio layouts are unchanged. Enable a skin in{' '}
              <Link href="/dashboard/settings?tab=pos" className="underline underline-offset-2 text-blue-500">
                Settings → POS Display → Theme
              </Link>
              .
            </p>
          </div>
          <Link
            href="/dashboard/pos"
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 transition"
            style={{ color: '#ffffff' }}
          >
            Open POS
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {TEMPLATES.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated, var(--bg-elevated))' }}
            >
              {/* Mini mock chrome */}
              <div
                className="h-36 relative px-3 py-2.5"
                style={{ background: t.id === 'hexa-light' ? '#F4F6FA' : '#0A0C10' }}
              >
                {t.id === 'nova' ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md" style={{ background: t.accent }} />
                      <div className="flex-1 h-6 rounded-full bg-white/10" />
                      <div className="w-14 h-6 rounded-lg bg-white/10" />
                    </div>
                    <div className="flex gap-2 h-[72px]">
                      <div className="flex-1 rounded-xl bg-white/[0.06] border border-white/10" />
                      <div className="w-[28%] rounded-xl bg-white/[0.08] border border-white/10" />
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 h-full">
                    <div className="w-10 rounded-lg bg-white/10 shrink-0" />
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <div className="h-7 rounded-lg bg-white/10" />
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1 rounded-xl bg-white/[0.06]" />
                        <div className="w-[30%] rounded-xl bg-white/[0.08]" />
                      </div>
                    </div>
                  </div>
                )}
                {t.status === 'New' && (
                  <span
                    className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: t.accent, color: '#fff' }}
                  >
                    NEW
                  </span>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-sm">{t.name}</h2>
                  <span className="text-[10px] font-semibold opacity-45 uppercase tracking-wide">{t.id}</span>
                </div>
                <p className="text-xs opacity-55 leading-relaxed">{t.blurb}</p>
                <p className="text-[11px] font-medium inline-flex items-center gap-1 opacity-70">
                  <Check size={12} style={{ color: t.accent }} />
                  {t.status === 'New'
                    ? 'Select “Nova Counter” in POS Display settings to use'
                    : 'Available in POS Display settings'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
