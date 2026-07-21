import { prisma } from '../config/database'

const BILLING_TENANT_SLUG = 'hexalyte-billing-internal'

export async function ensureBillingWhatsAppTenant(): Promise<string> {
  const fromEnv = process.env.BILLING_WHATSAPP_TENANT_ID?.trim()
  if (fromEnv) {
    const t = await prisma.tenant.findUnique({ where: { id: fromEnv } })
    if (t) return fromEnv
  }

  const row = await prisma.platformConfig.findUnique({ where: { key: 'billing_whatsapp_tenant_id' } })
  if (row?.value?.trim()) {
    const t = await prisma.tenant.findUnique({ where: { id: row.value.trim() } })
    if (t) return row.value.trim()
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: BILLING_TENANT_SLUG } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Hexalyte Billing',
        slug: BILLING_TENANT_SLUG,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        ownerEmail: 'billing@hexalyte.internal',
        ownerName: 'Hexalyte Platform',
        mrr: 0,
      },
    })
  }

  await prisma.whatsAppConfig.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, connectionMode: 'qr', enabled: true, sendPdfInvoice: true, status: 'disconnected' },
    update: { enabled: true, sendPdfInvoice: true },
  })

  await prisma.platformConfig.upsert({
    where: { key: 'billing_whatsapp_tenant_id' },
    create: { key: 'billing_whatsapp_tenant_id', value: tenant.id },
    update: { value: tenant.id },
  })

  return tenant.id
}
