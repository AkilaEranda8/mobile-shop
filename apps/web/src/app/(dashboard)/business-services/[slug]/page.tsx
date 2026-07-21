'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { BUSINESS_SERVICES, getServiceBySlug } from '@/components/business-services/data'
import {
  HelpSidebar,
  PackageCard,
  ServiceNav,
  WhatsAppRequestButton,
  WhyChooseSection,
} from '@/components/business-services/components'

export default function BusinessServiceDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = typeof params?.slug === 'string' ? params.slug : ''
  const service = useMemo(() => (slug ? getServiceBySlug(slug) : undefined), [slug])

  if (!service) {
    return (
      <div className="card p-10 text-center rounded-2xl space-y-3">
        <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Service not found
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          This service does not exist or may have been moved.
        </p>
        <Link href="/business-services" className="btn-primary inline-flex">
          Back to Business Services
        </Link>
      </div>
    )
  }

  const Icon = service.icon
  const defaultPkg = service.packages.find((p) => p.popular) ?? service.packages[0]

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Link
          href="/business-services"
          className="inline-flex items-center gap-1.5 font-medium hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} />
          Business Services
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {service.title}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_240px] gap-5 items-start">
        <div className="hidden xl:block">
          <ServiceNav services={BUSINESS_SERVICES} activeSlug={service.slug} />
        </div>

        <div className="space-y-8 min-w-0">
          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border p-6 sm:p-8"
            style={{
              borderColor: 'var(--border-subtle)',
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--brand-glow) 75%, var(--bg-card)), var(--bg-card))',
            }}
          >
            <div
              className="pointer-events-none absolute -bottom-20 -right-10 w-64 h-64 rounded-full blur-3xl opacity-35"
              style={{ background: 'var(--brand-glow)' }}
            />
            <div className="relative flex flex-col sm:flex-row sm:items-start gap-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'var(--brand-glow)',
                  border: '1px solid var(--sidebar-active-border)',
                  color: 'var(--brand-primary)',
                }}
              >
                <Icon size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--sidebar-active-text)' }}>
                  {service.category}
                </p>
                <h1 className="page-title !text-3xl">{service.title}</h1>
                <p className="page-subtitle !mt-2 max-w-2xl leading-relaxed">{service.description}</p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Starting from
                    </p>
                    <p className="text-xl font-bold" style={{ color: 'var(--brand-primary)' }}>
                      {service.startingPrice}
                    </p>
                  </div>
                  {defaultPkg && (
                    <WhatsAppRequestButton
                      serviceName={service.title}
                      packageName={defaultPkg.name}
                      packagePrice={defaultPkg.price}
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Features */}
          <section className="card p-6 rounded-2xl">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Features
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {service.features.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Check size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            {service.note && (
              <p
                className="mt-4 text-xs font-medium px-3 py-2 rounded-xl border"
                style={{
                  color: 'var(--status-warn)',
                  background: 'var(--status-warn-soft)',
                  borderColor: 'var(--status-warn-border)',
                }}
              >
                {service.note}
              </p>
            )}
          </section>

          {/* Pricing */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Pricing
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Choose a package and request via WhatsApp — we respond quickly with next steps.
              </p>
            </div>
            <div className={`grid gap-4 ${service.packages.length >= 3 ? 'grid-cols-1 md:grid-cols-3' : service.packages.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
              {service.packages.map((pkg, idx) => {
                const previous = idx > 0 ? service.packages[idx - 1] : undefined
                return (
                  <PackageCard
                    key={pkg.id}
                    serviceTitle={service.title}
                    pkg={pkg}
                    previousLabel={pkg.includesPrevious ? previous?.name : undefined}
                  />
                )
              })}
            </div>
          </section>

          {/* FAQ */}
          {service.faqs.length > 0 && (
            <section className="card p-6 rounded-2xl space-y-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                FAQ
              </h2>
              <div className="space-y-3">
                {service.faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-xl border px-4 py-3"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <summary
                      className="cursor-pointer list-none text-sm font-semibold flex items-center justify-between gap-3"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {faq.q}
                      <ChevronRight size={15} className="shrink-0 transition-transform group-open:rotate-90" style={{ color: 'var(--text-muted)' }} />
                    </summary>
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <WhyChooseSection />
        </div>

        <div className="hidden xl:block">
          <HelpSidebar />
        </div>
      </div>

      <div className="xl:hidden">
        <HelpSidebar />
      </div>
    </div>
  )
}
