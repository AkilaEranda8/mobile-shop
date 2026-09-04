import { Prisma, SubscriptionInvoiceStatus, SubscriptionPaymentChannel, SubscriptionPlan } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { logPlatformActivity } from '../../utils/activity-log'
import { recalculateTenantMrr } from '../../utils/tenant-mrr'
import { getBillingConfig } from './billing-config'
import {
  addMonths,
  calculateDueDate,
  daysOverdue,
  graceDaysRemaining,
  isInGracePeriod,
  isPastSuspension,
  resolveInvoiceStatus,
  toColomboDateKey,
} from './billing-dates'
import { generateSubscriptionInvoiceNumber } from './invoice-number'
import { getHelaposPublicConfig } from './helapos.client'
import {
  encodePlanUpgradeNotes,
  isUpgradePlan,
  parsePlanUpgradeNotes,
  resolvePlanBaseMrr,
} from './plan-prices'

const BILLING_SLUG = 'hexalyte-billing-internal'

export type CreateInvoiceInput = {
  tenantId: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
  months?: number
  amount?: number
  discount?: number
  tax?: number
  issueDate?: Date
  dueDate?: Date
  invoiceNumber?: string
  notes?: string
  status?: SubscriptionInvoiceStatus
  /** Snapshot plan on invoice (defaults to tenant.plan) */
  plan?: SubscriptionPlan
  mrrSnapshot?: number
  actor?: { type: string; name: string; userId?: string }
}

/** Sync legacy Tenant.paymentDue* fields from the latest unpaid required invoice */
export async function syncTenantPaymentDueFlags(tenantId: string) {
  const unpaid = await prisma.subscriptionInvoice.findFirst({
    where: {
      tenantId,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    orderBy: { dueDate: 'asc' },
  })

  if (!unpaid) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        paymentDue: false,
        paymentDueAmount: null,
        paymentDueInvoiceNo: null,
        paymentDueMonths: null,
        paymentDuePeriodStart: null,
        paymentDuePeriodEnd: null,
        paymentDueAt: null,
      },
    })
    return null
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      paymentDue: true,
      paymentDueAmount: unpaid.total,
      paymentDueInvoiceNo: unpaid.invoiceNumber,
      paymentDueMonths: unpaid.months,
      paymentDuePeriodStart: unpaid.billingPeriodStart,
      paymentDuePeriodEnd: unpaid.billingPeriodEnd,
      paymentDueAt: unpaid.issueDate,
    },
  })
  return unpaid
}

export async function createSubscriptionInvoice(input: CreateInvoiceInput) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } })
  if (!tenant) throw new AppError('Tenant not found', 404)
  if (tenant.slug === BILLING_SLUG) throw new AppError('Cannot bill internal billing tenant', 400)

  const existing = await prisma.subscriptionInvoice.findFirst({
    where: {
      tenantId: input.tenantId,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
    },
  })
  if (existing) return existing

  const config = await getBillingConfig()
  const months = Math.max(1, Math.min(24, input.months ?? 1))
  const mrr = input.mrrSnapshot != null && Number.isFinite(input.mrrSnapshot)
    ? Number(input.mrrSnapshot)
    : (tenant.mrr ?? 0)
  const subtotal = input.amount != null && Number.isFinite(input.amount)
    ? Number(input.amount)
    : mrr * months
  if (subtotal < 0) throw new AppError('Invalid invoice amount', 400)

  const discount = Math.max(0, input.discount ?? 0)
  const tax = Math.max(0, input.tax ?? 0)
  const total = Math.max(0, subtotal - discount + tax)
  const issueDate = input.issueDate ?? new Date()
  const dueDate = input.dueDate ?? calculateDueDate(issueDate, config.dueDaysAfterIssue)
  const invoiceNumber = input.invoiceNumber?.trim()
    || await generateSubscriptionInvoiceNumber(issueDate)
  const plan = input.plan ?? tenant.plan

  try {
    const invoice = await prisma.subscriptionInvoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        issueDate,
        dueDate,
        plan,
        months,
        subtotal,
        discount,
        tax,
        total,
        status: input.status ?? 'PENDING',
        notes: input.notes,
        mrrSnapshot: mrr,
      },
    })

    await syncTenantPaymentDueFlags(tenant.id)

    await logPlatformActivity({
      eventType: 'INVOICE_CREATED',
      severity: 'INFO',
      actorType: input.actor?.type ?? 'SYSTEM',
      actor: input.actor?.name ?? 'billing',
      target: tenant.name,
      details: `Invoice ${invoice.invoiceNumber} · Rs.${total.toLocaleString('en-LK')} · ${toColomboDateKey(input.billingPeriodStart)}→${toColomboDateKey(input.billingPeriodEnd)} · due ${toColomboDateKey(dueDate)}`,
      tenantId: tenant.id,
      userId: input.actor?.userId,
    })

    return invoice
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await prisma.subscriptionInvoice.findFirst({
        where: {
          tenantId: input.tenantId,
          billingPeriodStart: input.billingPeriodStart,
          billingPeriodEnd: input.billingPeriodEnd,
        },
      })
      if (again) return again
    }
    throw err
  }
}

