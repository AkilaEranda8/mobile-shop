/**
 * Seed one ManagedDevice + overdue HP for Phase4 browser tenant (emi-phase4-browser).
 * Run against accept DB while phase4-dev-server is up.
 */
process.env.DATABASE_URL =
  process.env.PHASE4_DATABASE_URL
  || process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/hexalyte_emi_accept'
process.env.EMI_LOCKER_DRY_RUN = 'true'
process.env.ANDROID_MANAGEMENT_ENABLED = 'false'

async function main() {
  const { prisma } = await import('../../config/database')
  const { calculateHirePurchase } = await import('../hire-purchase/hp-calc.util')
  const { emiLockerService } = await import('./emi-locker.service')

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'emi-phase4-browser' } })
  if (!tenant) throw new Error('Browser tenant missing — start phase4-dev-server first')
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } })
  if (!branch) throw new Error('Browser branch missing')

  await prisma.tenantFeature.upsert({
    where: { tenantId_feature: { tenantId: tenant.id, feature: 'EMI_LOCKER' } },
    create: { tenantId: tenant.id, feature: 'EMI_LOCKER', enabled: true },
    update: { enabled: true },
  })
  await prisma.tenantFeature.upsert({
    where: { tenantId_feature: { tenantId: tenant.id, feature: 'HIRE_PURCHASE' } },
    create: { tenantId: tenant.id, feature: 'HIRE_PURCHASE', enabled: true },
    update: { enabled: true },
  })

  let category = await prisma.category.findFirst({ where: { tenantId: tenant.id } })
  if (!category) {
    category = await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Phones', slug: 'phones-p4-browser' },
    })
  }
  let brand = await prisma.brand.findFirst({ where: { tenantId: tenant.id } })
  if (!brand) {
    brand = await prisma.brand.create({ data: { tenantId: tenant.id, name: 'P4BrowserBrand' } })
  }

  let product = await prisma.product.findFirst({ where: { tenantId: tenant.id, sku: 'P4-BROWSER-DEVICE' } })
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'EMI Locker Test Android Device',
        sku: 'P4-BROWSER-DEVICE',
        categoryId: category.id,
        brandId: brand.id,
        buyingPrice: 20000,
        sellingPrice: 30000,
        mrp: 30000,
        trackImei: true,
        stock: 1,
      },
    })
  }

  let customer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, name: 'EMI Locker Test Customer' },
  })
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'EMI Locker Test Customer',
        phone: '0709999001',
      },
    })
  }

  const imeiVal = '999011122233344'
  let imei = await prisma.imeiRecord.findFirst({ where: { imei: imeiVal } })
  if (!imei) {
    imei = await prisma.imeiRecord.create({
      data: {
        imei: imeiVal,
        productId: product.id,
        branchId: branch.id,
        customerId: customer.id,
        status: 'UNDER_HIRE_PURCHASE',
      },
    })
  }

  let agreement = await prisma.hirePurchaseAgreement.findFirst({
    where: { tenantId: tenant.id, agreementNumber: 'HP-P4-BROWSER-1' },
  })
  if (!agreement) {
    const firstDue = new Date(Date.UTC(2020, 0, 1))
    const calc = calculateHirePurchase({
      cashPrice: 30000,
      downPayment: 5000,
      interestType: 'NONE',
      interestRate: 0,
      installmentMonths: 5,
      firstDueDate: firstDue,
    })
    agreement = await prisma.hirePurchaseAgreement.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        agreementNumber: 'HP-P4-BROWSER-1',
        customerId: customer.id,
        productId: product.id,
        imeiRecordId: imei.id,
        productName: product.name,
        brandName: brand.name,
        modelName: 'Test Android',
        imei: imeiVal,
        cashPrice: calc.cashPrice,
        downPayment: calc.downPayment,
        financeAmount: calc.financeAmount,
        interestType: 'NONE',
        installmentMonths: 5,
        monthlyInstallment: calc.monthlyInstallment,
        totalPayable: calc.totalPayable,
        paidAmount: 5000,
        outstandingBalance: 25000,
        gracePeriodDays: 0,
        dueDay: 1,
        firstDueDate: firstDue,
        status: 'ACTIVE',
        approvedAt: new Date(),
        deviceMgmtEnabled: true,
        deviceMgmtConsentedAt: new Date(),
        deviceMgmtConsentVersion: 'p4-browser',
        installments: {
          create: calc.schedule.map((line, idx) => ({
            tenantId: tenant.id,
            branchId: branch.id,
            sequence: line.sequence,
            dueDate: idx === 0 ? firstDue : line.dueDate,
            principal: line.principal,
            interest: line.interest,
            fees: line.fees,
            totalDue: line.totalDue,
            paidAmount: 0,
            outstanding: line.outstanding,
            status: idx === 0 ? 'OVERDUE' : 'PENDING',
          })),
        },
      },
    })
  }

  let device = await prisma.managedDevice.findFirst({
    where: { tenantId: tenant.id, imei1: imeiVal },
  })
  if (!device) {
    const reg = await emiLockerService.registerDevice(
      tenant.id,
      branch.id,
      {
        agreementId: agreement.id,
        customerId: customer.id,
        imei1: imeiVal,
        imeiRecordId: imei.id,
        brand: brand.name,
        model: 'Test Android',
        consented: true,
        consentVersion: 'p4-browser',
      },
      { email: 'emi-phase4-owner@hexalyte.test' },
    )
    device = reg.device
  }

  // Ensure enrolled/ACTIVE for action testing
  if (device.deviceStatus === 'PENDING_ENROLLMENT' || device.enrollmentStatus !== 'ENROLLED') {
    await prisma.managedDevice.update({
      where: { id: device.id },
      data: {
        deviceStatus: 'ACTIVE',
        enrollmentStatus: 'ENROLLED',
        enrolledAt: new Date(),
        onlineStatus: 'ONLINE',
        lastSeenAt: new Date(),
      },
    })
    await prisma.deviceEvent.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        deviceId: device.id,
        eventType: 'DEVICE_ENROLLED',
        source: 'phase4-seed',
        payload: { note: 'seeded enrolled for browser E2E' },
      },
    })
  }

  console.log(JSON.stringify({
    ok: true,
    tenantId: tenant.id,
    branchId: branch.id,
    agreementId: agreement.id,
    deviceId: device.id,
    imei: imeiVal,
    detailPath: `/dashboard/emi-locker/devices/${device.id}`,
  }, null, 2))

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  try {
    const { prisma } = await import('../../config/database')
    await prisma.$disconnect()
  } catch { /* */ }
  process.exit(1)
})
