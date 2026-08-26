import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../../utils/response'
import { organizationService } from './organization.service'
import { employeesService } from './employees.service'
import { shiftsService } from './shifts.service'
import { attendanceService } from './attendance.service'
import { leaveService } from './leave.service'
import { salaryService } from './salary.service'
import { commissionService } from './commission.service'
import { payrollService } from './payroll.service'
import { advancesService } from './advances.service'

function actorEmail(req: Request) {
  return req.user?.email
}

export const hrController = {
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.overview(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async listDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.listDepartments(req.tenantId!))
    } catch (e) { next(e) }
  },

  async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.createDepartment(req.tenantId!, req.body, actorEmail(req)), 'Department created', 201)
    } catch (e) { next(e) }
  },

  async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.updateDepartment(req.tenantId!, req.params.id, req.body, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async listDesignations(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.listDesignations(req.tenantId!))
    } catch (e) { next(e) }
  },

  async createDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.createDesignation(req.tenantId!, req.body, actorEmail(req)), 'Designation created', 201)
    } catch (e) { next(e) }
  },

  async updateDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.updateDesignation(req.tenantId!, req.params.id, req.body, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.list(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async getEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.getById(req.tenantId!, req.params.id, req))
    } catch (e) { next(e) }
  },

  async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.create(req.tenantId!, req.body, req, actorEmail(req)), 'Employee created', 201)
    } catch (e) { next(e) }
  },

  async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.update(req.tenantId!, req.params.id, req.body, req, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async linkUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.body.userId ?? null
      sendSuccess(res, await employeesService.linkUser(req.tenantId!, req.params.id, userId, req, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async listShifts(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await shiftsService.list(req.tenantId!, req.query.branchId as string | undefined))
    } catch (e) { next(e) }
  },

  async createShift(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await shiftsService.create(req.tenantId!, req.body, actorEmail(req)), 'Shift created', 201)
    } catch (e) { next(e) }
  },

  async updateShift(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await shiftsService.update(req.tenantId!, req.params.id, req.body, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async assignShift(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await shiftsService.assign(req.tenantId!, req.body, actorEmail(req)), 'Shift assigned', 201)
    } catch (e) { next(e) }
  },

  async listShiftAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await shiftsService.listAssignments(req.tenantId!, req.query.employeeId as string | undefined))
    } catch (e) { next(e) }
  },

  async attendanceBoard(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await attendanceService.board(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async attendanceMyToday(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await attendanceService.myToday(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async attendanceCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await attendanceService.checkIn(req.tenantId!, req, req.body, actorEmail(req)), 'Checked in')
    } catch (e) { next(e) }
  },

  async attendanceCheckOut(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await attendanceService.checkOut(req.tenantId!, req, req.body, actorEmail(req)), 'Checked out')
    } catch (e) { next(e) }
  },

  async attendanceCorrect(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await attendanceService.correct(req.tenantId!, req, req.body, actorEmail(req)), 'Attendance corrected')
    } catch (e) { next(e) }
  },

  async listLeaveTypes(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.listTypes(req.tenantId!))
    } catch (e) { next(e) }
  },

  async createLeaveType(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.createType(req.tenantId!, req.body, actorEmail(req)), 'Leave type created', 201)
    } catch (e) { next(e) }
  },

  async updateLeaveType(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.updateType(req.tenantId!, req.params.id, req.body, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async listLeaveBalances(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.listBalances(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async listLeaveRequests(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.listRequests(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async submitLeave(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.submit(req.tenantId!, req, req.body, actorEmail(req)), 'Leave submitted', 201)
    } catch (e) { next(e) }
  },

  async approveLeave(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.approve(req.tenantId!, req.params.id, req, req.body, actorEmail(req)), 'Leave approved')
    } catch (e) { next(e) }
  },

  async rejectLeave(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.reject(req.tenantId!, req.params.id, req, req.body, actorEmail(req)), 'Leave rejected')
    } catch (e) { next(e) }
  },

  async cancelLeave(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await leaveService.cancel(req.tenantId!, req.params.id, req, actorEmail(req)), 'Leave cancelled')
    } catch (e) { next(e) }
  },

  // Phase 4 — Salary
  async listSalaryComponents(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await salaryService.listComponents(req.tenantId!)) } catch (e) { next(e) }
  },
  async createSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await salaryService.createComponent(req.tenantId!, req.body, actorEmail(req)), 'Component created', 201) } catch (e) { next(e) }
  },
  async updateSalaryComponent(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await salaryService.updateComponent(req.tenantId!, req.params.id, req.body, actorEmail(req))) } catch (e) { next(e) }
  },
  async listSalaryPackages(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await salaryService.listPackages(req.tenantId!, req)) } catch (e) { next(e) }
  },
  async upsertSalaryPackage(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await salaryService.upsertPackage(req.tenantId!, req, req.body, actorEmail(req)), 'Salary package saved', 201) } catch (e) { next(e) }
  },
  async previewSalaryPackage(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await salaryService.previewPackage(req.tenantId!, req.params.employeeId, req, req.query.asOf as string | undefined)) } catch (e) { next(e) }
  },

  // Phase 4 — Commission
  async listCommissionRules(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await commissionService.listRules(req.tenantId!)) } catch (e) { next(e) }
  },
  async createCommissionRule(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await commissionService.createRule(req.tenantId!, req.body, actorEmail(req)), 'Rule created', 201) } catch (e) { next(e) }
  },
  async updateCommissionRule(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await commissionService.updateRule(req.tenantId!, req.params.id, req.body, actorEmail(req))) } catch (e) { next(e) }
  },
  async commissionPreview(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await commissionService.preview(req.tenantId!, req)) } catch (e) { next(e) }
  },

  // Phase 5–6 — Payroll
  async listPayrollPeriods(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.listPeriods(req.tenantId!)) } catch (e) { next(e) }
  },
  async createPayrollPeriod(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.createPeriod(req.tenantId!, req.body, actorEmail(req)), 'Period created', 201) } catch (e) { next(e) }
  },
  async listPayrollRuns(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.listRuns(req.tenantId!, req)) } catch (e) { next(e) }
  },
  async getPayrollRun(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.getRun(req.tenantId!, req.params.id)) } catch (e) { next(e) }
  },
  async createPayrollRun(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.createDraft(req.tenantId!, req, req.body, actorEmail(req)), 'Draft created', 201) } catch (e) { next(e) }
  },
  async processPayrollRun(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.process(req.tenantId!, req.params.id, req, actorEmail(req)), 'Payroll processed') } catch (e) { next(e) }
  },
  async approvePayrollRun(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.approve(req.tenantId!, req.params.id, req, req.body, actorEmail(req)), 'Payroll approved') } catch (e) { next(e) }
  },
  async payPayrollRun(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.pay(req.tenantId!, req.params.id, req, req.body, actorEmail(req)), 'Payroll paid') } catch (e) { next(e) }
  },
  async cancelPayrollRun(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.cancel(req.tenantId!, req.params.id, actorEmail(req)), 'Payroll cancelled') } catch (e) { next(e) }
  },
  async listPayslips(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await payrollService.listPayslips(req.tenantId!, req)) } catch (e) { next(e) }
  },

  // Phase 7 — Advances / loans
  async listAdvances(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.listAdvances(req.tenantId!, req)) } catch (e) { next(e) }
  },
  async requestAdvance(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.requestAdvance(req.tenantId!, req, req.body, actorEmail(req)), 'Advance requested', 201) } catch (e) { next(e) }
  },
  async approveAdvance(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.reviewAdvance(req.tenantId!, req.params.id, 'approve', req.body, actorEmail(req), req), 'Advance approved') } catch (e) { next(e) }
  },
  async rejectAdvance(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.reviewAdvance(req.tenantId!, req.params.id, 'reject', req.body, actorEmail(req), req), 'Advance rejected') } catch (e) { next(e) }
  },
  async disburseAdvance(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.reviewAdvance(req.tenantId!, req.params.id, 'disburse', req.body, actorEmail(req), req), 'Advance disbursed') } catch (e) { next(e) }
  },
  async listLoans(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.listLoans(req.tenantId!, req)) } catch (e) { next(e) }
  },
  async requestLoan(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.requestLoan(req.tenantId!, req, req.body, actorEmail(req)), 'Loan requested', 201) } catch (e) { next(e) }
  },
  async approveLoan(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.reviewLoan(req.tenantId!, req.params.id, 'approve', req.body, actorEmail(req), req), 'Loan approved') } catch (e) { next(e) }
  },
  async rejectLoan(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.reviewLoan(req.tenantId!, req.params.id, 'reject', req.body, actorEmail(req), req), 'Loan rejected') } catch (e) { next(e) }
  },
  async activateLoan(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await advancesService.reviewLoan(req.tenantId!, req.params.id, 'activate', req.body, actorEmail(req), req), 'Loan activated') } catch (e) { next(e) }
  },
}
