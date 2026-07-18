import { Router, Request, Response, NextFunction } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { sendSuccess } from '../../utils/response'
import { requireAccountingFeature } from './accounting.middleware'
import { getAccountingStatus, listGlAccounts } from './accounting.service'
import { initializeAccounting } from './accounting-init.service'
import { effectiveBranchId } from '../../utils/active-branch'
import { resolveQueryDateRange } from '../../utils/date-range'
import { getPagination } from '../../utils/pagination'
import { syncOutboxForTenant } from './integration/accounting-outbox.service'
import { processAccountingOutbox } from './integration/accounting-processor.service'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import {
  getBalanceSheet,
  getCashFlow,
  getProfitAndLoss,
  getTrialBalance,
} from './reports/gl-reports.service'
import {
  getPeriodClosePreview,
  hardClosePeriod,
  listAccountingPeriods,
  reopenPeriod,
  softClosePeriod,
} from './periods/period-close.service'
import {
  getApSubledgerSummary,
  getApSupplierDetail,
  getArCustomerDetail,
  getArSubledgerSummary,
} from './subledgers/ar-ap-subledger.service'
import { recordApPayment, recordArPayment } from './subledgers/ar-ap-payment.service'
import {
  createManualJournalEntry,
  getJournalEntry,
  listJournalEntries,
  listPendingApprovals,
  approvePendingJournal,
  rejectPendingJournal,
  reverseManualJournalEntry,
} from './journals/manual-journal.service'
import {
  getAccountLedger,
  getAccountingSettingsDetail,
  updateAccountingSettings,
  updateGlAccount,
  createGlAccount,
} from './coa/coa.service'
import {
  createBankAccount,
  listCashBankRegisters,
  postCashBankTransfer,
  reconcileBankAccount,
  settleClearingAccount,
} from './cash-bank/cash-bank.service'
import { getVatSummary, listTaxCodes, postVatPayment } from './tax/tax.service'
import {
  getPettyCashStatus,
  recordPettyCashExpense,
  replenishPettyCash,
} from './petty-cash/petty-cash.service'
import {
  createPayrollAccrual,
  listPayrollEmployees,
  listPayrollRuns,
  payPayrollRun,
  postStatutoryRemittance,
} from './payroll/payroll.service'
import { listAuditEvents } from './audit/audit.service'

const router = Router()
router.use(authenticate)

/** Public to tenant users — shows whether module is enabled (no 403 if disabled) */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getAccountingStatus(req.tenantId!))
  } catch (e) { next(e) }
})

router.use(requireAccountingFeature)

router.post('/initialize', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await initializeAccounting(req.tenantId!, req.user!.email)
    sendSuccess(res, result, result.alreadyInitialized ? 'Already initialized' : 'Accounting initialized', result.alreadyInitialized ? 200 : 201)
  } catch (e) { next(e) }
})

router.get('/coa/accounts', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    sendSuccess(res, await listGlAccounts(req.tenantId!, branchId))
  } catch (e) { next(e) }
})

router.get('/coa/accounts/:id/ledger', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await getAccountLedger(req.tenantId!, req.params.id, {
      from: fromKey,
      to: toKey,
      branchId,
      skip,
      limit,
    }))
  } catch (e) { next(e) }
})

router.patch('/coa/accounts/:id', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await updateGlAccount(req.tenantId!, req.params.id, req.body))
  } catch (e) { next(e) }
})

router.post('/coa/accounts', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    sendSuccess(
      res,
      await createGlAccount(req.tenantId!, { ...req.body, branchId: branchId ?? undefined }),
      'GL account created',
      201,
    )
  } catch (e) { next(e) }
})

router.get('/audit', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const result = await listAuditEvents(req.tenantId!, {
      skip,
      limit,
      entityType: req.query.entityType as string | undefined,
      eventType: req.query.eventType as string | undefined,
    })
    res.status(200).json({
      success: true,
      data: result.rows,
      meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
    })
  } catch (e) { next(e) }
})

router.get('/settings', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getAccountingSettingsDetail(req.tenantId!))
  } catch (e) { next(e) }
})

router.patch('/settings', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await updateAccountingSettings(req.tenantId!, req.body))
  } catch (e) { next(e) }
})

router.get('/cash-bank/registers', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listCashBankRegisters(req.tenantId!, effectiveBranchId(req)))
  } catch (e) { next(e) }
})

router.post('/cash-bank/accounts', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await createBankAccount(req.tenantId!, req.body), 'Bank account created', 201)
  } catch (e) { next(e) }
})