/** Ensure monthly invoice exists for an active paid subscription whose period needs billing */
export async function ensureMonthlyInvoiceForTenant(tenantId: string, now = new Date()) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return null
  if (tenant.status === 'CANCELLED' || tenant.status === 'TRIAL') return null
  if (tenant.slug === BILLING_SLUG) return null
  if (!(tenant.mrr > 0) && tenant.plan === 'TRIAL') return null

  // Prefer generating against subscriptionEndsAt window when set
  const periodStart = tenant.subscriptionEndsAt && tenant.subscriptionEndsAt <= now
    ? new Date(tenant.subscriptionEndsAt)
    : tenant.subscriptionEndsAt && toColomboDateKey(tenant.subscriptionEndsAt) === toColomboDateKey(now)
      ? new Date(tenant.subscriptionEndsAt)
      : null

  if (!periodStart) return null

  const months = 1
  const periodEnd = addMonths(periodStart, months)
  const amount = (tenant.mrr ?? 0) * months
  if (amount <= 0) return null

  return createSubscriptionInvoice({
    tenantId: tenant.id,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    months,
    amount,
    issueDate: now,
    actor: { type: 'SYSTEM', name: 'monthly-invoice-job' },
  })
}

/**
 * Self-serve plan upgrade: creates (or reuses) a PLAN_UPGRADE invoice.
 * Amount = max(0, targetBaseMrr − currentBaseMrr). Payable via LankaQR or bank transfer.
 * Plan is applied when the payment is approved (webhook or admin).
 */
