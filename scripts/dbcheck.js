const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const count = await p.sale.count()
  const tenants = await p.tenant.findMany({ select: { id: true, name: true } })
  const sales = await p.sale.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { tenantId: true, invoiceNumber: true, total: true, status: true, createdAt: true } })
  console.log('TOTAL_SALES:', count)
  console.log('TENANTS:', JSON.stringify(tenants, null, 2))
  console.log('RECENT_SALES:', JSON.stringify(sales, null, 2))
}
main().catch(console.error).finally(() => p.$disconnect())
