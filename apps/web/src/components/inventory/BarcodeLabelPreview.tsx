'use client'

import { useEffect, useRef } from 'react'
import { renderBarcodeSvg, type BarcodeLabelItem } from '@/lib/barcode-print'
import {
  DEFAULT_BARCODE_LABEL_SETTINGS,
  resolveBarcodeLabelSettings,
  type BarcodeLabelSettings,
} from '@/lib/invoiceSettings'
import { formatCurrency } from '@/lib/utils'

/** Simple barcode SVG only (legacy). */
export function BarcodeLabelPreview({ value, className }: { value?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const code = value?.trim()
    if (!code) {
      ref.current.innerHTML = ''
      return
    }
    ref.current.innerHTML = renderBarcodeSvg(code)
  }, [value])

  if (!value?.trim()) return null
  return <div ref={ref} className={className} />
}

const SAMPLE_ITEM: BarcodeLabelItem = {
  barcode: '8901234567890',
  name: 'Sample Product Name',
  sku: 'SKU-001',
  price: 4990,
  qty: 2,
}

/** Full sticker preview matching print layout (scaled for screen). */
export function BarcodeStickerPreview({
  item,
  settings,
  shopName,
  className,
}: {
  item?: BarcodeLabelItem | null
  settings?: Partial<BarcodeLabelSettings> | BarcodeLabelSettings | null
  shopName?: string
  className?: string
}) {
  const barcodeRef = useRef<HTMLDivElement>(null)
  const resolved = resolveBarcodeLabelSettings({
    barcodeLabel: { ...DEFAULT_BARCODE_LABEL_SETTINGS, ...settings } as BarcodeLabelSettings,
  })
  const label = item?.barcode?.trim() ? item : SAMPLE_ITEM
  const scale = Math.min(2.2, Math.max(1.4, 120 / resolved.widthMm))

  useEffect(() => {
    if (!barcodeRef.current) return
    barcodeRef.current.innerHTML = renderBarcodeSvg(label.barcode, {
      height: resolved.barcodeHeight,
      width: resolved.barcodeBarWidth,
      displayValue: resolved.showBarcodeText,
    })
  }, [label.barcode, resolved.barcodeHeight, resolved.barcodeBarWidth, resolved.showBarcodeText])

  return (
    <div className={className}>
      <div
        className="mx-auto bg-white text-black shadow-sm border border-slate-200 overflow-hidden"
        style={{
          width: `${resolved.widthMm * scale}px`,
          height: `${resolved.heightMm * scale}px`,
          padding: `${0.8 * scale}px ${1.2 * scale}px`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {resolved.showShopName && shopName?.trim() && (
          <p
            className="text-center font-bold truncate"
            style={{ fontSize: `${4.5 * scale * 0.75}px`, lineHeight: 1.1, marginBottom: 2 }}
          >
            {shopName.trim()}
          </p>
        )}
        <div ref={barcodeRef} className="flex-shrink-0 text-center [&_svg]:max-w-full [&_svg]:h-auto" style={{ lineHeight: 0 }} />
        {resolved.showProductName && (
          <p
            className="font-bold"
            style={{
              fontSize: `${resolved.nameFontPt * scale * 0.75}px`,
              lineHeight: 1.1,
              display: '-webkit-box',
              WebkitLineClamp: resolved.nameMaxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {label.name}
          </p>
        )}
        {resolved.showSku && label.sku && (
          <p className="font-semibold truncate" style={{ fontSize: `${5 * scale * 0.75}px`, marginTop: 2 }}>
            SKU: {label.sku}
          </p>
        )}
        {resolved.showPrice && label.price != null && (
          <p className="font-semibold" style={{ fontSize: `${5 * scale * 0.75}px`, marginTop: 1 }}>
            {formatCurrency(label.price)}
          </p>
        )}
        {resolved.showCopyIndex && (label.qty ?? 1) > 1 && (
          <span
            className="absolute font-semibold"
            style={{ right: 4, bottom: 2, fontSize: `${5 * scale * 0.75}px`, color: '#222' }}
          >
            1/{label.qty ?? 1}
          </span>
        )}
      </div>
    </div>
  )
}
