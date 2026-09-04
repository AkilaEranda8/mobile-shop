/**
 * HelaPOS LankaQR sessions for SaaS subscription invoices.
 * Creates PENDING SubscriptionPayment (channel HELAPOS) and auto-approves on webhook success.
 *
 * Fee handling: QR amount may be grossed-up so Hexalyte nets the invoice total after HelaPOS fees.
 * Invoice.total / subscription revenue is never changed by the fee.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { logPlatformActivity } from '../../utils/activity-log'
import {
  createHelaposQr,
  getHelaposPublicConfig,
  helaposNotifyUrl,
  helaposSessionExpiresAt,
  isHelaposEnabled,
  isHelaposIpAllowed,
  isHelaposMockMode,
  parseHelaposWebhook,
  verifyHelaposWebhookSignature,
} from './helapos.client'
import { calculateHelaposCustomerPayable, type HelaposFeeBreakdown } from './helapos-fees'
import { approveSubscriptionPayment } from './billing.service'

const REF_PREFIX = 'HXHP'

export { getHelaposPublicConfig, helaposNotifyUrl }

export function buildHelaposReference(paymentId: string) {
  return `${REF_PREFIX}_${paymentId}`
}

export function parsePaymentIdFromReference(reference: string | null | undefined): string | null {
  if (!reference) return null
  const trimmed = reference.trim()
  if (trimmed.startsWith(`${REF_PREFIX}_`)) return trimmed.slice(REF_PREFIX.length + 1)
  if (/^[a-z0-9]{20,}$/i.test(trimmed)) return trimmed
  return null
}

function feeFieldsFromBreakdown(fee: HelaposFeeBreakdown) {
  return {
    amount: fee.customerPayableAmount,
    subscriptionAmount: fee.subscriptionAmount,
    processingFee: fee.processingFee,
    customerPayableAmount: fee.customerPayableAmount,
    settlementAmount: fee.expectedSettlementAmount,
  }
}

function feeSummary(fee: HelaposFeeBreakdown) {
  return {
    subscriptionAmount: fee.subscriptionAmount,
    processingFee: fee.processingFee,
    customerPayableAmount: fee.customerPayableAmount,
    expectedSettlementAmount: fee.expectedSettlementAmount,
    feeApplies: fee.feeApplies,
    feeRate: fee.feeRate,
  }
}

/** Preview fee breakdown for an invoice without creating a payment (UI). */
export async function quoteHelaposFeeForInvoice(opts: {
  tenantId: string
  invoiceId: string
}) {
  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { id: opts.invoiceId, tenantId: opts.tenantId },
    select: { id: true, invoiceNumber: true, total: true, status: true },
  })
  if (!invoice) throw new AppError('Invoice not found', 404)
  const fee = calculateHelaposCustomerPayable(invoice.total)
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceStatus: invoice.status,
    ...feeSummary(fee),
  }
}

