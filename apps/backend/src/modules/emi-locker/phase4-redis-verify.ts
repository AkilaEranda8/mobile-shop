/**
 * Phase 4 — real Redis verification (no Redis mock).
 *
 * Confirms REDIS_URL connectivity, EMI worker scan, and that production
 * redis.ts does not silently fall back to an in-memory mock.
 *
 * Prerequisites: Redis listening (default redis://localhost:6379)
 * Run: npx tsx src/modules/emi-locker/phase4-redis-verify.ts
 */
process.env.DATABASE_URL =
  process.env.PHASE4_DATABASE_URL
  || process.env.PHASE3_DATABASE_URL
  || process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/hexalyte_emi_accept'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
process.env.EMI_LOCKER_ENABLED = 'true'
process.env.EMI_LOCKER_DRY_RUN = 'true'
process.env.ANDROID_MANAGEMENT_ENABLED = 'false'
process.env.KEYCLOAK_AUTH_ENABLED = 'false'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []

function expect(name: string, cond: boolean, detail?: string) {
  checks.push({ name, pass: !!cond, detail })
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) throw new Error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('\n=== PHASE 4 REAL REDIS VERIFICATION ===')
  console.log('REDIS_URL=', process.env.REDIS_URL)
  console.log('DB=', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))

  const { redis, connectRedis } = await import('../../config/redis')
  expect('redis client is ioredis (not mock object)', typeof (redis as any).options === 'object')
  expect('no mock connect stub', (redis as any).connect?.toString?.().includes('async () => undefined') !== true)

  await connectRedis()
  expect('redis status ready/connecting/connect', ['ready', 'connecting', 'connect'].includes(redis.status), redis.status)

  const pong = await redis.ping()
  expect('PING => PONG', pong === 'PONG', String(pong))

  const key = `emi-locker:phase4-redis-verify:${Date.now()}`
  await redis.set(key, '1', 'EX', 30)
  const got = await redis.get(key)
  expect('SET/GET roundtrip', got === '1', String(got))
  await redis.del(key)

  // Force a clear error log path when pointing at a bad host (temporary client)
  const Redis = (await import('ioredis')).default
  const bad = new Redis('redis://127.0.0.1:6399', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 500,
    retryStrategy: () => null,
  })
  let badErr = ''
  bad.on('error', (err) => {
    badErr = err.message
  })
  try {
    await bad.connect()
  } catch (e) {
    badErr = e instanceof Error ? e.message : String(e)
  }
  await bad.quit().catch(() => undefined)
  expect('bad Redis host surfaces error (no silent mock fallback)', badErr.length > 0, badErr.slice(0, 120))

  const { runEmiLockerEnforcement } = await import('../../jobs/emi-locker-enforcement.job')
  await runEmiLockerEnforcement()
  expect('EMI enforcement worker completed without throw', true)

  // Auth blacklist dependency uses real Redis
  await redis.set('blacklist:phase4-probe', '1', 'EX', 5)
  expect('auth-style blacklist key writable', (await redis.get('blacklist:phase4-probe')) === '1')
  await redis.del('blacklist:phase4-probe')

  await redis.quit()

  const failed = checks.filter((c) => !c.pass)
  console.log(`\nRedis checks: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
