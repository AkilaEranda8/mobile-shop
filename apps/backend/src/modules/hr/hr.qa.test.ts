/**
 * HR static QA harness (Phase 1–7 schemas + engine contracts, no DB).
 * Run: npx tsx src/modules/hr/hr.qa.test.ts
 */
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  linkUserSchema,
  createDepartmentSchema,
  createLeaveTypeSchema,
  submitLeaveSchema,
  createSalaryComponentSchema,
  upsertSalaryPackageSchema,
  createCommissionRuleSchema,
  createPayrollPeriodSchema,
  createPayrollRunSchema,
  payPayrollSchema,
  requestAdvanceSchema,
  requestLoanSchema,
  activateLoanSchema,
} from './hr.schema'
import { DEFAULT_DEPARTMENTS, DEFAULT_DESIGNATIONS } from './hr.util'
import { HR_PAYROLL_FEATURE } from './hr.middleware'
import { HR_ENGINE_VERSION } from '../hr-engine/hr-engine.types'
import { calculateCompensationResult, calculateCommissionPreview } from '../hr-engine/hr-engine.compensation'
import { calculateLeaveDays } from '../hr-engine/hr-engine.leave'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(HR_PAYROLL_FEATURE === 'HR_PAYROLL', 'feature key stable')
assert(HR_ENGINE_VERSION.startsWith('1.'), 'engine version set')
assert(DEFAULT_DEPARTMENTS.length >= 5, 'default departments seeded list')
assert(DEFAULT_DESIGNATIONS.some(d => d.code === 'CASHIER'), 'cashier designation default')

// --- create employee schema ---
const cuid = 'clxxxxxxxxxxxxxxxxxxxxxxxx'
const goodCreate = createEmployeeSchema.safeParse({
  fullName: 'Nimal Perera',
  primaryBranchId: cuid,
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
  primaryBranchId: cuid,
  email: 'not-an-email',
})
assert(!badEmail.success, 'reject bad email')

const emptyEmailOk = createEmployeeSchema.safeParse({
  fullName: 'X',
  primaryBranchId: cuid,
  email: '',
})
assert(emptyEmailOk.success, 'empty email allowed')

const badStatus = createEmployeeSchema.safeParse({
  fullName: 'X',
  primaryBranchId: cuid,
  status: 'FIRED',
})
assert(!badStatus.success, 'reject invalid status')

const partial = updateEmployeeSchema.safeParse({ fullName: 'Updated' })
assert(partial.success, 'partial update ok')
const codeBlocked = updateEmployeeSchema.safeParse({ employeeCode: 'EMP-9999' })
assert(codeBlocked.success, 'unknown employeeCode stripped / ignored on update parse')
assert(!('employeeCode' in (codeBlocked.data ?? {})), 'employeeCode not in update payload')

const linkNull = linkUserSchema.safeParse({ userId: null })
assert(linkNull.success, 'unlink null ok')
const linkBad = linkUserSchema.safeParse({ userId: 'not-cuid' })
assert(!linkBad.success, 'link requires cuid')

const dept = createDepartmentSchema.safeParse({ name: 'Sales' })
assert(dept.success, 'dept name ok')
const deptEmpty = createDepartmentSchema.safeParse({ name: '   ' })
assert(!deptEmpty.success, 'dept blank name rejected')

// --- Phase 3 leave schemas ---
assert(createLeaveTypeSchema.safeParse({ name: 'Annual' }).success, 'leave type ok')
assert(submitLeaveSchema.safeParse({ leaveTypeId: cuid, startDate: '2026-08-26' }).success, 'submit leave ok')
assert(!submitLeaveSchema.safeParse({ leaveTypeId: 'x', startDate: '2026-08-26' }).success, 'submit leave bad type id')
assert(calculateLeaveDays({ startDate: '2026-08-26', endDate: '2026-08-28', startPart: 'PM', endPart: 'AM' }) === 2, 'leave half span')

// --- Phase 4 salary / commission ---
assert(createSalaryComponentSchema.safeParse({ name: 'TA', code: 'TA' }).success, 'salary component')
assert(
  upsertSalaryPackageSchema.safeParse({ employeeId: cuid, effectiveFrom: '2026-08-01', basicSalary: 100000 }).success,
  'salary package',
)
assert(createCommissionRuleSchema.safeParse({ name: 'POS', source: 'SALES', ratePercent: 1 }).success, 'commission rule')
assert(!createCommissionRuleSchema.safeParse({ name: 'X', source: 'POS' }).success, 'bad commission source')

const pkg = calculateCompensationResult({
  basicSalary: 100_000,
  components: [{ code: 'EPF_EE', label: 'EPF', kind: 'DEDUCTION', calcType: 'PERCENT_OF_BASIC', amount: 8 }],
  commissionAmount: 1000,
})
assert(pkg.net === 93_000, `comp net got ${pkg.net}`)
assert(calculateCommissionPreview([{ source: 'SALES', amount: 100_000 }], [{ source: 'SALES', ratePercent: 1, flatPerUnit: 0 }]).total === 1000, 'comm preview')

// --- Phase 5–6 payroll schemas ---
assert(createPayrollPeriodSchema.safeParse({ startDate: '2026-08-01', endDate: '2026-08-31' }).success, 'period')
assert(createPayrollRunSchema.safeParse({ periodId: cuid }).success, 'run draft')
assert(payPayrollSchema.safeParse({ paymentMethod: 'CASH', branchId: cuid }).success, 'pay schema')

// --- Phase 7 advances ---
assert(requestAdvanceSchema.safeParse({ amount: 5000 }).success, 'advance')
assert(!requestAdvanceSchema.safeParse({ amount: 0 }).success, 'advance amount > 0')
assert(requestLoanSchema.safeParse({ principal: 50000, installmentCount: 6 }).success, 'loan')
assert(activateLoanSchema.safeParse({ firstDueDate: '2026-09-01' }).success, 'activate loan')

console.log('hr.qa.test.ts: all checks passed')
