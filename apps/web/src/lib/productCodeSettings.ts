export interface ProductCodeSettings {
  skuStartNumber: number
  barcodeStartNumber: number
  skuPad: number
}

export interface ProductCodeSettingsView extends ProductCodeSettings {
  nextSku?: string
  nextBarcode?: string
  prefix?: string
}

export const DEFAULT_PRODUCT_CODE_SETTINGS: ProductCodeSettings = {
  skuStartNumber: 1,
  barcodeStartNumber: 1,
  skuPad: 5,
}

export function normalizeProductCodeSettings(raw: unknown): ProductCodeSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const parse = (value: unknown, fallback: number) => {
    const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback
  }
  return {
    skuStartNumber: parse(src.skuStartNumber, DEFAULT_PRODUCT_CODE_SETTINGS.skuStartNumber),
    barcodeStartNumber: parse(src.barcodeStartNumber, DEFAULT_PRODUCT_CODE_SETTINGS.barcodeStartNumber),
    skuPad: Math.min(12, Math.max(3, parse(src.skuPad, DEFAULT_PRODUCT_CODE_SETTINGS.skuPad))),
  }
}

export async function fetchProductCodeSettings(tenantId: string): Promise<ProductCodeSettingsView> {
  const { tenantApi } = await import('./api')
  const res: any = await tenantApi.getProductCodeSettings(tenantId)
  const data = res?.data ?? res ?? {}
  return {
    ...normalizeProductCodeSettings(data),
    nextSku: data.nextSku,
    nextBarcode: data.nextBarcode,
    prefix: data.prefix,
  }
}

export async function pushProductCodeSettings(tenantId: string, settings: ProductCodeSettings): Promise<ProductCodeSettingsView> {
  const { tenantApi } = await import('./api')
  const res: any = await tenantApi.updateProductCodeSettings(tenantId, settings)
  const data = res?.data ?? res ?? {}
  return {
    ...normalizeProductCodeSettings(data),
    nextSku: data.nextSku,
    nextBarcode: data.nextBarcode,
    prefix: data.prefix,
  }
}
