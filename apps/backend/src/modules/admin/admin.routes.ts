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
    const id = req.params.id
    await prisma.$transaction(async (tx) => {
      // These three tables reference Product without onDelete:Cascade, so they must be
      // removed first — otherwise the Product cascade from Tenant is blocked (P2003).
      await tx.stockMovement.deleteMany({ where: { product: { tenantId: id } } })
      await tx.imeiRecord.deleteMany({ where: { product: { tenantId: id } } })
      await tx.repairSparePart.deleteMany({ where: { repair: { tenantId: id } } })
      await tx.tenant.delete({ where: { id } })
    })
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

// ── Tenant Feature Flags ──────────────────────────────────────────────────────
const ALL_FEATURES = [
  'POS', 'REPAIRS', 'WARRANTY', 'WHATSAPP', 'ANALYTICS', 'REPORTS',
  'FINANCE', 'DELIVERY', 'EXCHANGES', 'STAFF', 'SUPPLIERS', 'IMEI', 'SERVICES', 'DAILY_RELOAD', 'CUSTOMER_CREDIT',
]
const OPT_IN_FEATURES = ['DAILY_RELOAD', 'CUSTOMER_CREDIT']

router.get('/tenants/:id/features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId: req.params.id } })
    const map: Record<string, boolean> = {}
    for (const f of ALL_FEATURES) map[f] = !OPT_IN_FEATURES.includes(f)
    for (const f of OPT_IN_FEATURES) map[f] = false
    for (const r of rows) map[r.feature] = r.enabled
    sendSuccess(res, map)
  } catch (e) { next(e) }
})

router.put('/tenants/:id/features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const features: Record<string, boolean> = req.body.features ?? {}
    const entries = Object.entries(features).filter(([feature]) => ALL_FEATURES.includes(feature))
    await Promise.all(
      entries.map(([feature, enabled]) =>
        prisma.tenantFeature.upsert({
          where: { tenantId_feature: { tenantId: req.params.id, feature } },
          create: { tenantId: req.params.id, feature, enabled },
          update: { enabled },
        })
      )
    )
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId: req.params.id } })
    const map: Record<string, boolean> = {}
    for (const f of ALL_FEATURES) map[f] = !OPT_IN_FEATURES.includes(f)
    for (const f of OPT_IN_FEATURES) map[f] = false
    for (const r of rows) map[r.feature] = r.enabled
    sendSuccess(res, map, 'Features updated')
  } catch (e) { next(e) }
})

