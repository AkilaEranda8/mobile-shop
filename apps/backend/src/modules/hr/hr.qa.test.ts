/**
 * HR Phase-1 static QA harness (no DB).
 * Run: npx tsx src/modules/hr/hr.qa.test.ts
 */
import { createEmployeeSchema, updateEmployeeSchema, linkUserSchema, createDepartmentSchema } from './hr.schema'
import { DEFAULT_DEPARTMENTS, DEFAULT_DESIGNATIONS } from './hr.util'
import { HR_PAYROLL_FEATURE } from './hr.middleware'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(HR_PAYROLL_FEATURE === 'HR_PAYROLL', 'feature key stable')
assert(DEFAULT_DEPARTMENTS.length >= 5, 'default departments seeded list')
assert(DEFAULT_DESIGNATIONS.some(d => d.code === 'CASHIER'), 'cashier designation default')

// --- create employee schema ---
const goodCreate = createEmployeeSchema.safeParse({
  fullName: 'Nimal Perera',
  primaryBranchId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  email: 'nimal@shop.com',
  phone: '0771234567',
})
assert(goodCreate.success, `create valid: ${JSON.stringify(goodCreate.error?.flatten())}`)

const missingBranch = createEmployeeSchema.safeParse({ fullName: 'X' })
assert(!missingBranch.success, 'create requires primaryBranchId')

const badEmail = createEmployeeSchema.safeParse({
  fullName: 'X',
  primaryBranchId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
  email: 'not-an-email',
})
assert(!badEmail.success, 'reject bad email')

const emptyEmailOk = createEmployeeSchema.safeParse({
  fullName: 'X',
  primaryBranchId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
  email: '',
})
assert(emptyEmailOk.success, 'empty email allowed')

const badStatus = createEmployeeSchema.safeParse({
  fullName: 'X',
  primaryBranchId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
  status: 'FIRED',
})
assert(!badStatus.success, 'reject invalid status')

// --- update schema ---
const partial = updateEmployeeSchema.safeParse({ fullName: 'Updated' })
assert(partial.success, 'partial update ok')
const codeBlocked = updateEmployeeSchema.safeParse({ employeeCode: 'EMP-9999' })
// omit employeeCode from update schema — unknown keys stripped by zod object default
assert(codeBlocked.success, 'unknown employeeCode stripped / ignored on update parse')
assert(!('employeeCode' in (codeBlocked.data ?? {})), 'employeeCode not in update payload')

// --- link user ---
const linkNull = linkUserSchema.safeParse({ userId: null })
assert(linkNull.success, 'unlink null ok')
const linkBad = linkUserSchema.safeParse({ userId: 'not-cuid' })
assert(!linkBad.success, 'link requires cuid')

// --- department ---
const dept = createDepartmentSchema.safeParse({ name: 'Sales' })
assert(dept.success, 'dept name ok')
const deptEmpty = createDepartmentSchema.safeParse({ name: '   ' })
assert(!deptEmpty.success, 'dept blank name rejected')

console.log('hr.qa.test.ts: all checks passed')
