import { Prisma, type DealerStatus } from '@prisma/client'
import { prisma } from '../../../config/database'
import { AppError } from '../../../middleware/error.middleware'
import type { CreateDealerInput, UpdateDealerInput } from './dealers.schema'

const dealerInclude = {
  tier: { select: { id: true, name: true, code: true } },
  assignedSalesRep: { select: { id: true, name: true, email: true } },
  branch: { select: { id: true, name: true } },
  addresses: true,
  _count: { select: { invoices: true, payments: true } },
} as const

async function nextDealerCode(tenantId: string): Promise<string> {
  const last = await prisma.dealer.findFirst({
    where: { tenantId, dealerCode: { startsWith: 'DLR-' } },
    orderBy: { dealerCode: 'desc' },
    select: { dealerCode: true },
  })
  let seq = 1
  if (last?.dealerCode) {
    const n = parseInt(last.dealerCode.replace(/^DLR-/, ''), 10)
    if (!Number.isNaN(n)) seq = n + 1
  }
  return `DLR-${String(seq).padStart(4, '0')}`
}

function normalizeEmail(email?: string | null) {
  if (!email || email === '') return null
  return email
}

export async function listDealers(
  tenantId: string,
  opts: {
    skip: number
    limit: number
    search?: string
    status?: DealerStatus
    branchId?: string | null
    isActive?: boolean
  },
) {
  const and: Prisma.DealerWhereInput[] = []
  if (opts.branchId) {
    // Explicit branch still includes tenant-wide (null branch) dealers
    and.push({ OR: [{ branchId: opts.branchId }, { branchId: null }] })
  }
  if (opts.search) {
    and.push({
      OR: [
        { legalName: { contains: opts.search, mode: 'insensitive' } },
        { tradingName: { contains: opts.search, mode: 'insensitive' } },
        { dealerCode: { contains: opts.search, mode: 'insensitive' } },
        { phone: { contains: opts.search, mode: 'insensitive' } },
        { email: { contains: opts.search, mode: 'insensitive' } },
      ],
    })
  }

  const where: Prisma.DealerWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(typeof opts.isActive === 'boolean' ? { isActive: opts.isActive } : {}),
    ...(and.length ? { AND: and } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.dealer.findMany({
      where,
      include: dealerInclude,
      orderBy: { createdAt: 'desc' },
      skip: opts.skip,
      take: opts.limit,
    }),
    prisma.dealer.count({ where }),
  ])
  return { data, total }
}

export async function getDealer(tenantId: string, id: string) {
  const dealer = await prisma.dealer.findFirst({
    where: { id, tenantId },
    include: dealerInclude,
  })
  if (!dealer) throw new AppError('Dealer not found', 404)
  return dealer
}

export async function createDealer(tenantId: string, input: CreateDealerInput) {
  const dealerCode = input.dealerCode?.trim() || (await nextDealerCode(tenantId))
  const existing = await prisma.dealer.findFirst({
    where: { tenantId, dealerCode },
    select: { id: true },
  })
  if (existing) throw new AppError(`Dealer code ${dealerCode} already exists`, 409)

  if (input.tierId) {
    const tier = await prisma.dealerTier.findFirst({ where: { id: input.tierId, tenantId } })
    if (!tier) throw new AppError('Dealer tier not found', 404)
  }

  return prisma.dealer.create({
    data: {
      tenantId,
      dealerCode,
      legalName: input.legalName.trim(),
      tradingName: input.tradingName?.trim() || null,
      phone: input.phone.trim(),
      email: normalizeEmail(input.email),
      taxId: input.taxId?.trim() || null,
      branchId: input.branchId || null,
      creditLimit: input.creditLimit ?? 0,
      paymentTermsDays: input.paymentTermsDays ?? 0,
      cashOnly: input.cashOnly ?? false,
      assignedSalesRepId: input.assignedSalesRepId || null,
      tierId: input.tierId || null,
      customerId: input.customerId || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'DRAFT',
    },
    include: dealerInclude,
  })
}

export async function updateDealer(tenantId: string, id: string, input: UpdateDealerInput) {
  await getDealer(tenantId, id)

  if (input.dealerCode) {
    const clash = await prisma.dealer.findFirst({
      where: { tenantId, dealerCode: input.dealerCode, NOT: { id } },
      select: { id: true },
    })
    if (clash) throw new AppError(`Dealer code ${input.dealerCode} already exists`, 409)
  }
  if (input.tierId) {
    const tier = await prisma.dealerTier.findFirst({ where: { id: input.tierId, tenantId } })
    if (!tier) throw new AppError('Dealer tier not found', 404)
  }

  return prisma.dealer.update({
    where: { id },
    data: {
      ...(input.dealerCode !== undefined ? { dealerCode: input.dealerCode.trim() } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName.trim() } : {}),
      ...(input.tradingName !== undefined ? { tradingName: input.tradingName?.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() || null } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId || null } : {}),
      ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
      ...(input.paymentTermsDays !== undefined ? { paymentTermsDays: input.paymentTermsDays } : {}),
      ...(input.cashOnly !== undefined ? { cashOnly: input.cashOnly } : {}),
      ...(input.assignedSalesRepId !== undefined
        ? { assignedSalesRepId: input.assignedSalesRepId || null }
        : {}),
      ...(input.tierId !== undefined ? { tierId: input.tierId || null } : {}),
      ...(input.customerId !== undefined ? { customerId: input.customerId || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: dealerInclude,
  })
}

async function setDealerStatus(
  tenantId: string,
  id: string,
  status: DealerStatus,
  notes?: string,
) {
  const dealer = await getDealer(tenantId, id)
  return prisma.dealer.update({
    where: { id },
    data: {
      status,
      ...(notes !== undefined
        ? { notes: [dealer.notes, notes].filter(Boolean).join('\n') || notes }
        : {}),
      isActive: status === 'ACTIVE' || status === 'ON_HOLD' ? true : dealer.isActive,
    },
    include: dealerInclude,
  })
}

export async function approveDealer(tenantId: string, id: string, notes?: string) {
  const dealer = await getDealer(tenantId, id)
  if (dealer.status === 'CLOSED') throw new AppError('Cannot approve a closed dealer', 400)
  return setDealerStatus(tenantId, id, 'ACTIVE', notes)
}

export async function holdDealer(tenantId: string, id: string, notes?: string) {
  const dealer = await getDealer(tenantId, id)
  if (dealer.status === 'CLOSED') throw new AppError('Cannot hold a closed dealer', 400)
  return setDealerStatus(tenantId, id, 'ON_HOLD', notes)
}

export async function suspendDealer(tenantId: string, id: string, notes?: string) {
  const dealer = await getDealer(tenantId, id)
  if (dealer.status === 'CLOSED') throw new AppError('Cannot suspend a closed dealer', 400)
  return setDealerStatus(tenantId, id, 'SUSPENDED', notes)
}
