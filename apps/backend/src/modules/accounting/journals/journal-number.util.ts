import { prisma } from '../../../config/database'
import { redis } from '../../../config/redis'

export async function generateJournalEntryNo(tenantId: string): Promise<string> {
  const key = `jnl_seq:${tenantId}`
  const seeded = await redis.set(key, '0', 'NX')
  if (seeded === 'OK') {
    const count = await prisma.journalEntry.count({ where: { tenantId } })
    await redis.set(key, String(count))
  }
  const next = await redis.incr(key)
  return `JNL-${String(next).padStart(6, '0')}`
}

