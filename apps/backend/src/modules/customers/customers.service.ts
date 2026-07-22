import { prisma } from '../../config/database'
import { PaymentMethod, Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'
import { emitOpeningCustomerArAccounting } from '../accounting/integration/accounting-events.service'
import { effectiveBranchId } from '../../utils/active-branch'

const round2 = (n: number) => Math.round(n * 100) / 100

type CustomerRow = {
  id: string
  totalDue: number
  [key: string]: unknown
}

/** When a branch is active, expose that branch's open invoice due as totalDue. */
async function attachBranchDue<T extends CustomerRow>(
  tenantId: string,
  customers: T[],
  branchId?: string,
): Promise<Array<T & { branchDue: number; tenantDue: number }>> {
  if (!customers.length) return []
  if (!branchId) {
    return customers.map(c => ({
      ...c,
      tenantDue: c.totalDue,
      branchDue: c.totalDue,
    }))
  }

  const dues = await prisma.sale.groupBy({
    by: ['customerId'],
    where: {
      tenantId,
      branchId,
      customerId: { in: customers.map(c => c.id) },
      dueAmount: { gt: 0 },
    },
    _sum: { dueAmount: true },
  })
  const dueMap = new Map(
    dues
      .filter(d => d.customerId)
      .map(d => [d.customerId as string, round2(d._sum.dueAmount ?? 0)]),
  )

  return customers.map(c => {
    const branchDue = dueMap.get(c.id) ?? 0
    return {
      ...c,
      tenantDue: c.totalDue,
      branchDue,
      totalDue: branchDue,
    }
  })
}

const CUSTOMER_LIST_SELECT = {
  id: true,
  tenantId: true,
  branchId: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  loyaltyPoints: true,
  totalPurchases: true,
  totalDue: true,
  totalRepairs: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

export const customersService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const status = String(req.query.status || 'active').toLowerCase()
    const where: any = {
      tenantId,
      ...(branchId ? { branchId } : {}),
      ...(status === 'inactive' ? { isActive: false }
        : status === 'all' ? {}
        : { isActive: true }),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] }),
    }
    const [raw, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: CUSTOMER_LIST_SELECT,
      }),
      prisma.customer.count({ where }),
    ])
    const data = await attachBranchDue(tenantId, raw, branchId)
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string, req?: Request) {
    const branchId = req ? effectiveBranchId(req) : undefined
    const c = await prisma.customer.findFirst({
      where: {
        id,
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        sales: {
          where: branchId ? { branchId } : undefined,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
        repairs: {
          where: branchId ? { branchId } : undefined,
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!c) throw new AppError('Customer not found', 404)
    const [annotated] = await attachBranchDue(tenantId, [c], branchId)
    return annotated
  },

  async create(tenantId: string, body: any, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    if (!name) throw new AppError('Customer name is required', 400)
    if (!phone) throw new AppError('Phone number is required', 400)

    let branchId = body.branchId ? String(body.branchId) : undefined
    if (!branchId) {
      const branch = await prisma.branch.findFirst({
        where: { tenantId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
      branchId = branch?.id
    }
    if (!branchId) throw new AppError('Branch is required to create a customer', 400)

    const existing = await prisma.customer.findFirst({ where: { tenantId, phone } })
    if (existing) throw new AppError('Phone number already registered', 409)

    const openingDue = Math.max(0, Number(body.openingDue ?? body.totalDue) || 0)
    const email = body.email != null ? String(body.email).trim() || null : null
    const address = body.address != null ? String(body.address).trim() || null : null
    const city = body.city != null ? String(body.city).trim() || null : null
    const notes = body.notes != null ? String(body.notes).trim() || null : null

    if (openingDue <= 0) {
      return prisma.customer.create({
        data: { tenantId, branchId, name, phone, email, address, city, notes, totalDue: 0 },
      })
    }

    const due = round2(openingDue)

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const customer = await tx.customer.create({
        data: { tenantId, branchId, name, phone, email, address, city, notes, totalDue: due },
      })

      const invoiceNumber = await generateInvoiceNumber(tenantId)
      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          invoiceNumber,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          subtotal: due,
          discount: 0,
          tax: 0,
          total: due,
          paidAmount: 0,
          dueAmount: due,
          status: 'DUE',
          cashierName: 'System',
          source: 'OPENING_BALANCE',
          notes: 'Opening / prior customer credit brought into the system',
          items: {
            create: [{
              productName: 'Opening customer credit',
              quantity: 1,
              unitPrice: due,
              total: due,
            }],
          },
          payments: {
            create: [{ method: 'CREDIT', amount: due, reference: 'Opening balance' }],
          },
        },
      })

      return { customer, openingSaleId: sale.id }
    })

    const accounting = await emitOpeningCustomerArAccounting(
      tenantId,
      created.openingSaleId,
      branchId,
      actorEmail,
    )
    return { ...created.customer, accounting }
  },

  async update(tenantId: string, id: string, body: any) {
    const c = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!c) throw new AppError('Customer not found', 404)

    const name = typeof body.name === 'string' ? body.name.trim() : c.name
    const phone = typeof body.phone === 'string' ? body.phone.trim() : c.phone
    if (!name) throw new AppError('Customer name is required', 400)
    if (!phone) throw new AppError('Phone number is required', 400)

    if (phone !== c.phone) {
      const duplicate = await prisma.customer.findFirst({
        where: { tenantId, phone, id: { not: id } },
        select: { id: true },
      })
      if (duplicate) throw new AppError('Phone number already registered', 409)
    }

    return prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        ...(body.email !== undefined ? { email: String(body.email).trim() || null } : {}),
        ...(body.address !== undefined ? { address: String(body.address).trim() || null } : {}),
        ...(body.city !== undefined ? { city: String(body.city).trim() || null } : {}),
        ...(body.notes !== undefined ? { notes: String(body.notes).trim() || null } : {}),
      },
    })
  },

  async search(tenantId: string, q: string, req?: Request) {
    const branchId = req ? effectiveBranchId(req) : undefined
    const raw = await prisma.customer.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
      },
      take: 10,
      select: CUSTOMER_LIST_SELECT,
    })
    return attachBranchDue(tenantId, raw, branchId)
  },

  async setActive(tenantId: string, id: string, isActive: boolean) {
    const existing = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true, isActive: true, name: true } })
    if (!existing) throw new AppError('Customer not found', 404)
    if (existing.isActive === isActive) {
      return prisma.customer.findFirst({ where: { id, tenantId }, select: CUSTOMER_LIST_SELECT })
    }
    return prisma.customer.update({
      where: { id },
      data: { isActive },
      select: CUSTOMER_LIST_SELECT,
    })
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            sales: true,
            repairs: true,
            warranties: true,
            exchanges: true,
            imeiRecords: true,
          },
        },
      },
    })
    if (!existing) throw new AppError('Customer not found', 404)

    const linked =
      existing._count.sales
      + existing._count.repairs
      + existing._count.warranties
      + existing._count.exchanges
      + existing._count.imeiRecords

    if (linked > 0) {
      throw new AppError(
        'Cannot delete this customer because they have sales, repairs, or other history. Deactivate them instead.',
        409,
      )
    }

    await prisma.customer.delete({ where: { id } })
    return { id, deleted: true }
  },

  async creditPayment(tenantId: string, customerId: string, body: {
    amount: number
    paymentMethod: string
    branchId?: string
    performedBy: string
    /** Skip these sales when allocating (e.g. new POS invoice created in the same checkout). */
    excludeSaleIds?: string[]
  }) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId } })
    if (!c) throw new AppError('Customer not found', 404)

    const { amount, paymentMethod, performedBy } = body
    let branchId = body.branchId
    if (!branchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId }, select: { id: true } })
      branchId = branch?.id
    }
    if (!branchId) throw new AppError('Branch is required for credit payment', 400)

    if (amount <= 0) throw new AppError('Amount must be greater than 0', 400)

    const method = paymentMethod as PaymentMethod
    const exclude = new Set((body.excludeSaleIds ?? []).filter(Boolean))

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const openSales = await tx.sale.findMany({
        where: {
          tenantId,
          customerId,
          branchId,
          dueAmount: { gt: 0 },
          ...(exclude.size ? { id: { notIn: [...exclude] } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      })

      const branchDue = round2(openSales.reduce((s, sale) => s + sale.dueAmount, 0))
      if (amount > branchDue + 0.001) {
        throw new AppError(
          branchDue <= 0
            ? 'No outstanding balance at this branch'
            : `Payment amount cannot exceed this branch outstanding (${branchDue.toFixed(2)})`,
          400,
        )
      }

      let remaining = round2(amount)
      const allocations: { saleId: string; invoiceNumber: string; applied: number; status: string }[] = []

      for (const sale of openSales) {
        if (remaining <= 0) break
        const apply = round2(Math.min(remaining, sale.dueAmount))
        const newDue = round2(sale.dueAmount - apply)
        const newPaid = round2(sale.paidAmount + apply)
        const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL'

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newStatus,
            payments: {
              create: {
                method,
                amount: apply,
                reference: 'Outstanding settlement',
              },
            },
          },
        })

        // Shrink or remove CREDIT payment rows so they always equal remaining due.
        // Leaving stale CREDIT rows after settlement double-counts AR / payment totals.
        let creditToReduce = apply
        const creditRows = await tx.salePayment.findMany({
          where: { saleId: sale.id, method: 'CREDIT' },
          orderBy: { amount: 'desc' },
        })
        for (const row of creditRows) {
          if (creditToReduce <= 0) break
          const reduceBy = round2(Math.min(creditToReduce, row.amount))
          const nextAmount = round2(row.amount - reduceBy)
          if (nextAmount <= 0.001) {
            await tx.salePayment.delete({ where: { id: row.id } })
          } else {
            await tx.salePayment.update({ where: { id: row.id }, data: { amount: nextAmount } })
          }
          creditToReduce = round2(creditToReduce - reduceBy)
        }

        remaining = round2(remaining - apply)
        allocations.push({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          applied: apply,
          status: newStatus,
        })
      }

      let collectionInvoice: string | undefined
      // When excluding the new POS invoice, never create a leftover "collection"
      // sale — that would steal from the intentional credit left on the new bill.
      if (remaining > 0 && exclude.size === 0) {
        const invoiceNumber = await generateInvoiceNumber(tenantId)
        collectionInvoice = invoiceNumber
        await tx.sale.create({
          data: {
            tenantId,
            branchId,
            invoiceNumber,
            customerId,
            customerName: c.name,
            customerPhone: c.phone,
            subtotal: remaining,
            discount: 0,
            tax: 0,
            total: remaining,
            paidAmount: remaining,
            dueAmount: 0,
            status: 'PAID',
            cashierName: performedBy,
            source: 'CREDIT_COLLECTION',
            notes: 'Outstanding balance settlement',
            items: {
              create: [{
                productName: 'Outstanding balance payment',
                quantity: 1,
                unitPrice: remaining,
                total: remaining,
              }],
            },
            payments: {
              create: [{ method, amount: remaining, reference: 'Credit settlement' }],
            },
          },
        })
        remaining = 0
      }

      const amountApplied = round2(amount - remaining)
      if (amountApplied <= 0.001) {
        throw new AppError('No open invoices available to apply this outstanding payment', 400)
      }

      // Re-read balance inside the transaction — a concurrent POS sale may have
      // just increased totalDue (new credit). Only reduce by what we actually applied.
      const fresh = await tx.customer.findUnique({ where: { id: customerId }, select: { totalDue: true } })
      const newTotalDue = round2(Math.max(0, (fresh?.totalDue ?? c.totalDue) - amountApplied))
      await tx.customer.update({ where: { id: customerId }, data: { totalDue: newTotalDue } })

      const invoiceRefs = [
        ...allocations.map(a => a.invoiceNumber),
        ...(collectionInvoice ? [collectionInvoice] : []),
      ]

      await tx.transaction.create({
        data: {
          tenantId,
          branchId,
          type: 'INCOME',
          category: 'Customer Credit Payment',
          amount: amountApplied,
          description: `Credit payment from ${c.name} (${c.phone})${invoiceRefs.length ? ` — ${invoiceRefs.join(', ')}` : ''}`,
          paymentMethod: method,
          reference: invoiceRefs.join(', ') || undefined,
          performedBy,
        },
      })

      const remainingBranchDue = round2(Math.max(0, branchDue - amountApplied))

      return {
        customerId,
        amountPaid: amountApplied,
        newOutstanding: remainingBranchDue,
        tenantOutstanding: newTotalDue,
        allocations,
        collectionInvoice,
      }
    })
  },
}
