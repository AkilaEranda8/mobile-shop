import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { Prisma } from '@prisma/client'
import {
  DEMO_BRANDS,
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_PRODUCTS,
  DEMO_SERVICES,
  DEMO_STAFF,
  DEMO_STAFF_PASSWORD,
  DEMO_SUPPLIER,
  DEMO_TEMPLATE_VERSION,
  emptyDemoManifest,
  normalizeDemoManifest,
  type DemoDataManifest,
} from './demo-seed.template'

/** Deterministic 15-digit IMEI unique per tenant+key (global unique constraint). */
function demoImei(tenantId: string, key: string): string {
  let h = 0
  const s = `${tenantId}:${key}`
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0
  const n = 350000000000000 + (h % 64999999999999)
  return String(n).slice(0, 15)
}

function addMonths(d: Date, months: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + months)
  return x
}

export async function getDemoDataStatus(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { demoDataInstalled: true, demoDataClearedAt: true, demoDataManifest: true },
  })
  if (!tenant) throw new AppError('Tenant not found', 404)
  const manifest = tenant.demoDataManifest ? normalizeDemoManifest(tenant.demoDataManifest) : null
  return {
    installed: tenant.demoDataInstalled,
    clearedAt: tenant.demoDataClearedAt,
    canRemove: tenant.demoDataInstalled && !!manifest,
    itemCounts: manifest
      ? {
          categories: manifest.categoryIds.length,
          brands: manifest.brandIds.length,
          products: manifest.productIds.length,
          customers: manifest.customerIds.length,
          services: manifest.serviceIds.length,
          suppliers: manifest.supplierIds.length,
          staff: manifest.userIds.length,
          imeis: manifest.imeiIds.length,
          sales: manifest.saleIds.length,
          repairs: manifest.repairIds.length,
          warranties: manifest.warrantyIds.length,
          purchaseOrders: manifest.purchaseOrderIds.length,
          transactions: manifest.transactionIds.length,
          deliveries: manifest.deliveryOrderIds.length,
          exchanges: manifest.exchangeIds.length,
          reloads: manifest.dailyReloadIds.length,
          funds: manifest.profitFundIds.length,
        }
      : null,
  }
}

