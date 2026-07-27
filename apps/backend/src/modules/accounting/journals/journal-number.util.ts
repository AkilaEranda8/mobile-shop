import { prisma } from '../../../config/database'
import { redis } from '../../../config/redis'

async function maxJournalSeq(tenantId: string): Promise<number> {
  const last = await prisma.journalEntry.findFirst({
    where: { tenantId, entryNo: { startsWith: 'JNL-' } },
    orderBy: { entryNo: 'desc' },
    select: { entryNo: true },
  })
  if (!last?.entryNo) return 0
  const n = parseInt(String(last.entryNo).replace(/^JNL-/i, ''), 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Allocates the next JNL-###### for a tenant.
 * Redis is the fast counter, but we always lift it to at least the DB max so
 * manually-inserted / support journals cannot cause unique-constraint collisions.
 */
export async function generateJournalEntryNo(tenantId: string): Promise<string> {
  const key = `jnl_seq:${tenantId}`
  const maxDb = await maxJournalSeq(tenantId)
  const currentRaw = await redis.get(key)
  const currentN = currentRaw != null ? parseInt(currentRaw, 10) : NaN
  if (!Number.isFinite(currentN) || currentN < maxDb) {
    await redis.set(key, String(maxDb))
  }
  const next = await redis.incr(key)
  return `JNL-${String(next).padStart(6, '0')}`
}
