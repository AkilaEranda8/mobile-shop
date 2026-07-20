/**
 * Run: npx tsx src/modules/configuration-engine/configuration-engine.service.test.ts
 */
import { CONFIG_DOMAIN_META } from './configuration-engine.types'
import { cacheGet, cacheInvalidate, cacheSet, cacheClearAll } from './configuration-engine.cache'
import { listConfigDomains } from './configuration-engine.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(listConfigDomains().length === CONFIG_DOMAIN_META.length, 'domain list')
assert(CONFIG_DOMAIN_META.some(d => d.domain === 'invoice'), 'invoice domain')

cacheClearAll()
cacheSet('t1', 'invoice', { shopName: 'Demo' }, 60_000)
assert((cacheGet('t1', 'invoice') as any)?.shopName === 'Demo', 'cache hit')
cacheInvalidate('t1', 'invoice')
assert(cacheGet('t1', 'invoice') === undefined, 'cache invalidated')

console.log('configuration-engine.service.test.ts: all checks passed')
