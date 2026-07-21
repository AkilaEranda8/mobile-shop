import { env } from '../config/env'
import { tenantShopUrl } from './tenant-app-domain'

export type TenantOnboardShareInput = {
  shopName: string
  ownerName: string
  email: string
  password: string
  plan: string
  phone?: string
  subdomain?: string
}

export function tenantLoginUrl(subdomain?: string): string {
  if (subdomain) {
    const slug = subdomain.includes('.') ? subdomain.split('.')[0] : subdomain
    return tenantShopUrl(slug, '/login')
  }
  const base = (env.FRONTEND_URL || 'https://app.hexalyte.com').replace(/\/$/, '')
  return `${base}/login`
}

export function buildTenantOnboardShareMessage(input: TenantOnboardShareInput): string {
  const planLabel = input.plan.charAt(0) + input.plan.slice(1).toLowerCase()
  const loginUrl = tenantLoginUrl(input.subdomain)

  const lines = [
    '*Welcome to Hexalyte*',
    '',
    `Hi *${input.ownerName}*,`,
    '',
    'Your shop account has been created and is ready to use.',
    '',
    `🏪 *Shop:* ${input.shopName}`,
    `📦 *Plan:* ${planLabel}`,
    '',
    '─────────────────',
    '*LOGIN CREDENTIALS*',
    '─────────────────',
    '',
    '🔗 *Login URL*',
    loginUrl,
    '',
    '📧 *Email*',
    input.email,
    '',
    '🔑 *Password*',
    input.password,
  ]

  if (input.subdomain) {
    const slug = input.subdomain.includes('.') ? input.subdomain.split('.')[0] : input.subdomain
    lines.push('', '🌐 *Shop URL*', tenantShopUrl(slug))
  }

  lines.push(
    '',
    '─────────────────',
    '',
    '_Please sign in and change your password after your first login._',
    '',
    'Thank you for choosing Hexalyte!',
    '— *Hexalyte Team*',
  )

  return lines.join('\n')
}
