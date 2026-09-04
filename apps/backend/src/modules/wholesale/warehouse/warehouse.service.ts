import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import {
  generateWholesaleDispatchNumber,
  generateWholesalePickNumber,
} from '../../../utils/counters'
import { softReserveImei } from '../../inventory-engine/inventory-engine.stock'
import { releaseReservationsForOrder } from '../orders/orders.service'
import { getWholesaleSettings } from '../settings/wholesale-settings.service'
import type { CreateDispatchInput, CreatePickListInput, RecordPickInput } from './warehouse.schema'

const pickInclude = {
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      dealerId: true,
      dealer: { select: { id: true, legalName: true, tradingName: true } },
    },
  },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  assignedPicker: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WholesalePickListInclude

const dispatchInclude = {
  salesOrder: { select: { id: true, orderNumber: true, dealerId: true } },
  pickList: { select: { id: true, pickNumber: true } },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    include: { serials: true },
  },
} satisfies Prisma.WholesaleDispatchInclude

export async function pickQueue(
  tenantId: string,
  opts: { branchId?: string; skip: number; limit: number },
) {
  const where: Prisma.WholesaleSalesOrderWhereInput = {
    tenantId,
    status: { in: ['CONFIRMED', 'PARTIAL'] },
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
  }
  const [orders, total] = await Promise.all([
    prisma.wholesaleSalesOrder.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { confirmedAt: 'asc' },
      include: {
        dealer: { select: { id: true, legalName: true, tradingName: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        pickLists: { select: { id: true, pickNumber: true, status: true } },
      },
    }),
    prisma.wholesaleSalesOrder.count({ where }),
  ])
  return { data: orders, total }
}

export async function listPickLists(
  tenantId: string,
  opts: { branchId?: string; status?: string; skip: number; limit: number },
) {
  const where: Prisma.WholesalePickListWhereInput = {
    tenantId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.status ? { status: opts.status as never } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.wholesalePickList.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      include: pickInclude,
    }),
    prisma.wholesalePickList.count({ where }),
  ])
  return { data, total }
}

export async function getPickList(tenantId: string, id: string) {
  const row = await prisma.wholesalePickList.findFirst({
    where: { id, tenantId },
    include: pickInclude,
  })
  if (!row) throw new AppError('Pick list not found', 404)
  return row
}