export async function createHelaposQrSession(opts: {
  tenantId: string
  invoiceId: string
  submittedById?: string
}) {
  if (!(await isHelaposEnabled())) {
    throw new AppError(
      'LankaQR is not enabled. Set HELAPOS_ENABLED=true and App ID/Secret (or HELAPOS_MOCK=true).',
      503,
    )
  }

  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { id: opts.invoiceId, tenantId: opts.tenantId },
  })
  if (!invoice) throw new AppError('Invoice not found', 404)
  if (invoice.status === 'PAID') throw new AppError('Invoice is already paid', 400)
  if (invoice.status === 'CANCELLED') throw new AppError('Invoice is cancelled', 400)

  // Fee is computed from invoice.total (subscription net). Invoice row is never mutated.
  const fee = calculateHelaposCustomerPayable(invoice.total)
  const feeData = feeFieldsFromBreakdown(fee)

  // Reuse existing pending HELAPOS payment for this invoice; block other pending channels
  const pending = await prisma.subscriptionPayment.findFirst({
    where: { invoiceId: invoice.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })

  if (pending && pending.channel !== 'HELAPOS') {
    throw new AppError(
      'A payment is already pending review for this invoice. Wait for admin approval or rejection.',
      409,
    )
  }

  let payment = pending
  if (!payment) {
    payment = await prisma.subscriptionPayment.create({
      data: {
        tenantId: opts.tenantId,
        invoiceId: invoice.id,
        ...feeData,
        channel: 'HELAPOS',
        methodLabel: 'LankaQR (HelaPOS)',
        paymentDate: new Date(),
        status: 'PENDING',
        submittedById: opts.submittedById,
        notes: (await isHelaposMockMode())
          ? 'HelaPOS mock session'
          : fee.feeApplies
            ? `HelaPOS QR session · fee ${fee.processingFee.toFixed(2)} on net ${fee.subscriptionAmount.toFixed(2)}`
            : 'HelaPOS QR session',
      },
    })
  }

  const reference = buildHelaposReference(payment.id)
  const notifyUrl = helaposNotifyUrl()
  const expiresAt = await helaposSessionExpiresAt()

  // QR amount = customer payable (gross), not invoice.total
  const qr = await createHelaposQr({
    amount: fee.customerPayableAmount,
    reference,
    notifyUrl,
    description: `Hexalyte subscription ${invoice.invoiceNumber}`,
    invoiceNumber: invoice.invoiceNumber,
  })

  const gatewayPayload: Prisma.InputJsonValue = {
    reference,
    notifyUrl,
    mock: qr.mock,
    gatewayTxnId: qr.gatewayTxnId ?? null,
    qrPayload: qr.qrPayload,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    fee: feeSummary(fee),
    rawCreate: qr.raw as Prisma.InputJsonValue,
  }

  payment = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      transactionRef: reference,
      gatewayPayload,
      ...feeData,
      paymentDate: new Date(),
      notes: (await isHelaposMockMode())
        ? 'HelaPOS mock session'
        : fee.feeApplies
          ? `HelaPOS QR · pay ${fee.customerPayableAmount.toFixed(2)} (net ${fee.subscriptionAmount.toFixed(2)} + fee ${fee.processingFee.toFixed(2)})`
          : 'HelaPOS QR session',
    },
  })

  await logPlatformActivity({
    eventType: 'PAYMENT_SUBMITTED',
    severity: 'INFO',
    actorType: 'USER',
    actor: opts.submittedById ?? 'tenant-user',
    target: opts.tenantId,
    details: `HelaPOS QR session ${payment.id} · invoice ${invoice.invoiceNumber} · subscription Rs.${fee.subscriptionAmount.toLocaleString('en-LK')} · payable Rs.${fee.customerPayableAmount.toLocaleString('en-LK')}${fee.feeApplies ? ` · fee Rs.${fee.processingFee.toLocaleString('en-LK')}` : ''}${qr.mock ? ' · MOCK' : ''}`,
    tenantId: opts.tenantId,
    userId: opts.submittedById,
  })

  return {
    paymentId: payment.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    /** @deprecated use customerPayableAmount — kept for older clients */
    amount: fee.customerPayableAmount,
    reference,
    qrPayload: qr.qrPayload,
    mock: qr.mock,
    status: payment.status,
    notifyUrl,
    expiresAt: expiresAt.toISOString(),
    ...feeSummary(fee),
  }
}

export async function getHelaposPaymentStatus(opts: {
  tenantId: string
  paymentId: string
}) {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: opts.paymentId, tenantId: opts.tenantId, channel: 'HELAPOS' },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, status: true, total: true, paidAt: true } },
    },
  })
  if (!payment) throw new AppError('Payment not found', 404)

  const payload = (payment.gatewayPayload && typeof payment.gatewayPayload === 'object'
    ? payment.gatewayPayload as Record<string, unknown>
    : {}) as Record<string, unknown>

  const subscriptionAmount = payment.subscriptionAmount ?? payment.invoice.total
  const customerPayableAmount = payment.customerPayableAmount ?? payment.amount
  const processingFee = payment.processingFee ?? Math.max(0, customerPayableAmount - subscriptionAmount)

  return {
    paymentId: payment.id,
    status: payment.status,
    amount: customerPayableAmount,
    subscriptionAmount,
    processingFee,
    customerPayableAmount,
    settlementAmount: payment.settlementAmount ?? subscriptionAmount,
    feeApplies: processingFee > 0,
    reference: payment.transactionRef,
    invoice: payment.invoice,
    qrPayload: typeof payload.qrPayload === 'string' ? payload.qrPayload : null,
    mock: payload.mock === true,
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : null,
    expired: typeof payload.expiresAt === 'string' ? new Date(payload.expiresAt).getTime() < Date.now() : false,
    paid: payment.status === 'APPROVED' || payment.invoice.status === 'PAID',
  }
}

/**
 * Public webhook handler. Idempotent: already-approved payments return ok.
 */
