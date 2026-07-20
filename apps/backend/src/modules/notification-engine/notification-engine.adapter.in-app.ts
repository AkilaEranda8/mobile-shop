import type { Prisma, UserNotificationType } from '@prisma/client'
import { prisma } from '../../config/database'
import type { ChannelDispatchResult } from './notification-engine.types'

type DbClient = Prisma.TransactionClient | typeof prisma

export async function dispatchInAppNotification(
  opts: {
    tenantId: string
    userId: string
    type: UserNotificationType
    title: string
    message: string
    link?: string | null
    relatedId?: string | null
  },
  db: DbClient = prisma,
): Promise<ChannelDispatchResult> {
  try {
    const row = await db.userNotification.create({
      data: {
        tenantId: opts.tenantId,
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        link: opts.link ?? null,
        relatedId: opts.relatedId ?? null,
      },
    })
    return { channel: 'in_app', ok: true, messageId: row.id }
  } catch (e: any) {
    return { channel: 'in_app', ok: false, error: e?.message ?? 'in_app dispatch failed' }
  }
}
