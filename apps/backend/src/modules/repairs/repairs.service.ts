import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateTicketNumber } from '../../utils/counters'
import { linkRepairToClaim, createWarrantiesFromRepair } from '../warranty/warranty.service'
import { Request } from 'express'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { effectiveBranchId, assertBranchRecordAccess, resolveMutationBranchId } from '../../utils/active-branch'
import { emitRepairAccounting } from '../accounting/integration/accounting-events.service'
import { formatRepairServiceItemName } from '../../utils/repair-item-label'
import { applyRepairSparePartsStockEffectsIfEnabled } from '../inventory-engine/inventory-engine.service'
import { assertRepairTransitionIfEnabled } from '../workflow-validators/workflow-validators.service'


async function loadRepairForAccess(tenantId: string, id: string, req?: Request) {
  const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { notes: true, spareParts: true, history: true } })
  if (!r) throw new AppError('Repair ticket not found', 404)
  if (req) assertBranchRecordAccess(req, r.branchId)
  return r
}


function normalizeFaultName(input: unknown) {
  const s = String(input ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
  return s
}

function serializeRepair<T extends Record<string, unknown>>(ticket: T) {
  if (!ticket) return ticket
  const { history, ...rest } = ticket as T & { history?: unknown; statusHistory?: unknown }
  return { ...rest, statusHistory: (history ?? (ticket as { statusHistory?: unknown }).statusHistory ?? []) as unknown }
}

export const repairsService = {
  async listFaultOptions(tenantId: string) {
    const rows = await (prisma as any).repairFaultOption.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true },
    })
    return rows
  },

  async createFaultOption(tenantId: string, body: any) {
    const name = normalizeFaultName(body?.name)
    if (!name) throw new AppError('Fault name is required', 400)
    if (name.length > 80) throw new AppError('Fault name is too long', 400)

    const existing = await (prisma as any).repairFaultOption.findFirst({
      where: { tenantId, name },
      select: { id: true, name: true },
    })
    if (existing) return existing

    const created = await (prisma as any).repairFaultOption.create({
      data: { tenantId, name, isActive: true },
      select: { id: true, name: true },
    })
    return created
  },

  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const branchId = effectiveBranchId(req)
    const customerId = req.query.customerId as string | undefined
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const completedFrom = req.query.completedFrom as string | undefined
    const completedTo = req.query.completedTo as string | undefined
    const where: any = { tenantId, ...(status && { status }), ...(branchId && { branchId }), ...(customerId && { customerId }), ...(search && { OR: [{ ticketNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { deviceBrand: { contains: search, mode: 'insensitive' } }, { deviceModel: { contains: search, mode: 'insensitive' } }] }) }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(`${from}T00:00:00.000Z`)
      if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999Z`)
    }
    if (completedFrom || completedTo) {
      where.completedAt = {}
      if (completedFrom) where.completedAt.gte = new Date(`${completedFrom}T00:00:00.000Z`)
      if (completedTo) where.completedAt.lte = new Date(`${completedTo}T23:59:59.999Z`)
    }
    const [data, total] = await Promise.all([
      prisma.repairTicket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { notes: true, spareParts: true, history: true } }),
      prisma.repairTicket.count({ where }),
    ])
    return { data: data.map(serializeRepair), total, page, limit }
  },

  async getById(tenantId: string, id: string, req: Request) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { notes: true, spareParts: true, history: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    assertBranchRecordAccess(req, r.branchId)
    return serializeRepair(r)
  },

  async create(tenantId: string, body: any, req: Request) {
    body.branchId = await resolveMutationBranchId(req, { preferred: body.branchId })

    if (!body.customerId && body.customerPhone) {
      let customer = await prisma.customer.findFirst({
        where: { tenantId, phone: body.customerPhone, branchId: body.branchId },
      })
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            tenantId,
            branchId: body.branchId,
            name: body.customerName || 'Unknown',
            phone: body.customerPhone,
          },
        })
      }
      body.customerId = customer.id
    }
    if (!body.customerId) throw new AppError('Customer phone is required', 400)

    const ticketNumber = await generateTicketNumber(tenantId)
    const repair = await prisma.repairTicket.create({
      data: {
        tenantId,
        ticketNumber,
        branchId:            body.branchId,
        customerId:          body.customerId,
        customerName:        body.customerName   || 'Unknown',
        customerPhone:       body.customerPhone  || '',
        deviceBrand:         body.deviceBrand    || '',
        deviceModel:         body.deviceModel    || '',
        deviceColor:         body.deviceColor    || undefined,
        imei:                body.imei           || undefined,
        accessories:         body.accessories    || undefined,
        deviceCondition:     body.deviceCondition?.trim() || undefined,
        reportedIssue:       body.reportedIssue  || '',
        estimatedCost:       Number(body.estimatedCost) || 0,
        priority:            body.priority       || 'NORMAL',
        technicianId:        body.technicianId   || undefined,
        technicianName:      body.technicianName || undefined,
        source:              body.source         || 'WALK_IN',
        estimatedCompletion: body.estimatedCompletion ? new Date(body.estimatedCompletion) : undefined,
        ...(body.warrantyMonths != null && body.warrantyMonths !== ''
          ? { warrantyMonths: Math.max(0, Math.min(120, Number(body.warrantyMonths))) }
          : {}),
        history: { create: [{ status: 'RECEIVED', changedBy: body.createdBy ?? 'system', note: 'Ticket created' }] },
      },
      include: { notes: true, spareParts: true, history: true },
    })
    await prisma.customer.update({ where: { id: body.customerId }, data: { totalRepairs: { increment: 1 } } }).catch(() => {})
    if (body.imei) {
      await prisma.imeiRecord.updateMany({ where: { imei: body.imei }, data: { status: 'IN_REPAIR' } }).catch(() => {})
    }
    if (body.warrantyClaimId) {
      await linkRepairToClaim(tenantId, body.warrantyClaimId, repair.id)
    }
    return serializeRepair(repair)
  },

  async update(tenantId: string, id: string, body: any, req?: Request) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { spareParts: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    if (req) assertBranchRecordAccess(req, r.branchId)
    if (r.status === 'DELIVERED' || r.status === 'CANCELLED') {
      const locked = ['estimatedCost', 'actualCost', 'paidAmount', 'dueAmount', 'warrantyMonths', 'imei', 'deviceBrand', 'deviceModel', 'deviceColor'] as const
      for (const key of locked) {
        if (body[key] !== undefined) {
          throw new AppError(`Cannot change ${key} on a completed or cancelled repair`, 400)
        }
      }
    }
    const { customerName, customerPhone, deviceBrand, deviceModel, deviceColor,
            imei, accessories, deviceCondition, reportedIssue, technicianId, technicianName, priority,
            estimatedCost, actualCost, estimatedCompletion, source, warrantyMonths } = body
    const data: any = {}
    if (customerName        !== undefined) data.customerName        = customerName
    if (customerPhone       !== undefined) data.customerPhone       = customerPhone
    if (deviceBrand         !== undefined) data.deviceBrand         = deviceBrand
    if (deviceModel         !== undefined) data.deviceModel         = deviceModel
    if (deviceColor         !== undefined) data.deviceColor         = deviceColor
    if (accessories         !== undefined) data.accessories         = accessories
    if (deviceCondition     !== undefined) data.deviceCondition     = typeof deviceCondition === 'string' ? (deviceCondition.trim() || null) : deviceCondition
    if (imei                !== undefined) {
      data.imei = imei
      if (imei && imei !== r.imei) {
        await prisma.imeiRecord.updateMany({ where: { imei }, data: { status: 'IN_REPAIR' } }).catch(() => {})
        if (r.imei) {
          await prisma.imeiRecord.updateMany({ where: { imei: r.imei }, data: { status: 'IN_STOCK' } }).catch(() => {})
        }
      }
    }
    if (reportedIssue       !== undefined) data.reportedIssue       = reportedIssue
    if (technicianId        !== undefined) data.technicianId        = technicianId
    if (technicianName      !== undefined) data.technicianName      = technicianName
    if (priority            !== undefined) data.priority            = priority
    if (estimatedCost       !== undefined) data.estimatedCost = Number(estimatedCost)
    if (actualCost          !== undefined) data.actualCost          = Number(actualCost)
    if (estimatedCompletion !== undefined) data.estimatedCompletion = estimatedCompletion ? new Date(estimatedCompletion) : null
    if (source              !== undefined) data.source              = source
    if (warrantyMonths === null || warrantyMonths === '') {
      data.warrantyMonths = null
    } else if (warrantyMonths !== undefined) {
      data.warrantyMonths = Math.max(0, Math.min(120, Number(warrantyMonths)))
    }
    const updated = await prisma.repairTicket.update({ where: { id }, data, include: { notes: true, spareParts: true, history: true } })
    return serializeRepair(updated)
  },

  async updateStatus(tenantId: string, id: string, status: string, changedBy: string, note?: string, req?: Request) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    if (req) assertBranchRecordAccess(req, r.branchId)
    await assertRepairTransitionIfEnabled(tenantId, r.status, status)
    await prisma.$transaction([
      prisma.repairTicket.update({ where: { id }, data: { status: status as any } }),
      prisma.repairStatusHistory.create({ data: { repairId: id, status: status as any, changedBy, note } }),
    ])
    if (status === 'CANCELLED' && r.imei) {
      await prisma.imeiRecord.updateMany({ where: { imei: r.imei }, data: { status: 'IN_STOCK' } }).catch(() => {})
    }
    const ticket = await prisma.repairTicket.findUnique({ where: { id }, include: { notes: true, spareParts: true, history: true } })
    return serializeRepair(ticket!)
  },

  async addNote(tenantId: string, id: string, text: string, authorName: string, isPublic: boolean, req?: Request) {
    if (req) {
      const existing = await prisma.repairTicket.findFirst({ where: { id, tenantId }, select: { branchId: true } })
      if (!existing) throw new AppError('Repair ticket not found', 404)
      assertBranchRecordAccess(req, existing.branchId)
    }
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    await prisma.repairNote.create({ data: { repairId: id, text, authorName, isPublic } })
    const ticket = await prisma.repairTicket.findUnique({
      where: { id },
      include: { notes: true, spareParts: true, history: true },
    })
    return serializeRepair(ticket!)
  },

  async addSparePart(tenantId: string, repairId: string, body: any, req?: Request) {
    if (req) {
      const existing = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId }, select: { branchId: true } })
      if (!existing) throw new AppError('Repair ticket not found', 404)
      assertBranchRecordAccess(req, existing.branchId)
    }
    const r = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    if (r.status === 'DELIVERED' || r.status === 'CANCELLED') {
      throw new AppError('Cannot add parts to a completed or cancelled repair', 400)
    }
    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } })
    if (!product) throw new AppError('Product not found', 404)
    const qty      = Number(body.quantity) || 1
    if (product.stock < qty) {
      throw new AppError(`Insufficient stock for "${product.name}". Available: ${product.stock}, Required: ${qty}`, 400)
    }
    const unitCost = body.unitCost != null && String(body.unitCost).trim() !== ''
      ? Number(body.unitCost)
      : (Number(product.sellingPrice) || Number(product.buyingPrice) || 0)
    const unitBuyCost = Number(product.buyingPrice) || 0
    const warrantyMonths = Math.max(0, Math.min(120, Number(product.warrantyMonths) || 0))
    const warrantyNote = product.warrantyNote?.trim() || undefined
    const partTotal = qty * unitCost
    await prisma.repairSparePart.create({
      data: {
        repairId, productId: body.productId, productName: product.name,
        quantity: qty, unitCost, unitBuyCost, total: partTotal,
        warrantyMonths, warrantyNote,
      },
    })
    const ticket = await prisma.repairTicket.findUnique({ where: { id: repairId }, include: { notes: true, spareParts: true, history: true } })
    return serializeRepair(ticket!)
  },

  async removeSparePart(tenantId: string, repairId: string, partId: string, req?: Request) {
    if (req) {
      const existing = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId }, select: { branchId: true } })
      if (!existing) throw new AppError('Repair ticket not found', 404)
      assertBranchRecordAccess(req, existing.branchId)
    }
    const r = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    if (r.status === 'DELIVERED' || r.status === 'CANCELLED') {
      throw new AppError('Cannot remove parts from a completed or cancelled repair', 400)
    }
    await prisma.repairSparePart.deleteMany({ where: { id: partId, repairId } })
    const ticket = await prisma.repairTicket.findUnique({ where: { id: repairId }, include: { notes: true, spareParts: true, history: true } })
    return serializeRepair(ticket!)
  },

  async updatePhotos(tenantId: string, id: string, photos: string[]) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    const updated = await prisma.repairTicket.update({ where: { id }, data: { photos }, include: { notes: true, spareParts: true, history: true } })
    return serializeRepair(updated)
  },

  async collectPayment(tenantId: string, id: string, body: { discount?: number; paymentMethod: string; cashierName?: string; paidAmount?: number; reference?: string }, req?: Request) {
    if (req) {
      const existing = await prisma.repairTicket.findFirst({ where: { id, tenantId }, select: { branchId: true } })
      if (!existing) throw new AppError('Repair ticket not found', 404)
      assertBranchRecordAccess(req, existing.branchId)
    }
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { spareParts: true, notes: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    if (r.status === 'DELIVERED') throw new AppError('Payment has already been collected for this ticket', 400)
    if (r.status === 'CANCELLED') throw new AppError('Cannot collect payment on a cancelled repair', 400)
    if (r.status !== 'READY') throw new AppError('Repair must be marked Ready before collecting payment', 400)
    await assertRepairTransitionIfEnabled(tenantId, r.status, 'DELIVERED', { via: 'collect_payment' })
    await assertBusinessDayOpenIfEnabled(tenantId, r.branchId)

    const serviceFee  = Number(r.estimatedCost) || 0
    const subtotal    = serviceFee
    const discount    = Number(body.discount) || 0
    const total       = Math.max(0, subtotal - discount)
    const paidAmount  = body.paidAmount != null
      ? Math.min(Math.max(0, Number(body.paidAmount)), total)
      : total
    const dueAmount   = Math.max(0, total - paidAmount)
    if (dueAmount > 0 && !r.customerId) {
      throw new AppError('Customer is required when recording credit / partial payment', 400)
    }
    const saleStatus  = dueAmount > 0 ? (paidAmount > 0 ? 'PARTIAL' : 'DUE') : 'PAID'
    const cashierName = body.cashierName || 'System'
    const invoiceNumber = r.ticketNumber

    const repairWarrantyMonths = r.warrantyMonths != null && r.warrantyMonths >= 0
      ? Math.max(0, Math.min(120, Number(r.warrantyMonths)))
      : 0

    const partsSummary = r.spareParts.length
      ? ` | Parts: ${r.spareParts.map((p) => `${p.productName} x${p.quantity}`).join(', ')}`
      : ''
    const ticketNotes = (r.notes ?? [])
      .map((n: { text?: string }) => n.text?.trim())
      .filter(Boolean)
      .join('; ')
    const notesSummary = ticketNotes ? ` | Notes: ${ticketNotes}` : ''

    await prisma.$transaction(async (tx: any) => {
      await tx.repairTicket.update({
        where: { id },
        data: {
          actualCost: total,
          paidAmount,
          dueAmount,
          status: 'DELIVERED',
          completedAt: new Date(),
        },
      })
      await tx.repairStatusHistory.create({
        data: {
          repairId: id,
          status: 'DELIVERED',
          changedBy: cashierName,
          note: dueAmount > 0 ? `Payment collected — LKR ${dueAmount} on customer credit` : 'Payment collected',
        },
      })
      const saleItems: any[] = []
      if (serviceFee > 0) {
        saleItems.push({
          productName: formatRepairServiceItemName(r.deviceBrand, r.deviceModel),
          sku: r.ticketNumber,
          quantity: 1,
          unitPrice: serviceFee,
          discount: 0,
          total: serviceFee,
          warrantyMonths: repairWarrantyMonths,
        })
      }
      const sale = await tx.sale.create({
        data: {
          tenantId, branchId: r.branchId, invoiceNumber,
          customerId: r.customerId, customerName: r.customerName, customerPhone: r.customerPhone,
          subtotal, discount, tax: 0, total,
          paidAmount, dueAmount,
          status: saleStatus, cashierName, source: 'REPAIR',
          notes: `Repair ticket: ${r.ticketNumber}${r.reportedIssue?.trim() ? ` | Fault: ${r.reportedIssue.trim()}` : ''}${notesSummary}${partsSummary}`,
          items:    { create: saleItems },
          payments: paidAmount > 0
            ? { create: [{
                method: body.paymentMethod as any,
                amount: paidAmount,
                reference: body.reference?.trim() || null,
              }] }
            : undefined,
        },
      })
      await createWarrantiesFromRepair(tx, {
        tenantId,
        branchId: r.branchId,
        saleId: sale.id,
        invoiceNumber,
        ticketNumber: r.ticketNumber,
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        deviceBrand: r.deviceBrand,
        deviceModel: r.deviceModel,
        imei: r.imei,
        serviceWarrantyMonths: repairWarrantyMonths,
        spareParts: r.spareParts.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          quantity: p.quantity,
          warrantyMonths: (p as { warrantyMonths?: number }).warrantyMonths,
          warrantyNote: (p as { warrantyNote?: string | null }).warrantyNote,
        })),
      })
      if (r.customerId && dueAmount > 0) {
        await tx.customer.update({
          where: { id: r.customerId },
          data: { totalDue: { increment: dueAmount }, totalPurchases: { increment: 1 } },
        })
      } else if (r.customerId) {
        await tx.customer.update({
          where: { id: r.customerId },
          data: { totalPurchases: { increment: 1 } },
        }).catch(() => {})
      }
      const stockHandledByEngine = await applyRepairSparePartsStockEffectsIfEnabled({
        tx,
        tenantId,
        branchId: r.branchId,
        ticketNumber: r.ticketNumber,
        performedBy: cashierName,
        items: r.spareParts,
      })
      if (!stockHandledByEngine) {
        for (const p of r.spareParts) {
          if (p.productId) {
            const prod = await tx.product.findUnique({ where: { id: p.productId }, select: { stock: true, name: true } })
            if (prod) {
              // Atomic conditional decrement prevents overselling under concurrent writes.
              const dec = await tx.product.updateMany({
                where: { id: p.productId, stock: { gte: p.quantity } },
                data:  { stock: { decrement: p.quantity } },
              })
              if (dec.count === 0) {
                throw new AppError(`Insufficient stock for "${prod.name}". Available: ${prod.stock}, Required: ${p.quantity}`, 400)
              }
              await tx.stockMovement.create({
                data: {
                  productId:   p.productId,
                  branchId:    r.branchId,
                  type:        'REPAIR_USE',
                  quantity:    -p.quantity,
                  reference:   r.ticketNumber,
                  note:        `Spare part used in repair ${r.ticketNumber}`,
                  performedBy: cashierName,
                },
              })
            }
          }
        }
      }
    })
    // ── Auto-create Finance INCOME transaction for repair payment ──
    try {
      if (paidAmount > 0) {
        await prisma.transaction.create({
          data: {
            tenantId,
            branchId:    r.branchId,
            type:        'INCOME',
            category:    'Repairs',
            amount:      paidAmount,
            description: `Repair - ${r.ticketNumber} (${r.deviceBrand} ${r.deviceModel})${r.customerName ? ' — ' + r.customerName : ''}${dueAmount > 0 ? ` (Credit: LKR ${dueAmount})` : ''}`,
            paymentMethod: body.paymentMethod as any,
            reference:   r.ticketNumber,
            performedBy: cashierName,
          },
        })
      }
    } catch (e) { console.error('Finance repair transaction error:', e) }
    if (r.imei) {
      await prisma.imeiRecord.updateMany({ where: { imei: r.imei }, data: { status: 'IN_STOCK' } }).catch(() => {})
    }
    await prisma.warrantyClaim.updateMany({
      where: { repairTicketId: id },
      data: { status: 'RESOLVED', resolution: `Repair completed — ${r.ticketNumber}` },
    }).catch(() => {})
    const ticket = await prisma.repairTicket.findUnique({ where: { id }, include: { notes: true, spareParts: true, history: true } })
    void emitRepairAccounting(tenantId, id, r.branchId, body.cashierName)
    return serializeRepair(ticket!)
  },
}
