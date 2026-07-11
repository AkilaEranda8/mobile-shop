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
    counts.dailyReloadProviderPayments = (await tx.dailyReloadProviderPayment.deleteMany({
      where: { tenantId },
    })).count
    counts.dailySummaries = (await tx.dailySummary.deleteMany({ where: { tenantId } })).count
    counts.profitTransactions = (await tx.profitTransaction.deleteMany({ where: { tenantId } })).count
    counts.profitWithdrawals = (await tx.profitWithdrawal.deleteMany({ where: { tenantId } })).count
    counts.profitAllocationLines = (await tx.profitAllocationLine.deleteMany({
      where: { allocation: { tenantId } },
    })).count
    counts.profitAllocations = (await tx.profitAllocation.deleteMany({ where: { tenantId } })).count
    counts.profitFunds = (await tx.profitFund.deleteMany({ where: { tenantId } })).count
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

    // Accounting & report data (journal entries cascade to lines + integration links)
    counts.integrationLinks = (await tx.integrationLink.deleteMany({ where: { tenantId } })).count
    counts.journalLines = (await tx.journalLine.deleteMany({ where: { tenantId } })).count
    counts.journalEntries = (await tx.journalEntry.deleteMany({ where: { tenantId } })).count
    counts.accountingOutbox = (await tx.accountingOutbox.deleteMany({ where: { tenantId } })).count
    counts.cashAccounts = (await tx.cashAccount.deleteMany({ where: { tenantId } })).count
    counts.bankAccounts = (await tx.bankAccount.deleteMany({ where: { tenantId } })).count
    counts.taxCodes = (await tx.taxCode.deleteMany({ where: { tenantId } })).count
    counts.autoJournalRules = (await tx.autoJournalRule.deleteMany({ where: { tenantId } })).count
    counts.auditEvents = (await tx.auditEvent.deleteMany({ where: { tenantId } })).count
    counts.approvalRequests = (await tx.approvalRequest.deleteMany({ where: { tenantId } })).count

    await tx.glAccount.updateMany({
      where: { tenantId },
      data: { parentAccountId: null },
    })
    counts.glAccounts = (await tx.glAccount.deleteMany({ where: { tenantId } })).count
    counts.accountingPeriods = (await tx.accountingPeriod.deleteMany({ where: { tenantId } })).count

    const accountingReset = await tx.accountingSettings.updateMany({
      where: { tenantId },
      data: {
        initializedAt: null,
        defaultAccounts: {},
        expenseCategoryMap: {},
      },
    })
    counts.accountingSettingsReset = accountingReset.count
  })

  return counts
}
