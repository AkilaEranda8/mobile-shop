import { prisma } from '../../config/database'
import { MOBILE_SHOP_COA, DEFAULT_ACCOUNT_KEYS } from './seed/mobile-shop-coa.seed'

function currentPeriodName(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }).slice(0, 7)
}

function periodBounds(name: string) {
  const [y, m] = name.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0))
  return { start, end }
}

export async function initializeAccounting(tenantId: string, actorEmail = 'system') {
  const existing = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (existing?.initializedAt) {
    return { alreadyInitialized: true, settings: existing }
  }

  const branches = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true },
  })

  await prisma.$transaction(async tx => {
    for (const row of MOBILE_SHOP_COA) {
      await tx.glAccount.upsert({
        where: { tenantId_code: { tenantId, code: row.code } },
        create: {
          tenantId,
          code: row.code,
          name: row.name,
          type: row.type,
          subtype: row.subtype as import('@prisma/client').GlAccountSubtype,
          isControlAccount: row.isControlAccount ?? false,
          isSystem: row.isSystem ?? false,
          isActive: true,
        },
        update: {},
      })
    }

    for (const branch of branches) {
      const branchCode = `1000-${branch.id.slice(-4)}`
      const cashGl = await tx.glAccount.upsert({
        where: { tenantId_code: { tenantId, code: branchCode } },
        create: {
          tenantId,
          branchId: branch.id,
          code: branchCode,
          name: `Cash on Hand — ${branch.name}`,
          type: 'ASSET',
          subtype: 'CASH',
          isSystem: true,
          isActive: true,
        },
        update: {},
      })
      await tx.cashAccount.upsert({
        where: { tenantId_branchId_name: { tenantId, branchId: branch.id, name: 'Main Cash' } },
        create: {
          tenantId,
          branchId: branch.id,
          name: 'Main Cash',
          glAccountId: cashGl.id,
        },
        update: { glAccountId: cashGl.id },
      })
    }

    const periodName = currentPeriodName()
    const { start, end } = periodBounds(periodName)
    await tx.accountingPeriod.upsert({
      where: { tenantId_name: { tenantId, name: periodName } },
      create: {
        tenantId,
        name: periodName,
        startDate: start,
        endDate: end,
        status: 'OPEN',
      },
      update: {},
    })

    const accounts = await tx.glAccount.findMany({
      where: { tenantId, branchId: null },
      select: { id: true, code: true },
    })
    const byCode = Object.fromEntries(accounts.map(a => [a.code, a.id]))
    const defaultAccounts: Record<string, string> = {}
    for (const [key, code] of Object.entries(DEFAULT_ACCOUNT_KEYS)) {
      const id = byCode[code]
      if (id) defaultAccounts[key] = id
    }

    if (defaultAccounts.vatOutput) {
      await tx.taxCode.upsert({
        where: { tenantId_code: { tenantId, code: 'VAT18' } },
        create: {
          tenantId,
          code: 'VAT18',
          name: 'VAT 18%',
          rate: 18,
          type: 'OUTPUT',
          glAccountId: defaultAccounts.vatOutput,
          isActive: true,
        },
        update: {},
      })
    }

    if (defaultAccounts.vatInput) {
      await tx.taxCode.upsert({
        where: { tenantId_code: { tenantId, code: 'VAT18_IN' } },
        create: {
          tenantId,
          code: 'VAT18_IN',
          name: 'VAT 18% Input',
          rate: 18,
          type: 'INPUT',
          glAccountId: defaultAccounts.vatInput,
          isActive: true,
        },
        update: {},
      })
    }

    const pettyGlId = defaultAccounts.pettyCash
    for (const branch of branches) {
      if (pettyGlId) {
        await tx.cashAccount.upsert({
          where: { tenantId_branchId_name: { tenantId, branchId: branch.id, name: 'Petty Cash' } },
          create: { tenantId, branchId: branch.id, name: 'Petty Cash', glAccountId: pettyGlId },
          update: { glAccountId: pettyGlId },
        })
      }
    }

    if (defaultAccounts.bank) {
      await tx.bankAccount.upsert({
        where: { tenantId_name: { tenantId, name: 'Main Bank' } },
        create: {
          tenantId,
          name: 'Main Bank',
          bankName: 'Main',
          glAccountId: defaultAccounts.bank,
        },
        update: { glAccountId: defaultAccounts.bank },
      })
    }

    await tx.accountingSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        initializedAt: new Date(),
        defaultAccounts,
        expenseCategoryMap: {},
      },
      update: {
        initializedAt: new Date(),
        defaultAccounts,
      },
    })

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorEmail,
        eventType: 'ACCOUNTING_INITIALIZED',
        entityType: 'AccountingSettings',
        entityId: tenantId,
        afterJson: { periodName, accountCount: MOBILE_SHOP_COA.length, branchCount: branches.length },
      },
    })
  })

  const settings = await prisma.accountingSettings.findUniqueOrThrow({ where: { tenantId } })
  return { alreadyInitialized: false, settings }
}

/** Idempotent — backfill bank, petty cash, VAT input for tenants initialized before these were added */
export async function ensureAccountingRegisters(tenantId: string) {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!settings?.initializedAt) return

  const map = (settings.defaultAccounts ?? {}) as Record<string, string>
  const branches = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  })

  if (map.pettyCash) {
    for (const branch of branches) {
      await prisma.cashAccount.upsert({
        where: { tenantId_branchId_name: { tenantId, branchId: branch.id, name: 'Petty Cash' } },
        create: { tenantId, branchId: branch.id, name: 'Petty Cash', glAccountId: map.pettyCash },
        update: { glAccountId: map.pettyCash },
      })
    }
  }

  if (map.bank) {
    await prisma.bankAccount.upsert({
      where: { tenantId_name: { tenantId, name: 'Main Bank' } },
      create: { tenantId, name: 'Main Bank', bankName: 'Main', glAccountId: map.bank },
      update: { glAccountId: map.bank },
    })
  }

  if (map.vatInput) {
    await prisma.taxCode.upsert({
      where: { tenantId_code: { tenantId, code: 'VAT18_IN' } },
      create: {
        tenantId,
        code: 'VAT18_IN',
        name: 'VAT 18% Input',
        rate: 18,
        type: 'INPUT',
        glAccountId: map.vatInput,
        isActive: true,
      },
      update: {},
    })
  }

  for (const [key, code] of [['epfPayable', '2310'], ['etfPayable', '2311']] as const) {
    const row = MOBILE_SHOP_COA.find(r => r.code === code)
    if (!row) continue
    await prisma.glAccount.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: {
        tenantId,
        code: row.code,
        name: row.name,
        type: row.type,
        subtype: row.subtype as import('@prisma/client').GlAccountSubtype,
        isSystem: row.isSystem ?? false,
        isActive: true,
      },
      update: {},
    })
    if (!map[key]) {
      const gl = await prisma.glAccount.findUnique({ where: { tenantId_code: { tenantId, code } } })
      if (gl) map[key] = gl.id
    }
  }

  if (Object.keys(map).length) {
    await prisma.accountingSettings.update({
      where: { tenantId },
      data: { defaultAccounts: map },
    })
  }
}

export async function onAccountingFeatureEnabled(tenantId: string, actorEmail = 'system') {
  return initializeAccounting(tenantId, actorEmail)
}
