import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Hexalyte Innovation privacy policy for the mobile shop SaaS platform.',
}

const COMPANY = 'Hexalyte Innovation (Pvt) Ltd'
const CONTACT = 'info@hexalyte.com'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#07090f] text-slate-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/login" className="text-sm text-violet-400 hover:text-violet-300">← Back to login</Link>
        <h1 className="text-3xl font-bold text-white mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Who we are</h2>
            <p>
              {COMPANY} operates Hexalyte, a cloud-based point-of-sale and shop management platform
              for mobile phone retailers and repair centres in Sri Lanka. Our application is hosted at{' '}
              <strong className="text-white">app.hexalyte.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data we collect</h2>
            <p>When you use Hexalyte we store business data you enter, including shop profile, products,
              inventory, sales, customers, repairs, and staff accounts. We also collect account credentials
              (email, hashed password) and basic usage logs for security and support.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">How we use data</h2>
            <p>Your data is used solely to provide the Hexalyte service to your business — billing,
              inventory, POS, reports, and support. We do not sell customer data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data storage &amp; security</h2>
            <p>Tenant data is stored on secure servers with encrypted connections (HTTPS). Access is
              restricted by role-based permissions within your organisation.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Your rights</h2>
            <p>You may request export or deletion of your tenant data by contacting us. Account owners
              can manage staff access from Settings → Staff.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p>
              Questions about this policy:{' '}
              <a href={`mailto:${CONTACT}`} className="text-violet-400 hover:underline">{CONTACT}</a>
              {' · '}
              <a href="https://www.hexalyte.com" className="text-violet-400 hover:underline">www.hexalyte.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