export async function requestPlanUpgrade(opts: {
  tenantId: string
  targetPlan: string
  actor?: { type: string; name: string; userId?: string }
}) {
  const target = String(opts.targetPlan || '').toUpperCase() as SubscriptionPlan
  if (!['STARTER', 'PRO'].includes(target)) {
    throw new AppError('Self-serve upgrades support Starter and Pro only. Contact sales for Enterprise.', 400)
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: opts.tenantId } })
  if (!tenant) throw new AppError('Tenant not found', 404)
  if (tenant.slug === BILLING_SLUG) throw new AppError('Invalid tenant', 400)
  if (tenant.status === 'CANCELLED') throw new AppError('Cancelled accounts cannot upgrade', 400)

  const fromPlan = tenant.plan
  if (fromPlan === target) throw new AppError('You are already on this plan', 400)
  if (!isUpgradePlan(fromPlan, target)) {
    throw new AppError('Downgrades are handled by support — please contact Hexalyte', 400)
  }

  const targetMrr = await resolvePlanBaseMrr(target)
  const currentBase = fromPlan === 'TRIAL' ? 0 : await resolvePlanBaseMrr(fromPlan)
  // Prefer live tenant.mrr when on a paid plan so priced add-ons are reflected in the delta
  const currentBillable = fromPlan === 'TRIAL' || tenant.status === 'TRIAL'
    ? 0
    : Math.max(currentBase, tenant.mrr ?? 0)
  const amount = Math.round(Math.max(0, targetMrr - Math.min(currentBillable, targetMrr)) * 100) / 100
  if (amount <= 0) {
    throw new AppError('No upgrade charge required for this plan change — contact support to apply it', 400)
  }

  const notes = encodePlanUpgradeNotes(fromPlan, target)

  // Reuse unpaid upgrade invoice for the same target plan
  const existingUpgrades = await prisma.subscriptionInvoice.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ['PENDING', 'OVERDUE'] },
      notes: { startsWith: 'PLAN_UPGRADE|' },
    },
    orderBy: { createdAt: 'desc' },
  })
  const reuse = existingUpgrades.find((inv) => parsePlanUpgradeNotes(inv.notes)?.to === target)
  if (reuse) {
    return {
      invoice: reuse,
      reused: true,
      fromPlan,
      targetPlan: target,
      amount: reuse.total,
      targetMrr,
    }
  }

  // Cancel other pending upgrades (different target)
  if (existingUpgrades.length) {
    await prisma.subscriptionInvoice.updateMany({
      where: { id: { in: existingUpgrades.map((i) => i.id) } },
      data: { status: 'CANCELLED' },
    })
  }

  const now = new Date()
  // Unique period window (avoids collision with monthly @@unique period)
  const billingPeriodStart = now
  const billingPeriodEnd = addMonths(now, 1)

  const invoice = await createSubscriptionInvoice({
    tenantId: tenant.id,
    billingPeriodStart,
    billingPeriodEnd,
    months: 1,
    amount,
    plan: target,
    mrrSnapshot: targetMrr,
    notes,
    issueDate: now,
    actor: opts.actor ?? { type: 'USER', name: 'plan-upgrade' },
  })

  await logPlatformActivity({
    eventType: 'PLAN_UPGRADE_REQUESTED',
    severity: 'INFO',
    actorType: opts.actor?.type ?? 'USER',
    actor: opts.actor?.name ?? 'tenant-user',
    target: tenant.name,
    details: `Upgrade ${fromPlan} → ${target} · invoice ${invoice.invoiceNumber} · Rs.${amount.toLocaleString('en-LK')}`,
    tenantId: tenant.id,
    userId: opts.actor?.userId,
  })

  return {
    invoice,
    reused: false,
    fromPlan,
    targetPlan: target,
    amount,
    targetMrr,
  }
}

export async function listTenantInvoices(
  tenantId: string,
  opts: { status?: string; search?: string; limit?: number } = {},
) {
  const config = await getBillingConfig()
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { ownerName: true, name: true },
  })
  const where: Prisma.SubscriptionInvoiceWhereInput = { tenantId }
  if (opts.status && opts.status !== 'ALL') {
    where.status = opts.status as SubscriptionInvoiceStatus
  }
  if (opts.search?.trim()) {
    where.invoiceNumber = { contains: opts.search.trim(), mode: 'insensitive' }
  }

  const invoices = await prisma.subscriptionInvoice.findMany({
    where,
    orderBy: [{ billingPeriodStart: 'desc' }, { createdAt: 'desc' }],
    take: opts.limit ?? 100,
    include: {
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  const fallbackName = tenant?.ownerName || tenant?.name || null
  const enriched = await enrichInvoicesWithPayers(invoices, fallbackName)

  const now = new Date()
  return enriched.map(inv => {
    const effective = resolveInvoiceStatus(inv.status as any, inv.dueDate, now, config.graceDays)
    return {
      ...inv,
      effectiveStatus: effective,
      daysOverdue: effective === 'OVERDUE' || effective === 'PENDING'
        ? daysOverdue(inv.dueDate, now)
        : 0,
      graceDaysRemaining: inv.status === 'PAID' || inv.status === 'CANCELLED'
        ? 0
        : graceDaysRemaining(now, inv.dueDate, config.graceDays),
      inGracePeriod: inv.status !== 'PAID' && inv.status !== 'CANCELLED'
        && isInGracePeriod(now, inv.dueDate, config.graceDays),
    }
  })
}

type PaymentLike = {
  submittedById?: string | null
  reviewedById?: string | null
  reviewedByEmail?: string | null
  status: string
  [key: string]: unknown
}

async function resolveUserMap(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return new Map<string, { id: string; name: string; email: string }>()
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  })
  return new Map(users.map(u => [u.id, u]))
}

