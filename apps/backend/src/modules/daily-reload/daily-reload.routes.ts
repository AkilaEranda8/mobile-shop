import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'

const router = Router()
router.use(authenticate)

function buildDateFilter(date?: string) {
  if (!date) return {}
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end   = new Date(date); end.setHours(23, 59, 59, 999)
  return { reloadDate: { gte: start, lte: end } }
}

// ── List reloads ──────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { date, page = '1', limit = '200' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where = { tenantId, ...buildDateFilter(date) }

    const [reloads, total, agg] = await Promise.all([
      prisma.dailyReload.findMany({ where, orderBy: { reloadDate: 'desc' }, skip, take: parseInt(limit) }),
      prisma.dailyReload.count({ where }),
      prisma.dailyReload.aggregate({ where, _sum: { amount: true }, _count: true }),
    ])

    const totalAmount = agg._sum.amount ?? 0
    sendSuccess(res, {
      data: reloads, total,
      totalAmount,
      commission: Math.round(totalAmount * 0.03 * 100) / 100,
      page: parseInt(page), limit: parseInt(limit),
    })
  } catch (e) { next(e) }
})

// ── Manual single add ─────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { connectionNo, transactionId, executedBy, reloadDate, status, amount } = req.body
    if (!connectionNo || amount === undefined) throw new AppError('connectionNo and amount are required', 400)

    const reload = await prisma.dailyReload.create({
      data: {
        tenantId,
        connectionNo: String(connectionNo),
        transactionId: transactionId ? String(transactionId) : undefined,
        executedBy:    executedBy    ? String(executedBy)    : undefined,
        reloadDate:    reloadDate    ? new Date(reloadDate)  : new Date(),
        status:        status        ? String(status)        : 'Success',
        amount:        parseFloat(String(amount)),
      },
    })
    sendSuccess(res, reload, 'Reload added', 201)
  } catch (e) { next(e) }
})

// ── Bulk import (frontend sends parsed rows) ──────────────────────────────────
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) throw new AppError('rows array is required', 400)

    const data = rows
      .map((r: any) => ({
        tenantId,
        connectionNo:  String(r.connectionNo  || '').trim(),
        transactionId: r.transactionId ? String(r.transactionId).trim() : undefined,
        executedBy:    r.executedBy    ? String(r.executedBy).trim()    : undefined,
        reloadDate:    r.date          ? new Date(r.date)               : new Date(),
        status:        r.status        ? String(r.status)               : 'Success',
        amount:        parseFloat(String(r.amount || '0').replace(/[^0-9.]/g, '')),
      }))
      .filter(r => r.connectionNo && !isNaN(r.amount) && r.amount > 0)

    if (data.length === 0) throw new AppError('No valid rows found in the file', 400)

    await prisma.dailyReload.createMany({ data })
    sendSuccess(res, { imported: data.length }, `${data.length} reloads imported`, 201)
  } catch (e) { next(e) }
})

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const existing = await prisma.dailyReload.findFirst({ where: { id: req.params.id, tenantId } })
    if (!existing) throw new AppError('Record not found', 404)
    await prisma.dailyReload.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Deleted')
  } catch (e) { next(e) }
})

export default router
