import { prisma } from '../../../config/database'

export async function listAuditEvents(
  tenantId: string,
  opts: { skip: number; limit: number; entityType?: string; eventType?: string },
) {
  const where = {
    tenantId,
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.eventType ? { eventType: opts.eventType } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts.skip,
      take: opts.limit,
    }),
    prisma.auditEvent.count({ where }),
  ])

  return { rows, total }
}
