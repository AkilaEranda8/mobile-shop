import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { businessDayRange, businessDateKeyFromInstant, businessDateFromInstant, resolveQueryDateRange, businessDateDb, normalizeBusinessDate } from '../../utils/date-range'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import {
  calcReloadCommission,
  fetchTenantReloadSettings,
  getCommissionRate,
  resolveReloadProvider,
  type ReloadServiceType,
} from './reload-settings.util'
import { buildProviderBreakdown, summarizeProviderBreakdown } from './reload-provider.util'

const router = Router()
router.use(authenticate)

async function requireDailyReloadFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    const feat = await prisma.tenantFeature.findFirst({
      where: { tenantId: req.tenantId!, feature: 'DAILY_RELOAD', enabled: true },
    })
    if (!feat) throw new AppError('Daily Reload is not enabled for this shop. Ask your admin to enable it.', 403)
    next()
  } catch (e) { next(e) }
}
router.use(requireDailyReloadFeature)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function parseAmt(raw: unknown): number {
  return parseFloat(String(raw ?? '0').replace(/[^0-9.]/g, '')) || 0
}

function buildDateFilter(date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return {}
  // Align the day window to the Sri Lanka business day (matches Daily Closing).
  const { start, end } = businessDayRange(date)
  return { reloadDate: { gte: start, lte: end } }
}

function reloadServiceType(reload: { reloadType?: string | null }): ReloadServiceType {
  return reload.reloadType === 'RECHARGE_CARD' ? 'RECHARGE_CARD' : 'RELOAD'
}

function enrichReload(reload: any, settings: Awaited<ReturnType<typeof fetchTenantReloadSettings>>) {
  const svc = reloadServiceType(reload)
  const commissionRate = getCommissionRate(settings, reload.connectionNo, reload.provider, svc)
  const commission = calcReloadCommission(reload.amount, settings, reload.connectionNo, reload.provider, svc)
  const provider = resolveReloadProvider(reload.connectionNo, reload.provider)
  return { ...reload, provider: provider ?? reload.provider ?? null, commissionRate, commission }
}

