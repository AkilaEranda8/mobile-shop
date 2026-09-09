/**
 * Phase 4 local API for browser smoke (accept DB + mocked Redis).
 * Keeps AMAPI disabled / dry-run on.
 *
 * Run: npx tsx src/modules/emi-locker/phase4-dev-server.ts
 */
process.env.DATABASE_URL =
  process.env.PHASE4_DATABASE_URL
  || process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/hexalyte_emi_accept'
process.env.EMI_LOCKER_ENABLED = 'true'
process.env.EMI_LOCKER_DRY_RUN = 'true'
process.env.ANDROID_MANAGEMENT_ENABLED = 'false'
process.env.KEYCLOAK_AUTH_ENABLED = 'false'
process.env.PORT = process.env.PORT || '3001'

async function main() {
  const { redis } = await import('../../config/redis')
  ;(redis as any).get = async () => null
  ;(redis as any).set = async () => 'OK'
  ;(redis as any).del = async () => 1
  ;(redis as any).connect = async () => undefined
  ;(redis as any).quit = async () => 'OK'
  ;(redis as any).status = 'ready'

  const { prisma } = await import('../../config/database')
  const bcryptMod = await import('bcryptjs')
  const bcrypt = (bcryptMod as any).default || bcryptMod

  // Fixed browser smoke credentials
  const email = 'emi-phase4-owner@hexalyte.test'
  const password = 'Phase4@Test1'
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'emi-phase4-browser' } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'EMI Phase4 Browser Tenant',
        slug: 'emi-phase4-browser',
        ownerEmail: email,
        ownerName: 'Phase4 Owner',
        status: 'ACTIVE',
        features: {
          create: [
            { feature: 'HIRE_PURCHASE', enabled: true },
            { feature: 'EMI_LOCKER', enabled: true },
          ],
        },
      },
    })
  } else {
    for (const feature of ['HIRE_PURCHASE', 'EMI_LOCKER']) {
      await prisma.tenantFeature.upsert({
        where: { tenantId_feature: { tenantId: tenant.id, feature } },
        create: { tenantId: tenant.id, feature, enabled: true },
        update: { enabled: true },
      })
    }
  }

  let branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } })
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Browser HQ',
        address: '1 Browser St',
        city: 'Colombo',
        state: 'WP',
        phone: '0112223333',
        isHeadquarters: true,
        isDefault: true,
      },
    })
  }

  const hash = await bcrypt.hash(password, 10)
  let user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: 'Phase4 Owner',
        password: hash,
        role: 'OWNER',
        branches: { create: [{ branchId: branch.id }] },
      },
    })
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { password: hash, role: 'OWNER', isActive: true } })
  }

  const app = (await import('../../app')).default
  app.listen(parseInt(process.env.PORT!, 10), () => {
    console.log(`PHASE4_DEV_SERVER http://localhost:${process.env.PORT}/api/v1`)
    console.log(`LOGIN ${email} / ${password}`)
    console.log('EMI_LOCKER_DRY_RUN=true ANDROID_MANAGEMENT_ENABLED=false')
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
