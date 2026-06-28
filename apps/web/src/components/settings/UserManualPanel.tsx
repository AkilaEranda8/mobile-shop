'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  BookOpen, ChevronRight, CreditCard, FileText, HelpCircle, Keyboard,
  LogIn, MessageSquare, Package, Phone, RotateCcw, Search, Shield,
  ShoppingCart, UserCheck, Users, Workflow, Wrench, ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  USER_MANUAL_SECTIONS,
  USER_MANUAL_WORKFLOW_EN,
  USER_MANUAL_WORKFLOW_SI,
  type ManualLang,
  type ManualSection,
} from './userManualContent'

const LANG_OPTIONS: { key: ManualLang; label: string }[] = [
  { key: 'both', label: 'English + සිංහල' },
  { key: 'en', label: 'English' },
  { key: 'si', label: 'සිංහල' },
]

const SECTION_ICONS: Record<string, LucideIcon> = {
  start: LogIn,
  pos: ShoppingCart,
  'pos-keys': Keyboard,
  inventory: Package,
  customers: Users,
  'sales-returns': RotateCcw,
  repairs: Wrench,
  warranty: Shield,
  finance: CreditCard,
  'invoice-settings': FileText,
  whatsapp: MessageSquare,
  roles: UserCheck,
  faq: HelpCircle,
}

interface UserManualPanelProps {
  /** Inside Settings tab — hides page header */
  embedded?: boolean
}

export default function UserManualPanel({ embedded = false }: UserManualPanelProps) {
  const [lang, setLang] = useState<ManualLang>('both')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState('pos')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return USER_MANUAL_SECTIONS
    return USER_MANUAL_SECTIONS.filter(s => {
      const blob = [s.titleEn, s.titleSi, ...s.itemsEn, ...s.itemsSi].join(' ').toLowerCase()
      return blob.includes(q)
    })
  }, [query])

  const active = filtered.find(s => s.id === activeId) ?? filtered[0] ?? USER_MANUAL_SECTIONS[0]

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-6'}>
      {/* Header */}
      {embedded ? (
        <div className="card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BookOpen size={16} className="text-violet-500" />
                User Manual
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                POS, inventory, warranty, bills, and daily shop work
              </p>
            </div>
            <Link
              href="/dashboard/user-manual"
              className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
            >
              <ExternalLink size={13} />
              Open full page
            </Link>
          </div>
          <ManualToolbar lang={lang} setLang={setLang} query={query} setQuery={setQuery} compact />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <BookOpen size={24} className="text-violet-500" />
              User Manual
            </h1>
            <p className="page-subtitle">
              Learn how to use Hexalyte — POS, inventory, warranty, invoices, and daily operations
            </p>
          </div>
          <div className="lg:ml-auto w-full lg:w-auto">
            <ManualToolbar lang={lang} setLang={setLang} query={query} setQuery={setQuery} />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
        {/* Topic nav — same pattern as Release Notes sidebar list */}
        <nav
          className="card p-2 space-y-0.5 lg:sticky lg:top-4 max-h-[70vh] overflow-y-auto"
        >
          <p
            className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Topics
          </p>
          {filtered.map(section => {
            const Icon = SECTION_ICONS[section.id] ?? BookOpen
            const selected = active?.id === section.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  selected
                    ? 'bg-violet-600 text-white'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/5'
                }`}
                style={selected ? undefined : { color: 'var(--text-secondary)' }}
              >
                <Icon size={15} className="shrink-0 opacity-80" />
                <span className="truncate flex-1">
                  {lang === 'si' ? section.titleSi : section.titleEn}
                </span>
                {selected && <ChevronRight size={14} className="shrink-0 opacity-70" />}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>No topics found</p>
          )}
        </nav>

        {/* Main content */}
        <div className="space-y-5 min-w-0">
          {active && <WorkflowCard lang={lang} />}

          {active ? (
            <SectionDetail section={active} lang={lang} />
          ) : (
            <div className="card p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No topics match your search. Try &quot;POS&quot;, &quot;warranty&quot;, or &quot;invoice&quot;.
            </div>
          )}

          <SupportCard />
        </div>
      </div>
    </div>
  )
}

function ManualToolbar({
  lang, setLang, query, setQuery, compact,
}: {
  lang: ManualLang
  setLang: (v: ManualLang) => void
  query: string
  setQuery: (v: string) => void
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-3' : 'sm:flex-row sm:items-center gap-3'}`}>
      <div className="relative flex-1 sm:max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search topics…"
          className="input-field pl-9 w-full text-sm"
        />
      </div>
      <div
        className="flex flex-wrap gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
      >
        {LANG_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setLang(opt.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              lang === opt.key
                ? 'bg-violet-600 text-white shadow-sm'
                : ''
            }`}
            style={lang === opt.key ? undefined : { color: 'var(--text-secondary)' }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function WorkflowCard({ lang }: { lang: ManualLang }) {
  const columns =
    lang === 'si'
      ? [{ label: 'සිංහල', steps: USER_MANUAL_WORKFLOW_SI }]
      : lang === 'en'
        ? [{ label: 'English', steps: USER_MANUAL_WORKFLOW_EN }]
        : [
            { label: 'English', steps: USER_MANUAL_WORKFLOW_EN },
            { label: 'සිංහල', steps: USER_MANUAL_WORKFLOW_SI },
          ]

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Workflow size={16} className="text-emerald-500" />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Daily POS workflow
        </h3>
      </div>
      <div className={`grid gap-5 ${columns.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {columns.map(col => (
          <ol key={col.label} className="space-y-2">
            {lang === 'both' && (
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                {col.label}
              </p>
            )}
            {col.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-bold flex items-center justify-center border border-violet-500/20">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        ))}
      </div>
    </div>
  )
}

function SectionDetail({ section, lang }: { section: ManualSection; lang: ManualLang }) {
  const Icon = SECTION_ICONS[section.id] ?? BookOpen

  return (
    <div className="card p-5 hover:border-violet-500/20 transition-colors">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-violet-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {lang === 'si' ? section.titleSi : section.titleEn}
          </h3>
          {lang === 'both' && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{section.titleSi}</p>
          )}
        </div>
      </div>

      <div className={`grid gap-6 ${lang === 'both' ? 'md:grid-cols-2' : ''}`}>
        {(lang === 'en' || lang === 'both') && (
          <SectionList label={lang === 'both' ? 'English' : undefined} items={section.itemsEn} />
        )}
        {(lang === 'si' || lang === 'both') && (
          <SectionList label={lang === 'both' ? 'සිංහල' : undefined} items={section.itemsSi} />
        )}
      </div>
    </div>
  )
}

function SectionList({ label, items }: { label?: string; items: string[] }) {
  return (
    <div>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-3">{label}</p>
      )}
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <CheckDot />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CheckDot() {
  return (
    <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-violet-500" />
  )
}

function SupportCard() {
  return (
    <div
      className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-emerald-500/20"
      style={{ background: 'color-mix(in srgb, var(--bg-card) 92%, #10b981 8%)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Need more help?</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Hexalyte Innovation support — Mon–Sat business hours
        </p>
      </div>
      <a
        href="tel:0703130100"
        className="btn-primary text-sm inline-flex items-center gap-2 shrink-0"
      >
        <Phone size={14} />
        070 313 0100
      </a>
    </div>
  )
}
