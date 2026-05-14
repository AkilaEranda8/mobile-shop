export const INVOICE_SETTINGS_KEY = 'hx_invoice_settings'

export interface InvoiceSettings {
  shopName:    string
  slogan:      string
  phone:       string
  bankDetails: string
  email:      string
  address:    string
  website:    string
  footerNote: string
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  shopName:    '',
  slogan:      '',
  phone:       '',
  bankDetails: '',
  email:      '',
  address:    '',
  website:    '',
  footerNote: 'Thank you for your business!',
}

export function getInvoiceSettings(): InvoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_INVOICE_SETTINGS
  try {
    return { ...DEFAULT_INVOICE_SETTINGS, ...JSON.parse(localStorage.getItem(INVOICE_SETTINGS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_INVOICE_SETTINGS
  }
}