export async function createPickList(tenantId: string, input: CreatePickListInput) {
  const order = await prisma.wholesaleSalesOrder.findFirst({
    where: { id: input.salesOrderId, tenantId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!order) throw new AppError('Sales order not found', 404)
  if (order.status !== 'CONFIRMED' && order.status !== 'PARTIAL') {
    throw new AppError(`Order must be CONFIRMED/PARTIAL to pick (got ${order.status})`, 400)
  }
  const branchId = input.branchId || order.branchId
  if (!branchId) throw new AppError('branchId is required', 400)

  const remaining = order.lines.filter((l) => l.quantity - l.fulfilledQty > 0.0001)
  if (!remaining.length) throw new AppError('No remaining qty to pick', 400)

  const pickNumber = await generateWholesalePickNumber(tenantId)
  return prisma.wholesalePickList.create({
    data: {
      tenantId,
      branchId,
      salesOrderId: order.id,
      pickNumber,
      status: input.assignedPickerId ? 'ASSIGNED' : 'DRAFT',
      assignedPickerId: input.assignedPickerId || null,
      notes: input.notes || null,
      lines: {
        create: remaining.map((l, idx) => ({
          orderLineId: l.id,
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          quantity: l.quantity - l.fulfilledQty,
          pickedQty: 0,
          sortOrder: idx,
        })),
      },
    },
    include: pickInclude,
  })
}

export async function recordPick(tenantId: string, pickListId: string, input: RecordPickInput) {
  const pick = await getPickList(tenantId, pickListId)
  if (pick.status === 'COMPLETED' || pick.status === 'CANCELLED') {
    throw new AppError(`Cannot pick against ${pick.status} pick list`, 400)
  }

  await prisma.$transaction(async (tx) => {
    for (const row of input.lines) {
      const line = pick.lines.find((l) => l.id === row.pickLineId)
      if (!line) throw new AppError(`Pick line ${row.pickLineId} not found`, 404)
      if (row.pickedQty > line.quantity + 0.001) {
        throw new AppError(`Picked qty exceeds requested for ${line.productName}`, 400)
      }
      await tx.wholesalePickLine.update({
        where: { id: row.pickLineId },
        data: { pickedQty: row.pickedQty },
      })
    }
    await tx.wholesalePickList.update({
      where: { id: pickListId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: pick.startedAt || new Date(),
      },
    })
  })

  return getPickList(tenantId, pickListId)
}

export async function completePick(tenantId: string, pickListId: string) {
  const pick = await getPickList(tenantId, pickListId)
  if (pick.status === 'CANCELLED') throw new AppError('Pick list cancelled', 400)
  const incomplete = pick.lines.filter((l) => l.pickedQty <= 0)
  if (incomplete.length === pick.lines.length) {
    throw new AppError('No lines picked', 400)
  }
  return prisma.wholesalePickList.update({
    where: { id: pickListId },
    data: { status: 'COMPLETED', completedAt: new Date() },
    include: pickInclude,
  })
}

/** Pack = mark completed pick ready for dispatch (status stays COMPLETED; notes stamp). */
export async function packPickList(tenantId: string, pickListId: string, notes?: string) {
  const pick = await getPickList(tenantId, pickListId)
  if (pick.status !== 'COMPLETED') {
    throw new AppError('Pick list must be COMPLETED before pack', 400)
  }
  return prisma.wholesalePickList.update({
    where: { id: pickListId },
    data: {
      notes: notes
        ? `${pick.notes ? pick.notes + '\n' : ''}Packed: ${notes}`
        : pick.notes || 'Packed',
    },
    include: pickInclude,
  })
}

export async function createDispatch(tenantId: string, input: CreateDispatchInput) {
  const pick = await getPickList(tenantId, input.pickListId)
  if (pick.status !== 'COMPLETED') {
    throw new AppError('Pick list must be COMPLETED before dispatch', 400)
  }
  const pickedLines = pick.lines.filter((l) => l.pickedQty > 0)
  if (!pickedLines.length) throw new AppError('No picked qty to dispatch', 400)

  const dispatchNumber = await generateWholesaleDispatchNumber(tenantId)
  return prisma.wholesaleDispatch.create({
    data: {
      tenantId,
      branchId: pick.branchId,
      salesOrderId: pick.salesOrderId,
      pickListId: pick.id,
      dispatchNumber,
      status: 'DRAFT',
      notes: input.notes || null,
      lines: {
        create: pickedLines.map((l, idx) => ({
          orderLineId: l.orderLineId,
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          quantity: l.pickedQty,
          sortOrder: idx,
        })),
      },
    },
    include: dispatchInclude,
  })
}

export async function getDispatch(tenantId: string, id: string) {
  const row = await prisma.wholesaleDispatch.findFirst({
    where: { id, tenantId },
    include: dispatchInclude,
  })
  if (!row) throw new AppError('Dispatch not found', 404)
  return row
}

export async function bindDispatchImei(
  tenantId: string,
  dispatchId: string,
  dispatchLineId: string,
  imei: string,
  reservedBy: string,
) {
  const dispatch = await getDispatch(tenantId, dispatchId)
  if (dispatch.status !== 'DRAFT') {
    throw new AppError('IMEI can only be bound on DRAFT dispatch', 400)
  }
  const line = dispatch.lines.find((l) => l.id === dispatchLineId)
  if (!line) throw new AppError('Dispatch line not found', 404)
  if (line.serials.length >= line.quantity) {
    throw new AppError('All serial slots for this line are filled', 400)
  }

  const settings = await getWholesaleSettings(tenantId)
  await softReserveImei(prisma, {
    imei,
    reservedBy,
    ttlMs: Math.max(settings.imeiSoftReserveTtlMs, 24 * 60 * 60 * 1000), // hold through delivery day
  })

  const imeiRow = await prisma.imeiRecord.findUnique({ where: { imei } })
  return prisma.wholesaleDispatchSerial.create({
    data: {
      dispatchLineId,
      imei,
      imeiId: imeiRow?.id || null,
    },
  })
}

/**
 * Mark dispatch DISPATCHED.
 * Releases order StockReservations (invoice + consumeStock happen on POD acceptance).
 */
export async function confirmDispatch(tenantId: string, dispatchId: string) {
  const dispatch = await getDispatch(tenantId, dispatchId)
  if (dispatch.status !== 'DRAFT') {
    throw new AppError(`Dispatch already ${dispatch.status}`, 400)
  }

  await prisma.$transaction(async (tx) => {
    if (dispatch.salesOrderId) {
      // Free ATP reservation; physical stock consume happens on POD invoice
      await releaseReservationsForOrder(tx, dispatch.salesOrderId, 'RELEASED')

      for (const line of dispatch.lines) {
        if (!line.orderLineId) continue
        await tx.wholesaleSalesOrderLine.update({
          where: { id: line.orderLineId },
          data: { fulfilledQty: { increment: line.quantity } },
        })
      }

      const orderLines = await tx.wholesaleSalesOrderLine.findMany({
        where: { salesOrderId: dispatch.salesOrderId },
      })
      const allDone = orderLines.every((l) => l.fulfilledQty >= l.quantity - 0.001)
      const anyDone = orderLines.some((l) => l.fulfilledQty > 0)
      await tx.wholesaleSalesOrder.update({
        where: { id: dispatch.salesOrderId },
        data: { status: allDone ? 'FULFILLED' : anyDone ? 'PARTIAL' : 'CONFIRMED' },
      })
    }

    await tx.wholesaleDispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        notes: dispatch.notes
          ? `${dispatch.notes}\n[Stock: reservation released; invoice+consume on POD]`
          : '[Stock: reservation released; invoice+consume on POD]',
      },
    })
  })

  return getDispatch(tenantId, dispatchId)
}

export async function listDispatches(
  tenantId: string,
  opts: { branchId?: string; status?: string; skip: number; limit: number },
) {
  const where: Prisma.WholesaleDispatchWhereInput = {
    tenantId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.status ? { status: opts.status as never } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.wholesaleDispatch.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      include: dispatchInclude,
    }),
    prisma.wholesaleDispatch.count({ where }),
  ])
  return { data, total }
}
