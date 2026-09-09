process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hexalyte_emi_accept'

async function main() {
  const { prisma } = await import('../../config/database')
  const devices = await prisma.managedDevice.findMany({
    where: { tenant: { slug: 'emi-phase4-browser' } },
    select: { id: true },
  })
  for (const d of devices) {
    await prisma.deviceCommand.deleteMany({ where: { deviceId: d.id } })
    await prisma.deviceEvent.deleteMany({ where: { deviceId: d.id } })
    await prisma.deviceEnrollment.deleteMany({ where: { deviceId: d.id } })
    await prisma.managedDevice.delete({ where: { id: d.id } })
  }
  console.log(`removed ${devices.length} browser-tenant devices`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
