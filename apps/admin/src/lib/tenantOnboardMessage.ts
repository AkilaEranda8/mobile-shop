const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.hexalyte.com'

export type TenantOnboardShareInput = {
  shopName: string
  ownerName: string
  email: string
  password: string
  plan: string
  phone?: string
  subdomain?: string
}

export function tenantLoginUrl(): string {
  return `${WEB_APP_URL.replace(/\/$/, '')}/login`
}

export function buildTenantOnboardShareMessage(input: TenantOnboardShareInput): string {
  const planLabel = input.plan.charAt(0) + input.plan.slice(1).toLowerCase()
  const loginUrl = tenantLoginUrl()

  const lines = [
    `*Welcome to Hexalyte*`,
    '',
    `Hi *${input.ownerName}*,`,
    '',
    `Your shop account has been created and is ready to use.`,
    '',
    `🏪 *Shop:* ${input.shopName}`,
    `📦 *Plan:* ${planLabel}`,
    '',
    `─────────────────`,
    `*LOGIN CREDENTIALS*`,
    `─────────────────`,
    '',
    `🔗 *Login URL*`,
    loginUrl,
    '',
    `📧 *Email*`,
    input.email,
    '',
    `🔑 *Password*`,
    input.password,
  ]

  if (input.subdomain) {
    lines.push('', `🌐 *Shop URL*`, input.subdomain)
  }

  lines.push(
    '',
    `─────────────────`,
    '',
    `_Please sign in and change your password after your first login._`,
    '',
    `Thank you for choosing Hexalyte!`,
    `— *Hexalyte Team*`,
  )

  return lines.join('\n')
}

export function whatsAppShareUrl(message: string, phone?: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const text = encodeURIComponent(message)
  if (digits.length >= 9) {
    const normalized = digits.startsWith('0') ? `94${digits.slice(1)}` : digits
    return `https://wa.me/${normalized}?text=${text}`
  }
  return `https://wa.me/?text=${text}`
}