function attachPayerFields(
  payment: PaymentLike,
  users: Map<string, { id: string; name: string; email: string }>,
  fallbackName?: string | null,
) {
  const submitter = payment.submittedById ? users.get(String(payment.submittedById)) : null
  const reviewer = payment.reviewedById ? users.get(String(payment.reviewedById)) : null
  const paidByName = submitter?.name
    || (payment.status === 'APPROVED' ? fallbackName : null)
    || null
  const paidByEmail = submitter?.email || null
  const approvedByName = reviewer?.name || payment.reviewedByEmail || null
  return {
    ...payment,
    submittedBy: submitter ? { id: submitter.id, name: submitter.name, email: submitter.email } : null,
    paidByName,
    paidByEmail,
    approvedByName,
  }
}

async function enrichInvoicesWithPayers<T extends { payments?: PaymentLike[]; status: string }>(
  invoices: T[],
  fallbackName?: string | null,
) {
  const userIds: string[] = []
  for (const inv of invoices) {
    for (const p of inv.payments ?? []) {
      if (p.submittedById) userIds.push(String(p.submittedById))
      if (p.reviewedById) userIds.push(String(p.reviewedById))
    }
  }
  const users = await resolveUserMap(userIds)
  return invoices.map(inv => {
    const payments = (inv.payments ?? []).map(p => attachPayerFields(p, users, fallbackName))
    const approved = payments.find(p => p.status === 'APPROVED')
    const paidByName = approved?.paidByName
      || (inv.status === 'PAID' ? fallbackName : null)
      || null
    return {
      ...inv,
      payments,
      paidByName,
      paidByEmail: approved?.paidByEmail ?? null,
      approvedByName: approved?.approvedByName ?? null,
    }
  })
}

/**
 * Ensure invoice history exists from the day the tenant started paid use.
 * Past completed months → PAID records (idempotent). Does not invent unpaid future invoices.
 */
export async function backfillInvoiceHistory(tenantId: string): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      plan: true,
      mrr: true,
      status: true,
      createdAt: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      slug: true,
    },
  })
  if (!tenant || tenant.slug === BILLING_SLUG) return 0
  const mrr = tenant.mrr ?? 0
  if (mrr <= 0) return 0
  if (tenant.plan === 'TRIAL' && tenant.status === 'TRIAL') return 0

  const config = await getBillingConfig()
  const now = new Date()

  // Billing history starts when paid use began (after trial), else tenant createdAt
  let cursor = tenant.trialEndsAt && tenant.trialEndsAt < now
    ? new Date(tenant.trialEndsAt)
    : new Date(tenant.createdAt)

  // Align to start of that calendar month (UTC day preserved via Date)
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1)

  // Walk until the month before current (past settled periods only)
  const endExclusive = new Date(now.getFullYear(), now.getMonth(), 1)
  let created = 0

  while (cursor < endExclusive) {
    const periodStart = new Date(cursor)
    const periodEnd = addMonths(periodStart, 1)

    const existing = await prisma.subscriptionInvoice.findFirst({
      where: {
        tenantId: tenant.id,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      },
      select: { id: true },
    })

    if (!existing) {
      const issueDate = periodStart
      const dueDate = calculateDueDate(issueDate, config.dueDaysAfterIssue)
      try {
        await prisma.subscriptionInvoice.create({
          data: {
            tenantId: tenant.id,
            invoiceNumber: await generateSubscriptionInvoiceNumber(issueDate),
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            issueDate,
            dueDate,
            plan: tenant.plan === 'TRIAL' ? 'STARTER' : tenant.plan,
            months: 1,
            subtotal: mrr,
            discount: 0,
            tax: 0,
            total: mrr,
            status: 'PAID',
            paidAt: periodEnd,
            mrrSnapshot: mrr,
            notes: 'Backfilled from subscription start history',
          },
        })
        created += 1
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err
        }
      }
    }

    cursor = addMonths(cursor, 1)
  }

  return created
}

