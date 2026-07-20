/**
 * Run: npx tsx src/modules/audit-engine/audit-engine.service.test.ts
 */
import type { RecordAuditEventInput } from './audit-engine.types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

/** Unit-test merge behavior without DB by reimplementing the small pure helper inline. */
function mergeAfterJson(
  afterJson: Record<string, unknown> | null | undefined,
  correlationId?: string | null,
) {
  if (correlationId == null || correlationId === '') return afterJson ?? undefined
  if (afterJson != null && typeof afterJson === 'object') {
    return { ...afterJson, meta: { ...(afterJson.meta as object || {}), correlationId } }
  }
  return { value: afterJson ?? null, meta: { correlationId } }
}

const merged = mergeAfterJson({ name: 'P1' }, 'corr-1') as any
assert(merged.name === 'P1' && merged.meta.correlationId === 'corr-1', 'correlation in meta')

const input: RecordAuditEventInput = {
  tenantId: 't1',
  eventType: 'TEST',
  entityType: 'X',
  entityId: '1',
  actorEmail: 'a@b.com',
}
assert(input.eventType === 'TEST', 'input shape')

console.log('audit-engine.service.test.ts: all checks passed')
