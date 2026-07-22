import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run database seed in production (NODE_ENV=production).')
    console.error('   Use PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD bootstrap or create users via admin UI.')
    process.exit(1)
  }

  console.log('🌱 Seeding database...')

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-shop' },
    update: {},
    create: {
      name: 'Demo Mobile Shop',
      slug: 'demo-shop',
      plan: 'PRO',
      status: 'ACTIVE',
      ownerEmail: 'owner@demo.com',
      ownerName: 'Demo Owner',
    },
  })

  const branch = await prisma.branch.upsert({
    where: { id: 'demo-branch-1' },
    update: {},
    create: {
      id: 'demo-branch-1',
      tenantId: tenant.id,
      name: 'Main Branch',
      address: '123 Main Street',
      city: 'Colombo',
      state: 'Western',
      phone: '+94 11 234 5678',
      isHeadquarters: true,
    },
  })

  const hashedPassword = await bcrypt.hash('Demo@1234', 12)

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@demo.com',
      name: 'Demo Owner',
      password: hashedPassword,
      role: 'OWNER',
      branches: { create: { branchId: branch.id } },
    },
  })

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'cashier@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'cashier@demo.com',
      name: 'Demo Cashier',
      password: hashedPassword,
      role: 'CASHIER',
      branches: { create: { branchId: branch.id } },
    },
  })

  const mobilesCategory = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'mobiles' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Mobiles', slug: 'mobiles', icon: '📱' },
  })

  const accessoriesCategory = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'accessories' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Accessories', slug: 'accessories', icon: '🎧' },
  })

  const appleBrand = await prisma.brand.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Apple' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Apple' },
  })

  const samsungBrand = await prisma.brand.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Samsung' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Samsung' },
  })

  await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'IP15PM-256-BLK' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'iPhone 15 Pro Max 256GB Black',
      sku: 'IP15PM-256-BLK',
      categoryId: mobilesCategory.id,
      brandId: appleBrand.id,
      buyingPrice: 120000,
      sellingPrice: 145000,
      mrp: 150000,
      trackImei: true,
      warrantyMonths: 12,
      stock: 5,
      minStock: 2,
    },
  })

  await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'SS-S24U-256-BLK' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Samsung Galaxy S24 Ultra 256GB',
      sku: 'SS-S24U-256-BLK',
      categoryId: mobilesCategory.id,
      brandId: samsungBrand.id,
      buyingPrice: 95000,
      sellingPrice: 115000,
      mrp: 120000,
      trackImei: true,
      warrantyMonths: 12,
      stock: 8,
      minStock: 2,
    },
  })

  await prisma.customer.upsert({
    where: {
      tenantId_branchId_phone: {
        tenantId: tenant.id,
        branchId: branch.id,
        phone: '+94 77 123 4567',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Kasun Perera',
      phone: '+94 77 123 4567',
      email: 'kasun@example.com',
      city: 'Colombo',
    },
  })

  const adminPassword = await bcrypt.hash('admin', 12)
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@hexalyte.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@hexalyte.com',
      name: 'Platform Admin',
      password: adminPassword,
      role: 'PLATFORM_ADMIN',
      branches: { create: { branchId: branch.id } },
    },
  })

  console.log(`✅ Seed complete!`)
  console.log(`   Tenant: ${tenant.name} (${tenant.id})`)
  console.log(`   Owner login:  owner@demo.com / Demo@1234`)
  console.log(`   Cashier login: cashier@demo.com / Demo@1234`)
  console.log(`   Admin login:  admin@hexalyte.com / admin`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
