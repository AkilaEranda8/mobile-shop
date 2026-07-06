import { prisma } from '../../config/database'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

export async function getAccountingStatus(tenantId: string) {
  const enabled = await isTenantFeatureEnabled(tenantId, 'ACCOUNTING')
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  const [accountCount, periodCount, journalCount, outboxPending] = await Promise.all([
    prisma.glAccount.count({ where: { tenantId } }),
    prisma.accountingPeriod.count({ where: { tenantId } }),
    prisma.journalEntry.count({ where: { tenantId } }),
    prisma.accountingOutbox.count({ where: { tenantId, status: 'PENDING' } }),
  ])
  const currentPeriod = await prisma.accountingPeriod.findFirst({
    where: { tenantId, status: 'OPEN' },
    orderBy: { startDate: 'desc' },
  })
  return {
    enabled,
    initialized: !!settings?.initializedAt,
    initializedAt: settings?.initializedAt ?? null,
    baseCurrency: settings?.baseCurrency ?? 'LKR',
    autoPostEnabled: settings?.autoPostEnabled ?? true,
    accountCount,
    periodCount,
    journalCount,
    outboxPending,
    currentPeriod: currentPeriod
      ? { id: currentPeriod.id, name: currentPeriod.name, status: currentPeriod.status }
      : null,
  }
}

export async function listGlAccounts(tenantId: string, branchId?: string) {
  return prisma.glAccount.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: branchId
        ? [{ branchId: null }, { branchId }]
        : [{ branchId: null }],
    },
    orderBy: [{ code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subtype: true,
      branchId: true,
      isControlAccount: true,
      isSystem: true,
      parentAccountId: true,
    },
  })
}
