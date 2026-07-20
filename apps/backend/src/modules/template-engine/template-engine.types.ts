/** Stable template keys for registry / future renderers. */
export type TemplateKey =
  | 'invoice.layout.default'
  | 'invoice.layout.kasthuri'
  | 'invoice.layout.payment_receipt'
  | 'message.whatsapp.sale_invoice'
  | 'label.barcode.po_receive'
  | 'print.repair.intake'
  | 'print.warranty.certificate'

export type TemplateChannel = 'a4' | 'thermal' | 'whatsapp' | 'label' | 'web'

export type TemplateRegistryEntry = {
  key: TemplateKey
  label: string
  description: string
  channel: TemplateChannel
  /** Mustache-style variable names supported by this template */
  variables: string[]
  /** Maps to existing invoiceSettings.invoiceTemplate when applicable */
  invoiceTemplateId?: 'default' | 'kasthuri' | 'payment_receipt'
}

export type TemplateBindVars = Record<string, string | number | null | undefined>

export type RenderedTemplate = {
  key: TemplateKey
  channel: TemplateChannel
  body: string
  variablesUsed: string[]
}
