import type { Request } from 'express'
import { prisma } from '../config/database'

export type PlatformActivityInput = {
  eventType: string
  severity?: string
  actorType: string
  actor: string
  target?: string
  details: string
  ip?: string
  tenantId?: string | null
  userId?: string | null
}

export function getClientIp(req: Pick<Request, 'ip' | 'socket' | 'headers'>): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || '—'
}

export async function logPlatformActivity(input: PlatformActivityInput): Promise<void> {
  try {
    await prisma.platformActivityLog.create({
      data: {
        eventType: input.eventType,
        severity: input.severity ?? 'INFO',
        actorType: input.actorType,
        actor: input.actor,
        target: input.target ?? '—',
        details: input.details,
        ip: input.ip ?? '—',
        tenantId: input.tenantId ?? undefined,
        userId: input.userId ?? undefined,
      },
    })
  } catch (err) {
    console.error('[ActivityLog] write failed:', err)
  }
}
