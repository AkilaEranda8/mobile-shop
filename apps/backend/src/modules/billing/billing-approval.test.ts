/**
 * Payment approval / reactivation decision helpers (pure).
 * Run: npx tsx src/modules/billing/billing-approval.test.ts
 */

function shouldReactivate(outstandingRequiredUnpaid: number): boolean {
  return outstandingRequiredUnpaid === 0
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// After approving one invoice with no others unpaid → reactivate
assert(shouldReactivate(0) === true, 'reactivate when no outstanding')

// Another unpaid required invoice remains → keep restricted
assert(shouldReactivate(1) === false, 'keep suspended/restricted when outstanding remain')
assert(shouldReactivate(3) === false, 'multiple outstanding')

console.log('billing-approval.test.ts: all checks passed')
