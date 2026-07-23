import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess } from '../../middleware/module-access.middleware'
import { AppError } from '../../middleware/error.middleware'
import { validate } from '../../middleware/validate.middleware'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { businessDayRange } from '../../utils/date-range'
import { getPeriodFinancials, toFinanceSummaryResponse } from './business-financials.service'
import { effectiveBranchId, resolveMutationBranchId } from '../../utils/active-branch'
import { createTransactionSchema } from './finance.schema'
import { buildPlStatement } from './pl-statement.service'
import { buildPaymentMethodCashflow } from './payment-method-cashflow.service'
import { emitExpenseAccounting } from '../accounting/integration/accounting-events.service'
import {
  buildReportFilterContext,
  resolveBusinessReportRange,
} from '../report-engine/report-engine.service'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('FINANCE'))

router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page, branchId, search } = buildReportFilterContext(req)
    const type     = req.query.type     as string | undefined
    const category = req.query.category as string | undefined
    const from     = req.query.from     as string | undefined
    const to       = req.query.to       as string | undefined
    const where: any = {
      tenantId: req.tenantId!,
      ...(type     && { type }),
      ...(branchId && { branchId }),
      ...(category && { category }),
      ...(search   && { description: { contains: search, mode: 'insensitive' } }),
    }
    if (from || to) {
      const start = from ? businessDayRange(from).start : undefined
      const end = to ? businessDayRange(to).end : undefined
      where.OR = [
        {
          occurredAt: {
            ...(start && { gte: start }),
            ...(end && { lte: end }),
          },
        },
        {
          AND: [
            { occurredAt: null },
            {
              createdAt: {
                ...(start && { gte: start }),
                ...(end && { lte: end }),
              },
            },
          ],
        },
      ]
    }
    const [data, total] = await Promise.all([prisma.transaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.transaction.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/transactions', authorize('OWNER', 'MANAGER', 'CASHIER'), validate(createTransactionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as ReturnType<typeof createTransactionSchema.parse>
    const branchId = await resolveMutationBranchId(req, { preferred: body.branchId })

    await assertBusinessDayOpenIfEnabled(req.tenantId!, branchId)
    if (body.type === 'EXPENSE' && body.category === 'Supplier Payment') {
      throw new AppError(
        'Record supplier payments under Purchases → Supplier Payments (not Finance → Expenses)',
        400,
      )
    }
    const tx = await prisma.transaction.create({
      data: {
        tenantId: req.tenantId!,
        branchId,
        type: body.type,
        category: body.category,
        amount: body.amount,
        description: body.description,
        paymentMethod: body.paymentMethod,
        reference: body.reference,
        performedBy: req.user!.email,
      },
    })
    if (body.type === 'EXPENSE') {
      void emitExpenseAccounting(req.tenantId!, tx.id, branchId, req.user!.email)
    }
    sendSuccess(res, tx, 'Transaction recorded', 201)
  } catch (e) { next(e) }
})

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromKey, toKey, branchId, tenantId } = resolveBusinessReportRange(req, {
      defaultFrom: 'month_start',
    })

    const fin = await getPeriodFinancials(tenantId, fromKey, toKey, branchId)
    sendSuccess(res, toFinanceSummaryResponse(fin, { from: fromKey, to: toKey }))
  } catch (e) { next(e) }
})

router.get('/pl-statement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromKey, toKey, branchId, tenantId } = resolveBusinessReportRange(req, {
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await buildPlStatement(tenantId, fromKey, toKey, branchId))
  } catch (e) { next(e) }
})

router.get('/payment-method-cashflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromKey, toKey, branchId, tenantId } = resolveBusinessReportRange(req, {
      defaultFrom: 'month_start',
    })
    sendSuccess(res, await buildPaymentMethodCashflow(tenantId, fromKey, toKey, branchId))
  } catch (e) { next(e) }
})

router.get('/daily-summaries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page, branchId } = buildReportFilterContext(req)
    const where: any = { tenantId: req.tenantId!, ...(branchId && { branchId }) }
    const [data, total] = await Promise.all([prisma.dailySummary.findMany({ where, skip, take: limit, orderBy: { date: 'desc' } }), prisma.dailySummary.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

export default router