router.post('/cash-bank/transfers', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await postCashBankTransfer(req.tenantId!, { ...req.body, branchId }, req.user?.email),
      'Transfer posted',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/cash-bank/settle-clearing', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await settleClearingAccount(req.tenantId!, { ...req.body, branchId }, req.user?.email),
      'Clearing settled',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/cash-bank/reconcile', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await reconcileBankAccount(req.tenantId!, { ...req.body, branchId }, req.user?.email))
  } catch (e) { next(e) }
})

router.get('/tax/codes', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listTaxCodes(req.tenantId!))
  } catch (e) { next(e) }
})

router.get('/tax/vat-summary', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await getVatSummary(req.tenantId!, {
      fromKey,
      toKey,
      branchId: effectiveBranchId(req),
    }))
  } catch (e) { next(e) }
})

router.post('/tax/vat-payment', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await postVatPayment(req.tenantId!, { ...req.body, branchId }, req.user?.email),
      'VAT payment posted',
      201,
    )
  } catch (e) { next(e) }
})

router.get('/petty-cash', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(res, await getPettyCashStatus(req.tenantId!, branchId))
  } catch (e) { next(e) }
})

router.post('/petty-cash/expenses', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await recordPettyCashExpense(req.tenantId!, { ...req.body, branchId }, req.user?.email),
      'Petty cash expense posted',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/petty-cash/replenish', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await replenishPettyCash(req.tenantId!, { ...req.body, branchId }, req.user?.email),
      'Petty cash replenished',
      201,
    )
  } catch (e) { next(e) }
})

router.get('/payroll/runs', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listPayrollRuns(req.tenantId!))
  } catch (e) { next(e) }
})

router.get('/payroll/employees', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listPayrollEmployees(req.tenantId!))
  } catch (e) { next(e) }
})

router.post('/payroll/runs', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    sendSuccess(
      res,
      await createPayrollAccrual(req.tenantId!, { ...req.body, branchId: branchId ?? undefined }, req.user?.email),
      'Payroll accrued',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/payroll/runs/:runId/pay', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await payPayrollRun(req.tenantId!, req.params.runId, { ...req.body, branchId }, req.user?.email),
      'Payroll paid',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/payroll/statutory-remittance', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await postStatutoryRemittance(req.tenantId!, { ...req.body, branchId }, req.user?.email),
      'Statutory remittance posted',
      201,
    )
  } catch (e) { next(e) }
})

router.get('/journals', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })
    const result = await listJournalEntries(req.tenantId!, {
      skip,
      limit,
      branchId,
      sourceModule: req.query.sourceModule as string | undefined,
      status: (req.query.status as string | undefined) ?? 'POSTED',
      from: fromKey,
      to: toKey,
      search,
    })
    res.status(200).json({
      success: true,
      data: result.rows,
      meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
    })
  } catch (e) { next(e) }
})

router.get('/journals/pending-approval', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listPendingApprovals(req.tenantId!))
  } catch (e) { next(e) }
})

router.get('/journals/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getJournalEntry(req.tenantId!, req.params.id))
  } catch (e) { next(e) }
})

router.post('/journals/manual', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    sendSuccess(
      res,
      await createManualJournalEntry(
        req.tenantId!,
        {
          branchId: branchId ?? undefined,
          entryDate: req.body.entryDate,
          memo: req.body.memo,
          lines: req.body.lines ?? [],
        },
        req.user?.email,
      ),
      'Manual journal posted',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/journals/:id/reverse', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(
      res,
      await reverseManualJournalEntry(req.tenantId!, req.params.id, req.user?.email, req.body?.memo),
      'Journal reversed',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/journals/:id/approve', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await approvePendingJournal(req.tenantId!, req.params.id, req.user?.email), 'Journal approved')
  } catch (e) { next(e) }
})

router.post('/journals/:id/reject', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await rejectPendingJournal(req.tenantId!, req.params.id, req.user?.email, req.body?.reason), 'Journal rejected')
  } catch (e) { next(e) }
})

router.post('/integration/sync', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const { fromKey, toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await syncOutboxForTenant(tenantId, branchId, { from: fromKey, to: toKey }), 'Outbox synced')
  } catch (e) { next(e) }
})

router.post('/integration/process', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const limit = Math.min(500, Math.max(1, Number(req.body?.limit ?? 50)))
    sendSuccess(res, await processAccountingOutbox(tenantId, limit, req.user?.email), 'Outbox processed')
  } catch (e) { next(e) }
})

