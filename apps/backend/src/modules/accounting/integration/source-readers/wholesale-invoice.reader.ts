import { prisma } from '../../../../config/database'

export async function readWholesaleInvoiceForAccounting(tenantId: string, invoiceId: string) {
  return prisma.wholesaleInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      lines: { include: { product: { include: { category: true } } } },
      payments: true,
      dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true } },
    },
  })
}

export async function readWholesaleCreditNoteForAccounting(tenantId: string, creditNoteId: string) {
  return prisma.wholesaleCreditNote.findFirst({
    where: { id: creditNoteId, tenantId },
    include: {
      lines: true,
      dealer: { select: { id: true, legalName: true, tradingName: true } },
    },
  })
}

export async function readDealerPaymentForAccounting(tenantId: string, paymentId: string) {
  return prisma.dealerPayment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      dealer: { select: { id: true, legalName: true, tradingName: true } },
      allocations: true,
    },
  })
}
