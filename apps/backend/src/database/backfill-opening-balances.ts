/**
 * Backfill opening-balance GL journals for supplier AP and customer AR.
 * Run: npx tsx src/database/backfill-opening-balances.ts [tenant-id-or-slug]
 */
import { PrismaClient } from '@prisma/client'
import {
  postOpeningCustomerArJournal,
  postOpeningSupplierApJournal,
} from '../modules/accounting/integration/auto-journal.engine'

const prisma = new PrismaClient()
const ACTOR = 'backfill-opening-balances'

async function main() {
  const key = process.argv[2]?.trim()
  let tenantId: string | undefined

  if (key) {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      select: { id: true, slug: true, name: true },
    })
    if (!tenant) {
      console.error(`Tenant not found: ${key}`)
      process.exit(1)
    }
    tenantId = tenant.id
    console.log(`Tenant: ${tenant.name} (${tenant.slug})`)
  }

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      notes: { contains: 'OPENING_BALANCE' },
      receivedAt: null,
      total: { gt: 0 },
    },
    select: { id: true, poNumber: true, tenantId: true, supplierName: true, total: true },
    orderBy: { createdAt: 'asc' },
  })

  const sales = await prisma.sale.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      source: 'OPENING_BALANCE',
      total: { gt: 0 },
    },
    select: { id: true, invoiceNumber: true, tenantId: true, customerName: true, total: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${pos.length} opening supplier PO(s), ${sales.length} opening customer sale(s)`)
  let posted = 0
  let skipped = 0

  for (const po of pos) {
    const settings = await prisma.accountingSettings.findUnique({
      where: { tenantId: po.tenantId },
      select: { initializedAt: true },
    })
    if (!settings?.initializedAt) {
      console.log(`Skip ${po.poNumber} — accounting not initialized`)
      skipped += 1
      continue
    }

    const linked = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId: po.tenantId,
          sourceType: 'PurchaseOrder',
          sourceId: po.id,
          eventType: 'OPENING_SUPPLIER_AP',
        },
      },
    })
    if (linked) {
      console.log(`Skip ${po.poNumber} — already linked`)
      skipped += 1
      continue
    }

    const je = await postOpeningSupplierApJournal(po.tenantId, po.id, ACTOR)
    if (je) {
      console.log(`Posted supplier AP ${po.poNumber} (${po.supplierName}) ${po.total} → ${je.entryNo}`)
      posted += 1
    } else {
      skipped += 1
    }
  }

  for (const sale of sales) {
    const settings = await prisma.accountingSettings.findUnique({
      where: { tenantId: sale.tenantId },
      select: { initializedAt: true },
    })
    if (!settings?.initializedAt) {
      console.log(`Skip ${sale.invoiceNumber} — accounting not initialized`)
      skipped += 1
      continue
    }

    const linked = await prisma.integrationLink.findUnique({
      where: {
        tenantId_sourceType_sourceId_eventType: {
          tenantId: sale.tenantId,
          sourceType: 'Sale',
          sourceId: sale.id,
          eventType: 'OPENING_CUSTOMER_AR',
        },
      },
    })
    if (linked) {
      console.log(`Skip ${sale.invoiceNumber} — already linked`)
      skipped += 1
      continue
    }

    const je = await postOpeningCustomerArJournal(sale.tenantId, sale.id, ACTOR)
    if (je) {
      console.log(`Posted customer AR ${sale.invoiceNumber} (${sale.customerName}) ${sale.total} → ${je.entryNo}`)
      posted += 1
    } else {
      skipped += 1
    }
  }

  console.log(`Done. posted=${posted} skipped=${skipped}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
