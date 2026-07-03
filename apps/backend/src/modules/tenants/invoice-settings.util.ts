export const INVOICE_TEMPLATE_IDS = ['default', 'kasthuri', 'payment_receipt'] as const
export type InvoiceTemplateId = (typeof INVOICE_TEMPLATE_IDS)[number]

export const INVOICE_TEMPLATE_OPTIONS: Array<{
  id: InvoiceTemplateId
  label: string
  description: string
}> = [
  { id: 'default', label: 'Classic', description: 'Standard A4 invoice with company header and bank details' },
  { id: 'kasthuri', label: 'Professional', description: 'Professional layout with warranty and VAT fields' },
  { id: 'payment_receipt', label: 'Payment Receipt', description: 'Formal receipt with item table and payment information' },
]

export const KASTHURI_TENANT_SLUG = 'kasthuri-mobile-solutions'
export const PAYMENT_RECEIPT_TENANT_SLUGS = ['adrexlk', 'adrex-lk'] as const

/** Legacy tenant slugs — used for default presets only; all templates are selectable by any tenant */
export const INVOICE_TEMPLATE_TENANT_SLUGS: Record<Exclude<InvoiceTemplateId, 'default'>, readonly string[]> = {
  kasthuri: [KASTHURI_TENANT_SLUG],
  payment_receipt: [...PAYMENT_RECEIPT_TENANT_SLUGS],
}

export function tenantCanUseInvoiceTemplate(template: InvoiceTemplateId): boolean {
  return (INVOICE_TEMPLATE_IDS as readonly string[]).includes(template)
}

export function listInvoiceTemplatesForTenant(_tenantSlug?: string | null) {
  return INVOICE_TEMPLATE_OPTIONS
}

export function isKasthuriTenant(tenantSlug?: string | null): boolean {
  return tenantSlug === KASTHURI_TENANT_SLUG
}

export function isPaymentReceiptTenant(tenantSlug?: string | null): boolean {
  if (!tenantSlug) return false
  return PAYMENT_RECEIPT_TENANT_SLUGS.includes(tenantSlug as (typeof PAYMENT_RECEIPT_TENANT_SLUGS)[number])
    || INVOICE_TEMPLATE_TENANT_SLUGS.payment_receipt.includes(tenantSlug)
}

export interface InvoiceSettings {
  invoiceTemplate: InvoiceTemplateId
  shopName: string
  companyLegalName: string
  vatRegNo: string
  qrCodeUrl: string
  slogan: string
  logo: string
  phone: string
  email: string
  address: string
  website: string
  bankName: string
  accNumber: string
  accHolder: string
  swiftCode: string
  bankDetails: string
  currency: string
  taxRate: number
  discountRate: number
  terms: string[]
  warrantyServiceTerms: string[]
  signatoryName: string
  signatoryTitle: string
  footerNote: string
  thermalWidthPOS: '58mm' | '80mm' | 'stockForm'
  thermalWidthRepair: '58mm' | '80mm'
  thermalShowLogo: boolean
  thermalShowSlogan: boolean
  thermalShowAddress: boolean
  thermalShowPhone: boolean
  thermalShowEmail: boolean
  thermalShowCustomer: boolean
  thermalShowSku: boolean
  thermalShowImei: boolean
  thermalShowPayment: boolean
  thermalShowBank: boolean
  thermalShowWebsite: boolean
  thermalShowWarranty: boolean
  thermalFontSize: 'sm' | 'md' | 'lg'
  posAutoPrintBill: boolean
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  invoiceTemplate: 'default',
  shopName: '',
  companyLegalName: '',
  vatRegNo: '',
  qrCodeUrl: '',
  slogan: '',
  logo: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  bankName: '',
  accNumber: '',
  accHolder: '',
  swiftCode: '',
  bankDetails: '',
  currency: 'LKR',
  taxRate: 0,
  discountRate: 0,
  terms: [
    'Payment is due upon receipt of this invoice.',
    'All sales are final unless otherwise agreed.',
    'Thank you for your business!',
  ],
  warrantyServiceTerms: [],
  signatoryName: '',
  signatoryTitle: 'Authorized Signatory',
  footerNote: 'Thank you for your business!',
  thermalWidthPOS: '58mm',
  thermalWidthRepair: '80mm',
  thermalShowLogo: true,
  thermalShowSlogan: true,
  thermalShowAddress: true,
  thermalShowPhone: true,
  thermalShowEmail: true,
  thermalShowCustomer: true,
  thermalShowSku: true,
  thermalShowImei: true,
  thermalShowPayment: true,
  thermalShowBank: true,
  thermalShowWebsite: true,
  thermalShowWarranty: true,
  thermalFontSize: 'md',
  posAutoPrintBill: true,
}

