/**
 * Run: npx tsx src/modules/emi-locker/emi-locker-eligibility.test.ts
 *
 * Pure unit checks for soft-status derivation (no DB).
 */
import { emiLockerEligibilityService } from './emi-locker-eligibility.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const today = new Date()
const utc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const start = utc(today)

function daysAgo(n: number) {
  const d = new Date(start)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function daysFromNow(n: number) {
  const d = new Date(start)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

const baseAgreement = {
  id: 'a1',
  tenantId: 't1',
  branchId: 'b1',
  agreementNumber: 'HP-1',
  customerId: 'c1',
  saleId: null,
  productId: null,
  imeiRecordId: null,
  salesPersonId: null,
  productName: 'Phone',
  brandName: null,
  modelName: null,
  imei: '123',
  color: null,
  storage: null,
  cashPrice: 1000,
  downPayment: 0,
  financeAmount: 1000,
  interestType: 'NONE' as const,
  interestRate: 0,
  interestAmount: 0,
  processingFee: 0,
  insuranceFee: 0,
  documentFee: 0,
  otherCharges: 0,
  installmentMonths: 2,
  monthlyInstallment: 500,
  totalPayable: 1000,
  paidAmount: 0,
  outstandingBalance: 1000,
  gracePeriodDays: 3,
  lateFee: 0,
  dueDay: 1,
  firstDueDate: daysAgo(10),
  customerNic: null,
  customerDob: null,
  occupation: null,
  monthlyIncome: null,
  employer: null,
  agreementPdfUrl: null,
  qrCode: null,
  barcode: null,
  customerSignatureUrl: null,
  deviceMgmtConsentVersion: 'v1',
  deviceMgmtConsentedAt: new Date(),
  deviceMgmtEnabled: true,
  status: 'ACTIVE' as const,
  approvedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const overduePastGrace = {
  ...baseAgreement,
  installments: [
    {
      id: 'i1',
      tenantId: 't1',
      branchId: 'b1',
      agreementId: 'a1',
      sequence: 1,
      dueDate: daysAgo(10),
      principal: 500,
      interest: 0,
      fees: 0,
      totalDue: 500,
      paidAmount: 0,
      outstanding: 500,
      status: 'OVERDUE' as const,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
}

assert(
  emiLockerEligibilityService.deriveSoftStatus(overduePastGrace, 3) === 'OVERDUE',
  'overdue past grace → OVERDUE',
)

const inGrace = {
  ...baseAgreement,
  gracePeriodDays: 14,
  installments: [
    {
      ...overduePastGrace.installments[0],
      dueDate: daysAgo(2),
      status: 'PENDING' as const,
    },
  ],
}
assert(
  emiLockerEligibilityService.deriveSoftStatus(inGrace, 3) === 'GRACE_PERIOD',
  'within grace → GRACE_PERIOD',
)

const warningSoon = {
  ...baseAgreement,
  installments: [
    {
      ...overduePastGrace.installments[0],
      dueDate: daysFromNow(2),
      status: 'PENDING' as const,
    },
  ],
}
assert(
  emiLockerEligibilityService.deriveSoftStatus(warningSoon, 3) === 'WARNING',
  'within warningDays → WARNING',
)

console.log('emi-locker-eligibility.test.ts: OK')
