import { z } from 'zod'

const masterBody = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const createDepartmentSchema = masterBody
export const updateDepartmentSchema = masterBody.partial()
export const createDesignationSchema = masterBody
export const updateDesignationSchema = masterBody.partial()

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  employeeCode: z.string().trim().max(32).optional(),
  userId: z.string().cuid().optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  designationId: z.string().cuid().optional().nullable(),
  primaryBranchId: z.string().cuid(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  emergencyName: z.string().trim().max(120).optional().nullable(),
  emergencyPhone: z.string().trim().max(40).optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL']).optional(),
  status: z.enum(['CANDIDATE', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED']).optional(),
  joinedAt: z.string().optional().nullable(),
  confirmedAt: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ employeeCode: true })

export const linkUserSchema = z.object({
  userId: z.string().cuid().nullable(),
})

const minutes = z.number().int().min(0).max(1439)

export const createShiftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).optional().nullable(),
  branchId: z.string().cuid().optional().nullable(),
  startMinutes: minutes,
  endMinutes: minutes,
  graceMinutes: z.number().int().min(0).max(180).optional(),
  halfDayMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  isOvernight: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const updateShiftSchema = createShiftSchema.partial()

export const assignShiftSchema = z.object({
  employeeId: z.string().cuid(),
  shiftId: z.string().cuid(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
})

export const attendancePunchSchema = z.object({
  employeeId: z.string().cuid().optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const attendanceCorrectSchema = z.object({
  employeeId: z.string().cuid(),
  date: z.string().optional(),
  checkInAt: z.string().optional().nullable(),
  checkOutAt: z.string().optional().nullable(),
  status: z.enum(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY']).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  shiftId: z.string().cuid().optional().nullable(),
})

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isPaid: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  annualAllowance: z.number().min(0).max(366).optional(),
  maxDaysPerRequest: z.number().min(0).max(366).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial()

export const submitLeaveSchema = z.object({
  employeeId: z.string().cuid().optional(),
  leaveTypeId: z.string().cuid(),
  startDate: z.string().min(8),
  endDate: z.string().min(8).optional(),
  startPart: z.enum(['FULL', 'AM', 'PM']).optional(),
  endPart: z.enum(['FULL', 'AM', 'PM']).optional(),
  reason: z.string().trim().max(1000).optional().nullable(),
})

export const reviewLeaveSchema = z.object({
  reviewerNote: z.string().trim().max(1000).optional().nullable(),
})

export const createSalaryComponentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32),
  kind: z.enum(['EARNING', 'DEDUCTION', 'EMPLOYER']).optional(),
  calcType: z.enum(['FIXED', 'PERCENT_OF_BASIC']).optional(),
  defaultAmount: z.number().min(0).optional(),
  isTaxable: z.boolean().optional(),
  isStatutory: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const updateSalaryComponentSchema = createSalaryComponentSchema.partial()

export const upsertSalaryPackageSchema = z.object({
  employeeId: z.string().cuid(),
  effectiveFrom: z.string().min(8),
  basicSalary: z.number().min(0),
  currency: z.string().trim().max(8).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  lines: z.array(z.object({
    componentId: z.string().cuid(),
    amount: z.number(),
  })).optional(),
})

export const createCommissionRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).optional().nullable(),
  source: z.enum(['SALES', 'REPAIRS', 'HIRE_PURCHASE']),
  ratePercent: z.number().min(0).max(100).optional(),
  flatPerUnit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const updateCommissionRuleSchema = createCommissionRuleSchema.partial()

export const createPayrollPeriodSchema = z.object({
  label: z.string().trim().max(64).optional(),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional().nullable(),
})

export const createPayrollRunSchema = z.object({
  periodId: z.string().cuid(),
  branchId: z.string().cuid().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const approvePayrollSchema = z.object({
  applyStatutory: z.boolean().optional(),
})

export const payPayrollSchema = z.object({
  branchId: z.string().cuid().optional(),
  entryDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'WALLET']).optional(),
  memo: z.string().trim().max(500).optional().nullable(),
})

export const requestAdvanceSchema = z.object({
  employeeId: z.string().cuid().optional(),
  amount: z.number().positive(),
  reason: z.string().trim().max(500).optional().nullable(),
})

export const reviewAdvanceSchema = z.object({
  reviewerNote: z.string().trim().max(1000).optional().nullable(),
})

export const requestLoanSchema = z.object({
  employeeId: z.string().cuid().optional(),
  principal: z.number().positive(),
  interestRate: z.number().min(0).max(100).optional(),
  installmentCount: z.number().int().min(1).max(120),
  reason: z.string().trim().max(500).optional().nullable(),
})

export const activateLoanSchema = z.object({
  firstDueDate: z.string().min(8),
  reviewerNote: z.string().trim().max(1000).optional().nullable(),
})
