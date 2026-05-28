import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'

const router = Router()
router.use(authenticate)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function parseAmt(raw: unknown): number {
  return parseFloat(String(raw ?? '0').replace(/[^0-9.]/g, '')) || 0
}

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

    res.setHeader('Cache-Control', 'no-store')
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
        reloadDate:    new Date(),
        status:        r.status        ? String(r.status)               : 'Success',
        amount:        parseFloat(String(r.amount || '0').replace(/[^0-9.]/g, '')),
      }))
      .filter(r => r.connectionNo && !isNaN(r.amount) && r.amount > 0)

    if (data.length === 0) throw new AppError('No valid rows found in the file', 400)

    await prisma.dailyReload.createMany({ data })
    sendSuccess(res, { imported: data.length }, `${data.length} reloads imported`, 201)
  } catch (e) { next(e) }
})

// ── Server-side Excel upload & parse ─────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    if (!req.file) throw new AppError('No file uploaded', 400)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx')
    const wb     = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (!matrix || matrix.length < 2) throw new AppError('File is empty or has no data rows', 400)

    // Skip row 0 (header). Columns: A=connNo B=txId C=agent D=date E=time F=status G=amount
    const data = matrix.slice(1)
      .map((r: any[]) => ({
        tenantId,
        connectionNo:  String(r[0] ?? '').trim(),
        transactionId: r[1] != null && r[1] !== '' ? String(r[1]).trim() : undefined,
        executedBy:    r[2] != null && r[2] !== '' ? String(r[2]).trim() : undefined,
        reloadDate:    new Date(),
        status:        r[5] != null && r[5] !== '' ? String(r[5]).trim() : 'Success',
        amount:        parseAmt(r[6]),
      }))
      .filter(r => r.connectionNo && r.amount > 0)

    if (data.length === 0) throw new AppError('No valid rows found. Ensure Connection No (col A) and Amount (col G) are filled.', 400)

    await prisma.dailyReload.createMany({ data })
    sendSuccess(res, { imported: data.length }, `${data.length} reloads imported`, 201)
  } catch (e) { next(e) }
})

// ── Report (date range) ───────────────────────────────────────────────────────
router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { from, to } = req.query as Record<string, string>
    const where: any = { tenantId }
    if (from) where.reloadDate = { ...(where.reloadDate ?? {}), gte: new Date(from + 'T00:00:00.000Z') }
    if (to)   where.reloadDate = { ...(where.reloadDate ?? {}), lte: new Date(to   + 'T23:59:59.999Z') }

    res.setHeader('Cache-Control', 'no-store')
    const reloads = await prisma.dailyReload.findMany({ where, orderBy: { reloadDate: 'asc' } })

    const totalAmount  = reloads.reduce((s: number, r: any) => s + Number(r.amount), 0)
    const successCount = reloads.filter((r: any) => r.status === 'Success').length

    const byDate: Record<string, { date: string; count: number; totalAmount: number; commission: number; successCount: number }> = {}
    for (const r of reloads) {
      const d = r.reloadDate.toISOString().split('T')[0]
      if (!byDate[d]) byDate[d] = { date: d, count: 0, totalAmount: 0, commission: 0, successCount: 0 }
      byDate[d].count++
      byDate[d].totalAmount += Number(r.amount)
      if (r.status === 'Success') byDate[d].successCount++
    }
    for (const d of Object.values(byDate)) d.commission = Math.round(d.totalAmount * 0.03 * 100) / 100

    sendSuccess(res, {
      totalCount:     reloads.length,
      totalAmount:    Math.round(totalAmount * 100) / 100,
      commission:     Math.round(totalAmount * 0.03 * 100) / 100,
      successCount,
      failCount:      reloads.length - successCount,
      dailyBreakdown: Object.values(byDate),
    })
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