export async function getBillingOverview(tenantId: string) {
  const config = await getBillingConfig()
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      plan: true,
      status: true,
      mrr: true,
      subscriptionEndsAt: true,
      trialEndsAt: true,
      createdAt: true,
      ownerName: true,
      ownerEmail: true,
      paymentDue: true,
      paymentDueAmount: true,
      paymentDueInvoiceNo: true,
    },
  })
  if (!tenant) throw new AppError('Tenant not found', 404)

  // Build history from the day they started using the paid system
  await backfillInvoiceHistory(tenantId).catch((err) => {
    console.warn('[billing] history backfill skipped:', err?.message ?? err)
  })

  const invoices = await listTenantInvoices(tenantId, { limit: 240 })
  const current = invoices.find(i => i.status === 'PENDING' || i.status === 'OVERDUE' || i.effectiveStatus === 'OVERDUE')
    ?? invoices[0]
    ?? null

  const yearStart = new Date()
  yearStart.setMonth(0, 1)
  yearStart.setHours(0, 0, 0, 0)

  const paidThisYear = await prisma.subscriptionInvoice.aggregate({
    where: {
      tenantId,
      status: 'PAID',
      paidAt: { gte: yearStart },
    },
    _sum: { total: true },
  })

  const outstanding = invoices.filter(i =>
    i.status === 'PENDING' || i.status === 'OVERDUE' || i.effectiveStatus === 'OVERDUE',
  )
  const balance = outstanding.reduce((s, i) => s + i.total, 0)

  const graceInvoice = outstanding.find(i => i.inGracePeriod) ?? null
  const suspendCandidate = outstanding.find(i =>
    isPastSuspension(new Date(), i.dueDate, config.graceDays),
  ) ?? null

  return {
    tenant,
    config: {
      graceDays: config.graceDays,
      dueDaysAfterIssue: config.dueDaysAfterIssue,
      bank: config.bank,
      helapos: await getHelaposPublicConfig(),
    },
    summary: {
      currentBalance: balance,
      currentInvoice: current
        ? {
            id: current.id,
            invoiceNumber: current.invoiceNumber,
            total: current.total,
            status: current.effectiveStatus,
            dueDate: current.dueDate,
            paidAt: current.paidAt,
          }
        : null,
      paidThisYear: paidThisYear._sum.total ?? 0,
      outstandingCount: outstanding.length,
    },
    subscription: {
      plan: tenant.plan,
      monthlyPrice: tenant.mrr,
      billingCycle: 'MONTHLY',
      nextBillingDate: tenant.subscriptionEndsAt,
      status: tenant.status,
    },
    currentInvoice: current,
    invoices,
    graceWarning: graceInvoice
      ? {
          invoiceId: graceInvoice.id,
          invoiceNumber: graceInvoice.invoiceNumber,
          amount: graceInvoice.total,
          daysRemaining: graceInvoice.graceDaysRemaining,
          dueDate: graceInvoice.dueDate,
        }
      : null,
    suspension: tenant.status === 'SUSPENDED' || suspendCandidate
      ? {
          suspended: tenant.status === 'SUSPENDED',
          invoiceId: suspendCandidate?.id ?? graceInvoice?.id ?? current?.id ?? null,
        }
      : null,
  }
}

export async function getInvoiceForTenant(tenantId: string, invoiceId: string) {
  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
      tenant: {
        select: { id: true, name: true, ownerName: true, ownerEmail: true, plan: true },
      },
    },
  })
  if (!invoice) throw new AppError('Invoice not found', 404)
  const [enriched] = await enrichInvoicesWithPayers(
    [invoice],
    invoice.tenant.ownerName || invoice.tenant.name,
  )
  return enriched
}

/** Admin: load subscription invoice by id (any tenant) */
export async function getSubscriptionInvoiceById(invoiceId: string) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
      tenant: {
        select: { id: true, name: true, ownerName: true, ownerEmail: true, plan: true },
      },
    },
  })
  if (!invoice) throw new AppError('Invoice not found', 404)
  const [enriched] = await enrichInvoicesWithPayers(
    [invoice],
    invoice.tenant.ownerName || invoice.tenant.name,
  )
  return enriched
}