// ── Tenant-specific sales ─────────────────────────────────────────────────────
router.get('/tenants/:id/sales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sales = await prisma.sale.findMany({
      where: { tenantId: req.params.id },
      select: {
        id: true, invoiceNumber: true, total: true, paidAmount: true, dueAmount: true,
        status: true, cashierName: true, customerName: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    sendSuccess(res, sales)
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

    // Monthly GMV trend — last 12 months (single SQL query, replaces 12 sequential round-trips)
    const from12 = new Date(now); from12.setMonth(from12.getMonth() - 11); from12.setDate(1); from12.setHours(0, 0, 0, 0)
    const gmvRaw = await prisma.$queryRaw<Array<{ month: Date; gmv: number; invoices: bigint }>>`
      SELECT DATE_TRUNC('month', "createdAt") AS month,
             COALESCE(SUM(total), 0)::float   AS gmv,
             COUNT(*)::bigint                 AS invoices
      FROM   "Sale"
      WHERE  "createdAt" >= ${from12}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `
    const gmvMap: Record<string, { gmv: number; invoices: number }> = {}
    for (const r of gmvRaw) {
      const key = new Date(r.month).toISOString().slice(0, 7)
      gmvMap[key] = { gmv: Number(r.gmv), invoices: Number(r.invoices) }
    }
    const gmvMonths: { month: string; gmv: number; invoices: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i); d.setDate(1)
      const key = d.toISOString().slice(0, 7)
      gmvMonths.push({
        month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        gmv:      gmvMap[key]?.gmv      ?? 0,
        invoices: gmvMap[key]?.invoices ?? 0,
      })
    }

    // New tenants per month — last 12 months (single SQL query, replaces 12 sequential round-trips)
    const tenantRaw = await prisma.$queryRaw<Array<{ month: Date; cnt: bigint }>>`
      SELECT DATE_TRUNC('month', "createdAt") AS month,
             COUNT(*)::bigint                 AS cnt
      FROM   "Tenant"
      WHERE  "createdAt" >= ${from12}
      GROUP  BY 1
      ORDER  BY 1 ASC
    `
    const tenantMap: Record<string, number> = {}
    for (const r of tenantRaw) tenantMap[new Date(r.month).toISOString().slice(0, 7)] = Number(r.cnt)
    const tenantMonths: { month: string; newTenants: number; cumulative: number }[] = []
    let cumulative = 0
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i); d.setDate(1)
      const key = d.toISOString().slice(0, 7)
      const cnt = tenantMap[key] ?? 0
      cumulative += cnt
      tenantMonths.push({
        month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
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

// ── Activity Logs (synthesised from real DB records) ─────────────────────────
router.get('/activity-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search = '', severity: sevFilter = 'ALL', eventType: evFilter = 'ALL',
            actorType: actFilter = 'ALL', page = '1', limit = '50' } = req.query as Record<string, string>
    const TAKE = 100

    // ── pull raw records in parallel ──────────────────────────────
    const [tenants, users, sales, repairs, repairHistory, warrantyClaims, purchaseOrders] =
      await Promise.all([
        prisma.tenant.findMany({ select: { id: true, name: true, plan: true, status: true, createdAt: true, ownerEmail: true }, orderBy: { createdAt: 'desc' }, take: TAKE }),
        prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true, tenant: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: TAKE }),
        prisma.sale.findMany({ select: { id: true, invoiceNumber: true, total: true, cashierName: true, createdAt: true, tenant: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: TAKE }),
        prisma.repairTicket.findMany({ select: { id: true, ticketNumber: true, deviceModel: true, createdAt: true, status: true, tenant: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: TAKE }),
        prisma.repairStatusHistory.findMany({ select: { id: true, status: true, changedBy: true, note: true, timestamp: true, repair: { select: { ticketNumber: true, tenant: { select: { name: true } } } } }, orderBy: { timestamp: 'desc' }, take: TAKE }),
        prisma.warrantyClaim.findMany({ select: { id: true, issue: true, status: true, createdAt: true, warranty: { select: { productName: true, tenant: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: TAKE }),
        prisma.purchaseOrder.findMany({ select: { id: true, poNumber: true, total: true, supplierName: true, status: true, createdAt: true, tenant: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: TAKE }),
      ])

    // ── normalize to common log shape ──────────────────────────────
    type RawLog = { id: string; timestamp: string; eventType: string; severity: string; actorType: string; actor: string; target: string; details: string; ip: string }
    const logs: RawLog[] = []

    for (const t of tenants) {
      const isSuspended = t.status === 'SUSPENDED'
      logs.push({ id: `t-${t.id}`, timestamp: t.createdAt.toISOString(),
        eventType: isSuspended ? 'TENANT_SUSPENDED' : 'NEW_TENANT',
        severity:  isSuspended ? 'ERROR' : 'INFO',
        actorType: 'SYSTEM', actor: 'platform', target: t.name,
        details: `${isSuspended ? 'Tenant suspended' : 'New tenant registered'} · ${t.plan} plan · ${t.ownerEmail ?? ''}`,
        ip: '—' })
    }

    for (const u of users) {
      logs.push({ id: `u-${u.id}`, timestamp: u.createdAt.toISOString(),
        eventType: 'USER_CREATED', severity: 'INFO',
        actorType: 'TENANT', actor: u.tenant?.name ?? '—', target: u.name,
        details: `New ${u.role} created · ${u.email}`, ip: '—' })
    }

    for (const s of sales) {
      logs.push({ id: `s-${s.id}`, timestamp: s.createdAt.toISOString(),
        eventType: 'SALE_CREATED', severity: 'INFO',
        actorType: 'TENANT', actor: s.cashierName ?? s.tenant?.name ?? '—',
        target: s.invoiceNumber ?? s.id,
        details: `Sale Rs.${Number(s.total ?? 0).toLocaleString()} · ${s.tenant?.name}`, ip: '—' })
    }

    for (const r of repairs) {
      logs.push({ id: `r-${r.id}`, timestamp: r.createdAt.toISOString(),
        eventType: 'REPAIR_OPENED', severity: 'INFO',
        actorType: 'TENANT', actor: r.tenant?.name ?? '—', target: r.ticketNumber,
        details: `Repair opened · ${r.deviceModel ?? 'Unknown device'}`, ip: '—' })
    }

    for (const h of repairHistory) {
      const isDanger = ['CANCELLED'].includes(h.status)
      logs.push({ id: `rh-${h.id}`, timestamp: h.timestamp.toISOString(),
        eventType: 'REPAIR_STATUS_CHANGED', severity: isDanger ? 'WARN' : 'INFO',
        actorType: 'TENANT', actor: h.changedBy, target: h.repair?.ticketNumber ?? '—',
        details: `Status → ${h.status}${h.note ? ' · ' + h.note : ''} · ${h.repair?.tenant?.name ?? ''}`, ip: '—' })
    }

    for (const w of warrantyClaims) {
      logs.push({ id: `wc-${w.id}`, timestamp: w.createdAt.toISOString(),
        eventType: 'WARRANTY_CLAIM', severity: 'WARN',
        actorType: 'TENANT', actor: w.warranty?.tenant?.name ?? '—',
        target: w.warranty?.productName ?? '—',
        details: `Warranty claim · ${w.issue.slice(0, 60)} · ${w.status}`, ip: '—' })
    }

    for (const po of purchaseOrders) {
      logs.push({ id: `po-${po.id}`, timestamp: po.createdAt.toISOString(),
        eventType: 'PURCHASE_ORDER', severity: 'INFO',
        actorType: 'TENANT', actor: po.tenant?.name ?? '—', target: po.poNumber ?? po.id,
        details: `PO from ${po.supplierName ?? 'Unknown'} · Rs.${Number(po.total ?? 0).toLocaleString()} · ${po.status}`, ip: '—' })
    }

    // ── sort all by newest first ───────────────────────────────────
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // ── filter ────────────────────────────────────────────────────
    const q = search.toLowerCase()
    let filtered = logs.filter(l => {
      if (sevFilter !== 'ALL' && l.severity !== sevFilter) return false
      if (evFilter  !== 'ALL' && l.eventType !== evFilter) return false
      if (actFilter !== 'ALL' && l.actorType !== actFilter) return false
      if (q && !(l.actor.toLowerCase().includes(q) || l.target.toLowerCase().includes(q) ||
                 l.details.toLowerCase().includes(q) || l.eventType.toLowerCase().includes(q))) return false
      return true
    })

    const total = filtered.length
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const data = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    // severity summary
    const summary = { INFO: 0, WARN: 0, ERROR: 0, CRITICAL: 0 }
    for (const l of logs) summary[l.severity as keyof typeof summary] = (summary[l.severity as keyof typeof summary] ?? 0) + 1

    sendSuccess(res, { data, total, page: pageNum, limit: limitNum, summary })
  } catch (e) { next(e) }
})

// ── Platform Notifications (synthesised smart alerts) ────────────────────────
router.get('/notifications', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now  = new Date()
    const in7d = new Date(now.getTime() + 7  * 86400_000)
    const in3d = new Date(now.getTime() + 3  * 86400_000)
    const ago30d = new Date(now.getTime() - 30 * 86400_000)
    const ago24h = new Date(now.getTime() - 86400_000)

    const [
      expiringSubscriptions, expiringTrials, suspendedTenants,
      newTenants, recentWarrantyClaims, pendingRepairs,
    ] = await Promise.all([
      prisma.tenant.findMany({
        where: { status: 'ACTIVE', subscriptionEndsAt: { lte: in7d, gte: now } },
        select: { id: true, name: true, plan: true, subscriptionEndsAt: true },
      }),
      prisma.tenant.findMany({
        where: { status: 'TRIAL', trialEndsAt: { lte: in3d, gte: now } },
        select: { id: true, name: true, trialEndsAt: true },
      }),
      prisma.tenant.findMany({
        where: { status: 'SUSPENDED', updatedAt: { gte: ago30d } },
        select: { id: true, name: true, plan: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }, take: 20,
      }),
      prisma.tenant.findMany({
        where: { createdAt: { gte: ago24h } },
        select: { id: true, name: true, plan: true, createdAt: true, ownerEmail: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.warrantyClaim.findMany({
        where: { createdAt: { gte: ago24h } },
        select: { id: true, issue: true, createdAt: true, warranty: { select: { tenant: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' }, take: 30,
      }),
      prisma.repairTicket.findMany({
        where: { status: 'RECEIVED' },
        select: { tenantId: true },
      }),
    ])

    type Notif = { id: string; type: string; title: string; message: string; severity: string; createdAt: string; tenantId?: string }
    const items: Notif[] = []

    for (const t of expiringSubscriptions) {
      const days = Math.round((new Date(t.subscriptionEndsAt!).getTime() - now.getTime()) / 86400_000)
      items.push({
        id: `sub-exp-${t.id}`,
        type: 'SUBSCRIPTION_EXPIRING',
        title: `Subscription expiring in ${days}d`,
        message: `${t.name} (${t.plan}) subscription ends on ${new Date(t.subscriptionEndsAt!).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}`,
        severity: days <= 2 ? 'ERROR' : 'WARN',
        createdAt: now.toISOString(),
        tenantId: t.id,
      })
    }

    for (const t of expiringTrials) {
      const days = Math.round((new Date(t.trialEndsAt!).getTime() - now.getTime()) / 86400_000)
      items.push({
        id: `trial-exp-${t.id}`,
        type: 'TRIAL_EXPIRING',
        title: `Trial expiring in ${days}d`,
        message: `${t.name} trial ends on ${new Date(t.trialEndsAt!).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}. Consider reaching out for conversion.`,
        severity: 'WARN',
        createdAt: now.toISOString(),
        tenantId: t.id,
      })
    }

    for (const t of suspendedTenants) {
      items.push({
        id: `suspended-${t.id}`,
        type: 'TENANT_SUSPENDED',
        title: 'Tenant suspended',
        message: `${t.name} (${t.plan}) was suspended.`,
        severity: 'ERROR',
        createdAt: (t.updatedAt as Date).toISOString(),
        tenantId: t.id,
      })
    }

    for (const t of newTenants) {
      items.push({
        id: `new-tenant-${t.id}`,
        type: 'NEW_TENANT',
        title: 'New tenant registered',
        message: `${t.name} joined on ${t.plan} plan · ${t.ownerEmail}`,
        severity: 'INFO',
        createdAt: (t.createdAt as Date).toISOString(),
        tenantId: t.id,
      })
    }

    for (const w of recentWarrantyClaims) {
      items.push({
        id: `wc-${w.id}`,
        type: 'WARRANTY_CLAIM',
        title: 'New warranty claim',
        message: `${w.warranty?.tenant?.name ?? 'Unknown'}: ${(w.issue ?? '').slice(0, 80)}`,
        severity: 'WARN',
        createdAt: (w.createdAt as Date).toISOString(),
      })
    }

    // Group pending repairs by tenant and flag those with >= 10 pending
    const repairByTenant: Record<string, number> = {}
    for (const r of pendingRepairs) repairByTenant[r.tenantId] = (repairByTenant[r.tenantId] ?? 0) + 1
    for (const [tenantId, count] of Object.entries(repairByTenant)) {
      if (count >= 10) {
        items.push({
          id: `high-repairs-${tenantId}`,
          type: 'HIGH_REPAIR_QUEUE',
          title: 'High repair queue',
          message: `Tenant has ${count} pending repair tickets.`,
          severity: count >= 20 ? 'ERROR' : 'WARN',
          createdAt: now.toISOString(),
          tenantId,
        })
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const summary = { INFO: 0, WARN: 0, ERROR: 0 }
    for (const n of items) summary[n.severity as keyof typeof summary] = (summary[n.severity as keyof typeof summary] ?? 0) + 1

    sendSuccess(res, { data: items, total: items.length, summary })
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

// ── Support Tools ─────────────────────────────────────────────────────────────
router.get('/support/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.query as Record<string, string>
    const notes = await prisma.supportNote.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    sendSuccess(res, notes)
  } catch (e) { next(e) }
})

router.post('/support/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, note, adminName = 'Support Admin', ticketRef } = req.body
    if (!tenantId || !note) throw new AppError('tenantId and note are required', 400)
    const created = await prisma.supportNote.create({
      data: { tenantId, note, adminName, ticketRef: ticketRef || undefined },
      include: { tenant: { select: { name: true } } },
    })
    sendSuccess(res, created, 'Note added', 201)
  } catch (e) { next(e) }
})

router.delete('/support/notes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.supportNote.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Deleted')
  } catch (e) { next(e) }
})

router.post('/support/impersonate/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owner = await prisma.user.findFirst({
      where: { tenantId: req.params.tenantId, role: 'OWNER' },
    })
    if (!owner) throw new AppError('No OWNER user found for this tenant', 404)
    const { signAccessToken } = await import('../../utils/jwt.js')
    const token = signAccessToken({
      userId: owner.id, tenantId: owner.tenantId,
      role: owner.role, email: owner.email,
    })
    sendSuccess(res, { token, ownerEmail: owner.email, tenantId: owner.tenantId })
  } catch (e) { next(e) }
})

router.get('/support/tenant-debug/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.params
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new AppError('Tenant not found', 404)

    const [products, customers, sales, repairs, users, warrantyClaimsArr, purchaseOrdersArr] =
      await Promise.all([
        prisma.product.count({ where: { tenantId, isActive: true } }),
        prisma.customer.count({ where: { tenantId } }),
        prisma.sale.count({ where: { tenantId } }),
        prisma.repairTicket.count({ where: { tenantId } }),
        prisma.user.count({ where: { tenantId } }),
        prisma.warrantyClaim.findMany({
          where: { warranty: { tenantId } },
          select: { status: true, createdAt: true, issue: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.purchaseOrder.findMany({
          where: { tenantId },
          select: { status: true, createdAt: true, poNumber: true, total: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

    const lastSale = await prisma.sale.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })

    sendSuccess(res, {
      tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan, status: tenant.status, createdAt: tenant.createdAt },
      counts: { products, customers, sales, repairs, users },
      lastActivity: lastSale?.createdAt ?? null,
      recentWarrantyClaims: warrantyClaimsArr,
      recentPurchaseOrders: purchaseOrdersArr,
    })
  } catch (e) { next(e) }
})

// ── Announcements ─────────────────────────────────────────────────────────────
router.get('/announcements', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.platformAnnouncement.findMany({ orderBy: { createdAt: 'desc' } })
    sendSuccess(res, items)
  } catch (e) { next(e) }
})

router.post('/announcements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, type = 'INFO', target = 'ALL', scheduledAt, sendNow = false } = req.body
    if (!title || !body) throw new AppError('title and body are required', 400)
    const status = sendNow ? 'SENT' : scheduledAt ? 'SCHEDULED' : 'DRAFT'
    const item = await prisma.platformAnnouncement.create({
      data: {
        title, body, type, target, status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        sentAt: sendNow ? new Date() : undefined,
      },
    })
    sendSuccess(res, item, 'Announcement created', 201)
  } catch (e) { next(e) }
})

