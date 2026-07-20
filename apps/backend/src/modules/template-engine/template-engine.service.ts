import { getTenantConfig } from '../configuration-engine/configuration-engine.service'
import type { InvoiceSettings } from '../tenants/invoice-settings.util'
import { DEFAULT_WHATSAPP_SALE_INVOICE_TEMPLATE, TEMPLATE_REGISTRY } from './template-engine.registry'
import type {
  RenderedTemplate,
  TemplateBindVars,
  TemplateKey,
  TemplateRegistryEntry,
} from './template-engine.types'

/**
 * Bind `{{variable}}` placeholders. Missing keys become empty string.
 */
export function bindTemplateVariables(template: string, vars: TemplateBindVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key]
    return value == null ? '' : String(value)
  })
}

export function listTemplateRegistry(): TemplateRegistryEntry[] {
  return TEMPLATE_REGISTRY
}

export function getTemplateEntry(key: TemplateKey): TemplateRegistryEntry | undefined {
  return TEMPLATE_REGISTRY.find(t => t.key === key)
}

/** Shop-facing bind vars from normalized invoice settings. */
export function shopVarsFromInvoiceSettings(settings: InvoiceSettings): TemplateBindVars {
  return {
    shop_name: settings.shopName || settings.companyLegalName || '',
    shop_phone: settings.phone || '',
    shop_email: settings.email || '',
    shop_address: settings.address || '',
    shop_website: settings.website || '',
    currency: settings.currency || 'LKR',
    vat_reg_no: settings.vatRegNo || '',
    slogan: settings.slogan || '',
    footer_note: settings.footerNote || '',
  }
}

export async function loadInvoiceSettingsForTemplates(tenantId: string): Promise<InvoiceSettings> {
  return getTenantConfig<InvoiceSettings>(tenantId, 'invoice')
}

export type WhatsAppSaleInvoiceInput = {
  templateBody?: string | null
  customerName?: string | null
  orderId: string
  amount?: number | null
  shopName?: string | null
  currency?: string
  date?: string
}

/** Render WhatsApp sale invoice message (text channel). */
export function renderWhatsAppSaleInvoice(input: WhatsAppSaleInvoiceInput): RenderedTemplate {
  const key: TemplateKey = 'message.whatsapp.sale_invoice'
  const entry = getTemplateEntry(key)!
  const template = input.templateBody?.trim() || DEFAULT_WHATSAPP_SALE_INVOICE_TEMPLATE
  const vars: TemplateBindVars = {
    customer_name: input.customerName ?? 'Customer',
    order_id: input.orderId,
    amount: input.amount != null ? Number(input.amount).toLocaleString() : '0',
    currency: input.currency ?? 'LKR',
    date: input.date ?? new Date().toLocaleDateString(),
    shop_name: input.shopName ?? 'Hexalyte',
  }
  return {
    key,
    channel: entry.channel,
    body: bindTemplateVariables(template, vars),
    variablesUsed: entry.variables,
  }
}

/** Map invoice layout template id → registry key. */
export function invoiceLayoutKeyFromId(
  id: 'default' | 'kasthuri' | 'payment_receipt',
): TemplateKey {
  switch (id) {
    case 'kasthuri':
      return 'invoice.layout.kasthuri'
    case 'payment_receipt':
      return 'invoice.layout.payment_receipt'
    default:
      return 'invoice.layout.default'
  }
}
