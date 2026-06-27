import { env } from '../config/env'

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
    const host = subdomain.includes('.') ? subdomain : `${subdomain}.app.hexalyte.com`
    return `https://${host.replace(/^https?:\/\//, '')}/login`
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
    const shopHost = input.subdomain.includes('.')
      ? input.subdomain
      : `${input.subdomain}.app.hexalyte.com`
    lines.push('', '🌐 *Shop URL*', `https://${shopHost.replace(/^https?:\/\//, '')}`)
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
