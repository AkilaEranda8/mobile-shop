import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import type { ListAuditEventsOpts, RecordAuditEventInput } from './audit-engine.types'

type DbClient = Prisma.TransactionClient | typeof prisma

function resolveActorEmail(input: RecordAuditEventInput): string {
  return (input.actorEmail ?? input.actor?.email ?? 'system').trim() || 'system'
}

function mergeAfterJson(
  afterJson: Prisma.InputJsonValue | null | undefined,
  correlationId?: string | null,
): Prisma.InputJsonValue | undefined {
  if (correlationId == null || correlationId === '') {
    return afterJson === null ? undefined : afterJson
  }
  if (afterJson != null && typeof afterJson === 'object' && !Array.isArray(afterJson)) {
    const base = afterJson as Record<string, unknown>
    const meta = {
      ...((base.meta as Record<string, unknown> | undefined) ?? {}),
      correlationId,
    }
    return { ...base, meta } as Prisma.InputJsonValue
  }
  return {
    value: afterJson ?? null,
    meta: { correlationId },
  } as Prisma.InputJsonValue
}

/**
 * Append-only audit write. Prefer this over raw `prisma.auditEvent.create`.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
  db: DbClient = prisma,
): Promise<string> {
  const row = await db.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      actorUserId: input.actor?.userId ?? undefined,
      actorEmail: resolveActorEmail(input),
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson === null ? undefined : input.beforeJson,
      afterJson: mergeAfterJson(input.afterJson, input.correlationId),
      ip: input.ip ?? undefined,
    },
  })
  return row.id
}

/** Non-blocking audit — never throws (for optional operational hooks). */
export async function recordAuditEventSafe(
  input: RecordAuditEventInput,
  db: DbClient = prisma,
): Promise<string | null> {
  try {
    return await recordAuditEvent(input, db)
  } catch (e) {
    console.error('audit-engine record failed:', e)
    return null
  }
}

export async function listAuditEvents(tenantId: string, opts: ListAuditEventsOpts) {
  const where = {
    tenantId,
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.eventType ? { eventType: opts.eventType } : {}),
    ...(opts.entityId ? { entityId: opts.entityId } : {}),
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