export async function handleHelaposWebhook(opts: {
  body: unknown
  rawBody?: string | Buffer
  headers: Record<string, string | string[] | undefined>
  ip?: string
}) {
  if (!(await isHelaposIpAllowed(opts.ip))) {
    await logPlatformActivity({
      eventType: 'SECURITY_ALERT',
      severity: 'WARN',
      actorType: 'SYSTEM',
      actor: 'helapos-webhook',
      target: opts.ip || 'unknown',
      details: 'HelaPOS webhook rejected — IP not allowlisted',
    }).catch(() => {})
    throw new AppError('Forbidden', 403)
  }

  if (opts.rawBody != null) {
    const sig = await verifyHelaposWebhookSignature(opts.rawBody, opts.headers)
    if (!sig.ok) {
      await logPlatformActivity({
        eventType: 'SECURITY_ALERT',
        severity: 'WARN',
        actorType: 'SYSTEM',
        actor: 'helapos-webhook',
        target: opts.ip || 'unknown',
        details: `HelaPOS webhook signature failed · ${sig.reason || 'invalid'}`,
      }).catch(() => {})
      throw new AppError('Unauthorized', 401)
    }
  } else if (!(await isHelaposMockMode())) {
    // Live path without raw body cannot verify HMAC — refuse in non-mock
    const liveNeedsSig = await verifyHelaposWebhookSignature('', opts.headers)
    if (!liveNeedsSig.ok && liveNeedsSig.reason === 'webhook_secret_required') {
      throw new AppError('Unauthorized', 401)
    }
  }

  const parsed = parseHelaposWebhook(opts.body)
  const paymentId = parsePaymentIdFromReference(parsed.reference)

  if (!paymentId) {
    console.warn('[helapos-webhook] missing/unknown reference', JSON.stringify(parsed.raw).slice(0, 500))
    return { ok: false, reason: 'unknown_reference' }
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { invoice: true, tenant: { select: { id: true, name: true } } },
  })

  if (!payment || payment.channel !== 'HELAPOS') {
    console.warn('[helapos-webhook] payment not found', paymentId)
    return { ok: false, reason: 'payment_not_found' }
  }

  if (payment.status === 'APPROVED') {
    return { ok: true, alreadyApproved: true, paymentId: payment.id }
  }

  if (payment.status === 'REJECTED') {
    return { ok: false, reason: 'payment_rejected' }
  }

  const prev = (payment.gatewayPayload && typeof payment.gatewayPayload === 'object'
    ? payment.gatewayPayload as Record<string, unknown>
    : {})

  // Reject expired QR sessions (except already approved above)
  if (typeof prev.expiresAt === 'string' && new Date(prev.expiresAt).getTime() < Date.now()) {
    await logPlatformActivity({
      eventType: 'SECURITY_ALERT',
      severity: 'WARN',
      actorType: 'SYSTEM',
      actor: 'helapos-webhook',
      target: payment.tenant.name,
      details: `HelaPOS webhook for expired session ${payment.id}`,
      tenantId: payment.tenantId,
    }).catch(() => {})
    return { ok: false, reason: 'session_expired' }
  }

  if (!parsed.success) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        gatewayPayload: {
          ...prev,
          lastWebhook: parsed.raw,
          lastWebhookAt: new Date().toISOString(),
          lastWebhookStatus: parsed.status,
        } as Prisma.InputJsonValue,
      },
    })
    return { ok: true, paid: false, paymentId: payment.id, status: parsed.status }
  }

  // Live success must include amount (prevents forged "paid" without amount)
  if (!(await isHelaposMockMode()) && parsed.amount == null) {
    throw new AppError('Webhook amount required', 400)
  }

  // Match against customer payable (gross QR amount), not invoice.total
  const expectedPayable = payment.customerPayableAmount ?? payment.amount
  if (parsed.amount != null && Math.abs(parsed.amount - expectedPayable) > 0.5) {
    console.warn('[helapos-webhook] amount mismatch', {
      expected: expectedPayable,
      got: parsed.amount,
      subscriptionAmount: payment.subscriptionAmount ?? payment.invoice.total,
      paymentId: payment.id,
    })
    await logPlatformActivity({
      eventType: 'SECURITY_ALERT',
      severity: 'WARN',
      actorType: 'SYSTEM',
      actor: 'helapos-webhook',
      target: payment.tenant.name,
      details: `HelaPOS amount mismatch · expected payable ${expectedPayable} got ${parsed.amount}`,
      tenantId: payment.tenantId,
    }).catch(() => {})
    throw new AppError('Webhook amount does not match invoice payment', 400)
  }

  // Gateway txn idempotency — block reuse across payments
  if (parsed.gatewayTxnId) {
    const reused = await prisma.subscriptionPayment.findFirst({
      where: {
        id: { not: payment.id },
        channel: 'HELAPOS',
        status: 'APPROVED',
        OR: [
          { transactionRef: parsed.gatewayTxnId },
          { gatewayPayload: { path: ['gatewayTxnId'], equals: parsed.gatewayTxnId } },
        ],
      },
      select: { id: true },
    })
    if (reused) {
      await logPlatformActivity({
        eventType: 'SECURITY_ALERT',
        severity: 'WARN',
        actorType: 'SYSTEM',
        actor: 'helapos-webhook',
        target: payment.tenant.name,
        details: `HelaPOS txn reuse blocked · ${parsed.gatewayTxnId}`,
        tenantId: payment.tenantId,
      }).catch(() => {})
      throw new AppError('Duplicate gateway transaction', 409)
    }
  }

  const subscriptionAmount = payment.subscriptionAmount ?? payment.invoice.total
  const processingFee = payment.processingFee ?? Math.max(0, expectedPayable - subscriptionAmount)
  // Prefer gateway-reported settlement if present; else expected net = subscription revenue
  const settlementAmount =
    typeof (parsed.raw as any)?.settlement_amount === 'number'
      ? Number((parsed.raw as any).settlement_amount)
      : typeof (parsed.raw as any)?.settled_amount === 'number'
        ? Number((parsed.raw as any).settled_amount)
        : subscriptionAmount

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      transactionRef: parsed.gatewayTxnId || payment.transactionRef || buildHelaposReference(payment.id),
      subscriptionAmount,
      processingFee,
      customerPayableAmount: expectedPayable,
      settlementAmount,
      amount: expectedPayable,
      gatewayPayload: {
        ...prev,
        lastWebhook: parsed.raw,
        lastWebhookAt: new Date().toISOString(),
        gatewayTxnId: parsed.gatewayTxnId,
        paidViaWebhook: true,
        verifiedIp: opts.ip || null,
        accounting: {
          subscriptionRevenue: subscriptionAmount,
          customerPaid: expectedPayable,
          processingFee,
          settlementAmount,
        },
      } as Prisma.InputJsonValue,
      notes: `HelaPOS paid · customer ${expectedPayable.toFixed(2)} · subscription revenue ${subscriptionAmount.toFixed(2)} · fee ${processingFee.toFixed(2)}${parsed.gatewayTxnId ? ` · txn ${parsed.gatewayTxnId}` : ''}`,
    },
  })

  // Marks invoice PAID; invoice.total (subscription revenue) unchanged
  await approveSubscriptionPayment({
    paymentId: payment.id,
    reviewedByEmail: 'helapos-webhook',
    reviewedById: undefined,
  })

  await logPlatformActivity({
    eventType: 'PAYMENT_APPROVED',
    severity: 'INFO',
    actorType: 'SYSTEM',
    actor: 'helapos-webhook',
    target: payment.tenant.name,
    details: `HelaPOS auto-approved ${payment.id} · invoice ${payment.invoice.invoiceNumber} · revenue Rs.${subscriptionAmount.toLocaleString('en-LK')} · customer paid Rs.${expectedPayable.toLocaleString('en-LK')}`,
    tenantId: payment.tenantId,
  })

  return {
    ok: true,
    paid: true,
    paymentId: payment.id,
    subscriptionAmount,
    customerPayableAmount: expectedPayable,
    processingFee,
    settlementAmount,
  }
}

/** Dev / mock helper: simulate successful pay for a pending HELAPOS session */
export async function simulateHelaposPayment(opts: {
  tenantId: string
  paymentId: string
}) {
  if (!(await isHelaposMockMode())) {
    throw new AppError('Mock pay only allowed when HELAPOS_MOCK=true (or credentials missing)', 403)
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: opts.paymentId, tenantId: opts.tenantId, channel: 'HELAPOS' },
  })
  if (!payment) throw new AppError('Payment not found', 404)

  const payable = payment.customerPayableAmount ?? payment.amount

  return handleHelaposWebhook({
    body: {
      reference: buildHelaposReference(payment.id),
      status: 'SUCCESS',
      amount: payable,
      transaction_id: `mock_pay_${Date.now()}`,
    },
    headers: {},
  })
}