export type SubmitPaymentInput = {
  tenantId: string
  invoiceId: string
  amount: number
  channel?: SubscriptionPaymentChannel
  methodLabel?: string
  paymentDate: Date
  bankName?: string
  accountRef?: string
  transactionRef?: string
  slipUrl?: string
  slipFilename?: string
  notes?: string
  submittedById?: string
}

export async function submitSubscriptionPayment(input: SubmitPaymentInput) {
  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
  })
  if (!invoice) throw new AppError('Invoice not found', 404)
  if (invoice.status === 'PAID') throw new AppError('Invoice is already paid', 400)
  if (invoice.status === 'CANCELLED') throw new AppError('Invoice is cancelled', 400)

  // Block duplicate pending submissions with same transaction ref
  if (input.transactionRef?.trim()) {
    const dup = await prisma.subscriptionPayment.findFirst({
      where: {
        tenantId: input.tenantId,
        transactionRef: input.transactionRef.trim(),
        status: { in: ['PENDING', 'APPROVED'] },
      },
    })
    if (dup) throw new AppError('A payment with this transaction reference already exists', 409)
  }

  // One pending payment per invoice at a time (avoid spam)
  const pending = await prisma.subscriptionPayment.findFirst({
    where: { invoiceId: invoice.id, status: 'PENDING' },
  })
  if (pending) {
    throw new AppError('A payment is already pending review for this invoice. Wait for admin approval or rejection.', 409)
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Invalid payment amount', 400)

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId: input.tenantId,
      invoiceId: invoice.id,
      amount,
      channel: input.channel ?? 'MANUAL_BANK_TRANSFER',
      methodLabel: input.methodLabel,
      paymentDate: input.paymentDate,
      bankName: input.bankName,
      accountRef: input.accountRef,
      transactionRef: input.transactionRef?.trim() || null,
      slipUrl: input.slipUrl,
      slipFilename: input.slipFilename,
      notes: input.notes,
      status: 'PENDING',
      submittedById: input.submittedById,
    },
    include: { invoice: true },
  })

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true },
  })

  await logPlatformActivity({
    eventType: 'PAYMENT_SUBMITTED',
    severity: 'INFO',
    actorType: 'USER',
    actor: input.submittedById ?? 'tenant-user',
    target: tenant?.name ?? input.tenantId,
    details: `Payment ${payment.id} · invoice ${invoice.invoiceNumber} · Rs.${amount.toLocaleString('en-LK')} · ${payment.channel} · ref ${payment.transactionRef ?? '—'}`,
    tenantId: input.tenantId,
    userId: input.submittedById,
  })

  return payment
}