function str(v: unknown, fallback = '') {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback: number) {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback
}

function bool(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback
}

function strArray(v: unknown, fallback: string[]) {
  if (!Array.isArray(v)) return fallback
  return v.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean)
}

function parseTemplate(v: unknown, tenantSlug?: string | null): InvoiceTemplateId {
  if (typeof v === 'string' && (INVOICE_TEMPLATE_IDS as readonly string[]).includes(v)) {
    return v as InvoiceTemplateId
  }
  if (!v && isKasthuriTenant(tenantSlug)) return 'kasthuri'
  return 'default'
}

export function resolveInvoiceTemplate(
  settings: Pick<InvoiceSettings, 'invoiceTemplate'>,
  tenantSlug?: string | null,
): InvoiceTemplateId {
  const requested = settings.invoiceTemplate
  if (requested && (INVOICE_TEMPLATE_IDS as readonly string[]).includes(requested)) return requested
  if (!requested && isKasthuriTenant(tenantSlug)) return 'kasthuri'
  return 'default'
}

export function normalizeInvoiceSettings(raw: unknown, tenantSlug?: string | null): InvoiceSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = { ...DEFAULT_INVOICE_SETTINGS }

  const thermalWidthPOS = src.thermalWidthPOS
  const thermalWidthRepair = src.thermalWidthRepair
  const thermalFontSize = src.thermalFontSize

  return {
    ...base,
    invoiceTemplate: parseTemplate(src.invoiceTemplate ?? base.invoiceTemplate, tenantSlug),
    shopName: str(src.shopName, base.shopName),
    companyLegalName: str(src.companyLegalName, base.companyLegalName),
    vatRegNo: str(src.vatRegNo, base.vatRegNo),
    qrCodeUrl: str(src.qrCodeUrl, base.qrCodeUrl),
    slogan: str(src.slogan, base.slogan),
    logo: str(src.logo, base.logo),
    phone: str(src.phone, base.phone),
    email: str(src.email, base.email),
    address: str(src.address, base.address),
    website: str(src.website, base.website),
    bankName: str(src.bankName, base.bankName),
    accNumber: str(src.accNumber, base.accNumber),
    accHolder: str(src.accHolder, base.accHolder),
    swiftCode: str(src.swiftCode, base.swiftCode),
    bankDetails: str(src.bankDetails, base.bankDetails),
    currency: str(src.currency, base.currency) || 'LKR',
    taxRate: Math.max(0, Math.min(100, num(src.taxRate, base.taxRate))),
    discountRate: Math.max(0, Math.min(100, num(src.discountRate, base.discountRate))),
    terms: strArray(src.terms, base.terms),
    warrantyServiceTerms: strArray(src.warrantyServiceTerms, base.warrantyServiceTerms),
    signatoryName: str(src.signatoryName, base.signatoryName),
    signatoryTitle: str(src.signatoryTitle, base.signatoryTitle),
    footerNote: str(src.footerNote, base.footerNote),
    thermalWidthPOS: thermalWidthPOS === '80mm' || thermalWidthPOS === 'stockForm' ? thermalWidthPOS : '58mm',
    thermalWidthRepair: thermalWidthRepair === '58mm' ? '58mm' : '80mm',
    thermalShowLogo: bool(src.thermalShowLogo, base.thermalShowLogo),
    thermalShowSlogan: bool(src.thermalShowSlogan, base.thermalShowSlogan),
    thermalShowAddress: bool(src.thermalShowAddress, base.thermalShowAddress),
    thermalShowPhone: bool(src.thermalShowPhone, base.thermalShowPhone),
    thermalShowEmail: bool(src.thermalShowEmail, base.thermalShowEmail),
    thermalShowCustomer: bool(src.thermalShowCustomer, base.thermalShowCustomer),
    thermalShowSku: bool(src.thermalShowSku, base.thermalShowSku),
    thermalShowImei: bool(src.thermalShowImei, base.thermalShowImei),
    thermalShowPayment: bool(src.thermalShowPayment, base.thermalShowPayment),
    thermalShowBank: bool(src.thermalShowBank, base.thermalShowBank),
    thermalShowWebsite: bool(src.thermalShowWebsite, base.thermalShowWebsite),
    thermalShowWarranty: bool(src.thermalShowWarranty, base.thermalShowWarranty),
    thermalFontSize: thermalFontSize === 'sm' || thermalFontSize === 'lg' ? thermalFontSize : 'md',
    posAutoPrintBill: bool(src.posAutoPrintBill, base.posAutoPrintBill),
  }
}
