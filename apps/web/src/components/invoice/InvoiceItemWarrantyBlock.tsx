import type { ItemWarrantyInfo } from '@/components/invoice/invoice-warranty.util'

export default function InvoiceItemWarrantyBlock({
  info,
  fontSize = 12,
  color = '#6b7280',
}: {
  info?: ItemWarrantyInfo
  fontSize?: number
  color?: string
}) {
  if (!info) return null
  if (!info.warrantyCode && !info.warrantyPeriod && !info.warrantyExpiry && !info.warrantyNote) return null

  return (
    <div style={{ marginTop: 4, fontSize, lineHeight: 1.5, color }}>
      {info.warrantyCode && <div>Warranty: {info.warrantyCode}</div>}
      {info.warrantyPeriod && <div>Warranty Period: {info.warrantyPeriod}</div>}
      {info.warrantyExpiry && <div>Valid until: {info.warrantyExpiry}</div>}
      {info.warrantyNote && <div>Warranty note: {info.warrantyNote}</div>}
    </div>
  )
}
