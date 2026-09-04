import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import {
  generateVanLoadNumber,
  generateVanSettlementNumber,
} from '../../../utils/counters'
import { stockTransferService } from '../../inventory/stock-transfer.service'
import { nextEmployeeCode } from '../../hr/hr.util'
import { createWholesaleInvoice } from '../sale/wholesale-sale.service'
import { round2 } from '../wholesale-uom.util'
import type {
  CreateRepInput,
  CreateSettlementInput,
  CreateVehicleInput,
  UpdateRepInput,
  UpdateVehicleInput,
  VanLoadInput,
  VanSaleInput,
} from './van.schema'

const vehicleInclude = {
  homeBranch: { select: { id: true, name: true, kind: true } },
  stockBranch: { select: { id: true, name: true, kind: true } },
  assignedRepUser: { select: { id: true, name: true, email: true } },
} satisfies Prisma.VehicleInclude

export async function listVehicles(tenantId: string, activeOnly = false) {
  return prisma.vehicle.findMany({
    where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { plateNumber: 'asc' },
    include: vehicleInclude,
  })
}

export async function getVehicle(tenantId: string, id: string) {
  const row = await prisma.vehicle.findFirst({
    where: { id, tenantId },
    include: vehicleInclude,
  })
  if (!row) throw new AppError('Vehicle not found', 404)
  return row
}

/** Create vehicle + Branch kind=VEHICLE as stock location. */
export async function createVehicle(tenantId: string, input: CreateVehicleInput) {
  const home = await prisma.branch.findFirst({
    where: { id: input.homeBranchId, tenantId },
    select: { id: true, name: true, address: true, city: true, state: true, phone: true, email: true },
  })
  if (!home) throw new AppError('Home branch not found', 404)

  const existing = await prisma.vehicle.findFirst({
    where: { tenantId, plateNumber: input.plateNumber.trim() },
  })
  if (existing) throw new AppError('Plate number already registered', 409)

  return prisma.$transaction(async (tx) => {
    const stockBranch = await tx.branch.create({
      data: {
        tenantId,
        name: `Van ${input.plateNumber.trim()}`,
        kind: 'VEHICLE',
        address: home.address || 'Vehicle',
        city: home.city || 'N/A',
        state: home.state || 'N/A',
        phone: home.phone || 'N/A',
        email: home.email,
        isActive: true,
      },
    })
    return tx.vehicle.create({
      data: {
        tenantId,
        plateNumber: input.plateNumber.trim(),
        name: input.name.trim(),
        homeBranchId: input.homeBranchId,
        stockBranchId: stockBranch.id,
        assignedRepUserId: input.assignedRepUserId || null,
        isActive: input.isActive ?? true,
      },
      include: vehicleInclude,
    })
  })
}

export async function updateVehicle(tenantId: string, id: string, input: UpdateVehicleInput) {
  await getVehicle(tenantId, id)
  return prisma.vehicle.update({
    where: { id },
    data: {
      ...(input.plateNumber !== undefined ? { plateNumber: input.plateNumber.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.homeBranchId !== undefined ? { homeBranchId: input.homeBranchId } : {}),
      ...(input.assignedRepUserId !== undefined
        ? { assignedRepUserId: input.assignedRepUserId }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: vehicleInclude,
  })
}

export async function listReps(tenantId: string) {
  return prisma.repProfile.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true } },
      defaultVehicle: { select: { id: true, plateNumber: true, name: true } },
    },
  })
}

export async function createRep(tenantId: string, input: CreateRepInput) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      branches: { select: { branchId: true }, take: 1 },
    },
  })
  if (!user) throw new AppError('User not found in tenant', 404)
  const existing = await prisma.repProfile.findUnique({ where: { userId: input.userId } })
  if (existing) throw new AppError('Rep profile already exists for user', 409)

  // HR commission preview attributes van invoices by Employee.userId — ensure link exists
  await ensureHrEmployeeLinkedToRep(tenantId, user)

  return prisma.repProfile.create({
    data: {
      tenantId,
      userId: input.userId,
      territoryId: input.territoryId || null,
      defaultVehicleId: input.defaultVehicleId || null,
      monthlyTarget: input.monthlyTarget ?? null,
      isActive: input.isActive ?? true,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true } },
      defaultVehicle: { select: { id: true, plateNumber: true, name: true } },
    },
  })
}

