# Template Engine (Phase 1)

Registry + variable binding for documents/messages. HTML/thermal layouts still render on **web**; backend owns contracts and text binding.

**Writes:** none  
**Flag:** none (safe facade)  
**Blueprint:** Section 4.3.8

## Entrypoints

| Function | Use |
|----------|-----|
| `listTemplateRegistry()` | Catalog of template keys + variables |
| `bindTemplateVariables(template, vars)` | `{{key}}` substitution |
| `renderWhatsAppSaleInvoice(input)` | WhatsApp sale message body |
| `loadInvoiceSettingsForTemplates(tenantId)` | Normalized shop settings |
| `shopVarsFromInvoiceSettings(settings)` | Common shop bind vars |
| `invoiceLayoutKeyFromId(id)` | Map settings template id → registry key |

## Consumers

- `whatsapp.service.ts` — sale invoice text message

## Next

- Server-side HTML render adapters (optional)
- Warranty / repair print variable contracts consumed by web
- Barcode label payload builder via registry key
