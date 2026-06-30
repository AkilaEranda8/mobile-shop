import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Hexalyte Innovation terms of service for the mobile shop SaaS platform.',
}

const COMPANY = 'Hexalyte Innovation (Pvt) Ltd'
const CONTACT = 'info@hexalyte.com'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#07090f] text-slate-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/login" className="text-sm text-violet-400 hover:text-violet-300">← Back to login</Link>
        <h1 className="text-3xl font-bold text-white mt-6 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Service</h2>
            <p>
              Hexalyte is a subscription SaaS platform provided by {COMPANY}. By creating an account at{' '}
              <strong className="text-white">app.hexalyte.com</strong> you agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Accounts</h2>
            <p>You are responsible for keeping login credentials secure and for all activity under your
              tenant account. Staff access should be granted only to authorised employees.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Acceptable use</h2>
            <p>Hexalyte must be used for legitimate retail and repair business operations only. You may not
              use the platform for phishing, spam, malware distribution, or any unlawful activity.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Subscriptions &amp; billing</h2>
            <p>Paid plans are billed according to the plan selected at registration or upgrade. Trial accounts
              may be limited in features or duration as described during signup.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Availability</h2>
            <p>We aim for high uptime but do not guarantee uninterrupted service. Scheduled maintenance will
              be communicated in advance where possible.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p>
              For support or legal enquiries:{' '}
              <a href={`mailto:${CONTACT}`} className="text-violet-400 hover:underline">{CONTACT}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
