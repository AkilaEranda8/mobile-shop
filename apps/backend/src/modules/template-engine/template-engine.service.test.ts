/**
 * Run: npx tsx src/modules/template-engine/template-engine.service.test.ts
 */
import { DEFAULT_WHATSAPP_SALE_INVOICE_TEMPLATE, TEMPLATE_REGISTRY } from './template-engine.registry'
import {
  bindTemplateVariables,
  getTemplateEntry,
  invoiceLayoutKeyFromId,
  listTemplateRegistry,
  renderWhatsAppSaleInvoice,
} from './template-engine.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(listTemplateRegistry().length === TEMPLATE_REGISTRY.length, 'registry length')
assert(getTemplateEntry('message.whatsapp.sale_invoice')?.channel === 'whatsapp', 'wa entry')
assert(invoiceLayoutKeyFromId('kasthuri') === 'invoice.layout.kasthuri', 'layout map')

assert(
  bindTemplateVariables('Hi {{name}}!', { name: 'Akila' }) === 'Hi Akila!',
  'bind vars',
)
assert(
  bindTemplateVariables('Hi {{name}}!', {}) === 'Hi !',
  'missing var empty',
)

const rendered = renderWhatsAppSaleInvoice({
  orderId: 'INV-1',
  amount: 1500,
  customerName: 'Sam',
  shopName: 'Demo Shop',
})
assert(rendered.body.includes('INV-1'), 'order in body')
assert(rendered.body.includes('Sam'), 'customer in body')
assert(rendered.key === 'message.whatsapp.sale_invoice', 'key')
assert(DEFAULT_WHATSAPP_SALE_INVOICE_TEMPLATE.includes('{{order_id}}'), 'default template')

console.log('template-engine.service.test.ts: all checks passed')
