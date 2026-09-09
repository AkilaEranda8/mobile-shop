/**
 * Phase 4 — real HTTP + JWT acceptance for EMI Locker.
 *
 * Starts Express in-process against hexalyte_emi_accept.
 * Redis is mocked by default; set USE_REAL_REDIS=1 to use REDIS_URL (no mock).
 * (no Google AMAPI; dry-run forced).
 *
 * Run: npx tsx src/modules/emi-locker/phase4-http.acceptance.ts
 * Real Redis: USE_REAL_REDIS=1 npx tsx src/modules/emi-locker/phase4-http.acceptance.ts
 */
process.env.DATABASE_URL =
  process.env.PHASE3_DATABASE_URL
  || process.env.PHASE4_DATABASE_URL
  || process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/hexalyte_emi_accept'
process.env.EMI_LOCKER_ENABLED = 'true'
process.env.EMI_LOCKER_DRY_RUN = 'true'
process.env.ANDROID_MANAGEMENT_ENABLED = 'false'
process.env.KEYCLOAK_AUTH_ENABLED = 'false'
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []

function expect(name: string, cond: boolean, detail?: string) {
  checks.push({ name, pass: !!cond, detail })
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) throw new Error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
}

function soft(name: string, cond: boolean, detail?: string) {
  checks.push({ name, pass: !!cond, detail })
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('\n=== PHASE 4 HTTP ACCEPTANCE ===')
  console.log('DB=', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))

  const { redis, connectRedis } = await import('../../config/redis')
  const useRealRedis = process.env.USE_REAL_REDIS === '1' || process.env.USE_REAL_REDIS === 'true'
  if (useRealRedis) {
    console.log('Redis mode=REAL', process.env.REDIS_URL || 'redis://localhost:6379')
    await connectRedis()
    const pong = await redis.ping()
    if (pong !== 'PONG') throw new Error(`Redis ping failed: ${pong}`)
  } else {
    console.log('Redis mode=MOCK')
    ;(redis as any).get = async () => null
    ;(redis as any).set = async () => 'OK'
    ;(redis as any).del = async () => 1
    ;(redis as any).connect = async () => undefined
    ;(redis as any).quit = async () => 'OK'
    ;(redis as any).status = 'ready'
  }

  const { prisma } = await import('../../config/database')
  const { signAccessToken } = await import('../../utils/jwt')
  const { calculateHirePurchase } = await import('../hire-purchase/hp-calc.util')
  const bcryptMod = await import('bcryptjs')
  const bcrypt = (bcryptMod as any).default || bcryptMod
  const http = await import('http')
  const app = (await import('../../app')).default

  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no listen port')
  const base = `http://127.0.0.1:${addr.port}/api/v1`
  console.log('HTTP base=', base)

  const stamp = Date.now().toString(36)
  const passwordHash = await bcrypt.hash('Phase4@Test1', 10)

  async function seedTenant(slug: string, name: string) {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: `${slug}-${stamp}`,
        ownerEmail: `${slug}-${stamp}@hexalyte.test`,
        ownerName: name,
        status: 'ACTIVE',
        features: {
          create: [
            { feature: 'HIRE_PURCHASE', enabled: true },
            { feature: 'EMI_LOCKER', enabled: true },
          ],
        },
      },
    })
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: `${name} HQ`,
        address: '1 Test',
        city: 'Colombo',
        state: 'WP',
        phone: '0111111111',
        isHeadquarters: true,
        isDefault: true,
      },
    })
    const branch2 = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: `${name} B2`,
        address: '2 Test',
        city: 'Kandy',
        state: 'CP',
        phone: '0811111111',
      },
    })

    async function user(role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'TECHNICIAN', emailPrefix: string, branches: string[]) {
      const u = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `${emailPrefix}-${stamp}@hexalyte.test`,
          name: `${role} ${name}`,
          password: passwordHash,
          role,
          branches: {
            create: branches.map((branchId) => ({ branchId })),
          },
        },
      })
      const token = signAccessToken({
        userId: u.id,
        tenantId: tenant.id,
        role,
        email: u.email,
      })
      return { user: u, token }
    }

    const owner = await user('OWNER', `${slug}-owner`, [branch.id, branch2.id])
    const manager = await user('MANAGER', `${slug}-mgr`, [branch.id, branch2.id])
    const cashier = await user('CASHIER', `${slug}-cash`, [branch.id])
    const tech = await user('TECHNICIAN', `${slug}-tech`, [branch.id])
    const branchOnly = await user('MANAGER', `${slug}-b2only`, [branch2.id])

    return { tenant, branch, branch2, owner, manager, cashier, tech, branchOnly }
  }

  const A = await seedTenant('p4a', 'Phase4 Tenant A')
  const B = await seedTenant('p4b', 'Phase4 Tenant B')

  // Restrict cashier EMI_LOCKER to view-only via tenant matrix
  await prisma.tenant.update({
    where: { id: A.tenant.id },
    data: {
      rolePermissions: {
        OWNER: { EMI_LOCKER: 'edit' },
        MANAGER: { EMI_LOCKER: 'edit' },
        CASHIER: { EMI_LOCKER: 'view' },
        TECHNICIAN: { EMI_LOCKER: 'hide' },
      },
    },
  })

  async function api(
    method: string,
    path: string,
    opts?: { token?: string | null; body?: unknown; branchId?: string; expectStatus?: number | number[] },
  ) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts?.token) headers.Authorization = `Bearer ${opts.token}`
    if (opts?.branchId) headers['x-active-branch-id'] = opts.branchId
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    let json: any = null
    const text = await res.text()
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
    if (opts?.expectStatus !== undefined) {
      const allowed = Array.isArray(opts.expectStatus) ? opts.expectStatus : [opts.expectStatus]
      expect(
        `${method} ${path} → ${allowed.join('|')}`,
        allowed.includes(res.status),
        `got ${res.status} body=${JSON.stringify(json)?.slice(0, 180)}`,
      )
    }
    return { status: res.status, json }
  }

  // ── Auth matrix on dashboard ──
  console.log('\n-- Auth matrix --')
  await api('GET', '/emi-locker/dashboard', { token: null, expectStatus: 401 })
  await api('GET', '/emi-locker/dashboard', { token: 'not-a-jwt', expectStatus: 401 })
  const expired = signAccessToken({
    userId: A.owner.user.id,
    tenantId: A.tenant.id,
    role: 'OWNER',
    email: A.owner.user.email,
  })
  // craft expired token
  const jwt = await import('jsonwebtoken')
  const { env } = await import('../../config/env')
  const expiredTok = jwt.default.sign(
    { userId: A.owner.user.id, tenantId: A.tenant.id, role: 'OWNER', email: A.owner.user.email },
    env.JWT_SECRET,
    { expiresIn: -10 },
  )
  await api('GET', '/emi-locker/dashboard', { token: expiredTok, expectStatus: 401 })
  void expired
  await api('GET', '/emi-locker/dashboard', { token: A.owner.token, branchId: A.branch.id, expectStatus: 200 })
  await api('GET', '/emi-locker/dashboard', { token: A.tech.token, branchId: A.branch.id, expectStatus: 403 })
  await api('GET', '/emi-locker/dashboard', { token: A.cashier.token, branchId: A.branch.id, expectStatus: 200 })

  // Seed HP + device under A via HTTP
  console.log('\n-- Seed catalog / HP / device --')
  const category = await prisma.category.create({
    data: { tenantId: A.tenant.id, name: 'Phones', slug: `p4-phones-${stamp}` },
  })
  const brand = await prisma.brand.create({
    data: { tenantId: A.tenant.id, name: `P4Brand-${stamp}` },
  })
  const product = await prisma.product.create({
    data: {
      tenantId: A.tenant.id,
      branchId: A.branch.id,
      name: 'EMI Locker Test Android Device',
      sku: `P4-${stamp}`,
      categoryId: category.id,
      brandId: brand.id,
      buyingPrice: 20000,
      sellingPrice: 30000,
      mrp: 30000,
      trackImei: true,
      stock: 1,
    },
  })
  const customer = await prisma.customer.create({
    data: {
      tenantId: A.tenant.id,
      branchId: A.branch.id,
      name: 'EMI Locker Test Customer',
      phone: `070${stamp.slice(-7).padStart(7, '0')}`,
    },
  })
  const imeiVal = `9988${String(Date.now()).slice(-11)}`.slice(0, 15)
  const imei = await prisma.imeiRecord.create({
    data: {
      imei: imeiVal,
      productId: product.id,
      branchId: A.branch.id,
      customerId: customer.id,
      status: 'UNDER_HIRE_PURCHASE',
    },
  })
  const firstDue = new Date()
  firstDue.setUTCDate(firstDue.getUTCDate() - 10)
  const calc = calculateHirePurchase({
    cashPrice: 30000,
    downPayment: 5000,
    interestType: 'NONE',
    interestRate: 0,
    installmentMonths: 5,
    firstDueDate: firstDue,
  })
  const agreement = await prisma.hirePurchaseAgreement.create({
    data: {
      tenantId: A.tenant.id,
      branchId: A.branch.id,
      agreementNumber: `HP-P4-${stamp}`,
      customerId: customer.id,
      productId: product.id,
      imeiRecordId: imei.id,
      productName: product.name,
      brandName: brand.name,
      modelName: 'Test',
      imei: imeiVal,
      cashPrice: calc.cashPrice,
      downPayment: calc.downPayment,
      financeAmount: calc.financeAmount,
      interestType: 'NONE',
      interestAmount: 0,
      installmentMonths: 5,
      monthlyInstallment: calc.monthlyInstallment,
      totalPayable: calc.totalPayable,
      paidAmount: 5000,
      outstandingBalance: 25000,
      gracePeriodDays: 0,
      dueDay: firstDue.getUTCDate(),
      firstDueDate: firstDue,
      status: 'ACTIVE',
      approvedAt: new Date(),
      installments: {
        create: calc.schedule.map((line) => ({
          tenantId: A.tenant.id,
          branchId: A.branch.id,
          sequence: line.sequence,
          dueDate: line.sequence === 1 ? new Date(Date.UTC(2020, 0, 1)) : line.dueDate,
          principal: line.principal,
          interest: line.interest,
          fees: line.fees,
          totalDue: line.totalDue,
          paidAmount: 0,
          outstanding: line.outstanding,
          status: line.sequence === 1 ? 'OVERDUE' : 'PENDING',
        })),
      },
    },
  })

  // Validation: unknown HP
  await api('POST', '/emi-locker/devices', {
    token: A.owner.token,
    branchId: A.branch.id,
    body: {
      agreementId: 'does-not-exist',
      customerId: customer.id,
      imei1: imeiVal,
      consented: true,
    },
    expectStatus: [400, 404],
  })

  // Cross-tenant HP attempt
  const foreignHp = await prisma.hirePurchaseAgreement.create({
    data: {
      tenantId: B.tenant.id,
      branchId: B.branch.id,
      agreementNumber: `HP-P4B-${stamp}`,
      customerId: (await prisma.customer.create({
        data: { tenantId: B.tenant.id, branchId: B.branch.id, name: 'B Cust', phone: `071${stamp.slice(-7)}` },
      })).id,
      productName: 'X',
      imei: `9977${String(Date.now()).slice(-11)}`.slice(0, 15),
      cashPrice: 1000,
      downPayment: 0,
      financeAmount: 1000,
      interestType: 'NONE',
      installmentMonths: 1,
      monthlyInstallment: 1000,
      totalPayable: 1000,
      outstandingBalance: 1000,
      dueDay: 1,
      firstDueDate: new Date(),
      status: 'ACTIVE',
    },
  })
  await api('POST', '/emi-locker/devices', {
    token: A.owner.token,
    branchId: A.branch.id,
    body: {
      agreementId: foreignHp.id,
      imei1: foreignHp.imei,
      consented: true,
    },
    expectStatus: [400, 403, 404],
  })

  const created = await api('POST', '/emi-locker/devices', {
    token: A.owner.token,
    branchId: A.branch.id,
    body: {
      agreementId: agreement.id,
      customerId: customer.id,
      imei1: imeiVal,
      imeiRecordId: imei.id,
      brand: brand.name,
      model: 'Test',
      consented: true,
      consentVersion: 'p4',
    },
    expectStatus: [200, 201],
  })
  const deviceId = created.json?.data?.device?.id || created.json?.data?.id
  expect('device id returned', !!deviceId, JSON.stringify(created.json).slice(0, 200))

  // Technician cannot enroll (hide)
  await api('POST', `/emi-locker/devices/${deviceId}/enrollment`, {
    token: A.tech.token,
    branchId: A.branch.id,
    body: { consented: true, ttlMinutes: 15 },
    expectStatus: 403,
  })

  // Cashier view-only cannot enroll
  await api('POST', `/emi-locker/devices/${deviceId}/enrollment`, {
    token: A.cashier.token,
    branchId: A.branch.id,
    body: { consented: true, ttlMinutes: 15 },
    expectStatus: 403,
  })

  const enrollment = await api('POST', `/emi-locker/devices/${deviceId}/enrollment`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { consented: true, consentVersion: 'p4', ttlMinutes: 15 },
    expectStatus: [200, 201],
  })
  expect('amapiDisabled in response', enrollment.json?.data?.amapiDisabled === true
    || enrollment.json?.data?.enrollment?.amapiDisabled === true
    || enrollment.json?.data?.qr?.amapiDisabled === true)
  expect(
    'no Google QR',
    !enrollment.json?.data?.qr?.provisioningQr,
    String(enrollment.json?.data?.qr?.provisioningQr),
  )

  // Consume enrollment via service (internal agent path still HTTP)
  const rawToken = enrollment.json?.data?.qr?.enrollmentToken
  const enrCode = enrollment.json?.data?.enrollment?.enrollmentCode
  await api('POST', '/emi-locker/enrollment/consume', {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { enrollmentCode: enrCode, token: rawToken },
    expectStatus: 200,
  })

  // Endpoint smoke (authorized)
  console.log('\n-- Endpoint smoke --')
  for (const [method, path] of [
    ['GET', '/emi-locker/dashboard'],
    ['GET', '/emi-locker/devices'],
    ['GET', `/emi-locker/devices/${deviceId}`],
    ['GET', `/emi-locker/devices/${deviceId}/enrollment`],
    ['GET', `/emi-locker/devices/${deviceId}/commands`],
    ['GET', `/emi-locker/devices/${deviceId}/events`],
    ['GET', '/emi-locker/policies'],
    ['GET', '/emi-locker/settings'],
    ['GET', '/emi-locker/reports/devices'],
    ['GET', '/emi-locker/reports/restrictions'],
    ['GET', '/emi-locker/reports/collections'],
    ['GET', '/emi-locker/commands'],
  ] as const) {
    await api(method, path, { token: A.owner.token, branchId: A.branch.id, expectStatus: 200 })
  }

  await api('PATCH', `/emi-locker/devices/${deviceId}`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { androidVersion: '14' },
    expectStatus: 200,
  })
  await api('POST', `/emi-locker/devices/${deviceId}/sync`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: {},
    expectStatus: [200, 201],
  })

  // Cashier cannot restrict
  await api('POST', `/emi-locker/devices/${deviceId}/restrict`, {
    token: A.cashier.token,
    branchId: A.branch.id,
    body: { reason: 'cashier attempt' },
    expectStatus: 403,
  })

  // Restrict dry-run
  console.log('\n-- Restrict / restore / release HTTP --')
  const restrict1 = await api('POST', `/emi-locker/devices/${deviceId}/restrict`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'phase4 overdue', idempotencyKey: `p4-restrict-${deviceId}` },
    expectStatus: [200, 201],
  })
  const cmdStatus = restrict1.json?.data?.command?.status
  expect('restrict DRY_RUN', cmdStatus === 'DRY_RUN', String(cmdStatus))

  // Duplicate restrict → 409 already restricted
  await api('POST', `/emi-locker/devices/${deviceId}/restrict`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'again', idempotencyKey: `p4-restrict-2-${deviceId}` },
    expectStatus: 409,
  })

  const restrictCmds = await prisma.deviceCommand.count({
    where: { deviceId, commandType: 'APPLY_RESTRICTION' },
  })
  soft('restriction command count bounded', restrictCmds <= 2, `count=${restrictCmds}`)

  // Restore while overdue → 400
  await api('POST', `/emi-locker/devices/${deviceId}/restore`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'too early' },
    expectStatus: 400,
  })

  // Clear overdue
  await prisma.hirePurchaseInstallment.updateMany({
    where: { agreementId: agreement.id },
    data: { status: 'PAID', outstanding: 0, paidAmount: 5000 },
  })
  await prisma.hirePurchaseAgreement.update({
    where: { id: agreement.id },
    data: { outstandingBalance: 0, paidAmount: 30000 },
  })

  const restore = await api('POST', `/emi-locker/devices/${deviceId}/restore`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'cleared' },
    expectStatus: [200, 201],
  })
  expect('restore DRY_RUN', restore.json?.data?.command?.status === 'DRY_RUN', String(restore.json?.data?.command?.status))

  // Release before COMPLETED
  await api('POST', `/emi-locker/devices/${deviceId}/release`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'early' },
    expectStatus: 400,
  })

  await prisma.hirePurchaseAgreement.update({
    where: { id: agreement.id },
    data: { status: 'COMPLETED', completedAt: new Date(), outstandingBalance: 0 },
  })

  const release = await api('POST', `/emi-locker/devices/${deviceId}/release`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'completed' },
    expectStatus: [200, 201],
  })
  expect('release DRY_RUN', release.json?.data?.command?.status === 'DRY_RUN')
  const afterRelease = await prisma.managedDevice.findUniqueOrThrow({ where: { id: deviceId } })
  expect('device RELEASED', afterRelease.deviceStatus === 'RELEASED', afterRelease.deviceStatus)

  // RELEASED cannot restrict even with force body field
  await api('POST', `/emi-locker/devices/${deviceId}/restrict`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { reason: 'force attempt', force: true },
    expectStatus: 400,
  })
  const stillReleased = await prisma.managedDevice.findUniqueOrThrow({ where: { id: deviceId } })
  expect('still RELEASED after force attempt', stillReleased.deviceStatus === 'RELEASED')

  // Worker must not re-restrict released
  const { emiLockerService } = await import('./emi-locker.service')
  await emiLockerService.enforceOverdueForTenant(A.tenant.id)
  const afterWorker = await prisma.managedDevice.findUniqueOrThrow({ where: { id: deviceId } })
  expect('worker leaves RELEASED', afterWorker.deviceStatus === 'RELEASED', afterWorker.deviceStatus)

  // Tenant isolation
  console.log('\n-- Tenant HTTP isolation --')
  for (const [method, path] of [
    ['GET', `/emi-locker/devices/${deviceId}`],
    ['PATCH', `/emi-locker/devices/${deviceId}`],
    ['GET', `/emi-locker/devices/${deviceId}/commands`],
    ['GET', `/emi-locker/devices/${deviceId}/events`],
    ['GET', `/emi-locker/devices/${deviceId}/enrollment`],
    ['POST', `/emi-locker/devices/${deviceId}/restrict`],
    ['POST', `/emi-locker/devices/${deviceId}/restore`],
    ['POST', `/emi-locker/devices/${deviceId}/release`],
  ] as const) {
    await api(method, path, {
      token: B.owner.token,
      branchId: B.branch.id,
      body: method === 'GET' ? undefined : { reason: 'cross' },
      expectStatus: [403, 404],
    })
  }
  const reportsB = await api('GET', '/emi-locker/reports/devices', {
    token: B.owner.token,
    branchId: B.branch.id,
    expectStatus: 200,
  })
  const devicesB = reportsB.json?.data?.devices || reportsB.json?.data || []
  const leaked = Array.isArray(devicesB) && devicesB.some((d: any) => d.id === deviceId)
  expect('Tenant B reports do not leak Tenant A device', !leaked)

  // Branch isolation: branch2-only manager listing branch2 should not see branch1 device
  const listB2 = await api('GET', '/emi-locker/devices', {
    token: A.branchOnly.token,
    branchId: A.branch2.id,
    expectStatus: 200,
  })
  const rows = listB2.json?.data || []
  const seen = Array.isArray(rows) && rows.some((d: any) => d.id === deviceId)
  expect('branch2-scoped list hides branch1 device', !seen)

  // Policies / settings
  console.log('\n-- Policies / settings --')
  const pol = await api('POST', '/emi-locker/policies', {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { name: `P4 Policy ${stamp}`, kind: 'RESTRICTED', isActive: true },
    expectStatus: [200, 201],
  })
  const policyId = pol.json?.data?.id
  await api('PATCH', `/emi-locker/policies/${policyId}`, {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { name: `P4 Policy Updated ${stamp}` },
    expectStatus: 200,
  })
  await api('PATCH', '/emi-locker/settings', {
    token: A.cashier.token,
    branchId: A.branch.id,
    body: { dryRunEnabled: true },
    expectStatus: 403,
  })
  await api('PATCH', '/emi-locker/settings', {
    token: A.owner.token,
    branchId: A.branch.id,
    body: { dryRunEnabled: true, warningDays: 3 },
    expectStatus: 200,
  })

  // Audit presence
  const audits = await prisma.auditEvent.count({
    where: { tenantId: A.tenant.id, eventType: { startsWith: 'EMI_LOCKER_' } },
  })
  expect('audit events created', audits >= 3, `count=${audits}`)

  // No secrets in enrollment response
  const enrDump = JSON.stringify(enrollment.json)
  soft('no SA JSON in enrollment', !/BEGIN PRIVATE KEY|client_email|private_key/i.test(enrDump))

  server.close()
  if (useRealRedis) {
    try { await redis.quit() } catch { /* */ }
  }
  await prisma.$disconnect()

  const failed = checks.filter((c) => !c.pass)
  console.log(`\n=== HTTP SUMMARY: ${checks.length - failed.length}/${checks.length} passed ===`)
  if (failed.length) {
    for (const f of failed) console.log(` - ${f.name}: ${f.detail || ''}`)
    process.exit(1)
  }
  console.log('PHASE4_HTTP_OK')
}

main().catch(async (e) => {
  console.error('\nPHASE4_HTTP_FAILED', e)
  try {
    const { prisma } = await import('../../config/database')
    await prisma.$disconnect()
  } catch { /* */ }
  process.exit(1)
})