function sumCommission(reloads: any[], settings: Awaited<ReturnType<typeof fetchTenantReloadSettings>>) {
  return Math.round(
    reloads.reduce((s, r) => s + calcReloadCommission(
      r.amount, settings, r.connectionNo, r.provider, reloadServiceType(r),
    ), 0) * 100,
  ) / 100
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

async function resolveBranchId(tenantId: string, userId: string, branchId?: string) {
  if (branchId) {
    const b = await prisma.branch.findFirst({ where: { id: branchId, tenantId, isActive: true } })
    if (!b) throw new AppError('Invalid branch', 400)
    return b.id
  }
  const link = await prisma.userBranch.findFirst({
    where: { userId },
    include: { branch: true },
  })
  if (link?.branch?.isActive) return link.branchId
  const fallback = await prisma.branch.findFirst({ where: { tenantId, isActive: true }, orderBy: { isHeadquarters: 'desc' } })
  if (!fallback) throw new AppError('No active branch found', 400)
  return fallback.id
}

function isAllScope(date?: string | null) {
  return String(date ?? '').toLowerCase() === 'all'
}

async function buildProviderSettlement(
  tenantId: string,
  scope: 'day' | 'all',
  dateKey?: string,
) {
  const settings = await fetchTenantReloadSettings(tenantId)
  const reloadWhere: { tenantId: string; status: string; reloadDate?: { gte: Date; lte: Date } } = {
    tenantId,
    status: 'Success',
  }
  if (scope === 'day' && dateKey) {
    const { start, end } = businessDayRange(dateKey)
    reloadWhere.reloadDate = { gte: start, lte: end }
  }

  const paymentWhere: { tenantId: string; businessDate?: Date } = { tenantId }
  if (scope === 'day' && dateKey) {
    paymentWhere.businessDate = businessDateDb(dateKey)
  }

  const [reloads, payments] = await Promise.all([
    prisma.dailyReload.findMany({ where: reloadWhere, orderBy: { reloadDate: 'desc' } }),
    prisma.dailyReloadProviderPayment.findMany({ where: paymentWhere }),
  ])

  const paidMap: Record<string, number> = {}
  for (const p of payments) {
    paidMap[p.provider] = (paidMap[p.provider] ?? 0) + Number(p.amountPaid)
  }

  const providerBreakdown = buildProviderBreakdown(reloads, settings, paidMap)
  const settlement = summarizeProviderBreakdown(providerBreakdown)
  return { providerBreakdown, settlement, settings, reloads }
}

async function providerBalance(
  tenantId: string,
  provider: string,
  scope: 'day' | 'all',
  dateKey?: string,
) {
  const { providerBreakdown, settlement, settings, reloads } = await buildProviderSettlement(tenantId, scope, dateKey)
  const row = providerBreakdown.find(r => r.provider === provider)
  const providerReloads = reloads.filter(r => {
    const p = resolveReloadProvider(r.connectionNo, r.provider) ?? 'Other'
    return p === provider
  })
  const reloadTotal = row?.reloadTotal ?? round2(providerReloads.reduce((s, r) => s + Number(r.amount), 0))
  const commission = row?.commission ?? round2(providerReloads.reduce(
    (s, r) => s + calcReloadCommission(
      r.amount, settings, r.connectionNo, r.provider, reloadServiceType(r),
    ), 0,
  ))
  const netPayable = row?.netPayable ?? round2(reloadTotal - commission)
  const paidSoFar = row?.paid ?? 0
  const remaining = row?.remaining ?? round2(Math.max(0, netPayable - paidSoFar))
  return { reloadTotal, commission, netPayable, paidSoFar, remaining, providerReloads, settlement }
}

// ── List reloads ──────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { date, page = '1', limit = '200' } = req.query as Record<string, string>
    const pageNum  = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 200))
    const skip = (pageNum - 1) * limitNum
    const where = { tenantId, ...buildDateFilter(date) }

    res.setHeader('Cache-Control', 'no-store')
    const settings = await fetchTenantReloadSettings(tenantId)
    const [reloads, total, agg] = await Promise.all([
      prisma.dailyReload.findMany({ where, orderBy: { reloadDate: 'desc' }, skip, take: limitNum }),
      prisma.dailyReload.count({ where }),
      prisma.dailyReload.aggregate({ where, _sum: { amount: true }, _count: true }),
    ])

    const enriched = reloads.map(r => enrichReload(r, settings))
    const totalAmount = agg._sum.amount ?? 0
    const successReloads = reloads.filter(r => r.status === 'Success')
    const commission = sumCommission(successReloads, settings)

    let providerBreakdown: ReturnType<typeof buildProviderBreakdown> = []
    let settlement = { reloadTotal: 0, commission: 0, netPayable: 0, paid: 0, remaining: 0 }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const payments = await prisma.dailyReloadProviderPayment.findMany({
        where: { tenantId, businessDate: businessDateDb(date) },
      })
      const paidMap: Record<string, number> = {}
      for (const p of payments) {
        paidMap[p.provider] = (paidMap[p.provider] ?? 0) + Number(p.amountPaid)
      }
      providerBreakdown = buildProviderBreakdown(successReloads, settings, paidMap)
      settlement = summarizeProviderBreakdown(providerBreakdown)
    }

    sendSuccess(res, {
      data: enriched, total,
      totalAmount,
      commission,
      netPayable: settlement.netPayable > 0 ? settlement.netPayable : round2(
        successReloads.reduce((s, r) => s + Number(r.amount), 0) - commission,
      ),
      providerBreakdown,
      settlement,
      settings,
      page: pageNum, limit: limitNum,
    })
  } catch (e) { next(e) }
})

