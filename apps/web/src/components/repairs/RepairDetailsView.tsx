'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Loader2, X, Check, Smartphone, User, Wrench, DollarSign, AlertTriangle,
  CheckCircle2, CheckCircle, MessageSquare, Package, ArrowRight, ArrowLeft, MoreVertical, Phone,
  MapPin, Upload, SlidersHorizontal, FileText, Pencil, Zap, ClipboardList, History, Hash, Printer, Shield,
} from 'lucide-react'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useProducts, useFeatureFlag, useCanSeeProductCost } from '@/lib/hooks'
import { repairsApi, uploadApi } from '@/lib/api'
import { usePaymentMethods, type PaymentMethodKey } from '@/lib/payment-methods'
import { whatsappApi, formatWhatsAppPhone } from '@/lib/whatsapp-api'
import { captureElementAsPdfBase64 } from '@/lib/invoice-pdf'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { getInvoiceSettings, fetchInvoiceSettings, resolveInvoiceTemplate, thermalLogoMaxHeight, thermalBodyFontWeight, type InvoiceSettings } from '@/lib/invoiceSettings'
import { buildRepairInvoiceSale, resolveRepairWarrantyMonths, REPAIR_WARRANTY_OPTIONS, repairWarrantyMonths, repairTechnicianNotesText } from '@/lib/repair-invoice.util'
import { normalizeRepairTicket, repairNextStatus, repairPartsLocked, repairPaymentSummary, repairProgressStep, repairStatusHistory, repairTicketEditable, REPAIR_PROGRESS_FLOW, formatRepairServiceItemName, REPAIR_SERVICE_ITEM_LABEL } from '@/lib/repair.util'
import { printRepairIntakeReceipt } from '@/lib/repair-print.util'
import { formatWarrantyPeriodLabel } from '@/components/pos/cart-rules'
import InvoiceA4View from '@/components/invoice/InvoiceA4View'
import RepairPartsProfitPanel from '@/components/repairs/RepairPartsProfitPanel'
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import type { RepairTicket } from '@/types'
import toast from 'react-hot-toast'

const SOURCE_OPTIONS = [
  { value: 'WALK_IN',        label: 'Walk-in' },
  { value: 'WARRANTY_CLAIM', label: 'Warranty Claim' },
  { value: 'WHATSAPP',       label: 'WhatsApp' },
  { value: 'FACEBOOK',       label: 'Facebook' },
  { value: 'INSTAGRAM',      label: 'Instagram' },
  { value: 'PHONE_CALL',     label: 'Phone Call' },
  { value: 'REFERRAL',       label: 'Referral' },
  { value: 'ONLINE',         label: 'Online' },
]

const statusLabels: Record<string, string> = {
  ALL: 'All', RECEIVED: 'Received', DIAGNOSED: 'Diagnosed',
  IN_REPAIR: 'In Repair', QC: 'Quality Check',
  READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

const STATUS_FLOW = REPAIR_PROGRESS_FLOW

const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    URGENT: 'bg-red-500/10 border-red-500/20 text-red-400',
    HIGH:   'bg-orange-500/10 border-orange-500/20 text-orange-400',
    NORMAL: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    LOW:    'bg-green-500/10 border-green-500/20 text-green-400',
  }
  return map[p] || 'bg-slate-500/10 border-slate-500/20 [color:var(--text-muted)]'
}