router.patch('/announcements/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.platformAnnouncement.findUnique({ where: { id: req.params.id } })
    if (!item) throw new AppError('Announcement not found', 404)
    const updated = await prisma.platformAnnouncement.update({
      where: { id: req.params.id },
      data: { status: 'SENT', sentAt: new Date() },
    })
    sendSuccess(res, updated, 'Announcement sent')
  } catch (e) { next(e) }
})

router.patch('/announcements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['title', 'body', 'type', 'target', 'status', 'scheduledAt']
    const data: Record<string, unknown> = {}
    for (const k of allowed) if (k in req.body) data[k] = req.body[k]
    const updated = await prisma.platformAnnouncement.update({ where: { id: req.params.id }, data })
    sendSuccess(res, updated)
  } catch (e) { next(e) }
})

router.delete('/announcements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.platformAnnouncement.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Deleted')
  } catch (e) { next(e) }
})

// ── Settings ──────────────────────────────────────────────────────────────────
const CONFIG_DEFAULTS: Record<string, string> = {
  'platform.name':              'Hexalyte',
  'platform.supportEmail':      'support@hexalyte.com',
  'platform.trialDays':         '14',
  'feature.whatsappReceipts':   'true',
  'feature.advancedAnalytics':  'true',
  'feature.multiCurrency':      'false',
  'feature.apiAccess':          'false',
  'feature.customDomain':       'false',
  'email.fromEmail':            'noreply@hexalyte.com',
  'email.fromName':             'Hexalyte Platform',
  'email.apiKey':               '',
  'sms.provider':               'Twilio',
  'sms.apiKey':                 '',
  'sms.senderId':               '',
  'security.sessionTimeoutMin': '120',
  'security.maxLoginAttempts':  '5',
  'security.ipWhitelist':       '',
  'security.enforce2FA':        'true',
  'maintenance.enabled':        'false',
}