export async function approveSubscriptionPayment(opts: {
  paymentId: string
  reviewedById?: string
  reviewedByEmail?: string
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: opts.paymentId },
    include: {
      invoice: true,
      tenant: {
        select: {
          id: true,
          name: true,
          subscriptionEndsAt: true,
          plan: true,
          status: true,
        },
      },
    },
  })
  if (!payment) throw new AppError('Payment not found', 404)
  if (payment.status === 'APPROVED') return payment
  if (payment.status === 'REJECTED') throw new AppError('Rejected payments cannot be approved', 400)

  const upgrade = parsePlanUpgradeNotes(payment.invoice.notes)

  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: opts.reviewedById,
        reviewedByEmail: opts.reviewedByEmail,
        rejectionReason: null,
      },
    })

    const invoice = await tx.subscriptionInvoice.update({
      where: { id: payment.invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    // Extend subscription to invoice period end if later than current
    const periodEnd = invoice.billingPeriodEnd
    const currentEnd = payment.tenant.subscriptionEndsAt
    const newEnd = !currentEnd || periodEnd > currentEnd ? periodEnd : currentEnd

    // Any other required unpaid invoices?
    const outstanding = await tx.subscriptionInvoice.count({
      where: {
        tenantId: payment.tenantId,
        id: { not: invoice.id },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
    })

    const tenantUpdate: Prisma.TenantUpdateInput = {
      subscriptionEndsAt: newEnd,
      paymentDue: outstanding > 0,
    }

    if (upgrade) {
      tenantUpdate.plan = upgrade.to
      // Trial → paid activation
      if (payment.tenant.status === 'TRIAL' || payment.tenant.plan === 'TRIAL') {
        tenantUpdate.status = 'ACTIVE'
        tenantUpdate.trialEndsAt = new Date()
      }
    }

    if (outstanding === 0) {
      tenantUpdate.status = 'ACTIVE'
      tenantUpdate.paymentDueAmount = null
      tenantUpdate.paymentDueInvoiceNo = null
      tenantUpdate.paymentDueMonths = null
      tenantUpdate.paymentDuePeriodStart = null
      tenantUpdate.paymentDuePeriodEnd = null
      tenantUpdate.paymentDueAt = null
    }

    await tx.tenant.update({
      where: { id: payment.tenantId },
      data: tenantUpdate,
    })

    // Ensure users stay active on reactivation
    if (outstanding === 0) {
      await tx.user.updateMany({
        where: { tenantId: payment.tenantId, isActive: false },
        data: { isActive: true },
      })
    }

    return { updatedPayment, invoice, outstanding, reactivated: outstanding === 0, upgrade }
  })

  await syncTenantPaymentDueFlags(payment.tenantId)

  if (result.upgrade) {
    await recalculateTenantMrr(payment.tenantId)
  }

  await logPlatformActivity({
    eventType: 'PAYMENT_APPROVED',
    severity: 'INFO',
    actorType: 'ADMIN',
    actor: opts.reviewedByEmail ?? opts.reviewedById ?? 'admin',
    target: payment.tenant.name,
    details: `Payment ${payment.id} approved · invoice ${payment.invoice.invoiceNumber} · PAID${
      result.upgrade ? ` · plan ${result.upgrade.from}→${result.upgrade.to}` : ''
    }`,
    tenantId: payment.tenantId,
    userId: opts.reviewedById,
  })

  if (result.upgrade) {
    await logPlatformActivity({
      eventType: 'PLAN_UPGRADED',
      severity: 'INFO',
      actorType: 'ADMIN',
      actor: opts.reviewedByEmail ?? opts.reviewedById ?? 'admin',
      target: payment.tenant.name,
      details: `Plan upgraded ${result.upgrade.from} → ${result.upgrade.to} via invoice ${payment.invoice.invoiceNumber}`,
      tenantId: payment.tenantId,
      userId: opts.reviewedById,
    })
  }

  if (result.reactivated) {
    await logPlatformActivity({
      eventType: 'ACCOUNT_REACTIVATED',
      severity: 'INFO',
      actorType: 'ADMIN',
      actor: opts.reviewedByEmail ?? opts.reviewedById ?? 'admin',
      target: payment.tenant.name,
      details: `Account reactivated after payment approval · invoice ${payment.invoice.invoiceNumber}`,
      tenantId: payment.tenantId,
      userId: opts.reviewedById,
    })
  }

  return prisma.subscriptionPayment.findUnique({
    where: { id: payment.id },
    include: { invoice: true },
  })
}

export async function rejectSubscriptionPayment(opts: {
  paymentId: string
  reason: string
  reviewedById?: string
  reviewedByEmail?: string
}) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: opts.paymentId },
    include: { invoice: true, tenant: { select: { name: true } } },
  })
  if (!payment) throw new AppError('Payment not found', 404)
  if (payment.status === 'APPROVED') throw new AppError('Approved payments cannot be rejected', 400)
  if (payment.status === 'REJECTED') return payment

  const reason = opts.reason?.trim()
  if (!reason) throw new AppError('Rejection reason is required', 400)

  const updated = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedById: opts.reviewedById,
      reviewedByEmail: opts.reviewedByEmail,
    },
    include: { invoice: true },
  })

  await logPlatformActivity({
    eventType: 'PAYMENT_REJECTED',
    severity: 'WARN',
    actorType: 'ADMIN',
    actor: opts.reviewedByEmail ?? opts.reviewedById ?? 'admin',
    target: payment.tenant.name,
    details: `Payment ${payment.id} rejected · invoice ${payment.invoice.invoiceNumber} · ${reason}`,
    tenantId: payment.tenantId,
    userId: opts.reviewedById,
  })

  return updated
}

/**
 * Idempotent job step: refresh OVERDUE flags and suspend past grace.
 * Does NOT deactivate users or revoke sessions (login + billing must work).
 */
