export const INVOICE_SETTINGS_KEY = 'hx_invoice_settings'

export type InvoiceTemplateId = 'default' | 'kasthuri' | 'payment_receipt'

export const INVOICE_TEMPLATE_OPTIONS: Array<{
  id: InvoiceTemplateId
  label: string
  description: string
}> = [
  { id: 'default', label: 'Classic', description: 'Standard A4 invoice with company header and bank details' },
  { id: 'kasthuri', label: 'Kasthuri', description: 'Professional layout with warranty and VAT fields' },
  { id: 'payment_receipt', label: 'Payment Receipt', description: 'Formal receipt with item table and payment information' },
]

export const KASTHURI_TENANT_SLUG = 'kasthuri-mobile-solutions'

export const HEXALYTE_SOFTWARE_CREDIT = 'Software by Hexalyte Innovation'
export const HEXALYTE_SUPPORT_PHONE = '0703130100'
export const HEXALYTE_SOFTWARE_FOOTER = `${HEXALYTE_SOFTWARE_CREDIT} · ${HEXALYTE_SUPPORT_PHONE}`

export interface InvoiceSettings {
  invoiceTemplate?: InvoiceTemplateId
  shopName:       string
  companyLegalName?: string
  vatRegNo?:        string
  qrCodeUrl?:       string
  slogan:         string
  logo:           string
  phone:          string
  email:          string
  address:        string
  website:        string
  bankName:       string
  accNumber:      string
  accHolder:      string
  swiftCode:      string
  currency:       string
  taxRate:        number
  discountRate:   number
  terms:          string[]
  warrantyServiceTerms?: string[]
  signatoryName:    string
  signatoryTitle:   string
  footerNote:       string
  bankDetails:      string
  thermalWidthPOS:    '58mm' | '80mm' | 'stockForm'
  thermalWidthRepair: '58mm' | '80mm'
  thermalShowLogo:      boolean
  thermalShowSlogan:    boolean
  thermalShowAddress:   boolean
  thermalShowPhone:     boolean
  thermalShowEmail:     boolean
  thermalShowCustomer:  boolean
  thermalShowSku:       boolean
  thermalShowImei:      boolean
  thermalShowPayment:   boolean
  thermalShowBank:      boolean
  thermalShowWebsite:   boolean
  thermalShowWarranty:  boolean
  thermalFontSize:      'sm' | 'md' | 'lg'
  /** When true, POS prints the bill automatically after each completed sale */
  posAutoPrintBill:     boolean
}

export const KASTHURI_INVOICE_PRESET: Partial<InvoiceSettings> = {
  invoiceTemplate: 'kasthuri',
  shopName: 'Kasthuri Mobile Solutions',
  companyLegalName: 'KASTHURI MOBILE SOLUTIONS (PVT) LTD',
  logo: '/invoice-templates/kasthuri-logo.png',
  slogan: 'Expert In Repairs For iPhone, MacBook, Apple Watch, And AirPods – Delivering Professional, Reliable Solutions For All Your Apple Devices.',
  address: '06, Behind Gimanhala Road, Dambulla, Sri Lanka.',
  website: 'www.kasthurimobile.com',
  email: 'info@kasthurimobile.com',
  phone: '+94 74 100 1000',
  terms: [
    'Checking warranty does not apply if the warranty sticker is broken or removed.',
    'Goods / Parts / Accessories once sold will not be taken back.',
  ],
  warrantyServiceTerms: [
    '3 months coverage for phone to phone warranty.',
    'Software Warranty: 2 years coverage, including free software updates.',
    'Post-Warranty Discount: After the initial 3 months, customers receive 30% off any repair service charges.',
  ],
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  invoiceTemplate: 'default',
  shopName:       '',
  slogan:         '',
  logo:           '',
  phone:          '',
  email:          '',
  address:        '',
  website:        '',
  bankName:       '',
  accNumber:      '',
  accHolder:      '',
  swiftCode:      '',
  currency:       'LKR',
  taxRate:        0,
  discountRate:   0,
  terms:          [
    'Payment is due upon receipt of this invoice.',
    'All sales are final unless otherwise agreed.',
    'Thank you for your business!',
  ],
  warrantyServiceTerms: [],
  signatoryName:     '',
  signatoryTitle:    'Authorized Signatory',
  footerNote:        'Thank you for your business!',
  bankDetails:       '',
  thermalWidthPOS:    '58mm',
  thermalWidthRepair: '80mm',
  thermalShowLogo:      true,
  thermalShowSlogan:    true,
  thermalShowAddress:   true,
  thermalShowPhone:     true,
  thermalShowEmail:     true,
  thermalShowCustomer:  true,
  thermalShowSku:       true,
  thermalShowImei:      true,
  thermalShowPayment:   true,
  thermalShowBank:      true,
  thermalShowWebsite:   true,
  thermalShowWarranty:  true,
  thermalFontSize:      'md',
  posAutoPrintBill:     true,
}

