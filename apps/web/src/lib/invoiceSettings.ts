export const INVOICE_SETTINGS_KEY = 'hx_invoice_settings'

export interface InvoiceSettings {
  shopName:       string
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
  signatoryName:  string
  signatoryTitle: string
  footerNote:     string
  bankDetails:    string
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
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
  signatoryName:  '',
  signatoryTitle: 'Authorized Signatory',
  footerNote:     'Thank you for your business!',
  bankDetails:    '',
}

export function getInvoiceSettings(): InvoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_INVOICE_SETTINGS
  try {
    return { ...DEFAULT_INVOICE_SETTINGS, ...JSON.parse(localStorage.getItem(INVOICE_SETTINGS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_INVOICE_SETTINGS
  }
}

export function saveInvoiceSettings(s: InvoiceSettings) {
  localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(s))
}
