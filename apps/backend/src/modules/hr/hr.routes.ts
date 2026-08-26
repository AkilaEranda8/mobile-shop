import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { hrController } from './hr.controller'
import { requireHrFeature } from './hr.middleware'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createDesignationSchema,
  updateDesignationSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  linkUserSchema,
  createShiftSchema,
  updateShiftSchema,
  assignShiftSchema,
  attendancePunchSchema,
  attendanceCorrectSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  submitLeaveSchema,
  reviewLeaveSchema,
  createSalaryComponentSchema,
  updateSalaryComponentSchema,
  upsertSalaryPackageSchema,
  createCommissionRuleSchema,
  updateCommissionRuleSchema,
  createPayrollPeriodSchema,
  createPayrollRunSchema,
  approvePayrollSchema,
  payPayrollSchema,
  requestAdvanceSchema,
  reviewAdvanceSchema,
  requestLoanSchema,
  activateLoanSchema,
} from './hr.schema'

const router = Router()

router.use(authenticate)
router.use(requireHrFeature)
router.use(enforceModuleAccess('HR'))

const staffRoles = ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'] as const
const managerRoles = ['OWNER', 'MANAGER', 'PLATFORM_ADMIN'] as const

router.get('/overview', authorize(...staffRoles), hrController.overview)

router.get('/departments', authorize(...staffRoles), hrController.listDepartments)
router.post('/departments', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(createDepartmentSchema), hrController.createDepartment)
router.patch('/departments/:id', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(updateDepartmentSchema), hrController.updateDepartment)

router.get('/designations', authorize(...staffRoles), hrController.listDesignations)
router.post('/designations', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(createDesignationSchema), hrController.createDesignation)
router.patch('/designations/:id', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(updateDesignationSchema), hrController.updateDesignation)

router.get('/employees', authorize(...staffRoles), hrController.listEmployees)
router.post('/employees', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(createEmployeeSchema), hrController.createEmployee)
router.get('/employees/:id', authorize(...staffRoles), hrController.getEmployee)
router.patch('/employees/:id', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(updateEmployeeSchema), hrController.updateEmployee)
router.post('/employees/:id/link-user', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(linkUserSchema), hrController.linkUser)

// Phase 2 — Shifts
router.get('/shifts', authorize(...staffRoles), hrController.listShifts)
router.post('/shifts', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(createShiftSchema), hrController.createShift)
router.patch('/shifts/:id', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(updateShiftSchema), hrController.updateShift)
router.get('/shift-assignments', authorize(...staffRoles), hrController.listShiftAssignments)
router.post('/shift-assignments', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(assignShiftSchema), hrController.assignShift)

// Phase 2 — Attendance
router.get('/attendance/board', authorize(...staffRoles), hrController.attendanceBoard)
router.get('/attendance/my-today', authorize(...staffRoles), hrController.attendanceMyToday)
router.post('/attendance/check-in', authorize(...staffRoles), validate(attendancePunchSchema), hrController.attendanceCheckIn)
router.post('/attendance/check-out', authorize(...staffRoles), validate(attendancePunchSchema), hrController.attendanceCheckOut)
router.post('/attendance/correct', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(attendanceCorrectSchema), hrController.attendanceCorrect)

// Phase 3 — Leave
router.get('/leave/types', authorize(...staffRoles), hrController.listLeaveTypes)
router.post('/leave/types', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(createLeaveTypeSchema), hrController.createLeaveType)
router.patch('/leave/types/:id', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(updateLeaveTypeSchema), hrController.updateLeaveType)
router.get('/leave/balances', authorize(...staffRoles), hrController.listLeaveBalances)
router.get('/leave/requests', authorize(...staffRoles), hrController.listLeaveRequests)
router.post('/leave/requests', authorize(...staffRoles), validate(submitLeaveSchema), hrController.submitLeave)
router.post('/leave/requests/:id/approve', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewLeaveSchema), hrController.approveLeave)
router.post('/leave/requests/:id/reject', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewLeaveSchema), hrController.rejectLeave)
router.post('/leave/requests/:id/cancel', authorize(...staffRoles), hrController.cancelLeave)

// Phase 4 — Salary (HR_SALARY)
router.get('/salary/components', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'view'), hrController.listSalaryComponents)
router.post('/salary/components', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'edit'), validate(createSalaryComponentSchema), hrController.createSalaryComponent)
router.patch('/salary/components/:id', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'edit'), validate(updateSalaryComponentSchema), hrController.updateSalaryComponent)
router.get('/salary/packages', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'view'), hrController.listSalaryPackages)
router.post('/salary/packages', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'edit'), validate(upsertSalaryPackageSchema), hrController.upsertSalaryPackage)
router.get('/salary/packages/:employeeId/preview', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'view'), hrController.previewSalaryPackage)

// Phase 4 — Commission (HR_SALARY)
router.get('/commission/rules', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'view'), hrController.listCommissionRules)
router.post('/commission/rules', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'edit'), validate(createCommissionRuleSchema), hrController.createCommissionRule)
router.patch('/commission/rules/:id', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'edit'), validate(updateCommissionRuleSchema), hrController.updateCommissionRule)
router.get('/commission/preview', authorize(...managerRoles), requireModuleAccess('HR_SALARY', 'view'), hrController.commissionPreview)

// Phase 5–6 — Payroll (HR_PAYROLL)
router.get('/payroll/periods', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'view'), hrController.listPayrollPeriods)
router.post('/payroll/periods', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'edit'), validate(createPayrollPeriodSchema), hrController.createPayrollPeriod)
router.get('/payroll/runs', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'view'), hrController.listPayrollRuns)
router.post('/payroll/runs', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'edit'), validate(createPayrollRunSchema), hrController.createPayrollRun)
router.get('/payroll/runs/:id', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'view'), hrController.getPayrollRun)
router.post('/payroll/runs/:id/process', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'edit'), hrController.processPayrollRun)
router.post('/payroll/runs/:id/approve', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'edit'), validate(approvePayrollSchema), hrController.approvePayrollRun)
router.post('/payroll/runs/:id/pay', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'edit'), validate(payPayrollSchema), hrController.payPayrollRun)
router.post('/payroll/runs/:id/cancel', authorize(...managerRoles), requireModuleAccess('HR_PAYROLL', 'edit'), hrController.cancelPayrollRun)
router.get('/payslips', authorize(...staffRoles), hrController.listPayslips)

// Phase 7 — Advances / loans
router.get('/advances', authorize(...staffRoles), hrController.listAdvances)
router.post('/advances', authorize(...staffRoles), validate(requestAdvanceSchema), hrController.requestAdvance)
router.post('/advances/:id/approve', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewAdvanceSchema), hrController.approveAdvance)
router.post('/advances/:id/reject', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewAdvanceSchema), hrController.rejectAdvance)
router.post('/advances/:id/disburse', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewAdvanceSchema), hrController.disburseAdvance)
router.get('/loans', authorize(...staffRoles), hrController.listLoans)
router.post('/loans', authorize(...staffRoles), validate(requestLoanSchema), hrController.requestLoan)
router.post('/loans/:id/approve', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewAdvanceSchema), hrController.approveLoan)
router.post('/loans/:id/reject', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(reviewAdvanceSchema), hrController.rejectLoan)
router.post('/loans/:id/activate', authorize(...managerRoles), requireModuleAccess('HR', 'edit'), validate(activateLoanSchema), hrController.activateLoan)

export default router
