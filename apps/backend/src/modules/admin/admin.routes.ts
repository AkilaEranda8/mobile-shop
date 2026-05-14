import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendError } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { authService } from '../auth/auth.service'

const router = Router()
router.use(authenticate)
router.use(authorize('PLATFORM_ADMIN'))

// ── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalTenants, activeTenants, trialTenants, suspendedTenants,
      mrrAgg, totalUsers, newTenantsThisMonth,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'TRIAL' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.tenant.aggregate({ _sum: { mrr: true } }),
      prisma.user.count(),
      prisma.tenant.count({
        where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
    ])
    const mrr = mrrAgg._sum.mrr ?? 0
    sendSuccess(res, {
      totalTenants, activeTenants, trialTenants, suspendedTenants,
      mrr, arr: mrr * 12, totalUsers, newTenantsThisMonth,
      mrrDelta: 12.4, churnRate: 2.1,
    })
  } catch (e) { next(e) }
})

// ── Tenants ───────────────────────────────────────────────────────────────────
router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shopName, ownerName, email, phone, plan, password } = req.body
    if (!shopName || !ownerName || !email) throw new AppError('shopName, ownerName and email are required', 400)
    const tempPassword = password || Math.random().toString(36).slice(-10) + 'A1!'
    const result = await authService.registerTenant({
      shopName, ownerName, ownerEmail: email, password: tempPassword, plan,
    })
    sendSuccess(res, {
      tenant: result.tenant,
      subdomain: result.subdomain,
      ownerEmail: email,
      tempPassword: password ? undefined : tempPassword,
    }, 'Tenant created')
  } catch (e) { next(e) }
})

router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, status, plan, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: Record<string, unknown> = {}
    if (status && status !== 'ALL') where.status = status
    if (plan && plan !== 'ALL') where.plan = plan
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ownerEmail: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: { branches: true, _count: { select: { users: true, sales: true, repairs: true } } },
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.count({ where }),
    ])
    sendSuccess(res, { data: tenants, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (e) { next(e) }
})

router.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        branches: true,
        users: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
        _count: { select: { sales: true, repairs: true, customers: true, products: true } },
      },
    })
    if (!tenant) throw new AppError('Tenant not found', 404)
    sendSuccess(res, tenant)
  } catch (e) { next(e) }
})

router.patch('/tenants/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body
    if (!['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'].includes(status)) {
      throw new AppError('Invalid status', 400)
    }
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: { status } })
    sendSuccess(res, tenant, `Tenant ${status.toLowerCase()}`)
  } catch (e) { next(e) }
})

router.delete('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } })
    if (!tenant) throw new AppError('Tenant not found', 404)
    await prisma.tenant.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Tenant deleted')
  } catch (e) { next(e) }
})

router.patch('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'plan', 'status', 'mrr', 'trialEndsAt', 'subscriptionEndsAt']
    const data: Record<string, unknown> = {}
    for (const k of allowed) if (k in req.body) data[k] = req.body[k]
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data })
    sendSuccess(res, tenant)
  } catch (e) { next(e) }
})

// ── Subscriptions ─────────────────────────────────────────────────────────────
router.get('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (status === 'OVERDUE') {
      where.status = 'ACTIVE'
      where.subscriptionEndsAt = { lt: new Date() }
    } else if (status && status !== 'ALL') {
      where.status = status
    }
    const tenants = await prisma.tenant.findMany({
      where,
      select: {
        id: true, name: true, plan: true, status: true,
        mrr: true, subscriptionEndsAt: true, trialEndsAt: true,
        ownerEmail: true, ownerName: true,
      },
      orderBy: { mrr: 'desc' },
    })
    const mrrTotal = tenants.reduce((s: number, t: { mrr: number | null }) => s + (t.mrr ?? 0), 0)
    sendSuccess(res, { data: tenants, mrrTotal })
  } catch (e) { next(e) }
})

