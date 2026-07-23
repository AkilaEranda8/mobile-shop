import { prisma } from '../../config/database'
import { PaymentMethod, Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'
import { emitOpeningCustomerArAccounting } from '../accounting/integration/accounting-events.service'
import { effectiveBranchId, resolveMutationBranchId, assertBranchRecordAccess } from '../../utils/active-branch'

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
          include: {
            items: true,
            payments: { orderBy: { id: 'asc' } },
          },
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

  async create(tenantId: string, body: any, actorEmail?: string, req?: Request) {
    const name = String(body.name ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    if (!name) throw new AppError('Customer name is required', 400)
    if (!phone) throw new AppError('Phone number is required', 400)

    let branchId: string
    if (req) {
      branchId = await resolveMutationBranchId(req, { preferred: body.branchId })
    } else {
      branchId = body.branchId ? String(body.branchId) : ''
      if (!branchId) {
        const branch = await prisma.branch.findFirst({
          where: { tenantId, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        })
        branchId = branch?.id ?? ''
      }
      if (!branchId) throw new AppError('Branch is required to create a customer', 400)
    }

    const existing = await prisma.customer.findFirst({ where: { tenantId, phone, branchId } })
    if (existing) throw new AppError('Phone number already registered at this branch', 409)

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

  async update(tenantId: string, id: string, body: any, req?: Request) {
    const c = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!c) throw new AppError('Customer not found', 404)
    if (req) assertBranchRecordAccess(req, c.branchId)

    const name = typeof body.name === 'string' ? body.name.trim() : c.name
    const phone = typeof body.phone === 'string' ? body.phone.trim() : c.phone
    if (!name) throw new AppError('Customer name is required', 400)
    if (!phone) throw new AppError('Phone number is required', 400)

    if (phone !== c.phone) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          tenantId,
          phone,
          id: { not: id },
          ...(c.branchId ? { branchId: c.branchId } : { branchId: null }),
        },
        select: { id: true },
      })
      if (duplicate) throw new AppError('Phone number already registered at this branch', 409)
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

  async setActive(tenantId: string, id: string, isActive: boolean, req?: Request) {
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId },
      select: { id: true, isActive: true, name: true, branchId: true },
    })
    if (!existing) throw new AppError('Customer not found', 404)
    if (req) assertBranchRecordAccess(req, existing.branchId)
    if (existing.isActive === isActive) {
      return prisma.customer.findFirst({ where: { id, tenantId }, select: CUSTOMER_LIST_SELECT })
    }
    return prisma.customer.update({
      where: { id },
      data: { isActive },
      select: CUSTOMER_LIST_SELECT,
    })
  },

  async remove(tenantId: string, id: string, req?: Request) {
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        branchId: true,
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
    if (req) assertBranchRecordAccess(req, existing.branchId)

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
    /** Optional write-off that also reduces outstanding (no cash). */
    discount?: number
    /** Free-text note saved on finance + payment references. */
    note?: string
    notes?: string
    /** Cheque / bank ref stored on SalePayment + finance reference. */
    reference?: string
    /** Skip these sales when allocating (e.g. new POS invoice created in the same checkout). */
    excludeSaleIds?: string[]
  }, req?: Request) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId } })
    if (!c) throw new AppError('Customer not found', 404)

    const cashAmount = round2(Number(body.amount) || 0)
    const discountAmount = round2(Math.max(0, Number(body.discount) || 0))
    const note = String(body.note ?? body.notes ?? '').trim()
    const paymentReference = String(body.reference ?? '').trim()
    const performedBy = body.performedBy
    const paymentMethod = body.paymentMethod
    let branchId = body.branchId
    if (!branchId && req) {
      branchId = effectiveBranchId(req) || c.branchId || undefined
    }
    if (!branchId) {
      branchId = c.branchId || undefined
    }
    if (!branchId) {
      const branch = await prisma.branch.findFirst({
        where: { tenantId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
      branchId = branch?.id
    }
    if (!branchId) throw new AppError('Branch is required for credit payment', 400)
    if (req) {
      await resolveMutationBranchId(req, { preferred: branchId })
    }

    if (cashAmount < 0 || discountAmount < 0) {
      throw new AppError('Amount and discount cannot be negative', 400)
    }
    if (cashAmount <= 0 && discountAmount <= 0) {
      throw new AppError('Enter a payment amount and/or discount', 400)
    }

    const settleTotal = round2(cashAmount + discountAmount)
    const method = paymentMethod as PaymentMethod
    const exclude = new Set((body.excludeSaleIds ?? []).filter(Boolean))

    const paymentRef = (kind: 'cash' | 'discount') => {
      const parts =
        kind === 'discount'
          ? ['Outstanding discount']
          : ['Outstanding settlement']
      if (discountAmount > 0 && kind === 'cash') parts.push(`Discount ${discountAmount.toFixed(2)}`)
      if (paymentReference && kind === 'cash') parts.push(paymentReference)
      if (note) parts.push(note)
      return parts.join(' | ')
    }

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
      if (settleTotal > branchDue + 0.001) {
        throw new AppError(
          branchDue <= 0
            ? 'No outstanding balance at this branch'
            : `Payment + discount cannot exceed this branch outstanding (${branchDue.toFixed(2)})`,
          400,
        )
      }

      let remainingSettle = settleTotal
      let remainingCash = cashAmount
      let remainingDiscount = discountAmount
      const allocations: {
        saleId: string
        invoiceNumber: string
        applied: number
        cashApplied: number
        discountApplied: number
        status: string
      }[] = []

      for (const sale of openSales) {
        if (remainingSettle <= 0) break
        const apply = round2(Math.min(remainingSettle, sale.dueAmount))
        const cashApply = round2(Math.min(remainingCash, apply))
        const discountApply = round2(apply - cashApply)
        const newDue = round2(sale.dueAmount - apply)
        const newPaid = round2(sale.paidAmount + apply)
        const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL'

        const paymentCreates: { method: PaymentMethod; amount: number; reference: string }[] = []
        if (cashApply > 0.001) {
          paymentCreates.push({ method, amount: cashApply, reference: paymentRef('cash') })
        }
        if (discountApply > 0.001) {
          // Write-off line — not cash; keep method as settlement method for reporting consistency
          paymentCreates.push({ method, amount: discountApply, reference: paymentRef('discount') })
        }

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newStatus,
            payments: { create: paymentCreates },
          },
        })

        // Shrink or remove CREDIT payment rows so they always equal remaining due.
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

        remainingSettle = round2(remainingSettle - apply)
        remainingCash = round2(remainingCash - cashApply)
        remainingDiscount = round2(remainingDiscount - discountApply)
        allocations.push({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          applied: apply,
          cashApplied: cashApply,
          discountApplied: discountApply,
          status: newStatus,
        })
      }

      let collectionInvoice: string | undefined
      if (remainingSettle > 0 && exclude.size === 0) {
        const invoiceNumber = await generateInvoiceNumber(tenantId)
        collectionInvoice = invoiceNumber
        const leftoverCash = remainingCash
        const leftoverDiscount = remainingDiscount
        const paymentCreates: { method: PaymentMethod; amount: number; reference: string }[] = []
        if (leftoverCash > 0.001) {
          paymentCreates.push({ method, amount: leftoverCash, reference: paymentRef('cash') })
        }
        if (leftoverDiscount > 0.001) {
          paymentCreates.push({ method, amount: leftoverDiscount, reference: paymentRef('discount') })
        }
        await tx.sale.create({
          data: {
            tenantId,
            branchId,
            invoiceNumber,
            customerId,
            customerName: c.name,
            customerPhone: c.phone,
            subtotal: remainingSettle,
            discount: leftoverDiscount,
            tax: 0,
            total: remainingSettle,
            paidAmount: remainingSettle,
            dueAmount: 0,
            status: 'PAID',
            cashierName: performedBy,
            source: 'CREDIT_COLLECTION',
            notes: [
              'Outstanding balance settlement',
              leftoverDiscount > 0 ? `Discount ${leftoverDiscount.toFixed(2)}` : null,
              note || null,
            ].filter(Boolean).join(' | '),
            items: {
              create: [{
                productName: leftoverDiscount > 0 && leftoverCash <= 0.001
                  ? 'Outstanding balance discount'
                  : 'Outstanding balance payment',
                quantity: 1,
                unitPrice: remainingSettle,
                total: remainingSettle,
              }],
            },
            payments: { create: paymentCreates },
          },
        })
        remainingSettle = 0
        remainingCash = 0
        remainingDiscount = 0
      }

      const amountApplied = round2(settleTotal - remainingSettle)
      const cashApplied = round2(cashAmount - remainingCash)
      const discountApplied = round2(discountAmount - remainingDiscount)
      if (amountApplied <= 0.001) {
        throw new AppError('No open invoices available to apply this outstanding payment', 400)
      }

      const fresh = await tx.customer.findUnique({ where: { id: customerId }, select: { totalDue: true } })
      const newTotalDue = round2(Math.max(0, (fresh?.totalDue ?? c.totalDue) - amountApplied))
      await tx.customer.update({ where: { id: customerId }, data: { totalDue: newTotalDue } })

      const invoiceRefs = [
        ...allocations.map(a => a.invoiceNumber),
        ...(collectionInvoice ? [collectionInvoice] : []),
      ]

      const descParts = [
        `Credit payment from ${c.name} (${c.phone})`,
        invoiceRefs.length ? invoiceRefs.join(', ') : null,
        paymentReference || null,
        discountApplied > 0 ? `Discount ${discountApplied.toFixed(2)}` : null,
        note || null,
      ].filter(Boolean)

      const txReference = [invoiceRefs.join(', '), paymentReference].filter(Boolean).join(' | ') || undefined

      if (cashApplied > 0.001) {
        await tx.transaction.create({
          data: {
            tenantId,
            branchId,
            type: 'INCOME',
            category: 'Customer Credit Payment',
            amount: cashApplied,
            description: descParts.join(' — '),
            paymentMethod: method,
            reference: txReference,
            performedBy,
          },
        })
      }

      // Record discount write-off in the ledger when cash was zero or partial
      if (discountApplied > 0.001) {
        await tx.transaction.create({
          data: {
            tenantId,
            branchId,
            type: 'EXPENSE',
            category: 'Customer Credit Discount',
            amount: discountApplied,
            description: [
              `Credit discount for ${c.name} (${c.phone})`,
              invoiceRefs.length ? invoiceRefs.join(', ') : null,
              note || null,
            ].filter(Boolean).join(' — '),
            paymentMethod: method,
            reference: invoiceRefs.join(', ') || undefined,
            performedBy,
          },
        })
      }

      const remainingBranchDue = round2(Math.max(0, branchDue - amountApplied))

      return {
        customerId,
        amountPaid: cashApplied,
        discount: discountApplied,
        note: note || null,
        settledTotal: amountApplied,
        newOutstanding: remainingBranchDue,
        tenantOutstanding: newTotalDue,
        allocations,
        collectionInvoice,
      }
    })
  },
}
