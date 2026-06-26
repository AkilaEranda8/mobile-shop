import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'

const PLATFORM_TENANT_SLUG = 'hexalyte-platform-internal'

export async function ensurePlatformAdmin(): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.PLATFORM_ADMIN_PASSWORD?.trim()
  if (!email || !password) return

  const existingAdmins = await prisma.user.count({ where: { role: 'PLATFORM_ADMIN', isActive: true } })
  if (existingAdmins > 0) return

  let tenant = await prisma.tenant.findUnique({ where: { slug: PLATFORM_TENANT_SLUG } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Hexalyte Platform',
        slug: PLATFORM_TENANT_SLUG,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        ownerEmail: email,
        ownerName: 'Hexalyte Platform',
        mrr: 0,
      },
    })
  }

  const hashed = await bcrypt.hash(password, 12)
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { password: hashed, role: 'PLATFORM_ADMIN', isActive: true },
    create: {
      tenantId: tenant.id,
      email,
      name: 'Platform Admin',
      password: hashed,
      role: 'PLATFORM_ADMIN',
    },
  })

  console.log(`[Bootstrap] Platform admin ready: ${email}`)
}
