import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import { generateWholesaleTripNumber } from '../../../utils/counters'
import { createWholesaleInvoice } from '../sale/wholesale-sale.service'
import type { CreateTripInput, PodInput } from './delivery.schema'

const tripInclude = {
  vehicle: { select: { id: true, plateNumber: true, name: true } },
  driver: { select: { id: true, name: true, email: true } },
  stops: {
    orderBy: { sequence: 'asc' as const },
    include: {
      dealer: { select: { id: true, legalName: true, tradingName: true } },
      dispatch: {
        include: {
          lines: { include: { serials: true } },
        },
      },
      salesOrder: { select: { id: true, orderNumber: true, total: true } },
      proof: true,
      invoices: { select: { id: true, invoiceNumber: true, total: true, status: true } },
    },
  },
} satisfies Prisma.WholesaleDeliveryTripInclude

export async function listTrips(
  tenantId: string,
  opts: { branchId?: string; status?: string; skip: number; limit: number },
) {
  const where: Prisma.WholesaleDeliveryTripWhereInput = {
    tenantId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.status ? { status: opts.status as never } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.wholesaleDeliveryTrip.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { plannedDate: 'desc' },
      include: tripInclude,
    }),
    prisma.wholesaleDeliveryTrip.count({ where }),
  ])
  return { data, total }
}

export async function getTrip(tenantId: string, id: string) {
  const row = await prisma.wholesaleDeliveryTrip.findFirst({
    where: { id, tenantId },
    include: tripInclude,
  })
  if (!row) throw new AppError('Delivery trip not found', 404)
  return row
}

export async function createTrip(tenantId: string, input: CreateTripInput) {
  if (!input.branchId) throw new AppError('branchId is required', 400)
  const tripNumber = await generateWholesaleTripNumber(tenantId)
  return prisma.wholesaleDeliveryTrip.create({
    data: {
      tenantId,
      branchId: input.branchId,
      tripNumber,
      status: 'PLANNED',
      vehicleId: input.vehicleId || null,
      driverUserId: input.driverUserId || null,
      plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
      notes: input.notes || null,
      stops: {
        create: input.stops.map((s, idx) => ({
          dealerId: s.dealerId,
          salesOrderId: s.salesOrderId || null,
          dispatchId: s.dispatchId || null,
          sequence: s.sequence ?? idx,
          notes: s.notes || null,
        })),
      },
    },
    include: tripInclude,
  })
}

export async function addStop(
  tenantId: string,
  tripId: string,
  input: {
    dealerId: string
    salesOrderId?: string | null
    dispatchId?: string | null
    sequence?: number
    notes?: string | null
  },
) {
  const trip = await getTrip(tenantId, tripId)
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    throw new AppError(`Cannot add stops to ${trip.status} trip`, 400)
  }
  const seq = input.sequence ?? trip.stops.length
  await prisma.wholesaleDeliveryStop.create({
    data: {
      tripId,
      dealerId: input.dealerId,
      salesOrderId: input.salesOrderId || null,
      dispatchId: input.dispatchId || null,
      sequence: seq,
      notes: input.notes || null,
    },
  })
  return getTrip(tenantId, tripId)
}

