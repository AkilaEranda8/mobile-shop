/**
 * Run: npx tsx src/modules/emi-locker/emi-locker.schema.test.ts
 */
import { createHash } from 'crypto'
import {
  buildIdempotencyKey,
  generateEnrollmentSecrets,
  hashEnrollmentToken,
} from './emi-locker.schema'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const raw = 'test-token'
assert(
  hashEnrollmentToken(raw) === createHash('sha256').update(raw).digest('hex'),
  'hashEnrollmentToken uses sha256',
)

const a = generateEnrollmentSecrets()
const b = generateEnrollmentSecrets()
assert(/^ENR-[A-F0-9]{6}$/.test(a.enrollmentCode), 'enrollment code format')
assert(a.rawToken !== b.rawToken, 'tokens are unique')
assert(a.tokenHash === hashEnrollmentToken(a.rawToken), 'tokenHash matches raw')

assert(buildIdempotencyKey(['a', 'b']) === buildIdempotencyKey(['a', 'b']), 'idempotency stable')
assert(buildIdempotencyKey(['a', 'b']) !== buildIdempotencyKey(['a', 'c']), 'idempotency differs')

console.log('emi-locker.schema.test.ts: OK')