// ── Manual single add ─────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { connectionNo, provider, transactionId, executedBy, reloadDate, status, amount, reloadType } = req.body
    if (!connectionNo || amount === undefined) throw new AppError('connectionNo and amount are required', 400)

    const resolvedProvider = resolveReloadProvider(String(connectionNo), provider ? String(provider) : null)
    const svc: ReloadServiceType = reloadType === 'RECHARGE_CARD' ? 'RECHARGE_CARD' : 'RELOAD'
    const reload = await prisma.dailyReload.create({
      data: {
        tenantId,
        connectionNo: String(connectionNo),
        provider: resolvedProvider ?? (provider ? String(provider) : undefined),
        transactionId: transactionId ? String(transactionId) : undefined,
        executedBy:    executedBy    ? String(executedBy)    : undefined,
        reloadDate:    reloadDate    ? new Date(reloadDate)  : new Date(),
        status:        status        ? String(status)        : 'Success',
        reloadType:    svc,
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
      .map((r: any) => {
        const connectionNo = String(r.connectionNo || '').trim()
        const provider = resolveReloadProvider(connectionNo, r.provider ? String(r.provider) : null)
        return {
          tenantId,
          connectionNo,
          provider: provider ?? (r.provider ? String(r.provider).trim() : undefined),
          transactionId: r.transactionId ? String(r.transactionId).trim() : undefined,
          executedBy:    r.executedBy    ? String(r.executedBy).trim()    : undefined,
          reloadDate:    new Date(),
          status:        r.status        ? String(r.status)               : 'Success',
          amount:        parseFloat(String(r.amount || '0').replace(/[^0-9.]/g, '')),
        }
      })
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
      .map((r: any[]) => {
        const connectionNo = String(r[0] ?? '').trim()
        const provider = resolveReloadProvider(connectionNo, null)
        return {
          tenantId,
          connectionNo,
          provider: provider ?? undefined,
          transactionId: r[1] != null && r[1] !== '' ? String(r[1]).trim() : undefined,
          executedBy:    r[2] != null && r[2] !== '' ? String(r[2]).trim() : undefined,
          reloadDate:    new Date(),
          status:        r[5] != null && r[5] !== '' ? String(r[5]).trim() : 'Success',
          amount:        parseAmt(r[6]),
        }
      })
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
    const { start, end } = resolveQueryDateRange({ from, to, days: 30 })
    where.reloadDate = { gte: start, lte: end }

    res.setHeader('Cache-Control', 'no-store')
    const settings = await fetchTenantReloadSettings(tenantId)
    const reloads = await prisma.dailyReload.findMany({ where, orderBy: { reloadDate: 'asc' } })

    const totalAmount  = reloads.reduce((s: number, r: any) => s + Number(r.amount), 0)
    const successCount = reloads.filter((r: any) => r.status === 'Success').length
    const totalCommission = sumCommission(reloads, settings)

    const byDate: Record<string, { date: string; count: number; totalAmount: number; commission: number; successCount: number }> = {}
    for (const r of reloads) {
      const d = businessDateKeyFromInstant(r.reloadDate)
      if (!byDate[d]) byDate[d] = { date: d, count: 0, totalAmount: 0, commission: 0, successCount: 0 }
      byDate[d].count++
      byDate[d].totalAmount += Number(r.amount)
      byDate[d].commission += calcReloadCommission(
        r.amount, settings, r.connectionNo, r.provider, reloadServiceType(r),
      )
      if (r.status === 'Success') byDate[d].successCount++
    }
    for (const d of Object.values(byDate)) {
      d.totalAmount = Math.round(d.totalAmount * 100) / 100
      d.commission = Math.round(d.commission * 100) / 100
    }

    sendSuccess(res, {
      totalCount:     reloads.length,
      totalAmount:    Math.round(totalAmount * 100) / 100,
      commission:     totalCommission,
      successCount,
      failCount:      reloads.length - successCount,
      dailyBreakdown: Object.values(byDate),
      settings,
    })
  } catch (e) { next(e) }
})

