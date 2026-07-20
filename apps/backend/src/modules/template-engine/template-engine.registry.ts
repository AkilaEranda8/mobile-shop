import type { TemplateRegistryEntry } from './template-engine.types'

export const DEFAULT_WHATSAPP_SALE_INVOICE_TEMPLATE =
  `Hello {{customer_name}},\n\nThank you for your purchase! 🎉\n\nOrder: {{order_id}}\nAmount: LKR {{amount}}\n\nThank you for choosing us!`

/** Canonical registry — layout HTML still renders on web; keys document the contract. */
export const TEMPLATE_REGISTRY: TemplateRegistryEntry[] = [
  {
    key: 'invoice.layout.default',
    label: 'Classic',
    description: 'Standard A4 invoice with company header and bank details',
    channel: 'a4',
    invoiceTemplateId: 'default',
    variables: ['shop_name', 'invoice_number', 'customer_name', 'total', 'date'],
  },
  {
    key: 'invoice.layout.kasthuri',
    label: 'Professional',
    description: 'Professional layout with warranty and VAT fields',
    channel: 'a4',
    invoiceTemplateId: 'kasthuri',
    variables: ['shop_name', 'invoice_number', 'customer_name', 'total', 'vat_reg_no', 'date'],
  },
  {
    key: 'invoice.layout.payment_receipt',
    label: 'Payment Receipt',
    description: 'Formal receipt with item table and payment information',
    channel: 'a4',
    invoiceTemplateId: 'payment_receipt',
    variables: ['shop_name', 'invoice_number', 'customer_name', 'total', 'paid_amount', 'date'],
  },
  {
    key: 'message.whatsapp.sale_invoice',
    label: 'WhatsApp sale invoice',
    description: 'Text message sent with optional PDF after POS sale',
    channel: 'whatsapp',
    variables: ['customer_name', 'order_id', 'amount', 'currency', 'date', 'shop_name'],
  },
  {
    key: 'label.barcode.po_receive',
    label: 'PO barcode labels',
    description: 'Structured label rows for thermal barcode stickers after receive',
    channel: 'label',
    variables: ['product_name', 'sku', 'barcode', 'price', 'qty', 'shop_name'],
  },
  {
    key: 'print.repair.intake',
    label: 'Repair intake slip',
    description: 'Thermal/web repair custody print (web renderer)',
    channel: 'thermal',
    variables: ['ticket_number', 'customer_name', 'device', 'imei', 'shop_name'],
  },
  {
    key: 'print.warranty.certificate',
    label: 'Warranty certificate',
    description: 'Warranty certificate print (web renderer)',
    channel: 'web',
    variables: ['warranty_code', 'customer_name', 'product_name', 'imei', 'end_date', 'shop_name'],
  },
]
