import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getTenantConfig } from '../configuration-engine/configuration-engine.service'
import type { InvoiceSettings } from '../tenants/invoice-settings.util'
import { DEFAULT_SMS_SALE_BODY, DEFAULT_SMS_REPAIR_BODY } from './sms-template.util'
import type { SmsSettings } from './sms-settings.util'
import { formatLkr, renderAndSendTemplatedSms, renderSmsTemplate, sendSms } from './sms.service'

async function shopNameForTenant(tenantId: string): Promise<string> {
  try {
    const inv = await getTenantConfig<InvoiceSettings>(tenantId, 'invoice')
    return String(inv.shopName || '').trim() || 'Our shop'
  } catch {
    return 'Our shop'
  }
}

export async function notifySaleSms(opts: {
  tenantId: string
  customerPhone?: string | null
  customerName?: string | null
  invoiceNumber: string
  total: number
  paidAmount: number
  dueAmount: number
  branchId?: string
}): Promise<void> {
  const shopName = await shopNameForTenant(opts.tenantId)
  await renderAndSendTemplatedSms({
    tenantId: opts.tenantId,
    templateKey: 'sale',
    phone: opts.customerPhone,
    branchId: opts.branchId,
    amount: opts.total,
    vars: {
      shopName,
      customerName: opts.customerName?.trim() || 'Customer',
      invoiceNumber: opts.invoiceNumber,
      ticketNumber: opts.invoiceNumber,
      referenceId: opts.invoiceNumber,
      totalAmount: formatLkr(opts.total),
      paidAmount: formatLkr(opts.paidAmount),
      dueAmount: formatLkr(opts.dueAmount),
    },
  })
}

export async function notifyRepairSms(opts: {
  tenantId: string
  customerPhone?: string | null
  customerName?: string | null
  ticketNumber: string
  total: number
  paidAmount: number
  dueAmount: number
  branchId?: string
}): Promise<void> {
  const shopName = await shopNameForTenant(opts.tenantId)
  await renderAndSendTemplatedSms({
    tenantId: opts.tenantId,
    templateKey: 'repair',
    phone: opts.customerPhone,
    branchId: opts.branchId,
    amount: opts.total,
    vars: {
      shopName,
      customerName: opts.customerName?.trim() || 'Customer',
      invoiceNumber: opts.ticketNumber,
      ticketNumber: opts.ticketNumber,
      referenceId: opts.ticketNumber,
      totalAmount: formatLkr(opts.total),
      paidAmount: formatLkr(opts.paidAmount),
      dueAmount: formatLkr(opts.dueAmount),
    },
  })
}

export async function notifyHpReminderSms(opts: {
  tenantId: string
  customerPhone?: string | null
  customerName?: string | null
  agreementNumber: string
  dueAmount: number
  branchId?: string
}): Promise<void> {
  const shopName = await shopNameForTenant(opts.tenantId)
  await renderAndSendTemplatedSms({
    tenantId: opts.tenantId,
    templateKey: 'hpReminder',
    phone: opts.customerPhone,
    branchId: opts.branchId,
    amount: opts.dueAmount,
    vars: {
      shopName,
      customerName: opts.customerName?.trim() || 'Customer',
      referenceId: opts.agreementNumber,
      invoiceNumber: opts.agreementNumber,
      ticketNumber: opts.agreementNumber,
      totalAmount: formatLkr(opts.dueAmount),
      paidAmount: formatLkr(0),
      dueAmount: formatLkr(opts.dueAmount),
    },
  })
}

export async function notifyCreditReminderSms(opts: {
  tenantId: string
  customerId: string
  customerPhone?: string | null
  customerName?: string | null
  dueAmount: number
  invoiceCount: number
  oldestDueDate: string
  branchId?: string
}): Promise<void> {
  const shopName = await shopNameForTenant(opts.tenantId)
  await renderAndSendTemplatedSms({
    tenantId: opts.tenantId,
    templateKey: 'creditReminder',
    phone: opts.customerPhone,
    branchId: opts.branchId,
    amount: opts.dueAmount,
    vars: {
      shopName,
      customerName: opts.customerName?.trim() || 'Customer',
      referenceId: opts.customerId,
      invoiceNumber: opts.customerId,
      ticketNumber: opts.customerId,
      totalAmount: formatLkr(opts.dueAmount),
      paidAmount: formatLkr(0),
      dueAmount: formatLkr(opts.dueAmount),
      invoiceCount: opts.invoiceCount,
      oldestDueDate: opts.oldestDueDate,
    },
  })
}

export async function notifyDeliverySms(opts: {
  tenantId: string
  customerPhone?: string | null
  customerName?: string | null
  orderNumber: string
  message: string
  branchId?: string
}): Promise<void> {
  const shopName = await shopNameForTenant(opts.tenantId)
  await renderAndSendTemplatedSms({
    tenantId: opts.tenantId,
    templateKey: 'delivery',
    phone: opts.customerPhone,
    branchId: opts.branchId,
    vars: {
      shopName,
      customerName: opts.customerName?.trim() || 'Customer',
      referenceId: opts.orderNumber,
      invoiceNumber: opts.orderNumber,
      ticketNumber: opts.orderNumber,
      message: opts.message,
      totalAmount: formatLkr(0),
      paidAmount: formatLkr(0),
      dueAmount: formatLkr(0),
    },
  })
}