router.get('/integration/outbox', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const status = (req.query.status as string | undefined) ?? 'PENDING'
    const where: any = { tenantId: req.tenantId!, status }
    const [data, total] = await Promise.all([
      prisma.accountingOutbox.findMany({ where, skip, take: limit, orderBy: { createdAt: 'asc' } }),
      prisma.accountingOutbox.count({ where }),
    ])
    res.status(200).json({ success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  } catch (e) { next(e) }
})

function reportRange(req: Request) {
  const branchId = effectiveBranchId(req)
  const { fromKey, toKey } = resolveQueryDateRange({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    defaultFrom: 'month_start',
  })
  return { tenantId: req.tenantId!, branchId, fromKey, toKey }
}

router.get('/reports/trial-balance', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId, fromKey, toKey } = reportRange(req)
    sendSuccess(res, await getTrialBalance({ tenantId, branchId, fromKey, toKey }))
  } catch (e) { next(e) }
})

router.get('/reports/profit-loss', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId, fromKey, toKey } = reportRange(req)
    sendSuccess(res, await getProfitAndLoss({ tenantId, branchId, fromKey, toKey }))
  } catch (e) { next(e) }
})

router.get('/reports/balance-sheet', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const { toKey } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: (req.query.asOf as string | undefined) ?? (req.query.to as string | undefined),
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await getBalanceSheet({ tenantId: req.tenantId!, branchId, asOfKey: toKey }))
  } catch (e) { next(e) }
})

router.get('/reports/cash-flow', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId, fromKey, toKey } = reportRange(req)
    sendSuccess(res, await getCashFlow({ tenantId, branchId, fromKey, toKey }))
  } catch (e) { next(e) }
})

router.get('/periods', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listAccountingPeriods(req.tenantId!))
  } catch (e) { next(e) }
})

router.get('/periods/:id/preview', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getPeriodClosePreview(req.tenantId!, req.params.id))
  } catch (e) { next(e) }
})

router.post('/periods/:id/soft-close', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await softClosePeriod(req.tenantId!, req.params.id, req.user?.email), 'Period soft-closed')
  } catch (e) { next(e) }
})

router.post('/periods/:id/hard-close', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await hardClosePeriod(req.tenantId!, req.params.id, req.user?.email), 'Period hard-closed')
  } catch (e) { next(e) }
})

router.post('/periods/:id/reopen', authorize('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await reopenPeriod(req.tenantId!, req.params.id, req.user?.email), 'Period reopened')
  } catch (e) { next(e) }
})

function subledgerOpts(req: Request) {
  const branchId = effectiveBranchId(req)
  const asOf = (req.query.asOf as string | undefined) ?? (req.query.to as string | undefined)
  return { tenantId: req.tenantId!, branchId, asOfKey: asOf }
}

router.get('/ar/summary', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getArSubledgerSummary(subledgerOpts(req)))
  } catch (e) { next(e) }
})

router.get('/ar/customers/:customerId', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const opts = subledgerOpts(req)
    sendSuccess(res, await getArCustomerDetail({ ...opts, customerId: req.params.customerId }))
  } catch (e) { next(e) }
})

router.get('/ap/summary', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getApSubledgerSummary(subledgerOpts(req)))
  } catch (e) { next(e) }
})

router.get('/ap/suppliers/:supplierId', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const opts = subledgerOpts(req)
    sendSuccess(res, await getApSupplierDetail({ ...opts, supplierId: req.params.supplierId }))
  } catch (e) { next(e) }
})

router.post('/ar/payments', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await recordArPayment(req.tenantId!, {
        customerId: req.body.customerId,
        branchId,
        amount: Number(req.body.amount),
        paymentMethod: req.body.paymentMethod ?? 'CASH',
        reference: req.body.reference,
        notes: req.body.notes,
        allocations: req.body.allocations,
      }, req.user?.email),
      'AR payment recorded',
      201,
    )
  } catch (e) { next(e) }
})

router.post('/ap/payments', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req.body.branchId as string) || effectiveBranchId(req)
    if (!branchId) throw new AppError('branchId is required', 400)
    sendSuccess(
      res,
      await recordApPayment(req.tenantId!, {
        supplierId: req.body.supplierId,
        branchId,
        amount: Number(req.body.amount),
        paymentMethod: req.body.paymentMethod ?? 'CASH',
        reference: req.body.reference,
        notes: req.body.notes,
        bankAccountId: req.body.bankAccountId,
        allocations: req.body.allocations,
      }, req.user?.email),
      'AP payment recorded',
      201,
    )
  } catch (e) { next(e) }
})

export default router