export interface ShopContext {
  tenantName?: string
  tenantEmail?: string
  branchName?: string
  branchAddress?: string
  branchCity?: string
  branchState?: string
  branchPhone?: string
  branchEmail?: string
}

/** True for the Kasthuri Mobile Solutions tenant only */
export function isKasthuriTenant(tenantSlug?: string | null): boolean {
  return tenantSlug === KASTHURI_TENANT_SLUG
}

/** Active A4 template — saved setting wins; Kasthuri tenant defaults to kasthuri */
export function resolveInvoiceTemplate(
  settings: InvoiceSettings,
  tenantSlug?: string | null,
): InvoiceTemplateId {
  if (settings.invoiceTemplate) return settings.invoiceTemplate
  if (isKasthuriTenant(tenantSlug)) return 'kasthuri'
  return 'default'
}

/** True when the Kasthuri A4 layout should be used */
export function isKasthuriInvoice(settings: InvoiceSettings, tenantSlug?: string): boolean {
  return resolveInvoiceTemplate(settings, tenantSlug) === 'kasthuri'
}

export function isPaymentReceiptInvoice(settings: InvoiceSettings, tenantSlug?: string): boolean {
  return resolveInvoiceTemplate(settings, tenantSlug) === 'payment_receipt'
}

export function applyKasthuriPreset(settings: InvoiceSettings, tenantSlug?: string): InvoiceSettings {
  if (tenantSlug !== KASTHURI_TENANT_SLUG) return settings
  const merged: InvoiceSettings = {
    ...KASTHURI_INVOICE_PRESET,
    ...settings,
    invoiceTemplate: settings.invoiceTemplate ?? KASTHURI_INVOICE_PRESET.invoiceTemplate ?? 'kasthuri',
  }
  if (!merged.logo?.trim()) merged.logo = KASTHURI_INVOICE_PRESET.logo ?? ''
  if (!merged.companyLegalName?.trim()) merged.companyLegalName = KASTHURI_INVOICE_PRESET.companyLegalName ?? ''
  if (!merged.slogan?.trim()) merged.slogan = KASTHURI_INVOICE_PRESET.slogan ?? ''
  if (!merged.address?.trim()) merged.address = KASTHURI_INVOICE_PRESET.address ?? ''
  if (!merged.website?.trim()) merged.website = KASTHURI_INVOICE_PRESET.website ?? ''
  if (!merged.email?.trim()) merged.email = KASTHURI_INVOICE_PRESET.email ?? ''
  if (!merged.phone?.trim()) merged.phone = KASTHURI_INVOICE_PRESET.phone ?? ''
  if (!merged.shopName?.trim()) merged.shopName = KASTHURI_INVOICE_PRESET.shopName ?? ''
  if (!merged.terms?.length) merged.terms = [...(KASTHURI_INVOICE_PRESET.terms ?? [])]
  if (!merged.warrantyServiceTerms?.length) {
    merged.warrantyServiceTerms = [...(KASTHURI_INVOICE_PRESET.warrantyServiceTerms ?? [])]
  }
  return merged
}

export function mergeReceiptSettings(
  settings: InvoiceSettings,
  ctx?: ShopContext,
): InvoiceSettings {
  const branchLine = [ctx?.branchAddress, ctx?.branchCity, ctx?.branchState].filter(Boolean).join(', ')
  return {
    ...settings,
    shopName: settings.shopName?.trim() || ctx?.tenantName?.trim() || ctx?.branchName?.trim() || '',
    email: settings.email?.trim() || ctx?.branchEmail?.trim() || ctx?.tenantEmail?.trim() || '',
    phone: settings.phone?.trim() || ctx?.branchPhone?.trim() || '',
    address: settings.address?.trim() || branchLine || '',
  }
}

