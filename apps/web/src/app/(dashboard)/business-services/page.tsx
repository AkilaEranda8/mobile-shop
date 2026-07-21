'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BriefcaseBusiness, Check, Search } from 'lucide-react'
import {
  BUSINESS_SERVICES,
  QUICK_STATS,
  SERVICE_CATEGORIES,
  type BusinessService,
} from '@/components/business-services/data'
import {
  HelpSidebar,
  ServiceCard,
  ServiceNav,
  WhyChooseSection,
} from '@/components/business-services/components'

export default function BusinessServicesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<(typeof SERVICE_CATEGORIES)[number]>('All')
  const [activeSlug, setActiveSlug] = useState<string | undefined>()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return BUSINESS_SERVICES.filter((s) => {
      const catOk = category === 'All' || s.category === category
      if (!catOk) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.shortDescription.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.features.some((f) => f.toLowerCase().includes(q))
      )
    })
  }, [search, category])

  const scrollToService = (slug: string) => {
    setActiveSlug(slug)
    const el = document.getElementById(`service-${slug}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: 'var(--border-subtle)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--brand-glow) 70%, var(--bg-card)), var(--bg-card) 55%, color-mix(in srgb, var(--brand-glow) 25%, transparent))',
        }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-40"
          style={{ background: 'var(--brand-glow)' }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--brand-glow)', color: 'var(--brand-primary)', border: '1px solid var(--sidebar-active-border)' }}
              >
                <BriefcaseBusiness size={18} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-active-text)' }}>
                Marketplace
              </span>
            </div>
            <h1 className="page-title !text-3xl sm:!text-4xl">Business Services</h1>
            <p className="page-subtitle max-w-2xl !mt-2 !text-sm sm:!text-base leading-relaxed">
              Everything your business needs in one place. From company registration to branding, websites,
              hosting, business email, SMS gateway, payment integrations, software development and digital
              marketing.
            </p>
          </div>
          <div className="w-full lg:w-80 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Services..."
              className="input-field !pl-10 !py-2.5 backdrop-blur-sm"
              style={{ background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)' }}
            />
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          {QUICK_STATS.map((stat) => (
            <span
              key={stat}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border"
              style={{
                background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Check size={13} className="text-emerald-500" />
              {stat}
            </span>
          ))}
        </div>
      </motion.section>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {SERVICE_CATEGORIES.map((c) => {
          const active = category === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={
                active
                  ? {
                      background: 'var(--sidebar-active-bg)',
                      color: 'var(--sidebar-active-text)',
                      borderColor: 'var(--sidebar-active-border)',
                    }
                  : {
                      background: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      borderColor: 'var(--border-subtle)',
                    }
              }
            >
              {c}
            </button>
          )
        })}
      </div>

      {/* Mobile / tablet service jump list */}
      <div className="xl:hidden -mx-1 overflow-x-auto pb-1">
        <div className="flex gap-2 px-1 min-w-max">
          {BUSINESS_SERVICES.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => scrollToService(s.slug)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition-all"
              style={{
                background: activeSlug === s.slug ? 'var(--sidebar-active-bg)' : 'var(--bg-card)',
                color: activeSlug === s.slug ? 'var(--sidebar-active-text)' : 'var(--text-secondary)',
                borderColor: activeSlug === s.slug ? 'var(--sidebar-active-border)' : 'var(--border-subtle)',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_240px] gap-5 items-start">
        <div className="hidden xl:block">
          <ServiceNav
            services={BUSINESS_SERVICES}
            activeSlug={activeSlug}
            onSelect={scrollToService}
          />
        </div>

        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {filtered.length} service{filtered.length === 1 ? '' : 's'}
              {search ? ` matching “${search}”` : ''}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-10 text-center rounded-2xl">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                No services found
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Try a different search or category filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((service: BusinessService, index) => (
                <div key={service.slug} id={`service-${service.slug}`}>
                  <ServiceCard service={service} index={index} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden xl:block">
          <HelpSidebar />
        </div>
      </div>

      {/* Mobile help */}
      <div className="xl:hidden">
        <HelpSidebar />
      </div>

      <WhyChooseSection />
    </div>
  )
}