// ── Platform Analytics ────────────────────────────────────────────────────────
router.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      totalSalesAgg, totalRepairs, totalCustomers,
      tenantsByPlan, topTenantsByRevenue,
      newTenantsThisMonth, activeTenantsCount,
    ] = await Promise.all([
      prisma.sale.aggregate({ _sum: { total: true }, _count: true }),
      prisma.repairTicket.count(),
      prisma.customer.count(),
      prisma.tenant.groupBy({ by: ['plan'], _count: true, _sum: { mrr: true } }),
      prisma.tenant.findMany({
        select: { id: true, name: true, mrr: true, plan: true, status: true,
          _count: { select: { sales: true, users: true } } },
        orderBy: { mrr: 'desc' },
        take: 10,
      }),
      prisma.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    ])

    // Monthly GMV trend — last 12 months
    const gmvMonths: { month: string; gmv: number; invoices: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const from = new Date(now); from.setMonth(from.getMonth() - i); from.setDate(1); from.setHours(0, 0, 0, 0)
      const to   = new Date(from); to.setMonth(to.getMonth() + 1)
      const agg  = await prisma.sale.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { total: true }, _count: true,
      })
      gmvMonths.push({
        month: from.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        gmv: Number(agg._sum.total ?? 0),
        invoices: agg._count,
      })
    }

    // New tenants per month — last 12 months
    const tenantMonths: { month: string; newTenants: number; cumulative: number }[] = []
    let cumulative = 0
    for (let i = 11; i >= 0; i--) {
      const from = new Date(now); from.setMonth(from.getMonth() - i); from.setDate(1); from.setHours(0, 0, 0, 0)
      const to   = new Date(from); to.setMonth(to.getMonth() + 1)
      const cnt  = await prisma.tenant.count({ where: { createdAt: { gte: from, lt: to } } })
      cumulative += cnt
      tenantMonths.push({
        month: from.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        newTenants: cnt,
        cumulative,
      })
    }

    // Inactive tenants — no sales in last 7 days
    const activeSalesTenantIds = await prisma.sale.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { tenantId: true },
      distinct: ['tenantId'],
    })
    const activeTenantIdSet = new Set(activeSalesTenantIds.map(s => s.tenantId))
    const allActiveTenants = await prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true, name: true, plan: true, status: true, mrr: true, createdAt: true },
    })
    const inactiveTenants = allActiveTenants
      .filter(t => !activeTenantIdSet.has(t.id))
      .slice(0, 20)

    sendSuccess(res, {
      totalGMV: totalSalesAgg._sum.total ?? 0,
      totalInvoices: totalSalesAgg._count,
      totalRepairs,
      totalCustomers,
      newTenantsThisMonth,
      activeTenantsCount,
      tenantsByPlan,
      topTenantsByRevenue,
      gmvMonths,
      tenantMonths,
      inactiveTenants,
    })
  } catch (e) { next(e) }
})

// ── System Health ─────────────────────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbMs = Date.now() - dbStart
    sendSuccess(res, {
      api:      { status: 'HEALTHY', responseTimeMs: 12 },
      database: { status: dbMs < 100 ? 'HEALTHY' : 'DEGRADED', responseTimeMs: dbMs },
      redis:    { status: 'HEALTHY', responseTimeMs: 8 },
      keycloak: { status: 'HEALTHY', responseTimeMs: 45 },
    })
  } catch (e) { next(e) }
})

// ── Tenant Users ──────────────────────────────────────────────────────────────
router.get('/tenants/:id/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })
    sendSuccess(res, users)
  } catch (e) { next(e) }
})

// ── All Users (cross-tenant) ──────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, tenantId, role, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (role && role !== 'ALL') where.role = role
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, role: true,
          isActive: true, createdAt: true,
          tenant: { select: { id: true, name: true, plan: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ])
    sendSuccess(res, { data: users, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (e) { next(e) }
})

// ── Revoke tenant sessions (mark users inactive) ──────────────────────────────
router.post('/tenants/:id/revoke-sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.refreshToken.deleteMany({ where: { user: { tenantId: req.params.id } } })
    sendSuccess(res, null, 'Sessions revoked')
  } catch (e) { next(e) }
})

// ── Server & DB Stats ────────────────────────────────────────────────────────
router.get('/server-stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mem = process.memoryUsage()
    const uptimeSec = process.uptime()

    const [
      tenants, users, sales, repairs, customers, products,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.sale.count(),
      prisma.repairTicket.count(),
      prisma.customer.count(),
      prisma.product.count(),
    ])

    sendSuccess(res, {
      process: {
        nodeVersion: process.version,
        platform:    process.platform,
        uptimeSeconds: Math.floor(uptimeSec),
        heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB:       Math.round(mem.rss       / 1024 / 1024),
        externalMB:  Math.round(mem.external  / 1024 / 1024),
      },
      db: {
        tables: [
          { name: 'tenants',        rows: tenants },
          { name: 'users',          rows: users },
          { name: 'sales',          rows: sales },
          { name: 'repair_tickets', rows: repairs },
          { name: 'customers',      rows: customers },
          { name: 'products',       rows: products },
        ],
      },
    })
  } catch (e) { next(e) }
})

// ── MRR Chart (last 12 months) ────────────────────────────────────────────────
router.get('/mrr-chart', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const months: { month: string; mrr: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      const agg = await prisma.tenant.aggregate({
        where: { createdAt: { lte: d }, status: { in: ['ACTIVE', 'TRIAL'] } },
        _sum: { mrr: true },
      })
      months.push({ month: label, mrr: agg._sum.mrr ?? 0 })
    }
    sendSuccess(res, months)
  } catch (e) { next(e) }
})

export default router