/** POS manual send — uses sale SMS template for an existing sale invoice. */
export async function sendSaleSmsForPos(opts: {
  tenantId: string
  saleId: string
  phone?: string
  branchId?: string
}): Promise<{ to: string; messageId?: string; segments: number }> {
  const sale = await prisma.sale.findFirst({
    where: { id: opts.saleId, tenantId: opts.tenantId },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      customerPhone: true,
      customerId: true,
      total: true,
      paidAmount: true,
      dueAmount: true,
      branchId: true,
    },
  })
  if (!sale) throw new AppError('Sale not found', 404)

  let phone = String(opts.phone ?? sale.customerPhone ?? '').trim()
  if (!phone && sale.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: sale.customerId, tenantId: opts.tenantId },
      select: { phone: true },
    })
    phone = String(c?.phone ?? '').trim()
  }
  if (!phone) throw new AppError('Customer phone required for SMS', 400)

  const settings = await getTenantConfig<SmsSettings>(opts.tenantId, 'sms', { bypassCache: true })
  if (!settings.enabled) throw new AppError('SMS gateway is disabled — enable it in SMS settings', 400)
  const tpl = settings.templates?.sale
  if (!tpl?.enabled) throw new AppError('Sale SMS template is disabled in SMS settings', 400)

  const shopName = await shopNameForTenant(opts.tenantId)
  const vars = {
    shopName,
    customerName: sale.customerName?.trim() || 'Customer',
    invoiceNumber: sale.invoiceNumber,
    ticketNumber: sale.invoiceNumber,
    referenceId: sale.invoiceNumber,
    totalAmount: formatLkr(Number(sale.total)),
    paidAmount: formatLkr(Number(sale.paidAmount)),
    dueAmount: formatLkr(Number(sale.dueAmount ?? 0)),
  }
  const message = renderSmsTemplate(tpl.body || DEFAULT_SMS_SALE_BODY, vars)
  if (!message.trim()) throw new AppError('Sale SMS template is empty', 400)

  return sendSms(opts.tenantId, phone, message, {
    eventType: 'sale',
    referenceId: sale.invoiceNumber,
    branchId: opts.branchId ?? sale.branchId ?? undefined,
    customerName: sale.customerName ?? undefined,
    amount: Number(sale.total),
  })
}

/** Repair ticket manual send — uses repair SMS template. */
export async function sendRepairSmsForTicket(opts: {
  tenantId: string
  repairId: string
  phone?: string
  branchId?: string
}): Promise<{ to: string; messageId?: string; segments: number }> {
  const ticket = await prisma.repairTicket.findFirst({
    where: { id: opts.repairId, tenantId: opts.tenantId },
    select: {
      id: true,
      ticketNumber: true,
      customerName: true,
      customerPhone: true,
      customerId: true,
      estimatedCost: true,
      actualCost: true,
      paidAmount: true,
      dueAmount: true,
      branchId: true,
    },
  })
  if (!ticket) throw new AppError('Repair ticket not found', 404)

  let phone = String(opts.phone ?? ticket.customerPhone ?? '').trim()
  if (!phone && ticket.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: ticket.customerId, tenantId: opts.tenantId },
      select: { phone: true },
    })
    phone = String(c?.phone ?? '').trim()
  }
  if (!phone) throw new AppError('Customer phone required for SMS', 400)

  const settings = await getTenantConfig<SmsSettings>(opts.tenantId, 'sms', { bypassCache: true })
  if (!settings.enabled) throw new AppError('SMS gateway is disabled — enable it in SMS settings', 400)
  const tpl = settings.templates?.repair
  if (!tpl?.enabled) throw new AppError('Repair SMS template is disabled in SMS settings', 400)

  const shopName = await shopNameForTenant(opts.tenantId)
  const total = Number(ticket.actualCost ?? ticket.estimatedCost ?? 0)
  const paidAmount = Number(ticket.paidAmount ?? 0)
  const dueAmount = Number(ticket.dueAmount ?? 0)
  const vars = {
    shopName,
    customerName: ticket.customerName?.trim() || 'Customer',
    invoiceNumber: ticket.ticketNumber,
    ticketNumber: ticket.ticketNumber,
    referenceId: ticket.ticketNumber,
    totalAmount: formatLkr(total),
    paidAmount: formatLkr(paidAmount),
    dueAmount: formatLkr(dueAmount),
  }
  const message = renderSmsTemplate(tpl.body || DEFAULT_SMS_REPAIR_BODY, vars)
  if (!message.trim()) throw new AppError('Repair SMS template is empty', 400)

  return sendSms(opts.tenantId, phone, message, {
    eventType: 'repair',
    referenceId: ticket.ticketNumber,
    branchId: opts.branchId ?? ticket.branchId ?? undefined,
    customerName: ticket.customerName ?? undefined,
    amount: total,
  })
}