/** Create or reuse HR Employee so van sales appear in HR → Commission. */
async function ensureHrEmployeeLinkedToRep(
  tenantId: string,
  user: {
    id: string
    name: string | null
    email: string | null
    branches: Array<{ branchId: string }>
  },
) {
  const linked = await prisma.employee.findFirst({
    where: { tenantId, userId: user.id },
    select: { id: true },
  })
  if (linked) return linked

  let primaryBranchId: string | undefined = user.branches[0]?.branchId
  if (!primaryBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { tenantId, isActive: true, kind: { not: 'VEHICLE' } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    primaryBranchId = branch?.id
  }
  if (!primaryBranchId) {
    throw new AppError('Cannot link HR employee — assign the user to a branch first', 400)
  }

  const employeeCode = await nextEmployeeCode(tenantId)
  return prisma.employee.create({
    data: {
      tenantId,
      employeeCode,
      userId: user.id,
      primaryBranchId,
      fullName: (user.name || user.email || 'Sales Rep').trim(),
      email: user.email || null,
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      joinedAt: new Date(),
      notes: 'Auto-created when adding Wholesale sales rep (for commission)',
      isActive: true,
    },
    select: { id: true },
  })
}

export async function updateRep(tenantId: string, id: string, input: UpdateRepInput) {
  const row = await prisma.repProfile.findFirst({ where: { id, tenantId } })
  if (!row) throw new AppError('Rep profile not found', 404)
  return prisma.repProfile.update({
    where: { id },
    data: {
      ...(input.territoryId !== undefined ? { territoryId: input.territoryId } : {}),
      ...(input.defaultVehicleId !== undefined
        ? { defaultVehicleId: input.defaultVehicleId }
        : {}),
      ...(input.monthlyTarget !== undefined ? { monthlyTarget: input.monthlyTarget } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true } },
      defaultVehicle: { select: { id: true, plateNumber: true, name: true } },
    },
  })
}

/** Load stock onto van via stock-transfer util (warehouse → vehicle stock branch). */
export async function loadVan(
  tenantId: string,
  input: VanLoadInput,
  actor: { userId: string; role: string; performedBy: string },
) {
  const vehicle = await getVehicle(tenantId, input.vehicleId)
  const fromBranchId = input.fromBranchId || vehicle.homeBranchId
  const loadNumber = await generateVanLoadNumber(tenantId)

  const transferResults = []
  for (const line of input.lines) {
    const result = await stockTransferService.transfer(
      tenantId,
      actor.userId,
      actor.role,
      actor.performedBy,
      {
        productId: line.productId,
        fromBranchId,
        toBranchId: vehicle.stockBranchId,
        quantity: line.quantity,
        notes: input.notes || `Van load ${loadNumber}`,
        variationKey: line.variationKey,
        imeis: line.imeis,
      },
    )
    transferResults.push(result)
  }

  const sheet = await prisma.vanLoadSheet.create({
    data: {
      tenantId,
      branchId: fromBranchId,
      vehicleId: vehicle.id,
      loadNumber,
      status: 'LOADED',
      loadedAt: new Date(),
      notes: input.notes || null,
      linesJson: input.lines as object,
    },
  })

  return { loadSheet: sheet, transfers: transferResults }
}

export async function vanSale(
  tenantId: string,
  input: VanSaleInput,
  actor: { userId: string; email?: string; performedBy: string },
) {
  const vehicle = await getVehicle(tenantId, input.vehicleId)
  if (!vehicle.isActive) throw new AppError('Vehicle is inactive', 400)

  return createWholesaleInvoice({
    tenantId,
    channel: 'VAN',
    dealerId: input.dealerId,
    fulfillmentBranchId: vehicle.stockBranchId,
    vehicleId: vehicle.id,
    visitId: input.visitId || null,
    salesRepId: vehicle.assignedRepUserId || actor.userId,
    notes: input.notes,
    lines: input.lines,
    payments: input.payments,
    performedBy: actor.performedBy,
    actorUserId: actor.userId,
    actorEmail: actor.email,
  })
}

export async function createSettlement(
  tenantId: string,
  input: CreateSettlementInput,
  defaultRepUserId: string,
) {
  const vehicle = await getVehicle(tenantId, input.vehicleId)
  const repUserId = input.repUserId || vehicle.assignedRepUserId || defaultRepUserId
  const settlementDate = input.settlementDate
    ? new Date(input.settlementDate)
    : new Date()
  settlementDate.setHours(0, 0, 0, 0)

  const dayStart = new Date(settlementDate)
  const dayEnd = new Date(settlementDate)
  dayEnd.setHours(23, 59, 59, 999)

  const invoices = await prisma.wholesaleInvoice.findMany({
    where: {
      tenantId,
      vehicleId: vehicle.id,
      channel: 'VAN',
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['VOID', 'CANCELLED', 'DRAFT'] },
    },
    include: { payments: true, lines: true },
  })

  const expectedCash = round2(
    input.expectedCash ??
      invoices.reduce(
        (s, inv) =>
          s +
          inv.payments
            .filter((p) => p.method === 'CASH')
            .reduce((ps, p) => ps + p.amount, 0),
        0,
      ),
  )
  const declaredCash = input.declaredCash ?? expectedCash
  const variance = round2(declaredCash - expectedCash)
  const settlementNumber = await generateVanSettlementNumber(tenantId)

  // Aggregate sold lines
  const lineMap = new Map<
    string,
    { productId: string | null; productName: string; sku: string | null; soldQty: number }
  >()
  for (const inv of invoices) {
    for (const l of inv.lines) {
      const key = l.productId || l.productName
      const prev = lineMap.get(key) || {
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        soldQty: 0,
      }
      prev.soldQty += l.stockQty || l.quantity
      lineMap.set(key, prev)
    }
  }

  const buckets =
    input.paymentBuckets ||
    (() => {
      const m = new Map<string, number>()
      for (const inv of invoices) {
        for (const p of inv.payments) {
          m.set(p.method, round2((m.get(p.method) || 0) + p.amount))
        }
      }
      return [...m.entries()].map(([method, amount]) => ({ method: method as never, amount }))
    })()

  return prisma.vanSettlement.create({
    data: {
      tenantId,
      branchId: input.branchId || vehicle.homeBranchId,
      vehicleId: vehicle.id,
      repUserId,
      settlementNumber,
      settlementDate,
      status: 'DRAFT',
      expectedCash,
      declaredCash,
      variance,
      notes: input.notes || null,
      lines: {
        create: [...lineMap.values()].map((l) => ({
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          soldQty: l.soldQty,
          openingQty: 0,
          loadedQty: 0,
          returnedQty: 0,
          closingQty: 0,
          varianceQty: 0,
        })),
      },
      paymentBuckets: {
        create: buckets.map((b) => ({
          method: b.method,
          amount: b.amount,
        })),
      },
    },
    include: { lines: true, paymentBuckets: true, vehicle: true, repUser: { select: { id: true, name: true, email: true } } },
  })
}

