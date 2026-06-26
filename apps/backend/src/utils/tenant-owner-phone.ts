import { prisma } from '../config/database'

type BranchLike = { phone?: string | null; isHeadquarters?: boolean }

export function pickBranchPhone(branches: BranchLike[]): string | null {
  const hq = branches.find(b => b.isHeadquarters && b.phone?.trim())
  if (hq?.phone?.trim()) return hq.phone.trim()
  const any = branches.find(b => b.phone?.trim())
  return any?.phone?.trim() ?? null
}

export function phoneFromInvoiceSettings(invoiceSettings: unknown): string | null {
  if (!invoiceSettings || typeof invoiceSettings !== 'object') return null
  const phone = (invoiceSettings as Record<string, unknown>).phone
  return typeof phone === 'string' && phone.trim() ? phone.trim() : null
}

export type OwnerPhoneSource = 'branch' | 'invoice_settings' | 'customer' | null

export async function resolveTenantOwnerPhone(tenantId: string): Promise<{
  phone: string | null
  source: OwnerPhoneSource
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      ownerEmail: true,
      ownerName: true,
      invoiceSettings: true,
      branches: { select: { phone: true, isHeadquarters: true } },
    },
  })
  if (!tenant) return { phone: null, source: null }

  const fromBranch = pickBranchPhone(tenant.branches)
  if (fromBranch) return { phone: fromBranch, source: 'branch' }

  const fromInvoice = phoneFromInvoiceSettings(tenant.invoiceSettings)
  if (fromInvoice) return { phone: fromInvoice, source: 'invoice_settings' }

  if (tenant.ownerEmail) {
    const byEmail = await prisma.customer.findFirst({
      where: {
        tenantId,
        email: { equals: tenant.ownerEmail, mode: 'insensitive' },
        phone: { not: '' },
      },
      select: { phone: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (byEmail?.phone?.trim()) return { phone: byEmail.phone.trim(), source: 'customer' }
  }

  if (tenant.ownerName) {
    const byName = await prisma.customer.findFirst({
      where: {
        tenantId,
        name: { equals: tenant.ownerName, mode: 'insensitive' },
        phone: { not: '' },
      },
      select: { phone: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (byName?.phone?.trim()) return { phone: byName.phone.trim(), source: 'customer' }
  }

  return { phone: null, source: null }
}

/** Sync resolver when tenant row already includes branches + invoiceSettings */
export function resolveTenantOwnerPhoneSync(
  branches: BranchLike[],
  invoiceSettings?: unknown,
): string | null {
  return pickBranchPhone(branches) ?? phoneFromInvoiceSettings(invoiceSettings)
}