// ── Provider settlement (all reloads or single day) ─────────────────────────
router.get('/provider-settlement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const { date } = req.query as { date?: string }
    const scopeAll = isAllScope(date)
    const dateKey = scopeAll ? undefined : normalizeBusinessDate(date)
    res.setHeader('Cache-Control', 'no-store')
    const { providerBreakdown, settlement } = await buildProviderSettlement(
      tenantId,
      scopeAll ? 'all' : 'day',
      dateKey,
    )
    sendSuccess(res, {
      scope: scopeAll ? 'all' : 'day',
      date: dateKey ?? null,
      providerBreakdown,
      settlement,
    })
  } catch (e) { next(e) }
})

// ── Pay provider (net reload total minus commission) ───────────────────────────
router.post('/pay-provider', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const user = req.user!
    const { date, provider, paymentMethod = 'CASH', branchId: bodyBranchId, amount: bodyAmount } = req.body as {
      date?: string
      provider?: string
      paymentMethod?: string
      branchId?: string
      amount?: number
    }
    if (!provider) throw new AppError('provider is required', 400)
    const scopeAll = isAllScope(date)
    if (!scopeAll && !date) throw new AppError('date is required (or use all)', 400)
    const paymentDateKey = businessDateFromInstant()
    const settlementDateKey = scopeAll ? undefined : normalizeBusinessDate(date)
    const branchId = await resolveBranchId(tenantId, user.userId, bodyBranchId)
    await assertBusinessDayOpenIfEnabled(tenantId, branchId)

    const {
      reloadTotal,
      commission,
      netPayable,
      paidSoFar,
      remaining,
      providerReloads,
    } = await providerBalance(tenantId, provider, scopeAll ? 'all' : 'day', settlementDateKey)

    if (providerReloads.length === 0 && paidSoFar === 0) {
      throw new AppError(
        scopeAll
          ? 'No successful reloads for this provider'
          : 'No successful reloads for this provider on selected date',
        400,
      )
    }
    if (remaining <= 0) {
      throw new AppError(
        scopeAll ? 'Provider already fully paid' : 'Provider already paid for this date',
        400,
      )
    }

    const requested = bodyAmount !== undefined && bodyAmount !== null
      ? round2(Number(bodyAmount))
      : remaining
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400)
    }
    if (requested > remaining + 0.01) {
      throw new AppError(`Payment cannot exceed remaining balance (Rs ${remaining.toFixed(2)})`, 400)
    }
    const amountPaid = round2(Math.min(requested, remaining))

    const method = ['CASH', 'CARD', 'UPI', 'WALLET', 'BANK_TRANSFER'].includes(paymentMethod)
      ? paymentMethod as 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'BANK_TRANSFER'
      : 'CASH'

    const balanceAfter = round2(remaining - amountPaid)
    const partialLabel = balanceAfter > 0.01 ? ` — partial Rs ${amountPaid.toFixed(2)} (balance Rs ${balanceAfter.toFixed(2)})` : ''

    const financeTx = await prisma.transaction.create({
      data: {
        tenantId,
        branchId,
        type: 'EXPENSE',
        category: 'Reload Provider',
        amount: amountPaid,
        description: scopeAll
          ? `${provider} reload settlement (all time)${partialLabel} — net after commission Rs ${commission.toFixed(2)}`
          : `${provider} reload settlement ${settlementDateKey}${partialLabel} (net after commission Rs ${commission.toFixed(2)})`,
        paymentMethod: method,
        performedBy: user.email,
      },
    })

    const payment = await prisma.dailyReloadProviderPayment.create({
      data: {
        tenantId,
        branchId,
        provider,
        businessDate: businessDateDb(paymentDateKey),
        reloadTotal,
        commission,
        amountPaid,
        paymentMethod: method,
        paidBy: user.email,
        financeTxId: financeTx.id,
      },
    })

    sendSuccess(res, {
      payment,
      provider,
      scope: scopeAll ? 'all' : 'day',
      date: scopeAll ? null : settlementDateKey,
      paymentDate: paymentDateKey,
      reloadTotal,
      commission,
      netPayable,
      amountPaid,
      paidSoFar: round2(paidSoFar + amountPaid),
      remaining: balanceAfter,
      financeTxId: financeTx.id,
    }, balanceAfter > 0.01 ? 'Partial provider payment recorded' : 'Provider payment recorded', 201)
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
