/**
 * Regression checks for branch catalog SKU normalization and destination lookup.
 * Run: npx tsx src/utils/branch-catalog.test.ts
 */
import {
  catalogBaseSku,
  destBranchSku,
  findBranchCatalogProduct,
} from './branch-catalog'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`)
}

const destinationBranchId = 'cmrt38hjh005t8o8vteiglqb5'
const baseSku = 'SHENZA-SKU-00811'
const cloneSku = `${baseSku}-BRIGLQB5`

assert(catalogBaseSku(cloneSku) === baseSku, 'strips a branch suffix')
assert(
  catalogBaseSku(`${cloneSku}-BRIGLQB5`) === baseSku,
  'strips repeated branch suffixes',
)
assert(destBranchSku(baseSku, destinationBranchId) === cloneSku, 'creates destination SKU')
assert(
  destBranchSku(cloneSku, destinationBranchId) === cloneSku,
  'does not create a double suffix from a clone SKU',
)

const calls: Array<Record<string, unknown>> = []
const db = {
  product: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      calls.push(where)
      return where.sku === baseSku ? { id: 'hq-product', ...where } : null
    },
  },
}

void findBranchCatalogProduct(
  db as any,
  'tenant-1',
  cloneSku,
  'hq-branch',
).then((product) => {
  assert(product?.id === 'hq-product', 'finds the clean destination catalog from a clone')
  assert(calls.length === 1, 'prefers the clean destination catalog before clone lookup')
  assert(calls[0].branchId === 'hq-branch', 'scopes catalog lookup to destination branch')
  console.log('branch-catalog.test.ts: all checks passed')
})