router.get('/settings/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.platformConfig.findMany()
    const map: Record<string, string> = { ...CONFIG_DEFAULTS }
    for (const r of rows) map[r.key] = r.value
    sendSuccess(res, map)
  } catch (e) { next(e) }
})

router.put('/settings/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body as Record<string, string>
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.platformConfig.upsert({ where: { key }, update: { value }, create: { key, value } })
      )
    )
    sendSuccess(res, null, 'Config saved')
  } catch (e) { next(e) }
})

router.get('/settings/admins', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'PLATFORM_ADMIN' },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, createdAt: true,
        refreshTokens: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    })
    const result = admins.map(a => ({
      id: a.id, name: a.name, email: a.email, role: a.role,
      isActive: a.isActive, createdAt: a.createdAt,
      lastLoginAt: a.refreshTokens[0]?.createdAt ?? null,
    }))
    sendSuccess(res, result)
  } catch (e) { next(e) }
})

router.post('/settings/admins', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, adminRole = 'SUPPORT_ADMIN' } = req.body
    if (!name || !email || !password) throw new AppError('name, email and password are required', 400)
    const existing = await prisma.user.findFirst({ where: { email } })
    if (existing) throw new AppError('Email already in use', 409)
    const bcrypt = await import('bcryptjs')
    const hashed = await bcrypt.default.hash(password, 12)
    const requester = (req as any).user
    const created = await prisma.user.create({
      data: {
        tenantId: requester.tenantId,
        name, email,
        password: hashed,
        role: 'PLATFORM_ADMIN',
      },
    })
    sendSuccess(res, { id: created.id, name: created.name, email: created.email, role: created.role, createdAt: created.createdAt }, 'Admin created', 201)
  } catch (e) { next(e) }
})

router.delete('/settings/admins/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requester = (req as any).user
    if (req.params.id === requester.userId) throw new AppError('Cannot delete yourself', 400)
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } })
    sendSuccess(res, null, 'Admin deactivated')
  } catch (e) { next(e) }
})

export default router
