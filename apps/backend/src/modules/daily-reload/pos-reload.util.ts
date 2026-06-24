import { Prisma } from '@prisma/client'
import { RELOAD_PROVIDER_IDS, type ReloadServiceType } from './reload-settings.util'

const PROVIDER_BY_SKU: Record<string, string> = {
  DIALOG: 'Dialog',
  MOBITEL: 'Mobitel',
  AIRTEL: 'Airtel',
  HUTCH: 'Hutch',
}

export function parsePosReloadItem(item: {
  sku?: string
  reloadProvider?: string
  reloadType?: string
}): { provider: string; reloadType: ReloadServiceType } | null {
  if (item.reloadProvider && RELOAD_PROVIDER_IDS.includes(item.reloadProvider as any)) {
    return {
      provider: item.reloadProvider,
      reloadType: item.reloadType === 'RECHARGE_CARD' ? 'RECHARGE_CARD' : 'RELOAD',
    }
  }

  const sku = (item.sku ?? '').toUpperCase()
  let reloadType: ReloadServiceType = 'RELOAD'
  let raw = ''
  if (sku.startsWith('RCARD-')) {
    reloadType = 'RECHARGE_CARD'
    raw = sku.slice(6)
  } else if (sku.startsWith('RELOAD-')) {
    raw = sku.slice(7)
  } else {
    return null
  }

  const provider = PROVIDER_BY_SKU[raw]
  return provider ? { provider, reloadType } : null
}

export async function createDailyReloadsFromSaleItems(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string
    items: Array<{ sku?: string; reloadProvider?: string; reloadType?: string; total?: number; unitPrice?: number; quantity?: number }>
    invoiceNumber: string
    cashierName: string
  },
): Promise<number> {
  const feat = await tx.tenantFeature.findFirst({
    where: { tenantId: opts.tenantId, feature: 'DAILY_RELOAD', enabled: true },
  })
  if (!feat) return 0

  let created = 0
  for (const item of opts.items) {
    const parsed = parsePosReloadItem(item)
    if (!parsed) continue
    const amount = Number(item.total ?? (Number(item.unitPrice ?? 0) * Number(item.quantity ?? 1)))
    if (!amount || amount <= 0) continue
    await tx.dailyReload.create({
      data: {
        tenantId: opts.tenantId,
        connectionNo: parsed.provider,
        provider: parsed.provider,
        reloadType: parsed.reloadType,
        amount,
        executedBy: opts.cashierName,
        transactionId: opts.invoiceNumber,
        status: 'Success',
      },
    })
    created += 1
  }
  return created
}
