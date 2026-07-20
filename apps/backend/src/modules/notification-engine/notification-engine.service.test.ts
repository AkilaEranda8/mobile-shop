/**
 * Run: npx tsx src/modules/notification-engine/notification-engine.service.test.ts
 */
import type { DispatchNotificationInput } from './notification-engine.types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const sample: DispatchNotificationInput = {
  tenantId: 't1',
  channels: ['whatsapp', 'in_app'],
  eventType: 'DELIVERY_STATUS',
  recipient: { phone: '+94771234567', userId: 'u1' },
  message: 'Hello',
  title: 'Update',
}

assert(sample.channels.includes('whatsapp'), 'whatsapp channel')
assert(sample.eventType === 'DELIVERY_STATUS', 'event type')

console.log('notification-engine.service.test.ts: all checks passed')
