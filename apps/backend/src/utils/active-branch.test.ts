/**
 * Lightweight runtime checks for active-branch resolution (no DB).
 * Run: npx tsx src/utils/active-branch.test.ts
 */
import { pickDefaultBranchId } from './active-branch'

const branches = [
  { id: 'b1', name: 'Colombo', city: '', isHeadquarters: false, isDefault: false, isActive: true },
  { id: 'b2', name: 'Kandy', city: '', isHeadquarters: true, isDefault: false, isActive: true },
  { id: 'b3', name: 'Galle', city: '', isHeadquarters: false, isDefault: true, isActive: true },
]

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// Default only applies within assigned pool
assert(pickDefaultBranchId(branches, ['b1', 'b2', 'b3']) === 'b3', 'isDefault in assigned pool')
assert(pickDefaultBranchId(branches, ['b1', 'b2']) === 'b1', 'default outside assigned pool ignored')

const noDefault = branches.map(b => ({ ...b, isDefault: false }))
assert(pickDefaultBranchId(noDefault, ['b1', 'b2']) === 'b1', 'first assigned branch')
assert(pickDefaultBranchId(branches, ['b1', 'b2', 'b3'], 'b1') === 'b1', 'preferred id')

console.log('active-branch.test.ts: all checks passed')