export async function processBillingLifecycle(now = new Date()): Promise<{
  overdueMarked: number
  graceLogged: number
  suspended: number
}> {
  const config = await getBillingConfig()
  let overdueMarked = 0
  let graceLogged = 0
  let suspended = 0

  const openInvoices = await prisma.subscriptionInvoice.findMany({
    where: { status: { in: ['PENDING', 'OVERDUE'] } },
    include: { tenant: { select: { id: true, name: true, status: true, slug: true } } },
  })

  for (const inv of openInvoices) {
    if (inv.tenant.slug === BILLING_SLUG) continue
    if (inv.tenant.status === 'CANCELLED') continue

    const nextStatus = resolveInvoiceStatus(inv.status as any, inv.dueDate, now, config.graceDays)

    if (nextStatus === 'OVERDUE' && inv.status !== 'OVERDUE') {
      await prisma.subscriptionInvoice.update({
        where: { id: inv.id },
        data: { status: 'OVERDUE' },
      })
      overdueMarked += 1

      if (isInGracePeriod(now, inv.dueDate, config.graceDays)) {
        await logPlatformActivity({
          eventType: 'GRACE_PERIOD_STARTED',
          severity: 'WARN',
          actorType: 'SYSTEM',
          actor: 'billing-lifecycle-job',
          target: inv.tenant.name,
          details: `Invoice ${inv.invoiceNumber} overdue · grace ${config.graceDays}d · ${graceDaysRemaining(now, inv.dueDate, config.graceDays)}d remaining`,
          tenantId: inv.tenantId,
        })
        graceLogged += 1
      } else {
        await logPlatformActivity({
          eventType: 'INVOICE_OVERDUE',
          severity: 'WARN',
          actorType: 'SYSTEM',
          actor: 'billing-lifecycle-job',
          target: inv.tenant.name,
          details: `Invoice ${inv.invoiceNumber} marked OVERDUE · due ${toColomboDateKey(inv.dueDate)}`,
          tenantId: inv.tenantId,
        })
      }
    }

    if (isPastSuspension(now, inv.dueDate, config.graceDays)) {
      if (inv.tenant.status !== 'SUSPENDED') {
        await prisma.$transaction([
          prisma.tenant.update({
            where: { id: inv.tenantId },
            data: { status: 'SUSPENDED', paymentDue: true },
          }),
        ])
        await syncTenantPaymentDueFlags(inv.tenantId)
        await logPlatformActivity({
          eventType: 'ACCOUNT_SUSPENDED',
          severity: 'WARN',
          actorType: 'SYSTEM',
          actor: 'billing-lifecycle-job',
          target: inv.tenant.name,
          details: `Suspended after grace · invoice ${inv.invoiceNumber} · due ${toColomboDateKey(inv.dueDate)} · unpaid Rs.${inv.total.toLocaleString('en-LK')}`,
          tenantId: inv.tenantId,
        })
        suspended += 1
        console.log(`[billing-lifecycle] suspended ${inv.tenant.name} (${inv.invoiceNumber})`)
      }
    }
  }

  return { overdueMarked, graceLogged, suspended }
}

export async function listAdminPayments(opts: {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  search?: string
  limit?: number
} = {}) {
  const where: Prisma.SubscriptionPaymentWhereInput = {}
  if (opts.status && opts.status !== 'ALL') where.status = opts.status
  if (opts.search?.trim()) {
    const q = opts.search.trim()
    where.OR = [
      { transactionRef: { contains: q, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
      { tenant: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const rows = await prisma.subscriptionPayment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 100,
    include: {
      tenant: { select: { id: true, name: true, ownerName: true, ownerEmail: true, plan: true, status: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          dueDate: true,
          billingPeriodStart: true,
          billingPeriodEnd: true,
        },
      },
    },
  })

  const users = await resolveUserMap(rows.flatMap(r => [r.submittedById, r.reviewedById].filter(Boolean) as string[]))
  return rows.map(row => {
    const enriched = attachPayerFields(row, users, row.tenant.ownerName || row.tenant.name)
    return {
      ...row,
      ...enriched,
      submittedByName: enriched.paidByName,
    }
  })
}
