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
    ref.current.innerHTML = renderBarcodeSvg(code, { displayValue: false })
  }, [value])

  if (!value?.trim()) return null
  return <div ref={ref} className={className} />
}

const SAMPLE_ITEM: BarcodeLabelItem = {
  barcode: '2351462490266001',
  name: 'kab - Aftermarket',
  sku: 'AKP',
  price: 2000,
  qty: 2,
}

/** Full sticker preview — order: shop → name → code → barcode → digits → price */
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
  const scale = Math.min(2.4, Math.max(1.5, 130 / resolved.widthMm))
  const pricePt = Math.max(resolved.nameFontPt + 1.5, 7)

  useEffect(() => {
    if (!barcodeRef.current) return
    barcodeRef.current.innerHTML = renderBarcodeSvg(label.barcode, {
      height: resolved.barcodeHeight,
      width: resolved.barcodeBarWidth,
      displayValue: false,
    })
  }, [label.barcode, resolved.barcodeHeight, resolved.barcodeBarWidth])

  return (
    <div className={className}>
      <div
        className="mx-auto bg-white text-black shadow-sm border border-slate-200 overflow-hidden"
        style={{
          width: `${resolved.widthMm * scale}px`,
          height: `${resolved.heightMm * scale}px`,
          padding: `${1 * scale}px ${1.4 * scale}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {resolved.showShopName && (
          <p
            className="truncate w-full"
            style={{
              fontSize: `${4.5 * scale * 0.75}px`,
              fontWeight: 500,
              color: '#666',
              lineHeight: 1.15,
              marginBottom: 2,
            }}
          >
            {shopName?.trim() || 'DEMO SPARE PARTS STORE'}
          </p>
        )}
        {resolved.showProductName && (
          <p
            className="w-full font-bold"
            style={{
              fontSize: `${resolved.nameFontPt * scale * 0.75}px`,
              color: '#111',
              lineHeight: 1.15,
              display: '-webkit-box',
              WebkitLineClamp: resolved.nameMaxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              marginBottom: 2,
            }}
          >
            {label.name}
          </p>
        )}
        {resolved.showSku && label.sku && (
          <p
            className="truncate w-full"
            style={{ fontSize: `${4.5 * scale * 0.75}px`, fontWeight: 500, color: '#777', marginBottom: 3 }}
          >
            {label.sku}
          </p>
        )}
        <div
          ref={barcodeRef}
          className="flex-shrink-0 w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
          style={{ lineHeight: 0, marginBottom: 2 }}
        />
        {resolved.showBarcodeText && (
          <p
            className="truncate w-full"
            style={{
              fontSize: `${5.5 * scale * 0.75}px`,
              fontWeight: 600,
              fontFamily: '"Courier New", Courier, monospace',
              color: '#111',
              marginBottom: 3,
            }}
          >
            {label.barcode}
          </p>
        )}
        {resolved.showPrice && label.price != null && (
          <p
            className="w-full font-extrabold"
            style={{
              fontSize: `${pricePt * scale * 0.75}px`,
              color: '#000',
              marginTop: 'auto',
              paddingTop: 2,
            }}
          >
            {formatCurrency(label.price)}
          </p>
        )}
        {resolved.showCopyIndex && (label.qty ?? 1) > 1 && (
          <span
            className="absolute font-semibold"
            style={{ right: 4, bottom: 2, fontSize: `${4.5 * scale * 0.75}px`, color: '#555' }}
          >
            1/{label.qty ?? 1}
          </span>
        )}
      </div>
    </div>
  )
}