export async function startTrip(tenantId: string, tripId: string) {
  const trip = await getTrip(tenantId, tripId)
  if (trip.status !== 'PLANNED' && trip.status !== 'LOADED') {
    throw new AppError(`Cannot start trip in status ${trip.status}`, 400)
  }
  return prisma.wholesaleDeliveryTrip.update({
    where: { id: tripId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
    include: tripInclude,
  })
}

export async function completeTrip(tenantId: string, tripId: string) {
  await getTrip(tenantId, tripId)
  return prisma.wholesaleDeliveryTrip.update({
    where: { id: tripId },
    data: { status: 'COMPLETED', completedAt: new Date() },
    include: tripInclude,
  })
}

export async function arriveStop(tenantId: string, tripId: string, stopId: string) {
  const trip = await getTrip(tenantId, tripId)
  const stop = trip.stops.find((s) => s.id === stopId)
  if (!stop) throw new AppError('Stop not found', 404)
  await prisma.wholesaleDeliveryStop.update({
    where: { id: stopId },
    data: { status: 'ARRIVED', arrivedAt: new Date() },
  })
  return getTrip(tenantId, tripId)
}

/**
 * POD accept / partial / reject.
 * On accept/partial: createWholesaleInvoice channel DELIVERY (consumes stock).
 */
export async function recordPod(
  tenantId: string,
  tripId: string,
  stopId: string,
  input: PodInput,
  actor: { userId: string; email?: string; performedBy: string },
) {
  const trip = await getTrip(tenantId, tripId)
  const stop = trip.stops.find((s) => s.id === stopId)
  if (!stop) throw new AppError('Stop not found', 404)
  if (stop.status === 'COMPLETED') throw new AppError('Stop already completed', 400)

  if (input.outcome === 'REJECT') {
    const rejectedQty =
      stop.dispatch?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0
    await prisma.$transaction(async (tx) => {
      await tx.wholesaleProofOfDelivery.create({
        data: {
          stopId,
          acceptedQty: 0,
          rejectedQty,
          recipientName: input.recipientName || null,
          signatureUrl: input.signatureUrl || null,
          photoUrl: input.photoUrl || null,
          notes: input.notes || 'Rejected',
          codCollected: 0,
        },
      })
      await tx.wholesaleDeliveryStop.update({
        where: { id: stopId },
        data: { status: 'FAILED', completedAt: new Date(), notes: input.notes || stop.notes },
      })
      if (stop.dispatchId) {
        await tx.wholesaleDispatch.update({
          where: { id: stop.dispatchId },
          data: { status: 'CANCELLED' },
        })
      }
    })
    return { trip: await getTrip(tenantId, tripId), invoice: null }
  }

  // Build invoice lines from acceptedLines or full dispatch
  let lines = input.acceptedLines
  if (!lines?.length) {
    if (!stop.dispatch?.lines?.length) {
      throw new AppError('acceptedLines required when stop has no dispatch lines', 400)
    }
    lines = stop.dispatch.lines
      .filter((l) => l.productId)
      .map((l) => {
        const serial = l.serials[0]
        return {
          productId: l.productId!,
          quantity: l.quantity,
          sellUnit: 'PIECE' as const,
          sku: l.sku,
          imei: serial?.imei || null,
          unitPrice: null as number | null,
          discount: null as number | null,
        }
      })
  }

  if (input.outcome === 'PARTIAL' && !input.acceptedLines?.length) {
    throw new AppError('PARTIAL requires acceptedLines', 400)
  }

  // Default payment: CREDIT on account (createWholesaleInvoice sets due = total − cash)
  let payments = input.payments
  if (!payments?.length) {
    payments = [{ method: 'CREDIT', amount: 1, reference: 'POD-CREDIT' }]
  }

  const invoice = await createWholesaleInvoice({
    tenantId,
    channel: 'DELIVERY',
    dealerId: stop.dealerId,
    fulfillmentBranchId: trip.branchId,
    salesOrderId: stop.salesOrderId || null,
    deliveryStopId: stop.id,
    salesRepId: trip.driverUserId || actor.userId,
    notes: input.notes || `POD ${input.outcome} trip ${trip.tripNumber}`,
    lines,
    payments,
    performedBy: actor.performedBy,
    actorUserId: actor.userId,
    actorEmail: actor.email,
  })

  const acceptedQty = lines.reduce((s, l) => s + l.quantity, 0)
  const dispatchQty = stop.dispatch?.lines.reduce((s, l) => s + l.quantity, 0) ?? acceptedQty
  const rejectedQty = Math.max(0, dispatchQty - acceptedQty)

  await prisma.$transaction(async (tx) => {
    await tx.wholesaleProofOfDelivery.create({
      data: {
        stopId,
        acceptedQty,
        rejectedQty,
        recipientName: input.recipientName || null,
        signatureUrl: input.signatureUrl || null,
        photoUrl: input.photoUrl || null,
        notes: input.notes || null,
        codCollected: input.codCollected ?? 0,
      },
    })
    await tx.wholesaleDeliveryStop.update({
      where: { id: stopId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    if (stop.dispatchId) {
      await tx.wholesaleDispatch.update({
        where: { id: stop.dispatchId },
        data: { status: 'DELIVERED' },
      })
    }
  })

  return { trip: await getTrip(tenantId, tripId), invoice }
}
