import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'

/**
 * Verifies the password against any active OWNER (or PLATFORM_ADMIN) user
 * for the tenant. Used to gate destructive / correcting sales actions.
 */
export async function verifyTenantAdminPassword(tenantId: string, password: unknown) {
  const raw = typeof password === 'string' ? password : ''
  if (!raw.trim()) throw new AppError('Admin password is required', 400)

  const admins = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ['OWNER', 'PLATFORM_ADMIN'] },
    },
    select: { id: true, password: true },
  })
  if (!admins.length) {
    throw new AppError('No admin account found for this shop. Contact Hexalyte support.', 400)
  }

  for (const admin of admins) {
    if (await bcrypt.compare(raw, admin.password)) return
  }
  throw new AppError('Invalid admin password', 403)
}
