import { getTenantConfig } from '../configuration-engine/configuration-engine.service'
import type { InvoiceSettings } from '../tenants/invoice-settings.util'
import { formatLkr, renderAndSendTemplatedSms } from './sms.service'

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