function printRepairReceipt(repair: RepairTicket, settings: InvoiceSettings): boolean {
  const paperWidth = settings.thermalWidthRepair || '80mm'
  const bodyWidth  = paperWidth === '58mm' ? '216px' : '302px'
  const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  const { serviceFee, subtotal } = calcRepairTotals(repair)
  const partsRows = (repair.spareParts ?? []).length > 0
    ? `<div class="line"></div><div class="bold med">PARTS USED</div>${(repair.spareParts ?? []).map((p: any) => `<div class="row"><span>${p.productName}</span><span>x${p.quantity}</span></div>`).join('')}`
    : ''
  const warrantyMonths = resolveRepairWarrantyMonths(repair, settings)
  const warrantyLine = warrantyMonths > 0
    ? `<div class="row"><span>Warranty:</span><span>${warrantyMonths} month${warrantyMonths === 1 ? '' : 's'} on repair service</span></div>`
    : ''
  const logoHeight = thermalLogoMaxHeight(settings.thermalLogoSize)
  const bodyWeight = thermalBodyFontWeight()
  const logoBlock = settings.thermalShowLogo !== false && settings.logo
    ? `<div class="center" style="margin-bottom:4px"><img src="${settings.logo}" alt="logo" style="max-height:${logoHeight}px;max-width:90%;object-fit:contain"/></div>`
    : ''
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Repair Receipt</title>
<style>
  @page { size: ${paperWidth} auto; margin: 4mm 3mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; font-weight: ${bodyWeight}; color:#000; width:${bodyWidth}; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .big { font-size:14px; font-weight:bold; }
  .med { font-size:12px; font-weight:bold; }
  .line { border-top:1px dashed #000; margin:4px 0; }
  .row { display:flex; justify-content:space-between; margin:1px 0; }
  table { width:100%; border-collapse:collapse; margin:3px 0; }
  td { padding:1px 2px; vertical-align:top; font-size:10px; }
  td:last-child { text-align:right; white-space:nowrap; }
  .total-row td { font-weight:bold; font-size:12px; border-top:1px solid #000; padding-top:3px; }
  .status { display:inline-block; border:1px solid #000; padding:1px 6px; font-size:10px; }
</style></head><body>
${logoBlock}
<div class="center"><div class="big">${settings.shopName || 'Service Center'}</div>
${settings.phone ? `<div>${settings.phone}</div>` : ''}
${settings.address ? `<div>${settings.address}</div>` : ''}</div>
<div class="line"></div>
<div class="center bold" style="font-size:13px;">REPAIR JOB RECEIPT</div>
<div class="line"></div>
<div class="row"><span class="bold">Ticket#:</span><span class="bold" style="font-size:12px;">${repair.ticketNumber}</span></div>
<div class="row"><span>Date:</span><span>${new Date(repair.createdAt).toLocaleDateString('en-LK')}</span></div>
<div class="row"><span>Status:</span><span class="status">${repair.status}</span></div>
<div class="line"></div>
<div class="bold med">CUSTOMER</div>
<div class="row"><span>Name:</span><span>${repair.customerName}</span></div>
<div class="row"><span>Phone:</span><span>${repair.customerPhone}</span></div>
<div class="line"></div>
<div class="bold med">DEVICE</div>
<div class="row"><span>Brand/Model:</span><span>${repair.deviceBrand} ${repair.deviceModel}</span></div>
${repair.imei ? `<div class="row"><span>IMEI:</span><span>${repair.imei}</span></div>` : ''}
${repair.accessories ? `<div class="row"><span>Accessories:</span><span>${repair.accessories}</span></div>` : ''}
${repair.deviceCondition ? `<div style="margin:3px 0;"><div class="bold">Phone condition:</div><div style="word-break:break-word;margin-top:2px;">${repair.deviceCondition}</div></div>` : ''}
<div class="line"></div>
<div class="bold med">FAULT</div>
<div style="word-break:break-word;margin:2px 0;">${repair.reportedIssue}</div>
${(repair.notes ?? []).some(n => n.text?.trim()) ? `<div class="line"></div><div class="bold med">NOTES</div>${(repair.notes ?? []).filter(n => n.text?.trim()).map(n => `<div style="word-break:break-word;margin:2px 0;">${n.text}</div>`).join('')}` : ''}
<div class="line"></div>
<div class="bold med">CHARGES</div>
<table><tbody>
  <tr><td>${REPAIR_SERVICE_ITEM_LABEL}</td><td style="text-align:right">1</td><td style="text-align:right">${fmt(serviceFee)}</td></tr>
  <tr class="total-row"><td colspan="2">TOTAL</td><td>${fmt(subtotal)}</td></tr>
</tbody></table>
${partsRows}
${repair.technicianName ? `<div class="line"></div><div class="row"><span>Technician:</span><span>${repair.technicianName}</span></div>` : ''}
${warrantyLine}
<div class="line"></div>
<div class="center" style="font-size:10px;margin-top:4px;">Thank you for choosing us!</div>
<div class="center" style="font-size:9px;margin-top:2px;">${settings.website || ''}</div>
</body></html>`
  const w = window.open('', '_blank', 'width=350,height=600')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
  return true
}

function calcRepairTotals(repair: Pick<RepairTicket, 'estimatedCost' | 'spareParts'>) {
  const partsTotal = (repair.spareParts ?? []).reduce(
    (sum, p) => sum + (Number((p as { total?: number }).total) || 0),
    0,
  )
  const estimatedCost = Number(repair.estimatedCost ?? 0) || 0
  const serviceFee = estimatedCost
  return { serviceFee, partsTotal, estimatedTotal: estimatedCost, subtotal: estimatedCost, estimatedCost }
}
export default function RepairDetailsView({ repair, onBack, onEdit, onStatusChange, onRefresh, onRepairUpdate, allRepairs, showPageHeader = true }: {
  repair: RepairTicket
  onBack: () => void
  onEdit: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onRefresh: () => void
  onRepairUpdate: (repair: RepairTicket) => void
  allRepairs?: RepairTicket[]
  showPageHeader?: boolean
}) {
  const { canEdit } = useModuleAccess()
  const quoteRef    = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const customerContactRef = useRef<HTMLDivElement>(null)
  const notesSectionRef = useRef<HTMLDivElement>(null)
  const [downloading,   setDownloading]   = useState(false)
  const [waSending,     setWaSending]     = useState<'quote' | 'invoice' | null>(null)
  const [waSendPdf,     setWaSendPdf]     = useState(false)
  const [invSettings, setInvSettings]   = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [tenantSlug, setTenantSlug]     = useState<string | undefined>()
  const [photos,        setPhotos]        = useState<string[]>(repair.photos ?? [])
  const [uploading,     setUploading]     = useState(false)
  const [lightboxUrl,   setLightboxUrl]   = useState<string | null>(null)
  const [showAddNote,   setShowAddNote]   = useState(false)
  const [noteText,      setNoteText]      = useState('')
  const [savingNote,    setSavingNote]    = useState(false)
  const canSeeProductCost = useCanSeeProductCost()

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    const load = () => {
      fetchInvoiceSettings(user.tenantId, getActiveBranchId()).then(setInvSettings).catch(() => {})
    }
    load()
    window.addEventListener('invoice-settings-updated', load)
    import('@/lib/api').then(({ tenantApi }) => {
      tenantApi.get(user.tenantId).then((res: any) => {
        setTenantSlug((res?.data ?? res)?.slug)
      }).catch(() => {})
    })
    whatsappApi.getConfig()
      .then((r: any) => setWaSendPdf(!!(r?.data ?? r)?.sendPdfInvoice))
      .catch(() => {})
    return () => window.removeEventListener('invoice-settings-updated', load)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of files) {
        const { url } = await uploadApi.repairPhoto(file)
        urls.push(url)
      }
      const updated = [...photos, ...urls]
      await repairsApi.updatePhotos(repair.id, updated)
      setPhotos(updated)
      toast.success(`${urls.length} file${urls.length > 1 ? 's' : ''} uploaded`)
    } catch (err: any) { toast.error(err?.message ?? 'Upload failed') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleDeletePhoto = async (url: string) => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    const updated = photos.filter(p => p !== url)
    try {
      await repairsApi.updatePhotos(repair.id, updated)
      setPhotos(updated)
    } catch { toast.error('Delete failed') }
  }

  const sendQuoteWhatsApp = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    const phone = formatWhatsAppPhone(repair.customerPhone ?? '')
    if (!phone) { toast.error('Customer phone required to send quote via WhatsApp'); return }

    const { serviceFee, estimatedCost } = calcRepairTotals(repair)
    const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK')}`
    const partsLines = (repair.spareParts ?? []).length > 0
      ? `\n\n*Parts used (inventory):*\n` + repair.spareParts!.map((p: any) => `  - ${p.productName} x${p.quantity}`).join('\n')
      : ''
    const msg = [
      `*Repair Quote — ${invSettings.shopName || 'Service Center'}*`,
      ``,
      `*Ticket:* ${repair.ticketNumber}`,
      `*Customer:* ${repair.customerName}`,
      `*Device:* ${repair.deviceBrand} ${repair.deviceModel}`,
      repair.imei ? `*IMEI:* ${repair.imei}` : null,
      ``,
      `*Issue:* ${repair.reportedIssue}`,
      resolveRepairWarrantyMonths(repair, invSettings) > 0
        ? `*Warranty:* ${formatWarrantyPeriodLabel(resolveRepairWarrantyMonths(repair, invSettings))} on repair service`
        : null,
      ``,
      `*Service Charge:* ${fmt(serviceFee)}` + partsLines,
      ``,
      `*Estimated Cost:* *${fmt(estimatedCost)}*`,
      repair.technicianName ? `*Technician:* ${repair.technicianName}` : null,
      ``,
      `_For any queries, please contact us._`,
      invSettings.phone ? `Tel: ${invSettings.phone}` : null,
    ].filter(Boolean).join('\n')

    setWaSending('quote')
    try {
      await whatsappApi.sendMessage({
        phone,
        message:      msg,
        customerName: repair.customerName,
        referenceId:  repair.ticketNumber,
        type:         'quote',
        amount:       estimatedCost,
      })
      toast.success('Quote sent via WhatsApp')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send quote — connect WhatsApp in Settings first')
    } finally {
      setWaSending(null)
    }
  }

  const sendInvoiceWhatsApp = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    const phone = formatWhatsAppPhone(repair.customerPhone ?? '')
    if (!phone) { toast.error('Customer phone required to send invoice via WhatsApp'); return }

    const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK')}`
    const { serviceFee, subtotal } = calcRepairTotals(repair)
    const discount   = repair.actualCost != null && repair.actualCost < subtotal ? subtotal - Number(repair.actualCost) : 0
    const grandTotal = discount > 0 ? Number(repair.actualCost) : subtotal

    const itemLines = [
      serviceFee > 0
        ? `  - ${REPAIR_SERVICE_ITEM_LABEL} (${repair.deviceBrand} ${repair.deviceModel}): ${fmt(serviceFee)}`
        : null,
      repair.reportedIssue?.trim()
        ? `    Fault / Service: ${repair.reportedIssue.trim()}`
        : null,
      resolveRepairWarrantyMonths(repair, invSettings) > 0
        ? `    Warranty: ${formatWarrantyPeriodLabel(resolveRepairWarrantyMonths(repair, invSettings))} on repair service`
        : null,
      ...(repair.spareParts ?? []).map((p: any) => `  - ${p.productName} x${p.quantity} (inventory)`),
    ].filter(Boolean).join('\n')

    const bankSection = invSettings.bankName
      ? `\n\n*Payment Details:*\n  Bank: ${invSettings.bankName}\n  Acc: ${invSettings.accNumber || '—'}\n  Name: ${invSettings.accHolder || '—'}`
      : ''

    const msg = [
      `*INVOICE — ${invSettings.shopName || 'Service Center'}*`,
      invSettings.phone ? `Tel: ${invSettings.phone}` : null,
      ``,
      `*Invoice No:* ${repair.ticketNumber}`,
      `*Customer:* ${repair.customerName}`,
      repair.customerPhone ? `*Phone:* ${repair.customerPhone}` : null,
      ``,
      `*Items:*`,
      itemLines,
      ``,
      ...(repairTechnicianNotesText(repair)
        ? [`*Notes:*`, repairTechnicianNotesText(repair)!.split('\n').map(l => `  ${l}`).join('\n'), ``]
        : []),
      discount > 0 ? `*Subtotal:* ${fmt(subtotal)}` : null,
      discount > 0 ? `*Discount:* -${fmt(discount)}` : null,
      `*Total: ${fmt(grandTotal)}*`,
      bankSection,
      ``,
      ...(invSettings.terms?.length ? invSettings.terms.map((t: string) => `_${t}_`) : [`_Thank you for choosing our repair services!_`]),
    ].filter(v => v !== null && v !== undefined).join('\n')

    setWaSending('invoice')
    try {
      let pdfBase64: string | undefined
      let pdfFilename: string | undefined
      if (waSendPdf && quoteRef.current) {
        await new Promise(r => setTimeout(r, 150))
        try {
          const pdf = await captureElementAsPdfBase64(
            quoteRef.current,
            `Repair-${repair.ticketNumber}.pdf`,
          )
          pdfBase64 = pdf.base64
          pdfFilename = pdf.filename
        } catch {
          toast.error('PDF generation failed — sending text only')
        }
      }

      await whatsappApi.sendInvoice({
        orderId:      repair.ticketNumber,
        phone,
        customerName: repair.customerName,
        amount:       grandTotal,
        message:      msg,
        pdfBase64,
        pdfFilename,
      })
      toast.success(pdfBase64 ? 'Invoice PDF sent via WhatsApp' : 'Invoice sent via WhatsApp')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send invoice — connect WhatsApp in Settings first')
    } finally {
      setWaSending(null)
    }
  }

  const downloadQuote = async () => {
    if (!quoteRef.current) {
      toast.error('Quote preview not ready — try again')
      return
    }
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')
      const A4_W_PX = 794, A4_W_MM = 210, A4_H_MM = 297
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${A4_W_PX}px;overflow:visible;`
      const clone = quoteRef.current!.cloneNode(true) as HTMLElement
      clone.style.width        = `${A4_W_PX}px`
      clone.style.maxWidth     = `${A4_W_PX}px`
      clone.style.minWidth     = `${A4_W_PX}px`
      clone.style.borderRadius = '0'
      clone.style.boxShadow    = 'none'
      clone.style.margin       = '0'
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)
      await new Promise(r => setTimeout(r, 100))
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: A4_W_PX, windowWidth: A4_W_PX })
      document.body.removeChild(wrapper)
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const imgH_MM = (canvas.height / canvas.width) * A4_W_MM
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      if (imgH_MM <= A4_H_MM * 1.15) {
        /* content is ≤ 1 page (or only slightly over) — scale to fill exactly one A4 page */
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, Math.min(imgH_MM, A4_H_MM))
      } else {
        const scale = canvas.width / A4_W_MM
        let yMM = 0
        while (yMM < imgH_MM) {
          const sliceHMM = Math.min(A4_H_MM, imgH_MM - yMM)
          const tmp = document.createElement('canvas')
          tmp.width = canvas.width; tmp.height = Math.ceil(sliceHMM * scale)
          tmp.getContext('2d')!.drawImage(canvas, 0, yMM * scale, canvas.width, sliceHMM * scale, 0, 0, canvas.width, sliceHMM * scale)
          if (yMM > 0) pdf.addPage()
          pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, sliceHMM)
          yMM += sliceHMM
        }
      }
      pdf.save(`Repair_${repair.ticketNumber}.pdf`)
      toast.success('Quote downloaded!')
    } catch { toast.error('Download failed') }
    finally { setDownloading(false) }
  }

  const focusCustomerInfo = () => {
    customerContactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    toast.success(`${repair.customerName || 'Customer'}${repair.customerPhone ? ` · ${repair.customerPhone}` : ''}`)
  }

  const openAddNote = () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    setShowAddNote(true)
    setTimeout(() => notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const handleSaveNote = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    const text = noteText.trim()
    if (!text) { toast.error('Enter a note'); return }
    setSavingNote(true)
    try {
      const res: any = await repairsApi.addNote(repair.id, { text, isPublic: true })
      onRepairUpdate(normalizeRepairTicket(res?.data ?? res))
      setNoteText('')
      setShowAddNote(false)
      toast.success('Note added — will show on invoice')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to add note')
    } finally {
      setSavingNote(false)
    }
  }

  const handlePrintIntake = () => {
    const ok = printRepairIntakeReceipt(repair, invSettings)
    if (!ok) toast.error('Popup blocked — allow popups to print')
    else toast.success('Opening intake receipt…')
  }

  const handlePrintTicket = () => {
    const ok = printRepairReceipt(repair, invSettings)
    if (!ok) toast.error('Popup blocked — allow popups to print')
    else toast.success('Opening job receipt…')
  }

  const [changingStatus, setChangingStatus] = useState(false)
  const [savingWarranty, setSavingWarranty] = useState(false)
  const [estimatedCostDraft, setEstimatedCostDraft] = useState(() => String(repair.estimatedCost ?? ''))
  const [savingEstimatedCost, setSavingEstimatedCost] = useState(false)
  const shopDefaultWarranty = repairWarrantyMonths(invSettings)
  const canEditEstimatedCost = canEdit && repairTicketEditable(repair.status)

  useEffect(() => {
    setEstimatedCostDraft(String(repair.estimatedCost ?? ''))
  }, [repair.estimatedCost])

  const handleWarrantyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    const raw = e.target.value
    const months = raw === '' ? null : Number(raw)
    setSavingWarranty(true)
    try {
      const res: any = await repairsApi.update(repair.id, { warrantyMonths: months })
      onRepairUpdate(normalizeRepairTicket(res?.data ?? res))
      toast.success('Warranty period updated')
    } catch (err: any) { toast.error(err?.message ?? 'Failed to update warranty') }
    finally { setSavingWarranty(false) }
  }

  const handleEstimatedCostSave = async () => {
    if (!canEditEstimatedCost) { if (!canEdit) viewOnlyToast('repairs'); return }
    const trimmed = estimatedCostDraft.trim()
    const value = trimmed === '' ? 0 : Number(trimmed)
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid estimated cost')
      setEstimatedCostDraft(String(repair.estimatedCost ?? ''))
      return
    }
    if (value === Number(repair.estimatedCost ?? 0)) return
    setSavingEstimatedCost(true)
    try {
      const res: any = await repairsApi.update(repair.id, { estimatedCost: value })
      onRepairUpdate(normalizeRepairTicket(res?.data ?? res))
      toast.success('Estimated cost updated')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update estimated cost')
      setEstimatedCostDraft(String(repair.estimatedCost ?? ''))
    } finally {
      setSavingEstimatedCost(false)
    }
  }

  const estimatedCostEditor = canEditEstimatedCost ? (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>LKR</span>
      <input
        type="number"
        min={0}
        step="0.01"
        className="text-sm font-black w-full min-w-0 bg-transparent outline-none border-b border-violet-500/30 focus:border-violet-500 text-right"
        style={{ color: 'var(--text-primary)' }}
        value={estimatedCostDraft}
        disabled={savingEstimatedCost}
        onChange={(e) => setEstimatedCostDraft(e.target.value)}
        onBlur={handleEstimatedCostSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
        placeholder="0"
        aria-label="Estimated cost"
      />
      {savingEstimatedCost && <Loader2 size={12} className="animate-spin shrink-0" style={{ color: 'var(--text-muted)' }} />}
    </div>
  ) : (
    <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(repair.estimatedCost ?? 0))}</span>
  )

  /* collect payment state */
  const [showPayment, setShowPayment] = useState(false)
  const [discount,    setDiscount]    = useState('')
  const [payMethodId, setPayMethodId] = useState('CASH')
  const payMethodOptions = usePaymentMethods()
  const payMethod: PaymentMethodKey = payMethodOptions.find(m => m.id === payMethodId)?.key
    ?? payMethodOptions.find(m => m.key === payMethodId)?.key
    ?? 'CASH'
  useEffect(() => {
    setPayMethodId(prev => payMethodOptions.some(m => m.id === prev || m.key === prev)
      ? (payMethodOptions.find(m => m.id === prev)?.id ?? payMethodOptions.find(m => m.key === prev)?.id ?? 'CASH')
      : 'CASH')
  }, [payMethodOptions])
  const [amountPaying, setAmountPaying] = useState('')
  const [collecting,  setCollecting]  = useState(false)
  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  /* spare parts state */
  const [showAddPart, setShowAddPart]       = useState(false)
  const [partSearch,  setPartSearch]        = useState('')
  const [partQty,     setPartQty]           = useState(1)
  const [partCost,    setPartCost]          = useState('')
  const [selProduct,  setSelProduct]        = useState<any>(null)
  const [addingPart,  setAddingPart]        = useState(false)
  const [removingId,  setRemovingId]        = useState<string | null>(null)
  const { data: productsData } = useProducts()
  const allProducts: any[] = (productsData?.data ?? []) as any[]
  const getProductBuyPrice = useCallback((productId: string) => {
    const p = allProducts.find((x: any) => x.id === productId)
    return p?.buyingPrice != null ? Number(p.buyingPrice) : undefined
  }, [allProducts])
  const filteredProducts = partSearch.length > 1
    ? allProducts.filter(p => String(p.name ?? '').toLowerCase().includes(partSearch.toLowerCase()) || String(p.sku ?? '').toLowerCase().includes(partSearch.toLowerCase())).slice(0, 8)
    : []

  const handleAddPart = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    if (!selProduct) return
    setAddingPart(true)
    try {
      const res: any = await repairsApi.addPart(repair.id, {
        productId: selProduct.id,
        quantity:  partQty,
        unitCost:  partCost ? Number(partCost) : undefined,
      })
      const updated = res?.data ? normalizeRepairTicket(res.data) : undefined
      if (updated) onRepairUpdate(updated)
      else onRefresh()
      toast.success(`${selProduct.name} added`)
      setShowAddPart(false); setPartSearch(''); setSelProduct(null); setPartQty(1); setPartCost('')
    } catch (err: any) { toast.error(err?.message ?? 'Failed to add part') }
    finally { setAddingPart(false) }
  }

  const handleRemovePart = async (partId: string) => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    setRemovingId(partId)
    try {
      const res: any = await repairsApi.removePart(repair.id, partId)
      const updated = res?.data ? normalizeRepairTicket(res.data) : undefined
      if (updated) onRepairUpdate(updated)
      else onRefresh()
      toast.success('Part removed')
    } catch (err: any) { toast.error(err?.message ?? 'Failed to remove part') }
    finally { setRemovingId(null) }
  }
  const currentIdx = repairProgressStep(repair.status)
  const nextStatus = repairNextStatus(repair.status)
  const statusHistory = repairStatusHistory(repair)
  const partsLocked = repairPartsLocked(repair.status)

  const handleNext = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    if (!nextStatus) return
    setChangingStatus(true)
    await onStatusChange(repair.id, nextStatus)
    setChangingStatus(false)
  }

  const handleCancel = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    setChangingStatus(true)
    await onStatusChange(repair.id, 'CANCELLED')
    setChangingStatus(false)
  }

  const { serviceFee, partsTotal, estimatedCost, subtotal } = calcRepairTotals(repair)
  const payment = repairPaymentSummary(repair)
  const { quote, billTotal, paid, due, discount: paidDiscount, isPaid, isPartial, isFull } = payment
  const activeTemplate = resolveInvoiceTemplate(invSettings, tenantSlug)
  const repairSale = buildRepairInvoiceSale(repair, invSettings, { isPaid })
  const discountAmt  = Number(discount) || 0
  const finalAmount  = Math.max(0, subtotal - discountAmt)
  const payNow = (() => {
    if (!hasCustomerCredit) return finalAmount
    const v = parseFloat(amountPaying)
    if (isNaN(v) || amountPaying.trim() === '') return finalAmount
    return Math.min(Math.max(0, v), finalAmount)
  })()
  const creditAmount = hasCustomerCredit ? Math.max(0, finalAmount - payNow) : 0

  const handleCollectPayment = async () => {
    if (!canEdit) { viewOnlyToast('repairs'); return }
    if (creditAmount > 0 && !repair.customerId) {
      toast.error('Customer is required for credit payment')
      return
    }
    setCollecting(true)
    try {
      await repairsApi.collectPayment(repair.id, {
        discount: discountAmt,
        paymentMethod: payMethod,
        paidAmount: payNow,
      })
      const hasWarranty = (repair.warrantyMonths ?? 0) > 0
        || (repair.spareParts ?? []).some(p => (p.warrantyMonths ?? 0) > 0)
      let msg = creditAmount > 0
        ? `Payment recorded — ${formatCurrency(creditAmount)} on customer credit`
        : 'Payment collected successfully'
      if (hasWarranty && repair.customerId) {
        msg += ' — warranty registered in Warranty Management'
      }
      toast.success(msg)
      setShowPayment(false)
      onRefresh()
    } catch (err: any) { toast.error(err?.message ?? 'Failed to collect payment') }
    finally { setCollecting(false) }
  }

  const STEP_ICONS = [Smartphone, Wrench, CheckCircle2]

  const repairHeaderActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={!repairTicketEditable(repair.status)}
          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40"
        >
          <Pencil size={14} /> Edit
        </button>
      )}
      <button
        type="button"
        onClick={downloadQuote}
        disabled={downloading}
        className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
      >
        {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
      </button>
      {canEdit && (
        <>
          <button
            type="button"
            onClick={sendQuoteWhatsApp}
            disabled={waSending !== null}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {waSending === 'quote' ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />} Quote
          </button>
          <button
            type="button"
            onClick={sendInvoiceWhatsApp}
            disabled={waSending !== null}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {waSending === 'invoice' ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            {waSending === 'invoice' ? 'Sending…' : waSendPdf ? 'Invoice PDF' : 'Invoice'}
          </button>
        </>
      )}
    </div>
  )

  const mainCard = (
    <div className="card overflow-hidden flex flex-col min-h-0">

        {/* 2-COLUMN BODY */}
        <div className="grid grid-cols-1 xl:grid-cols-12">

          {/* LEFT MAIN */}
          <div className="xl:col-span-8 p-6 space-y-6 border-b xl:border-b-0 xl:border-r" style={{ borderColor: 'var(--border-subtle)' }}>

            {/* Title + Badges */}
            <div>
              <p className="text-[12px] font-bold text-violet-500 font-mono mb-1">{repair.ticketNumber}</p>
              <h2 className="text-[22px] font-black mb-3 leading-tight" style={{ color: 'var(--text-primary)' }}>{repair.deviceBrand} {repair.deviceModel}</h2>
              <div className="flex flex-wrap gap-2">
                <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold ${getRepairStatusColor(repair.status)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" /> {statusLabels[repair.status]}
                </span>
                {repair.priority && repair.priority !== 'NORMAL' && (
                  <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold ${priorityBadge(repair.priority)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" /> {repair.priority}
                  </span>
                )}
                {isPaid && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 font-semibold">
                    <Check size={11} /> Paid
                  </span>
                )}
              </div>
            </div>

            {/* Info bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-0 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              {[
                { label: 'Date Received',  value: new Date(repair.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Est. Completion',value: repair.estimatedCompletion ? new Date(repair.estimatedCompletion).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
              ].map((item, i) => (
                <div key={item.label} className="p-3" style={{ borderLeft: i > 0 ? '1px solid var(--border-subtle)' : undefined, background: 'var(--bg-subtle)' }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                </div>
              ))}
              <div className="p-3" style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Est. Cost</p>
                {canEditEstimatedCost ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="text-xs font-bold w-full bg-transparent outline-none border-b border-violet-500/30 focus:border-violet-500"
                    style={{ color: 'var(--text-primary)' }}
                    value={estimatedCostDraft}
                    disabled={savingEstimatedCost}
                    onChange={(e) => setEstimatedCostDraft(e.target.value)}
                    onBlur={handleEstimatedCostSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        ;(e.currentTarget as HTMLInputElement).blur()
                      }
                    }}
                    placeholder="0"
                    aria-label="Estimated cost"
                  />
                ) : (
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(quote)}</p>
                )}
              </div>
              <div className="p-3" style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Warranty</p>
                <select
                  className="text-xs font-bold w-full bg-transparent outline-none cursor-pointer disabled:opacity-50"
                  style={{ color: repair.warrantyMonths == null ? 'var(--text-muted)' : 'var(--text-primary)' }}
                  value={repair.warrantyMonths != null ? String(repair.warrantyMonths) : ''}
                  disabled={!canEdit || savingWarranty || isPaid}
                  onChange={handleWarrantyChange}
                >
                  <option value="">Not set{shopDefaultWarranty > 0 ? ` (shop default: ${formatWarrantyPeriodLabel(shopDefaultWarranty)})` : ''}</option>
                  {REPAIR_WARRANTY_OPTIONS.map(m => (
                    <option key={m} value={m}>{m === 0 ? 'No warranty' : formatWarrantyPeriodLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div className="p-3" style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Payment Status</p>
                <p className={`text-xs font-bold ${isPaid ? 'text-green-600 dark:text-green-400' : ''}`} style={!isPaid ? { color: 'var(--text-primary)' } : {}}>
                  {!isPaid ? 'Pending' : isPartial ? 'Partial / Credit' : 'Paid in Full'}
                </p>
              </div>
            </div>

            {/* Ticket Details */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal size={13} className="text-violet-500" />
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Ticket Details</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Ticket #',   value: repair.ticketNumber,   icon: Hash },
                  { label: 'Technician', value: repair.technicianName || '—', icon: User },
                  { label: 'Customer',   value: repair.customerName,   icon: User },
                  { label: 'Source',     value: SOURCE_OPTIONS.find(o => o.value === repair.source)?.label ?? repair.source ?? 'Walk-in', icon: MapPin },
                  ...(repair.imei ? [{ label: 'IMEI', value: repair.imei, icon: Smartphone }] : []),
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Icon size={9} /> {label}
                    </p>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
                {repair.accessories && (
                  <div className="col-span-2 rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Package size={9} /> Accessories Received
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {repair.accessories.split(', ').map((a: string) => (
                        <span key={a} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {repair.deviceCondition?.trim() && (
                  <div className="col-span-2 rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <p className="text-[10px] mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <ClipboardList size={9} /> Mobile Phone Condition
                    </p>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                      {repair.deviceCondition}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Repair Progress */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={13} className="text-violet-500" />
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Repair Progress</p>
              </div>
              <div className="relative flex items-start justify-between px-2">
                <div className="absolute left-7 right-7 top-5 h-[2px] rounded-full" style={{ background: 'var(--border-default)' }} />
                <div className="absolute left-7 top-5 h-[2px] rounded-full bg-violet-500 transition-all duration-500"
                  style={{ width: currentIdx <= 0 ? '0%' : `${Math.min(100, (Math.min(currentIdx, STATUS_FLOW.length - 1) / (STATUS_FLOW.length - 1)) * 90)}%` }} />
                {STATUS_FLOW.map((s, i) => {
                  const StepIcon = STEP_ICONS[i]
                  const done     = currentIdx > i || (repair.status === 'DELIVERED' && i < STATUS_FLOW.length)
                  const active   = currentIdx === i && repair.status !== 'DELIVERED'
                  const stepTime = statusHistory.find((h: any) => h.status === s)?.timestamp
                  return (
                    <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        active ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/30'
                        : done  ? 'bg-violet-500 border-indigo-500'
                        : 'border-gray-300 dark:border-slate-600'}`}
                        style={!active && !done ? { background: 'var(--bg-card)' } : {}}>
                        {done   ? <CheckCircle size={16} className="text-white" />
                                 : <StepIcon size={15} className={active ? 'text-white' : 'text-gray-400 dark:[color:var(--text-muted)]'} />}
                      </div>
                      <span className={`text-[11px] font-bold ${active ? 'text-violet-600 dark:text-violet-400' : done ? 'text-indigo-400' : ''}`}
                        style={!active && !done ? { color: 'var(--text-muted)' } : {}}>{statusLabels[s]}</span>
                      {stepTime
                        ? <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(stepTime).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        : <span className="text-[10px] text-gray-300 dark:[color:var(--text-muted)]">Pending</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Action buttons */}
            {canEdit && repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {repair.status === 'READY' ? (
                    <button onClick={() => setShowPayment(v => !v)} disabled={collecting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                      style={{ background: showPayment ? 'var(--bg-subtle)' : 'linear-gradient(135deg,#16a34a,#15803d)', border: showPayment ? '1px solid var(--border-default)' : 'none', color: showPayment ? 'var(--text-secondary)' : '#ffffff' }}>
                      <DollarSign size={14} />{showPayment ? 'Hide Payment' : 'Collect Payment'}
                    </button>
                  ) : nextStatus ? (
                    <button onClick={handleNext} disabled={changingStatus}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ background: 'var(--brand-gradient)', color: '#ffffff' }}>
                      {changingStatus ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      Move to {statusLabels[nextStatus]}
                    </button>
                  ) : null}
                  <button onClick={handleCancel} disabled={changingStatus}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50 border border-red-500/25">
                    Cancel
                  </button>
                </div>
                {showPayment && repair.status === 'READY' && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                      <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Collect Payment</p>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm pt-2 font-bold" style={{ color: 'var(--text-primary)' }}>
                          <span>Estimated Cost</span>
                          <span>{formatCurrency(estimatedCost)}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>Discount Amount</label>
                        <input type="number" min={0} max={subtotal} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="input-field" />
                      </div>
                      {discountAmt > 0 && (
                        <div className="flex justify-between items-center px-3 py-2.5 rounded-xl border border-green-500/20" style={{ background: 'rgba(34,197,94,0.05)' }}>
                          <span className="text-sm font-bold text-green-600">Amount Due</span>
                          <span className="text-lg font-black text-green-600">{formatCurrency(finalAmount)}</span>
                        </div>
                      )}
                      {hasCustomerCredit && repair.customerId && finalAmount > 0 && (
                        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: creditAmount > 0 ? 'rgba(245,158,11,0.35)' : 'var(--border-subtle)', background: creditAmount > 0 ? 'rgba(245,158,11,0.06)' : 'var(--bg-subtle)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Paying now</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Bill {formatCurrency(finalAmount)}</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={finalAmount}
                            step="0.01"
                            value={amountPaying}
                            onChange={e => setAmountPaying(e.target.value)}
                            placeholder="Amount customer pays now"
                            className="input-field"
                          />
                          {creditAmount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span style={{ color: 'var(--text-secondary)' }}>Added to customer credit</span>
                              <span className="font-bold text-amber-600">{formatCurrency(creditAmount)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Payment Method</p>
                        <div className="grid grid-cols-2 gap-2">
                          {payMethodOptions.map(({ id, label }) => (
                            <button key={id} type="button" onClick={() => setPayMethodId(id)}
                              className="py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                              style={payMethodId === id ? { background: 'var(--brand-primary)', border: '2px solid var(--brand-primary)', color: '#fff' } : { background: 'var(--bg-subtle)', border: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                              {label}{payMethodId === id && <CheckCircle size={11} className="ml-auto" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleCollectPayment} disabled={collecting}
                        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#ffffff' }}>
                        {collecting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {collecting ? 'Processing…' : creditAmount > 0
                          ? `Confirm — Pay ${formatCurrency(payNow)} + Credit ${formatCurrency(creditAmount)}`
                          : `Confirm & Collect ${formatCurrency(payNow)}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reported Issue */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-violet-500" />
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Reported Issue</p>
              </div>
              <p className="text-sm font-semibold leading-relaxed uppercase" style={{ color: 'var(--text-primary)' }}>{repair.reportedIssue}</p>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wrench size={13} className="text-violet-500" />
                  <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Items ({(repair.spareParts?.length ?? 0) + (serviceFee > 0 ? 1 : 0)})
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => setShowAddPart(v => !v)} disabled={partsLocked}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: showAddPart ? 'rgba(239,68,68,0.08)' : 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: showAddPart ? '#ef4444' : 'var(--text-secondary)' }}>
                    {showAddPart ? <><X size={10} />Cancel</> : <><Plus size={10} />Add Part</>}
                  </button>
                )}
              </div>
              <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                {partsLocked
                  ? 'Repair completed — parts are locked.'
                  : 'Sell/buy tracked for profit report. Customer pays the quote only. Stock deducts on payment.'}
              </p>

              {showAddPart && !partsLocked && (
                <div className="rounded-xl p-4 mb-3 space-y-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <div className="relative">
                    <input className="input-field text-sm" placeholder="Search inventory by name or SKU…"
                      value={selProduct ? selProduct.name : partSearch}
                      onChange={e => { setPartSearch(e.target.value); setSelProduct(null) }} />
                    {filteredProducts.length > 0 && !selProduct && (
                      <div className="absolute z-10 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                        {filteredProducts.map((p: any) => (
                          <button key={p.id} type="button"
                            onClick={() => { setSelProduct(p); setPartSearch(''); setPartCost(String(p.sellingPrice ?? p.buyingPrice ?? '')) }}
                            className="w-full text-left px-4 py-2.5 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {p.sku ? `${p.sku} · ` : ''}Stock: {p.stock} · Sell: {formatCurrency(p.sellingPrice ?? 0)}
                              {canSeeProductCost ? ` · Buy: ${formatCurrency(p.buyingPrice ?? 0)}` : ''}
                              {Number(p.warrantyMonths) > 0 ? ` · Warranty: ${formatWarrantyPeriodLabel(Number(p.warrantyMonths))}` : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selProduct && (
                    <div className="rounded-lg px-3 py-2 space-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center gap-2">
                        <Package size={11} className="text-violet-500 shrink-0" />
                        <span className="text-xs flex-1 truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{selProduct.name}</span>
                        <button onClick={() => setSelProduct(null)} style={{ color: 'var(--text-muted)' }}><X size={11} /></button>
                      </div>
                      {(Number(selProduct.warrantyMonths) > 0 || selProduct.warrantyNote) && (
                        <p className="text-[10px] pl-5" style={{ color: 'var(--text-muted)' }}>
                          {Number(selProduct.warrantyMonths) > 0 && <>Warranty: {formatWarrantyPeriodLabel(Number(selProduct.warrantyMonths))}</>}
                          {selProduct.warrantyNote ? `${Number(selProduct.warrantyMonths) > 0 ? ' · ' : ''}Note: ${selProduct.warrantyNote}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Quantity</label><input type="number" min={1} className="input-field" value={partQty} onChange={e => setPartQty(Number(e.target.value))} /></div>
                    <div><label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Part Price (LKR)</label><input type="number" min={0} className="input-field" placeholder={selProduct ? String(selProduct.sellingPrice ?? selProduct.buyingPrice ?? '') : '0'} value={partCost} onChange={e => setPartCost(e.target.value)} /></div>
                  </div>
                  <button onClick={handleAddPart} disabled={!selProduct || addingPart || (selProduct && Number(selProduct.stock) < partQty)}
                    className="w-full py-2 text-sm rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: 'var(--brand-primary)' }}>
                    {addingPart ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add to Repair
                  </button>
                </div>
              )}

              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                  <div className="col-span-6">Item / Part</div>
                  <div className="col-span-2 text-center">QTY</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {serviceFee > 0 && (
                  <div className="grid grid-cols-12 px-4 py-3.5 items-center border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="col-span-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                          <Wrench size={13} className="text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatRepairServiceItemName(repair.deviceBrand, repair.deviceModel)}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Labor & Service</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-semibold border border-green-500/20">Service</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>1</div>
                    <div className="col-span-2 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(serviceFee)}</div>
                    <div className="col-span-2 text-right text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(serviceFee)}</div>
                  </div>
                )}
                {repair.spareParts?.length > 0 ? repair.spareParts.map((part: any) => (
                  <div key={part.id} className="grid grid-cols-12 px-4 py-3.5 items-center border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="col-span-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                          <Package size={13} className="text-violet-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{part.productName}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold border border-violet-500/20">Stock tracking</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{part.quantity}</div>
                    <div className="col-span-2 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>—</div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>—</span>
                      {canEdit && !partsLocked && (
                      <button onClick={() => handleRemovePart(part.id)} disabled={removingId === part.id}
                        className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                        style={{ color: 'var(--text-muted)' }}>
                        {removingId === part.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                      </button>
                      )}
                    </div>
                  </div>
                )) : canEdit && !showAddPart && serviceFee <= 0 && (
                  <div className="py-8 text-center">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No items yet</p>
                    <button onClick={() => setShowAddPart(true)} className="text-xs font-bold text-violet-500 hover:text-violet-400 mt-1">+ Add spare part</button>
                  </div>
                )}
                <div className="px-4 py-3" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="flex justify-between font-black text-base">
                    <span style={{ color: 'var(--text-primary)' }}>Customer Total</span>
                    <span className="text-violet-600 dark:text-violet-400">{formatCurrency(isPaid ? billTotal : quote)}</span>
                  </div>
                  {(repair.spareParts?.length ?? 0) > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Parts buy/sell in profit report below — not added to bill.</p>
                  )}
                </div>
              </div>
            </div>

            {canSeeProductCost && (
              <RepairPartsProfitPanel
                repair={repair}
                getBuyPrice={getProductBuyPrice}
                pendingDiscount={!isPaid ? discountAmt : 0}
              />
            )}

            {/* Technician Notes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList size={13} className="text-violet-500" />
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Technician Notes</p>
              </div>
              {repair.notes?.length > 0 ? (
                <div className="space-y-2">
                  {repair.notes.map((note: any) => (
                    <div key={note.id} className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{note.text}</p>
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(note.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })} · {note.authorName}
                      </p>
                    </div>
                  ))}
                </div>
              ) : statusHistory.filter((h: any) => h.note).length > 0 ? (
                <div className="space-y-2">
                  {statusHistory.filter((h: any) => h.note).map((h: any, i: number) => (
                    <div key={i} className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{h.note}</p>
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(h.timestamp).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })} · {h.changedBy}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl p-3.5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                  <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No technician notes yet.</p>
                </div>
              )}
            </div>

            {/* IMEI Device History */}
            {repair.imei && (() => {
              const history = (allRepairs ?? []).filter(r => r.imei === repair.imei && r.id !== repair.id)
              if (history.length === 0) return null
              return (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <History size={13} className="text-violet-500" />
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Device History — IMEI {repair.imei}</p>
                    <span className="ml-auto text-[10px] font-bold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded">{history.length} past repair{history.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {history.slice(0, 5).map(h => (
                      <div key={h.id} className="flex items-center gap-3 text-xs">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${getRepairStatusColor(h.status)}`}>{statusLabels[h.status] ?? h.status}</span>
                        <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{h.reportedIssue}</span>
                        <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{formatDate(h.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="xl:col-span-4 p-5 space-y-4">

            {/* Payment Summary */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="flex items-center gap-2">
                  <DollarSign size={13} className="text-violet-500" />
                  <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Payment Summary</p>
                </div>
                <button className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><MoreVertical size={13} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm font-bold shrink-0" style={{ color: 'var(--text-secondary)' }}>Estimated Cost</span>
                  <div className="min-w-[7rem] max-w-[10rem]">{estimatedCostEditor}</div>
                </div>
                {canEditEstimatedCost && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Set or update the repair service charge here when the quote is ready.</p>
                )}
                {isPaid && paidDiscount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Discount</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">−{formatCurrency(paidDiscount)}</span>
                  </div>
                )}
                {isPaid && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bill Total</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(billTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Paid Amount</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(isPaid ? paid : 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Balance Due</span>
                  <span className={`text-sm font-black ${due > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(due)}</span>
                </div>
                {isPaid && isFull && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-green-500/25 bg-green-500/10">
                    <CheckCircle size={16} className="text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-green-700 dark:text-green-400">Paid in Full</p>
                      <p className="text-[10px] text-green-600/70">Thank you! Payment completed.</p>
                    </div>
                  </div>
                )}
                {isPaid && isPartial && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Partial Payment</p>
                      <p className="text-[10px] text-amber-600/80">{formatCurrency(due)} remaining on customer credit</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <p className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Zap size={12} className="text-violet-500" /> Quick Actions
                </p>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {[
                  { icon: FileText,      label: 'Download PDF',    action: downloadQuote, disabled: downloading },
                  ...(canEdit ? [
                    { icon: MessageSquare, label: 'Quote WhatsApp', action: sendQuoteWhatsApp, disabled: waSending !== null },
                    { icon: Phone, label: 'Invoice WhatsApp', action: sendInvoiceWhatsApp, disabled: waSending !== null },
                  ] : []),
                  { icon: Package,       label: 'Print Intake',    action: handlePrintIntake },
                  { icon: Printer,       label: 'Print Ticket',    action: handlePrintTicket },
                  { icon: User,          label: 'Customer Info',   action: focusCustomerInfo },
                  ...(canEdit ? [{ icon: ClipboardList, label: 'Add Note', action: openAddNote }] : []),
                ].map(({ icon: Icon, label, action, disabled }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      action()
                    }}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-colors hover:border-indigo-500/40 disabled:opacity-50"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
                      <Icon size={14} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <span className="text-[9px] font-semibold text-center leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  </button>
                ))}
              </div>
              {canEdit && showAddNote && (
                <div ref={notesSectionRef} className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold pt-3" style={{ color: 'var(--text-muted)' }}>Add note (shown on invoice)</p>
                  <textarea
                    className="input-field text-sm min-h-[72px]"
                    placeholder="Write a note for the invoice…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => { setShowAddNote(false); setNoteText('') }} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                    <button type="button" onClick={handleSaveNote} disabled={savingNote} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                      {savingNote ? 'Saving…' : 'Save Note'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Device Condition */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="flex items-center gap-2">
                  <Shield size={12} className="text-violet-500" />
                  <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Device Condition</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">Good</span>
              </div>
              <div className="p-4 space-y-2.5">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No physical damage</p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="h-full rounded-full bg-green-500" style={{ width: '85%' }} />
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <p className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Upload size={12} className="text-violet-500" /> Attachments ({photos.length})
                </p>
                {canEdit && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-400 border border-indigo-500/20 bg-violet-500/10 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                    {uploading ? 'Uploading…' : 'Add Files'}
                  </button>
                )}
              </div>
              <div className="p-4">
                {canEdit && <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />}
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((url, i) => {
                      const isPdf = url.toLowerCase().endsWith('.pdf')
                      return (
                        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                          {isPdf ? (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium hover:bg-white/5 transition-colors"
                              style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                              <FileText size={22} className="text-red-400" />
                              PDF
                            </a>
                          ) : (
                            <button onClick={() => setLightboxUrl(url)} className="w-full h-full">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDeletePhoto(url)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {canEdit && <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-[10px] transition-colors hover:border-indigo-500/50 hover:bg-violet-500/5 disabled:opacity-50"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin text-indigo-400" /> : <Upload size={16} />}
                      {uploading ? '' : 'Add more'}
                    </button>}
                  </div>
                ) : canEdit ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full rounded-xl border-2 border-dashed p-5 flex flex-col items-center gap-2 text-center transition-colors hover:border-indigo-500/40 hover:bg-violet-500/5 disabled:opacity-50"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {uploading ? <Loader2 size={22} className="animate-spin text-indigo-400" /> : <Upload size={22} style={{ color: 'var(--text-muted)' }} />}
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{uploading ? 'Uploading files…' : 'Click to upload files'}</p>
                      {!uploading && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>JPG, PNG, WebP, PDF · Max 10 MB each</p>}
                    </div>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Lightbox */}
            {lightboxUrl && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={() => setLightboxUrl(null)}>
                <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setLightboxUrl(null)}>
                  <X size={20} />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lightboxUrl} alt="Attachment" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
              </div>
            )}

            {/* Customer Contact */}
            <div ref={customerContactRef} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <p className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <User size={12} className="text-violet-500" /> Customer Contact
                </p>
              </div>
              <div className="p-4 space-y-3">
                {repair.customerPhone && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                      <a href={`tel:${repair.customerPhone}`} className="text-sm font-semibold hover:text-violet-500 transition-colors" style={{ color: 'var(--text-primary)' }}>{repair.customerPhone}</a>
                    </div>
                    {canEdit && (
                      <button onClick={sendInvoiceWhatsApp} className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <MessageSquare size={12} className="text-green-600" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <User size={13} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{repair.customerName}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {SOURCE_OPTIONS.find(o => o.value === repair.source)?.label ?? 'Walk-in'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden PDF template */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1, width: 794 }}>
          <InvoiceA4View
            ref={quoteRef}
            sale={repairSale}
            settings={invSettings}
            tenantSlug={tenantSlug}
            template={activeTemplate}
            hideControls
          />
        </div>
      </div>
  )

  if (!showPageHeader) {
    return (
      <div>
        <div
          className="sticky top-0 z-10 px-3 sm:px-4 py-2 border-b flex flex-wrap items-center justify-end gap-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          {repairHeaderActions}
        </div>
        {mainCard}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header (match dashboard system) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title mt-3 truncate">{repair.deviceBrand} {repair.deviceModel}</h1>
          <p className="page-subtitle mt-1">
            {repair.ticketNumber} · {statusLabels[repair.status] ?? repair.status}{isPaid ? ' · Paid' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:pt-1">
          {repairHeaderActions}
        </div>
      </div>

      {mainCard}
    </div>
  )
}
