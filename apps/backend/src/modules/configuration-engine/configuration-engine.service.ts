import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { normalizeReloadSettings } from '../daily-reload/reload-settings.util'
import { normalizePaymentMethodSettings } from '../tenants/payment-method-settings.util'
import { normalizeProductVariantSettings } from '../products/product-variant-settings.util'
import {
  applyProductCodeSettings,
  normalizeProductCodeSettings,
} from '../products/product-code-settings.util'
import { peekProductCodes } from '../../utils/counters'
import { normalizeInvoiceSettings } from '../tenants/invoice-settings.util'
import { normalizePosUiSettings } from '../tenants/pos-ui-settings.util'
import { cacheGet, cacheInvalidate, cacheSet } from './configuration-engine.cache'
import { CONFIG_DOMAIN_META, type ConfigDomain } from './configuration-engine.types'

const DEFAULT_TTL_MS = 30_000

function assertDomain(domain: string): asserts domain is ConfigDomain {
  if (!CONFIG_DOMAIN_META.some(d => d.domain === domain)) {
    throw new AppError(`Unknown configuration domain: ${domain}`, 400)
  }
}

function deepMergePatch(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const patchBarcode =
    patch.barcodeLabel && typeof patch.barcodeLabel === 'object'
      ? (patch.barcodeLabel as Record<string, unknown>)
      : undefined
  return {
    ...prev,
    ...patch,
    ...(patchBarcode
      ? {
          barcodeLabel: {
            ...(prev.barcodeLabel && typeof prev.barcodeLabel === 'object'
              ? (prev.barcodeLabel as Record<string, unknown>)
              : {}),
            ...patchBarcode,
          },
        }
      : {}),
  }
}

export function listConfigDomains() {
  return CONFIG_DOMAIN_META
}

/**
 * Read + normalize one settings domain.
 * Defaults equal current behavior when JSON is unset.
 */
export async function getTenantConfig<T = unknown>(
  tenantId: string,
  domain: ConfigDomain,
  opts?: { bypassCache?: boolean; ttlMs?: number },
): Promise<T> {
  assertDomain(domain)
  if (!opts?.bypassCache) {
    const hit = cacheGet<T>(tenantId, domain)
    if (hit !== undefined) return hit
  }

  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      slug: true,
      invoiceSettings: true,
      reloadSettings: true,
      paymentMethodSettings: true,
      productVariantSettings: true,
      productCodeSettings: true,
      posUiSettings: true,
    },
  })
  if (!t) throw new AppError('Tenant not found', 404)

  let value: unknown
  switch (domain) {
    case 'invoice':
      value = normalizeInvoiceSettings(t.invoiceSettings, t.slug)
      break
    case 'reload':
      value = normalizeReloadSettings(t.reloadSettings)
      break
    case 'paymentMethod':
      value = normalizePaymentMethodSettings(t.paymentMethodSettings)
      break
    case 'productVariant':
      value = normalizeProductVariantSettings(t.productVariantSettings)
      break
    case 'productCode': {
      const settings = normalizeProductCodeSettings(t.productCodeSettings)
      const peek = await peekProductCodes(tenantId, t.slug)
      value = { ...settings, nextSku: peek.sku, nextBarcode: peek.barcode, prefix: peek.prefix }
      break
    }
    case 'posUi':
      value = normalizePosUiSettings(t.posUiSettings)
      break
  }

  cacheSet(tenantId, domain, value, opts?.ttlMs ?? DEFAULT_TTL_MS)
  return value as T
}

/**
 * Write + normalize one settings domain. Invalidates cache for that domain.
 */
export async function setTenantConfig(
  tenantId: string,
  domain: ConfigDomain,
  patch: Record<string, unknown>,
): Promise<unknown> {
  assertDomain(domain)

  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      slug: true,
      invoiceSettings: true,
      reloadSettings: true,
      paymentMethodSettings: true,
      productVariantSettings: true,
      productCodeSettings: true,
      posUiSettings: true,
    },
  })
  if (!existing) throw new AppError('Tenant not found', 404)

  let column: string
  let normalized: unknown

  switch (domain) {
    case 'invoice': {
      column = 'invoiceSettings'
      const prev =
        existing.invoiceSettings && typeof existing.invoiceSettings === 'object'
          ? (existing.invoiceSettings as Record<string, unknown>)
          : {}
      normalized = normalizeInvoiceSettings(deepMergePatch(prev, patch), existing.slug)
      break
    }
    case 'reload':
      column = 'reloadSettings'
      normalized = normalizeReloadSettings(patch)
      break
    case 'paymentMethod':
      column = 'paymentMethodSettings'
      normalized = normalizePaymentMethodSettings(patch)
      break
    case 'productVariant':
      column = 'productVariantSettings'
      normalized = normalizeProductVariantSettings(patch)
      break
    case 'productCode':
      column = 'productCodeSettings'
      normalized = normalizeProductCodeSettings(patch)
      break
    case 'posUi': {
      column = 'posUiSettings'
      const prev =
        existing.posUiSettings && typeof existing.posUiSettings === 'object'
          ? (existing.posUiSettings as Record<string, unknown>)
          : {}
      normalized = normalizePosUiSettings(deepMergePatch(prev, patch))
      break
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { [column]: normalized as any },
  })

  if (domain === 'productCode') {
    await applyProductCodeSettings(tenantId, existing.slug, normalized as any)
  }

  cacheInvalidate(tenantId, domain)

  // Return fresh read (productCode includes peek fields)
  return getTenantConfig(tenantId, domain, { bypassCache: true })
}

/** Aggregated settings bag — foundation for future GET /tenants/me/settings. */
export async function getAllTenantConfigs(tenantId: string) {
  const [invoice, reload, paymentMethod, productVariant, productCode, posUi] = await Promise.all([
    getTenantConfig(tenantId, 'invoice'),
    getTenantConfig(tenantId, 'reload'),
    getTenantConfig(tenantId, 'paymentMethod'),
    getTenantConfig(tenantId, 'productVariant'),
    getTenantConfig(tenantId, 'productCode'),
    getTenantConfig(tenantId, 'posUi'),
  ])
  return { invoice, reload, paymentMethod, productVariant, productCode, posUi }
}

export function invalidateTenantConfigCache(tenantId: string, domain?: ConfigDomain) {
  cacheInvalidate(tenantId, domain)
}
