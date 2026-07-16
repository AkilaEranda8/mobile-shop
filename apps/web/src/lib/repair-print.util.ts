import type { InvoiceSettings } from '@/lib/invoiceSettings'
import { thermalLogoMaxHeight, thermalBodyFontWeight, resolveRepairIntakeTerms } from '@/lib/invoiceSettings'
import type { RepairTicket } from '@/types'

function openThermalPrint(html: string, _title: string): boolean {
  const w = window.open('', '_blank', 'width=350,height=600')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
    w.close()
  }, 400)
  return true
}

function thermalShell(settings: InvoiceSettings, title: string, body: string) {
  const paperWidth = settings.thermalWidthRepair || '80mm'
  const bodyWidth = paperWidth === '58mm' ? '216px' : '302px'
  const logoHeight = thermalLogoMaxHeight(settings.thermalLogoSize)
  const bodyWeight = thermalBodyFontWeight()
  const logoBlock =
    settings.thermalShowLogo !== false && settings.logo
      ? `<div class="center" style="margin-bottom:4px"><img src="${settings.logo}" alt="logo" style="max-height:${logoHeight}px;max-width:90%;object-fit:contain"/></div>`
      : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
  @page { size: ${paperWidth} auto; margin: 4mm 3mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; font-weight: ${bodyWeight}; color:#000; width:${bodyWidth}; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .big { font-size:14px; font-weight:bold; }
  .med { font-size:12px; font-weight:bold; }
  .line { border-top:1px dashed #000; margin:4px 0; }
  .row { display:flex; justify-content:space-between; margin:1px 0; gap:8px; }
  .row span:last-child { text-align:right; word-break:break-word; }
  .box { border:1px solid #000; padding:6px; margin:6px 0; text-align:center; }
  .sig { margin-top:14px; }
  .sig-line { border-top:1px solid #000; margin-top:28px; padding-top:3px; text-align:center; font-size:10px; }
</style></head><body>
${logoBlock}
<div class="center"><div class="big">${settings.shopName || 'Service Center'}</div>
${settings.phone ? `<div>${settings.phone}</div>` : ''}
${settings.address ? `<div>${settings.address}</div>` : ''}</div>
${body}
</body></html>`
}

/**
 * Thermal custody / intake slip — printed when customer drops off a device.
 * Confirms the shop has taken responsibility for the item.
 */
export function printRepairIntakeReceipt(repair: RepairTicket, settings: InvoiceSettings): boolean {
  const receivedAt = repair.createdAt
    ? new Date(repair.createdAt).toLocaleString('en-LK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('en-LK')

  const estCost =
    Number(repair.estimatedCost) > 0
      ? `LKR ${Number(repair.estimatedCost).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
      : 'To be confirmed'

  const deviceColor = (repair as RepairTicket & { deviceColor?: string }).deviceColor
  const intakeTerms = resolveRepairIntakeTerms(settings)
  const termsBlock = intakeTerms.length
    ? `<div class="line"></div>
<div class="bold med">TERMS</div>
${intakeTerms.map((t, i) => `<div style="font-size:10px;margin:3px 0;word-break:break-word;">${i + 1}. ${t.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('')}`
    : ''

  const body = `
<div class="line"></div>
<div class="center bold" style="font-size:13px;">DEVICE RECEIPT</div>
<div class="center" style="font-size:10px;">INTAKE / CUSTODY SLIP</div>
<div class="line"></div>
<div class="row"><span class="bold">Ticket#:</span><span class="bold" style="font-size:12px;">${repair.ticketNumber}</span></div>
<div class="row"><span>Date Received:</span><span>${receivedAt}</span></div>
<div class="row"><span>Status:</span><span>RECEIVED</span></div>
<div class="line"></div>
<div class="bold med">CUSTOMER</div>
<div class="row"><span>Name:</span><span>${repair.customerName || '—'}</span></div>
<div class="row"><span>Phone:</span><span>${repair.customerPhone || '—'}</span></div>
<div class="line"></div>
<div class="bold med">DEVICE RECEIVED</div>
<div class="row"><span>Brand/Model:</span><span>${[repair.deviceBrand, repair.deviceModel].filter(Boolean).join(' ') || '—'}</span></div>
${deviceColor ? `<div class="row"><span>Color:</span><span>${deviceColor}</span></div>` : ''}
${repair.imei ? `<div class="row"><span>IMEI:</span><span>${repair.imei}</span></div>` : ''}
${repair.accessories ? `<div class="row"><span>Accessories:</span><span>${repair.accessories}</span></div>` : ''}
${(repair as any).deviceCondition ? `<div style="margin:3px 0;"><div class="bold">Phone condition:</div><div style="word-break:break-word;margin-top:2px;">${(repair as any).deviceCondition}</div></div>` : ''}
<div class="line"></div>
<div class="bold med">Fault in mobile</div>
<div style="word-break:break-word;margin:2px 0;">${repair.reportedIssue || '—'}</div>
<div class="line"></div>
<div class="row"><span>Est. Cost:</span><span>${estCost}</span></div>
${repair.estimatedCompletion ? `<div class="row"><span>Est. Ready:</span><span>${new Date(repair.estimatedCompletion).toLocaleDateString('en-LK')}</span></div>` : ''}
${repair.technicianName ? `<div class="row"><span>Technician:</span><span>${repair.technicianName}</span></div>` : ''}
<div class="box">
  <div class="bold">DEVICE IN OUR CUSTODY</div>
  <div style="font-size:10px;margin-top:3px;">We have received the above device for repair.</div>
  <div style="font-size:10px;margin-top:2px;">ඉහත උපාංගය අප වෙත භාරගෙන ඇත.</div>
</div>
${termsBlock}
<div class="center" style="font-size:10px;margin-top:6px;">Please keep this slip to collect your device.</div>
<div class="sig" style="display:flex;gap:12px;">
  <div style="flex:1"><div class="sig-line">Customer signature</div></div>
  <div style="flex:1"><div class="sig-line">Authorized Signature</div></div>
</div>
<div class="line"></div>
<div class="center" style="font-size:9px;margin-top:4px;">Thank you for choosing us!</div>
<div class="center" style="font-size:9px;margin-top:2px;">${settings.website || ''}</div>
`

  return openThermalPrint(thermalShell(settings, `Intake-${repair.ticketNumber}`, body), `Intake-${repair.ticketNumber}`)
}
