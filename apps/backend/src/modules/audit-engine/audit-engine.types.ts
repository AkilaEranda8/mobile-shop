import type { Prisma } from '@prisma/client'

export type AuditActor = {
  userId?: string | null
  email?: string | null
}

export type RecordAuditEventInput = {
  tenantId: string
  branchId?: string | null
  actor?: AuditActor
  /** Falls back to actor.email or 'system' */
  actorEmail?: string | null
  eventType: string
  entityType: string
  entityId: string
  beforeJson?: Prisma.InputJsonValue | null
  afterJson?: Prisma.InputJsonValue | null
  ip?: string | null
  /** Stored inside afterJson.meta.correlationId when afterJson is object-like */
  correlationId?: string | null
}

export type ListAuditEventsOpts = {
  skip: number
  limit: number
  entityType?: string
  eventType?: string
  entityId?: string
}