export async function submitSettlement(tenantId: string, id: string) {
  const row = await prisma.vanSettlement.findFirst({ where: { id, tenantId } })
  if (!row) throw new AppError('Settlement not found', 404)
  if (row.status !== 'DRAFT') throw new AppError(`Cannot submit ${row.status} settlement`, 400)
  return prisma.vanSettlement.update({
    where: { id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    include: { lines: true, paymentBuckets: true },
  })
}

export async function approveSettlement(
  tenantId: string,
  id: string,
  approvedByEmail?: string,
) {
  const row = await prisma.vanSettlement.findFirst({ where: { id, tenantId } })
  if (!row) throw new AppError('Settlement not found', 404)
  if (row.status !== 'SUBMITTED') throw new AppError(`Cannot approve ${row.status} settlement`, 400)
  return prisma.vanSettlement.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByEmail: approvedByEmail || null,
    },
    include: { lines: true, paymentBuckets: true },
  })
}

export async function listSettlements(
  tenantId: string,
  opts: { skip: number; limit: number; status?: string; vehicleId?: string },
) {
  const where: Prisma.VanSettlementWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.vehicleId ? { vehicleId: opts.vehicleId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.vanSettlement.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { settlementDate: 'desc' },
      include: {
        vehicle: { select: { id: true, plateNumber: true, name: true } },
        repUser: { select: { id: true, name: true, email: true } },
        paymentBuckets: true,
      },
    }),
    prisma.vanSettlement.count({ where }),
  ])
  return { data, total }
}

export async function upsertVisit(
  tenantId: string,
  repUserId: string,
  input: import('./van.schema').UpsertVisitInput,
) {
  const dealer = await prisma.dealer.findFirst({ where: { id: input.dealerId, tenantId } })
  if (!dealer) throw new AppError('Dealer not found', 404)

  if (input.id) {
    const existing = await prisma.repVisit.findFirst({ where: { id: input.id, tenantId } })
    if (!existing) throw new AppError('Visit not found', 404)
    return prisma.repVisit.update({
      where: { id: existing.id },
      data: {
        vehicleId: input.vehicleId === undefined ? undefined : input.vehicleId,
        status: input.status as never,
        plannedAt: input.plannedAt === undefined ? undefined : input.plannedAt ? new Date(input.plannedAt) : null,
        notes: input.notes === undefined ? undefined : input.notes,
        checkedInAt: input.checkIn ? new Date() : undefined,
        completedAt: input.complete ? new Date() : undefined,
        ...(input.checkIn && !input.status ? { status: 'CHECKED_IN' as never } : {}),
        ...(input.complete && !input.status ? { status: 'COMPLETED' as never } : {}),
      },
      include: { dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true } } },
    })
  }

  return prisma.repVisit.create({
    data: {
      tenantId,
      dealerId: input.dealerId,
      repUserId,
      vehicleId: input.vehicleId || null,
      status: (input.status as never) || (input.checkIn ? 'CHECKED_IN' : 'PLANNED'),
      plannedAt: input.plannedAt ? new Date(input.plannedAt) : new Date(),
      checkedInAt: input.checkIn ? new Date() : null,
      completedAt: input.complete ? new Date() : null,
      notes: input.notes || null,
    },
    include: { dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true } } },
  })
}

export async function listVisits(
  tenantId: string,
  opts: { skip: number; limit: number; repUserId?: string },
) {
  const where: Prisma.RepVisitWhereInput = {
    tenantId,
    ...(opts.repUserId ? { repUserId: opts.repUserId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.repVisit.findMany({
      where,
      skip: opts.skip,
      take: opts.limit,
      orderBy: { plannedAt: 'desc' },
      include: {
        dealer: { select: { id: true, legalName: true, tradingName: true, dealerCode: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, name: true } },
      },
    }),
    prisma.repVisit.count({ where }),
  ])
  return { data, total }
}
