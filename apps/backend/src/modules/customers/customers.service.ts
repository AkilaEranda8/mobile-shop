import { prisma } from '../../config/database'
import { PaymentMethod, Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'

export const customersService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const where: any = { tenantId, ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] }) }
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
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
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.customer.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const c = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sales:   { orderBy: { createdAt: 'desc' }, include: { items: true } },
        repairs: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!c) throw new AppError('Customer not found', 404)
    return c
  },

  async create(tenantId: string, body: any) {
    const existing = await prisma.customer.findFirst({ where: { tenantId, phone: body.phone } })
    if (existing) throw new AppError('Phone number already registered', 409)
    return prisma.customer.create({ data: { ...body, tenantId } })
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

  async search(tenantId: string, q: string) {
    return prisma.customer.findMany({
      where: { tenantId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
      take: 10,
      select: {
        id: true,
        tenantId: true,
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
        createdAt: true,
        updatedAt: true,
      },
    })
  },

  async creditPayment(tenantId: string, customerId: string, body: { amount: number; paymentMethod: string; branchId?: string; performedBy: string }) {
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
    if (amount > c.totalDue + 0.001) throw new AppError('Payment amount cannot exceed outstanding balance', 400)

    const method = paymentMethod as PaymentMethod
    const round2 = (n: number) => Math.round(n * 100) / 100

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const openSales = await tx.sale.findMany({
        where: { tenantId, customerId, dueAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      })

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

        remaining = round2(remaining - apply)
        allocations.push({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          applied: apply,
          status: newStatus,
        })
      }

      let collectionInvoice: string | undefined
      if (remaining > 0) {
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
      }

      const newTotalDue = round2(Math.max(0, c.totalDue - amount))
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
          amount,
          description: `Credit payment from ${c.name} (${c.phone})${invoiceRefs.length ? ` — ${invoiceRefs.join(', ')}` : ''}`,
          paymentMethod: method,
          reference: invoiceRefs.join(', ') || undefined,
          performedBy,
        },
      })

      return {
        customerId,
        amountPaid: amount,
        newOutstanding: newTotalDue,
        allocations,
        collectionInvoice,
      }
    })
  },
}
