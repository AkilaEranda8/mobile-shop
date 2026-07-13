'use client'

import { useEffect, useRef, useState } from 'react'
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

function StickerFace({
  label,
  resolved,
  shopName,
  scale,
  barcodeRef,
}: {
  label: BarcodeLabelItem
  resolved: BarcodeLabelSettings
  shopName?: string
  scale: number
  barcodeRef: React.RefObject<HTMLDivElement | null>
}) {
  const pricePt = Math.max(resolved.nameFontPt + 1.5, 7)
  const fs = (pt: number) => `${pt * scale * 0.9}px`

  return (
    <div
      className="bg-white text-black shadow-md border border-slate-300 overflow-hidden"
      style={{
        width: `${resolved.widthMm * scale}px`,
        height: `${resolved.heightMm * scale}px`,
        padding: `${1.2 * scale}px ${1.6 * scale}px`,
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
          style={{ fontSize: fs(4.5), fontWeight: 500, color: '#666', lineHeight: 1.15, marginBottom: 3 }}
        >
          {shopName?.trim() || 'DEMO SPARE PARTS STORE'}
        </p>
      )}
      {resolved.showProductName && (
        <p
          className="w-full font-bold"
          style={{
            fontSize: fs(resolved.nameFontPt),
            color: '#111',
            lineHeight: 1.15,
            display: '-webkit-box',
            WebkitLineClamp: resolved.nameMaxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            marginBottom: 3,
          }}
        >
          {label.name}
        </p>
      )}
      {resolved.showSku && label.sku && (
        <p className="truncate w-full" style={{ fontSize: fs(4.5), fontWeight: 500, color: '#777', marginBottom: 4 }}>
          {label.sku}
        </p>
      )}
      <div
        ref={barcodeRef}
        className="flex-shrink-0 w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
        style={{ lineHeight: 0, marginBottom: 3 }}
      />
      {resolved.showBarcodeText && (
        <p
          className="truncate w-full"
          style={{
            fontSize: fs(5.5),
            fontWeight: 600,
            fontFamily: '"Courier New", Courier, monospace',
            color: '#111',
            marginBottom: 4,
          }}
        >
          {label.barcode}
        </p>
      )}
      {resolved.showPrice && label.price != null && (
        <p
          className="w-full font-extrabold"
          style={{ fontSize: fs(pricePt), color: '#000', marginTop: 'auto', paddingTop: 3 }}
        >
          {formatCurrency(label.price)}
        </p>
      )}
      {resolved.showCopyIndex && (label.qty ?? 1) > 1 && (
        <span
          className="absolute font-semibold"
          style={{ right: 6, bottom: 4, fontSize: fs(4.5), color: '#555' }}
        >
          1/{label.qty ?? 1}
        </span>
      )}
    </div>
  )
}

/** Full sticker preview — order: shop → name → code → barcode → digits → price */
export function BarcodeStickerPreview({
  item,
  settings,
  shopName,
  className,
  large = false,
}: {
  item?: BarcodeLabelItem | null
  settings?: Partial<BarcodeLabelSettings> | BarcodeLabelSettings | null
  shopName?: string
  className?: string
  /** Larger on-screen preview (Settings page) — fills container */
  large?: boolean
}) {
  const barcodeRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [fillScale, setFillScale] = useState(large ? 8 : 2)

  const resolved = resolveBarcodeLabelSettings({
    barcodeLabel: { ...DEFAULT_BARCODE_LABEL_SETTINGS, ...settings } as BarcodeLabelSettings,
  })
  const label = item?.barcode?.trim() ? item : SAMPLE_ITEM
  const scale = large ? fillScale : Math.min(2.6, Math.max(1.6, 140 / resolved.widthMm))

  useEffect(() => {
    if (!large || !boxRef.current) return
    const el = boxRef.current
    const update = () => {
      const pad = 32
      const availW = Math.max(200, el.clientWidth - pad)
      const availH = Math.max(160, el.clientHeight - pad)
      const sW = availW / resolved.widthMm
      const sH = availH / resolved.heightMm
      setFillScale(Math.max(4, Math.min(sW, sH) * 0.92))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [large, resolved.widthMm, resolved.heightMm])

  useEffect(() => {
    if (!barcodeRef.current) return
    barcodeRef.current.innerHTML = renderBarcodeSvg(label.barcode, {
      height: resolved.barcodeHeight,
      width: resolved.barcodeBarWidth,
      displayValue: false,
    })
  }, [label.barcode, resolved.barcodeHeight, resolved.barcodeBarWidth, scale])

  if (large) {
    return (
      <div ref={boxRef} className={`w-full h-full min-h-[280px] flex items-center justify-center ${className ?? ''}`}>
        <StickerFace
          label={label}
          resolved={resolved}
          shopName={shopName}
          scale={scale}
          barcodeRef={barcodeRef}
        />
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mx-auto w-fit">
        <StickerFace
          label={label}
          resolved={resolved}
          shopName={shopName}
          scale={scale}
          barcodeRef={barcodeRef}
        />
      </div>
    </div>
  )
}
