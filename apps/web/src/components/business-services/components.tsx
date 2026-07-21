'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Mail, MessageCircle, Phone } from 'lucide-react'
import type { BusinessService, ServicePackage } from './data'
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, WHY_CHOOSE } from './data'
import { getWhatsAppContactUrl, getWhatsAppRequestUrl } from './whatsapp'

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export function WhatsAppRequestButton({
  serviceName,
  packageName,
  packagePrice,
  className = '',
  label = 'Request via WhatsApp',
}: {
  serviceName: string
  packageName: string
  packagePrice: string
  className?: string
  label?: string
}) {
  return (
    <a
      href={getWhatsAppRequestUrl(serviceName, packageName, packagePrice)}
      target="_blank"
      rel="noreferrer"
      className={`group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2.5 transition-all duration-200 active:scale-[0.98] shadow-sm ${className}`}
    >
      <span className="absolute inset-0 opacity-0 group-active:opacity-30 bg-white/40 transition-opacity duration-300 rounded-xl" />
      <MessageCircle size={16} />
      {label}
    </a>
  )
}

export function ServiceCard({ service, index = 0 }: { service: BusinessService; index?: number }) {
  const Icon = service.icon
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.35) }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="card card-hover p-5 flex flex-col h-full rounded-2xl border group"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: 'var(--brand-glow)', border: '1px solid var(--sidebar-active-border)', color: 'var(--brand-primary)' }}
      >
        <Icon size={20} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
        {service.title}
      </h3>
      <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: 'var(--text-secondary)' }}>
        {service.shortDescription}
      </p>
      <div className="flex items-end justify-between gap-3 mt-auto pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>
            Starting from
          </p>
          <p className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>
            {service.startingPrice}
          </p>
        </div>
        <Link
          href={`/business-services/${service.slug}`}
          className="btn-secondary !px-3 !py-2 text-xs font-semibold inline-flex items-center gap-1.5"
        >
          View Packages
          <ArrowRight size={13} />
        </Link>
      </div>
    </motion.div>
  )
}

export function PackageCard({
  serviceTitle,
  pkg,
  previousLabel,
}: {
  serviceTitle: string
  pkg: ServicePackage
  previousLabel?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="card p-6 rounded-2xl flex flex-col h-full relative overflow-hidden"
      style={{
        borderColor: pkg.popular ? 'var(--sidebar-active-border)' : 'var(--border-subtle)',
        boxShadow: pkg.popular ? '0 0 0 2px color-mix(in srgb, var(--brand-primary) 35%, transparent)' : undefined,
        background: pkg.popular
          ? 'linear-gradient(180deg, color-mix(in srgb, var(--brand-glow) 55%, var(--bg-card)), var(--bg-card))'
          : 'var(--bg-card)',
      }}
    >
      {pkg.badge && (
        <span
          className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-1 rounded-lg border"
          style={{
            background: 'var(--brand-glow)',
            borderColor: 'var(--sidebar-active-border)',
            color: 'var(--sidebar-active-text)',
          }}
        >
          {pkg.badge}
        </span>
      )}
      <h3 className="text-lg font-bold mb-1 pr-24" style={{ color: 'var(--text-primary)' }}>
        {pkg.name}
      </h3>
      {pkg.priceNote && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          {pkg.priceNote}
        </p>
      )}
      <p className="text-2xl font-bold mb-5" style={{ color: 'var(--brand-primary)' }}>
        {pkg.price}
      </p>
      <ul className="space-y-2.5 flex-1 mb-6">
        {pkg.includesPrevious && previousLabel && (
          <li className="text-sm font-medium flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
            Everything in {previousLabel}
          </li>
        )}
        {pkg.includesPrevious && previousLabel && (
          <li className="text-[11px] uppercase tracking-wide font-semibold pt-1" style={{ color: 'var(--text-muted)' }}>
            Plus
          </li>
        )}
        {pkg.features.map((f) => (
          <li key={f} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <WhatsAppRequestButton
        serviceName={serviceTitle}
        packageName={pkg.name}
        packagePrice={pkg.price}
        className="w-full"
      />
    </motion.div>
  )
}

export function ServiceNav({
  services,
  activeSlug,
  onSelect,
}: {
  services: BusinessService[]
  activeSlug?: string
  onSelect?: (slug: string) => void
}) {
  return (
    <nav className="card p-3 rounded-2xl sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <p className="text-[11px] font-semibold uppercase tracking-wider px-2 py-2" style={{ color: 'var(--text-muted)' }}>
        Business Services
      </p>
      <ul className="space-y-0.5">
        {services.map((s) => {
          const active = activeSlug === s.slug
          const Icon = s.icon
          const className = `w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-sm transition-all ${
            active ? 'font-semibold' : 'hover:bg-[var(--bg-subtle)]'
          }`
          const style = active
            ? {
                background: 'var(--sidebar-active-bg)',
                color: 'var(--sidebar-active-text)',
                border: '1px solid var(--sidebar-active-border)',
              }
            : { color: 'var(--text-secondary)', border: '1px solid transparent' }

          if (onSelect) {
            return (
              <li key={s.slug}>
                <button type="button" onClick={() => onSelect(s.slug)} className={className} style={style}>
                  <Icon size={15} className="shrink-0 opacity-80" />
                  <span className="truncate">{s.title}</span>
                </button>
              </li>
            )
          }

          return (
            <li key={s.slug}>
              <Link href={`/business-services/${s.slug}`} className={className} style={style}>
                <Icon size={15} className="shrink-0 opacity-80" />
                <span className="truncate">{s.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function HelpSidebar() {
  return (
    <aside className="card p-5 rounded-2xl sticky top-20 space-y-4">
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Need Help?
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Our team is ready to guide you to the right package.
        </p>
      </div>
      <a
        href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, '')}`}
        className="flex items-center gap-3 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}
        >
          <Phone size={16} />
        </span>
        📞 {SUPPORT_PHONE_DISPLAY}
      </a>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="flex items-center gap-3 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}
        >
          <Mail size={16} />
        </span>
        📧 {SUPPORT_EMAIL}
      </a>
      <a
        href={getWhatsAppContactUrl()}
        target="_blank"
        rel="noreferrer"
        className="group relative overflow-hidden flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2.5 transition-all active:scale-[0.98]"
      >
        <MessageCircle size={16} />
        Contact Our Team
      </a>
    </aside>
  )
}

export function WhyChooseSection() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Why Choose Hexalyte
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          A trusted partner for registration, digital, and growth services.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {WHY_CHOOSE.map((item, i) => (
          <motion.div
            key={item.title}
            {...fadeUp}
            transition={{ delay: i * 0.03 }}
            className="card p-4 rounded-2xl"
          >
            <div className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {item.desc}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