/** Copy demo templates into the tenant DB across major modules. */
export async function installDemoDataForTenant(tenantId: string, branchId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, demoDataInstalled: true, demoDataClearedAt: true },
  })
  if (!tenant) throw new AppError('Tenant not found', 404)
  if (tenant.demoDataInstalled) return getDemoDataStatus(tenantId)
  if (tenant.demoDataClearedAt) {
    throw new AppError('Demo data was already removed for this shop. Contact support if you need a fresh sample set.', 400)
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', isActive: true },
    select: { id: true, name: true },
  })
  const cashierName = owner?.name ?? 'Demo Owner'
  const manifest = emptyDemoManifest()
  const categoryByKey = new Map<string, string>()
  const brandByKey = new Map<string, string>()
  const productByKey = new Map<string, { id: string; name: string; sku: string; sellingPrice: number; buyingPrice: number; warrantyMonths: number }>()
  const customerByKey = new Map<string, { id: string; name: string; phone: string }>()

  // ── Catalog ──────────────────────────────────────────────────────────────
  for (const cat of DEMO_CATEGORIES) {
    const row = await prisma.category.create({
      data: { tenantId, name: cat.name, slug: cat.slug, icon: cat.icon },
    })
    categoryByKey.set(cat.key, row.id)
    manifest.categoryIds.push(row.id)
  }

  for (const brand of DEMO_BRANDS) {
    const row = await prisma.brand.create({ data: { tenantId, name: brand.name } })
    brandByKey.set(brand.key, row.id)
    manifest.brandIds.push(row.id)
  }

  for (const p of DEMO_PRODUCTS) {
    const categoryId = categoryByKey.get(p.categoryKey)
    const brandId = brandByKey.get(p.brandKey)
    if (!categoryId || !brandId) continue
    const row = await prisma.product.create({
      data: {
        tenantId,
        branchId,
        name: p.name,
        sku: p.sku,
        categoryId,
        brandId,
        buyingPrice: p.buyingPrice,
        sellingPrice: p.sellingPrice,
        mrp: p.mrp,
        trackImei: p.trackImei,
        warrantyMonths: p.warrantyMonths,
        stock: p.stock,
        minStock: p.minStock,
        description: 'Demo product — remove anytime from Dashboard',
      },
    })
    productByKey.set(p.key, {
      id: row.id,
      name: row.name,
      sku: row.sku,
      sellingPrice: row.sellingPrice,
      buyingPrice: row.buyingPrice,
      warrantyMonths: row.warrantyMonths,
    })
    manifest.productIds.push(row.id)
  }

  for (const c of DEMO_CUSTOMERS) {
    const row = await prisma.customer.create({
      data: {
        tenantId,
        branchId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        city: c.city,
      },
    })
    customerByKey.set(c.key, { id: row.id, name: row.name, phone: row.phone })
    manifest.customerIds.push(row.id)
  }

  for (const s of DEMO_SERVICES) {
    const row = await prisma.service.create({
      data: {
        tenantId,
        name: s.name,
        description: s.description,
        cost: s.cost,
        price: s.price,
        category: s.category,
      },
    })
    manifest.serviceIds.push(row.id)
  }

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      branchId,
      name: DEMO_SUPPLIER.name,
      contactName: DEMO_SUPPLIER.contactName,
      phone: DEMO_SUPPLIER.phone,
      email: DEMO_SUPPLIER.email,
      city: DEMO_SUPPLIER.city,
    } as Prisma.SupplierUncheckedCreateInput,
  })
  manifest.supplierIds.push(supplier.id)

  // ── Staff ────────────────────────────────────────────────────────────────
  const staffPassword = await bcrypt.hash(DEMO_STAFF_PASSWORD, 12)
  const slugBit = (tenant.slug || 'shop').slice(0, 20)
  for (const st of DEMO_STAFF) {
    const email = `${st.emailPrefix}.${slugBit}@demo.local`
    const existing = await prisma.user.findFirst({ where: { tenantId, email: { equals: email, mode: 'insensitive' } } })
    if (existing) {
      manifest.userIds.push(existing.id)
      continue
    }
    const row = await prisma.user.create({
      data: {
        tenantId,
        email,
        name: st.name,
        password: staffPassword,
        role: st.role,
        branches: { create: { branchId } },
      },
    })
    manifest.userIds.push(row.id)
  }

  // ── IMEI ─────────────────────────────────────────────────────────────────
  const iphone = productByKey.get('iphone')
  const samsung = productByKey.get('samsung')
  const airpods = productByKey.get('airpods')
  const kasun = customerByKey.get('kasun')
  const nimali = customerByKey.get('nimali')

  if (iphone) {
    for (const key of ['iphone-1', 'iphone-2', 'iphone-3'] as const) {
      const row = await prisma.imeiRecord.create({
        data: {
          imei: demoImei(tenantId, key),
          productId: iphone.id,
          branchId,
          status: 'IN_STOCK',
        },
      })
      manifest.imeiIds.push(row.id)
    }
  }
  if (samsung) {
    for (const key of ['samsung-1', 'samsung-2'] as const) {
      const row = await prisma.imeiRecord.create({
        data: {
          imei: demoImei(tenantId, key),
          productId: samsung.id,
          branchId,
          status: 'IN_STOCK',
        },
      })
      manifest.imeiIds.push(row.id)
    }
  }

  // ── Sale (sales / POS history / dashboard) ───────────────────────────────
  if (airpods && kasun) {
    const unitPrice = airpods.sellingPrice
    const qty = 1
    const total = unitPrice * qty
    const sale = await prisma.sale.create({
      data: {
        tenantId,
        branchId,
        invoiceNumber: `DEMO-INV-${Date.now().toString(36).toUpperCase()}`,
        customerId: kasun.id,
        customerName: kasun.name,
        customerPhone: kasun.phone,
        subtotal: total,
        total,
        paidAmount: total,
        dueAmount: 0,
        status: 'PAID',
        cashierId: owner?.id,
        cashierName,
        source: 'POS',
        notes: 'Demo sale — removable',
        items: {
          create: [{
            productId: airpods.id,
            productName: airpods.name,
            sku: airpods.sku,
            quantity: qty,
            unitPrice,
            unitCost: airpods.buyingPrice,
            total,
            warrantyMonths: airpods.warrantyMonths,
          }],
        },
        payments: {
          create: [{ method: 'CASH', amount: total }],
        },
      },
    })
    manifest.saleIds.push(sale.id)
  }

  // ── Repair ───────────────────────────────────────────────────────────────
  if (kasun) {
    const repair = await prisma.repairTicket.create({
      data: {
        tenantId,
        branchId,
        ticketNumber: `DEMO-RPR-${Date.now().toString(36).toUpperCase()}`,
        customerId: kasun.id,
        customerName: kasun.name,
        customerPhone: kasun.phone,
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 13',
        deviceColor: 'Blue',
        imei: demoImei(tenantId, 'repair-device'),
        reportedIssue: 'Cracked screen (demo ticket)',
        estimatedCost: 8500,
        status: 'IN_REPAIR',
        priority: 'NORMAL',
        source: 'WALK_IN',
      },
    })
    manifest.repairIds.push(repair.id)
  }

  // ── Warranty ─────────────────────────────────────────────────────────────
  if (iphone && nimali) {
    const start = new Date()
    const months = 12
    const w = await prisma.warranty.create({
      data: {
        tenantId,
        branchId,
        warrantyCode: `DEMO-W-${tenantId.slice(-6).toUpperCase()}`,
        customerId: nimali.id,
        customerName: nimali.name,
        customerPhone: nimali.phone,
        productId: iphone.id,
        productName: iphone.name,
        brandName: 'Apple (Demo)',
        imei: demoImei(tenantId, 'warranty-imei'),
        quantity: 1,
        startDate: start,
        endDate: addMonths(start, months),
        monthsDuration: months,
        status: 'ACTIVE',
      },
    })
    manifest.warrantyIds.push(w.id)
  }

  // ── Purchase order ───────────────────────────────────────────────────────
  if (samsung) {
    const qty = 2
    const unitCost = samsung.buyingPrice
    const lineTotal = qty * unitCost
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        branchId,
        poNumber: `DEMO-PO-${Date.now().toString(36).toUpperCase()}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: 'SENT',
        subtotal: lineTotal,
        total: lineTotal,
        dueAmount: lineTotal,
        notes: 'Demo purchase order',
        items: {
          create: [{
            productId: samsung.id,
            productName: samsung.name,
            quantity: qty,
            unitCost,
            total: lineTotal,
          }],
        },
      },
    })
    manifest.purchaseOrderIds.push(po.id)
  }

  // ── Finance transactions ─────────────────────────────────────────────────
  const income = await prisma.transaction.create({
    data: {
      tenantId,
      branchId,
      type: 'INCOME',
      category: 'Other Income',
      amount: 5000,
      description: 'Demo income entry',
      paymentMethod: 'CASH',
      performedBy: cashierName,
    },
  })
  const expense = await prisma.transaction.create({
    data: {
      tenantId,
      branchId,
      type: 'EXPENSE',
      category: 'Rent',
      amount: 25000,
      description: 'Demo shop rent',
      paymentMethod: 'CASH',
      performedBy: cashierName,
    },
  })
  manifest.transactionIds.push(income.id, expense.id)

  // ── Delivery ─────────────────────────────────────────────────────────────
  const courier = await prisma.courier.create({
    data: {
      tenantId,
      name: 'Demo Courier',
      code: `DEMO-${tenantId.slice(-4).toUpperCase()}`,
      isDefault: true,
      isActive: true,
    },
  })
  manifest.courierIds.push(courier.id)

  if (nimali && airpods) {
    const delivery = await prisma.deliveryOrder.create({
      data: {
        tenantId,
        branchId,
        orderNumber: `DEMO-DEL-${Date.now().toString(36).toUpperCase()}`,
        customerName: nimali.name,
        customerPhone: nimali.phone,
        addressLine1: '123 Demo Street',
        city: 'Colombo',
        subtotal: airpods.sellingPrice,
        deliveryCharge: 350,
        totalAmount: airpods.sellingPrice + 350,
        status: 'PENDING',
        notes: 'Demo delivery order',
        courierId: courier.id,
        items: {
          create: [{
            description: airpods.name,
            quantity: 1,
            unitPrice: airpods.sellingPrice,
            total: airpods.sellingPrice,
          }],
        },
      },
    })
    manifest.deliveryOrderIds.push(delivery.id)
  }

  // ── Exchange ─────────────────────────────────────────────────────────────
  if (kasun) {
    const ex = await prisma.deviceExchange.create({
      data: {
        tenantId,
        branchId,
        exchangeNumber: `DEMO-EX-${Date.now().toString(36).toUpperCase()}`,
        customerId: kasun.id,
        customerName: kasun.name,
        customerPhone: kasun.phone,
        oldBrand: 'Samsung',
        oldModel: 'A54',
        oldImei: demoImei(tenantId, 'exchange-old'),
        exchangeValue: 35000,
        newBrand: 'Samsung',
        newModel: 'S24 Ultra',
        newDevicePrice: 115000,
        balanceAmount: 80000,
        balanceDirection: 'CUSTOMER_PAYS',
        status: 'COMPLETED',
        notes: 'Demo exchange',
        createdBy: cashierName,
      },
    })
    manifest.exchangeIds.push(ex.id)
  }

  // ── Daily reload ─────────────────────────────────────────────────────────
  const reload = await prisma.dailyReload.create({
    data: {
      tenantId,
      branchId,
      connectionNo: '0770000999',
      provider: 'Dialog',
      amount: 1000,
      status: 'Success',
      reloadType: 'RELOAD',
      executedBy: cashierName,
    },
  })
  manifest.dailyReloadIds.push(reload.id)

  // ── Profit funds (demo-named so they don't clash with system defaults) ───
  const fundDefs = [
    { name: 'Demo Owner Draw', type: 'FIXED_AMOUNT' as const, fixedAmount: 10000, percentage: 0, sortOrder: 1 },
    { name: 'Demo Reserve %', type: 'PERCENTAGE' as const, fixedAmount: 0, percentage: 40, sortOrder: 2 },
    { name: 'Demo Manual Pool', type: 'MANUAL' as const, fixedAmount: 0, percentage: 0, sortOrder: 3 },
  ]
  for (const f of fundDefs) {
    const row = await prisma.profitFund.create({
      data: {
        tenantId,
        branchId,
        name: f.name,
        type: f.type,
        fixedAmount: f.fixedAmount,
        percentage: f.percentage,
        sortOrder: f.sortOrder,
        description: 'Demo fund — remove with demo data',
        balance: f.type === 'FIXED_AMOUNT' ? 25000 : 15000,
        isActive: true,
      },
    })
    manifest.profitFundIds.push(row.id)
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      demoDataInstalled: true,
      demoDataManifest: manifest as object,
      demoDataClearedAt: null,
    },
  })

  return getDemoDataStatus(tenantId)
}

/** Delete only demo-tagged rows from the manifest. Real tenant data stays. */
export async function clearDemoDataForTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { demoDataInstalled: true, demoDataManifest: true },
  })
  if (!tenant) throw new AppError('Tenant not found', 404)
  if (!tenant.demoDataInstalled) throw new AppError('No demo data to remove', 400)

  const manifest = normalizeDemoManifest(tenant.demoDataManifest)

  try {
    await prisma.$transaction(async (tx) => {
      // Children first
      if (manifest.profitFundIds.length) {
        await tx.profitAllocationLine.deleteMany({ where: { fundId: { in: manifest.profitFundIds } } })
        await tx.profitTransaction.deleteMany({ where: { fundId: { in: manifest.profitFundIds } } })
        await tx.profitWithdrawal.deleteMany({ where: { fundId: { in: manifest.profitFundIds } } })
        await tx.profitFund.deleteMany({ where: { id: { in: manifest.profitFundIds }, tenantId } })
      }
      if (manifest.dailyReloadIds.length) {
        await tx.dailyReload.deleteMany({ where: { id: { in: manifest.dailyReloadIds }, tenantId } })
      }
      if (manifest.deliveryOrderIds.length) {
        await tx.deliveryItem.deleteMany({ where: { deliveryOrderId: { in: manifest.deliveryOrderIds } } })
        await tx.waybill.deleteMany({ where: { deliveryOrderId: { in: manifest.deliveryOrderIds } } })
        await tx.deliveryNotification.deleteMany({ where: { deliveryOrderId: { in: manifest.deliveryOrderIds } } })
        await tx.trackingNumber.updateMany({
          where: { deliveryOrderId: { in: manifest.deliveryOrderIds } },
          data: { deliveryOrderId: null },
        })
        await tx.deliveryOrder.deleteMany({ where: { id: { in: manifest.deliveryOrderIds }, tenantId } })
      }
      if (manifest.courierIds.length) {
        await tx.trackingNumber.deleteMany({ where: { courierId: { in: manifest.courierIds } } })
        await tx.courier.deleteMany({ where: { id: { in: manifest.courierIds }, tenantId } })
      }
      if (manifest.exchangeIds.length) {
        await tx.deviceExchange.deleteMany({ where: { id: { in: manifest.exchangeIds }, tenantId } })
      }
      if (manifest.warrantyIds.length) {
        await tx.warrantyClaim.deleteMany({ where: { warrantyId: { in: manifest.warrantyIds } } })
        await tx.warranty.deleteMany({ where: { id: { in: manifest.warrantyIds }, tenantId } })
      }
      if (manifest.repairIds.length) {
        await tx.repairNote.deleteMany({ where: { repairId: { in: manifest.repairIds } } })
        await tx.repairSparePart.deleteMany({ where: { repairId: { in: manifest.repairIds } } })
        await tx.repairStatusHistory.deleteMany({ where: { repairId: { in: manifest.repairIds } } })
        await tx.repairTicket.deleteMany({ where: { id: { in: manifest.repairIds }, tenantId } })
      }
      if (manifest.saleIds.length) {
        await tx.salePayment.deleteMany({ where: { saleId: { in: manifest.saleIds } } })
        await tx.saleItem.deleteMany({ where: { saleId: { in: manifest.saleIds } } })
        await tx.saleReturn.deleteMany({ where: { saleId: { in: manifest.saleIds } } })
        await tx.imeiRecord.updateMany({
          where: { saleId: { in: manifest.saleIds } },
          data: { saleId: null },
        })
        await tx.sale.deleteMany({ where: { id: { in: manifest.saleIds }, tenantId } })
      }
      if (manifest.transactionIds.length) {
        await tx.supplierPaymentAllocation.deleteMany({ where: { transactionId: { in: manifest.transactionIds } } })
        await tx.transaction.deleteMany({ where: { id: { in: manifest.transactionIds }, tenantId } })
      }
      if (manifest.purchaseOrderIds.length) {
        await tx.pOItem.deleteMany({ where: { purchaseOrderId: { in: manifest.purchaseOrderIds } } })
        await tx.imeiRecord.updateMany({
          where: { purchaseOrderId: { in: manifest.purchaseOrderIds } },
          data: { purchaseOrderId: null, poItemId: null },
        })
        await tx.purchaseOrder.deleteMany({ where: { id: { in: manifest.purchaseOrderIds }, tenantId } })
      }
      if (manifest.imeiIds.length) {
        await tx.imeiRecord.deleteMany({ where: { id: { in: manifest.imeiIds } } })
      }
      if (manifest.productIds.length) {
        await tx.imeiRecord.deleteMany({ where: { productId: { in: manifest.productIds } } })
        await tx.stockMovement.deleteMany({ where: { productId: { in: manifest.productIds } } })
        await tx.product.deleteMany({ where: { id: { in: manifest.productIds }, tenantId } })
      }
      if (manifest.customerIds.length) {
        await tx.customer.deleteMany({ where: { id: { in: manifest.customerIds }, tenantId } })
      }
      if (manifest.serviceIds.length) {
        await tx.service.deleteMany({ where: { id: { in: manifest.serviceIds }, tenantId } })
      }
      if (manifest.supplierIds.length) {
        await tx.supplier.deleteMany({ where: { id: { in: manifest.supplierIds }, tenantId } })
      }
      if (manifest.brandIds.length) {
        await tx.brand.deleteMany({ where: { id: { in: manifest.brandIds }, tenantId } })
      }
      if (manifest.categoryIds.length) {
        await tx.category.deleteMany({ where: { id: { in: manifest.categoryIds }, tenantId } })
      }
      if (manifest.userIds.length) {
        await tx.userBranch.deleteMany({ where: { userId: { in: manifest.userIds } } })
        await tx.refreshToken.deleteMany({ where: { userId: { in: manifest.userIds } } })
        await tx.user.deleteMany({
          where: {
            id: { in: manifest.userIds },
            tenantId,
            role: { not: 'OWNER' },
          },
        })
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          demoDataInstalled: false,
          demoDataManifest: Prisma.DbNull,
          demoDataClearedAt: new Date(),
        },
      })
    }, { timeout: 60_000 })
  } catch (e: any) {
    throw new AppError(
      `Could not remove all demo data (some items may be linked to live records): ${e?.message ?? 'unknown error'}`,
      400,
    )
  }

  return { cleared: true, clearedAt: new Date().toISOString() }
}
