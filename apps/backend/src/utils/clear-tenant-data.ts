import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'

export type ClearTenantDataSummary = Record<string, number>

export async function clearTenantTrialData(tenantId: string): Promise<ClearTenantDataSummary> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!tenant) throw new AppError('Tenant not found', 404)

  const counts: ClearTenantDataSummary = {}

  await prisma.$transaction(async (tx) => {
    counts.repairSpareParts = (await tx.repairSparePart.deleteMany({
      where: { repair: { tenantId } },
    })).count

    counts.warranties = (await tx.warranty.deleteMany({ where: { tenantId } })).count
    counts.imeiRecords = (await tx.imeiRecord.deleteMany({
      where: { product: { tenantId } },
    })).count
    counts.stockMovements = (await tx.stockMovement.deleteMany({
      where: { product: { tenantId } },
    })).count
    counts.saleReturns = (await tx.saleReturn.deleteMany({ where: { tenantId } })).count
    counts.exchanges = (await tx.deviceExchange.deleteMany({ where: { tenantId } })).count

    await tx.sale.updateMany({ where: { tenantId }, data: { deliveryOrderId: null } })
    counts.sales = (await tx.sale.deleteMany({ where: { tenantId } })).count

    counts.trackingNumbers = (await tx.trackingNumber.deleteMany({ where: { tenantId } })).count
    counts.deliveryOrders = (await tx.deliveryOrder.deleteMany({ where: { tenantId } })).count
    counts.couriers = (await tx.courier.deleteMany({ where: { tenantId } })).count

    const waConfig = await tx.whatsAppConfig.findUnique({ where: { tenantId } })
    if (waConfig) {
      counts.whatsAppMessages = (await tx.whatsAppMessage.deleteMany({
        where: { configId: waConfig.id },
      })).count
    }

    counts.dailyClosings = (await tx.dailyClosing.deleteMany({ where: { tenantId } })).count
    counts.dailyReloads = (await tx.dailyReload.deleteMany({ where: { tenantId } })).count
    counts.dailySummaries = (await tx.dailySummary.deleteMany({ where: { tenantId } })).count
    counts.transactions = (await tx.transaction.deleteMany({ where: { tenantId } })).count
    counts.repairs = (await tx.repairTicket.deleteMany({ where: { tenantId } })).count
    counts.purchaseOrders = (await tx.purchaseOrder.deleteMany({ where: { tenantId } })).count
    counts.suppliers = (await tx.supplier.deleteMany({ where: { tenantId } })).count
    counts.products = (await tx.product.deleteMany({ where: { tenantId } })).count
    counts.categories = (await tx.category.deleteMany({ where: { tenantId } })).count
    counts.brands = (await tx.brand.deleteMany({ where: { tenantId } })).count
    counts.deviceModels = (await tx.deviceModel.deleteMany({ where: { tenantId } })).count
    counts.deviceBrands = (await tx.deviceBrand.deleteMany({ where: { tenantId } })).count
    counts.customers = (await tx.customer.deleteMany({ where: { tenantId } })).count
    counts.services = (await tx.service.deleteMany({ where: { tenantId } })).count
    counts.refreshTokens = (await tx.refreshToken.deleteMany({
      where: { user: { tenantId } },
    })).count
  })

  return counts
}
