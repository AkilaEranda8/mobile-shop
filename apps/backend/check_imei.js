const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const records = await prisma.imeiRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { product: true }
  })
  console.log("RECENT IMEIs:")
  records.forEach(r => {
    console.log(`IMEI: ${r.imei} | Variation: ${r.variation} | Product: ${r.product?.name}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