export function shopContextFromTenant(tenant: any, branchId?: string): ShopContext | undefined {
  if (!tenant) return undefined
  const branches: any[] = tenant.branches ?? []
  const branch =
    (branchId ? branches.find(b => b.id === branchId) : undefined)
    ?? branches.find(b => b.isDefault)
    ?? branches.find(b => b.isHeadquarters)
    ?? branches[0]
  return {
    tenantName: tenant.name,
    tenantEmail: tenant.ownerEmail,
    branchName: branch?.name,
    branchAddress: branch?.address,
    branchCity: branch?.city,
    branchState: branch?.state,
    branchPhone: branch?.phone,
    branchEmail: branch?.email,
  }
}

export function getInvoiceSettings(ctx?: ShopContext): InvoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_INVOICE_SETTINGS
  try {
    const stored = { ...DEFAULT_INVOICE_SETTINGS, ...JSON.parse(localStorage.getItem(INVOICE_SETTINGS_KEY) ?? '{}') }
    return ctx ? mergeReceiptSettings(stored, ctx) : stored
  } catch {
    return DEFAULT_INVOICE_SETTINGS
  }
}

export function saveInvoiceSettings(s: InvoiceSettings) {
  localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(s))
}

export async function fetchInvoiceSettings(tenantId: string, branchId?: string): Promise<InvoiceSettings> {
  try {
    const { tenantApi } = await import('./api')
    const [invRes, tenantRes] = await Promise.all([
      tenantApi.getInvoiceSettings(tenantId, branchId),
      tenantApi.get(tenantId).catch(() => null),
    ])
    const data = (invRes as any)?.data ?? invRes
    const tenant = (tenantRes as any)?.data ?? tenantRes
    const ctx = shopContextFromTenant(tenant, branchId)
    const slug = tenant?.slug as string | undefined
    const base = applyKasthuriPreset({
      ...DEFAULT_INVOICE_SETTINGS,
      ...data,
      invoiceTemplate: resolveInvoiceTemplate({ ...DEFAULT_INVOICE_SETTINGS, ...data }, slug),
    }, slug)
    const merged = mergeReceiptSettings(base, ctx)
    saveInvoiceSettings(merged)
    return merged
  } catch {
    return getInvoiceSettings()
  }
}

/** Raw invoice customize values (Invoice tab) without shop/branch overlay */
export async function fetchInvoiceCustomizeSettings(
  tenantId: string,
  tenantSlug?: string,
): Promise<InvoiceSettings> {
  try {
    const { tenantApi } = await import('./api')
    const res: any = await tenantApi.getInvoiceSettings(tenantId)
    const data = res?.data ?? res
    return applyKasthuriPreset({
      ...DEFAULT_INVOICE_SETTINGS,
      ...data,
      invoiceTemplate: resolveInvoiceTemplate({ ...DEFAULT_INVOICE_SETTINGS, ...data }, tenantSlug),
    }, tenantSlug)
  } catch {
    return applyKasthuriPreset(getInvoiceSettings(), tenantSlug)
  }
}

export async function pushInvoiceSettings(tenantId: string, s: InvoiceSettings, tenantSlug?: string): Promise<InvoiceSettings> {
  const payload: InvoiceSettings = {
    ...DEFAULT_INVOICE_SETTINGS,
    ...s,
    invoiceTemplate: s.invoiceTemplate ?? resolveInvoiceTemplate(s, tenantSlug),
  }
  saveInvoiceSettings(payload)
  const { tenantApi } = await import('./api')
  const res: any = await tenantApi.updateInvoiceSettings(tenantId, payload)
  const saved = (res?.data ?? res) as InvoiceSettings
  const merged = applyKasthuriPreset({ ...DEFAULT_INVOICE_SETTINGS, ...saved }, tenantSlug)
  saveInvoiceSettings(merged)
  return merged
}
