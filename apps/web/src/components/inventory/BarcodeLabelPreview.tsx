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
  barcodeMaxH,
}: {
  label: BarcodeLabelItem
  resolved: BarcodeLabelSettings
  shopName?: string
  scale: number
  barcodeRef: React.RefObject<HTMLDivElement | null>
  barcodeMaxH: number
}) {
  const dense =
    resolved.showShopName &&
    resolved.showProductName &&
    resolved.showSku &&
    resolved.showBarcodeText &&
    resolved.showPrice
  const pricePt = Math.min(dense ? 7 : 8, Math.max(resolved.nameFontPt + 0.25, 6))
  const namePt = Math.min(resolved.nameFontPt, dense ? 6 : 7) * scale * 0.85
  const metaPt = Math.max(8, (dense ? 3.8 : 4.2) * scale * 0.85)
  const digitsPt = Math.max(9, (dense ? 4.5 : 5) * scale * 0.85)
  const gap = Math.max(2, scale * 0.28)
  const padY = Math.max(5, scale * 0.85)
  const padX = Math.max(6, scale * 1.05)

  return (
    <div
      className="bg-white text-black shadow-md border border-slate-300"
      style={{
        width: `${resolved.widthMm * scale}px`,
        height: `${resolved.heightMm * scale}px`,
        padding: `${padY}px ${padX}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap,
        textAlign: 'center',
        position: 'relative',
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {resolved.showShopName && (
        <p
          className="truncate w-full"
          style={{
            fontSize: `${metaPt}px`,
            fontWeight: 500,
            color: '#666',
            lineHeight: 1.15,
            margin: 0,
            flexShrink: 0,
          }}
        >
          {shopName?.trim() || 'DEMO SPARE PARTS STORE'}
        </p>
      )}
      {resolved.showProductName && (
        <p
          className="w-full font-bold"
          style={{
            fontSize: `${Math.max(10, namePt)}px`,
            color: '#111',
            lineHeight: 1.15,
            display: '-webkit-box',
            WebkitLineClamp: resolved.nameMaxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            margin: 0,
            flexShrink: 0,
          }}
        >
          {label.name}
        </p>
      )}
      {resolved.showSku && label.sku && (
        <p
          className="truncate w-full"
          style={{
            fontSize: `${metaPt}px`,
            fontWeight: 500,
            color: '#777',
            lineHeight: 1.15,
            margin: 0,
            flexShrink: 0,
          }}
        >
          {label.sku}
        </p>
      )}

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.max(2, gap * 0.6),
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          ref={barcodeRef}
          className="w-full flex justify-center items-center"
          style={{
            lineHeight: 0,
            height: barcodeMaxH,
            maxHeight: barcodeMaxH,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        />
        {resolved.showBarcodeText && (
          <p
            className="truncate w-full"
            style={{
              fontSize: `${digitsPt}px`,
              fontWeight: 600,
              fontFamily: '"Courier New", Courier, monospace',
              color: '#111',
              lineHeight: 1.1,
              margin: 0,
              flexShrink: 0,
            }}
          >
            {label.barcode}
          </p>
        )}
      </div>

      {resolved.showPrice && label.price != null ? (
        <p
          className="w-full font-bold"
          style={{
            fontSize: `${Math.max(11, pricePt * scale * 0.85)}px`,
            color: '#000',
            lineHeight: 1.1,
            margin: 0,
            paddingBottom: resolved.showCopyIndex && (label.qty ?? 1) > 1 ? gap : 0,
            flexShrink: 0,
          }}
        >
          {formatCurrency(label.price)}
        </p>
      ) : null}

      {resolved.showCopyIndex && (label.qty ?? 1) > 1 && (
        <span
          className="absolute font-semibold"
          style={{
            right: padX * 0.45,
            bottom: padY * 0.35,
            fontSize: `${Math.max(8, 3.8 * scale * 0.8)}px`,
            color: '#555',
            lineHeight: 1,
          }}
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
  const [fillScale, setFillScale] = useState(large ? 6 : 2)

  const resolved = resolveBarcodeLabelSettings({
    barcodeLabel: { ...DEFAULT_BARCODE_LABEL_SETTINGS, ...settings } as BarcodeLabelSettings,
  })
  const label = item?.barcode?.trim() ? item : SAMPLE_ITEM
  const scale = large ? fillScale : Math.min(2.6, Math.max(1.6, 140 / resolved.widthMm))
  const dense =
    resolved.showShopName &&
    resolved.showProductName &&
    resolved.showSku &&
    resolved.showBarcodeText &&
    resolved.showPrice
  // Cap bars so text rows never collide on 50×30 with all fields
  const barcodeMaxH = Math.max(
    18,
    Math.min(
      resolved.heightMm * scale * (dense ? 0.20 : 0.26),
      (dense ? 4.2 : 5.2) * scale,
      resolved.barcodeHeight * scale * 0.22,
    ),
  )

  useEffect(() => {
    if (!large || !boxRef.current) return
    const el = boxRef.current
    const update = () => {
      const pad = 40
      const availW = Math.max(180, el.clientWidth - pad)
      const availH = Math.max(140, el.clientHeight - pad)
      const sW = availW / resolved.widthMm
      const sH = availH / resolved.heightMm
      setFillScale(Math.max(3.5, Math.min(sW, sH, 8.5) * 0.86))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [large, resolved.widthMm, resolved.heightMm])

  useEffect(() => {
    if (!barcodeRef.current) return
    const renderH = Math.max(16, Math.round(barcodeMaxH / Math.max(scale, 1)))
    barcodeRef.current.innerHTML = renderBarcodeSvg(label.barcode, {
      height: Math.min(resolved.barcodeHeight, renderH),
      width: Math.min(resolved.barcodeBarWidth, dense ? 1.15 : 1.4),
      displayValue: false,
    })
    const svg = barcodeRef.current.querySelector('svg')
    if (svg) {
      svg.setAttribute('height', String(Math.round(barcodeMaxH)))
      svg.style.width = '100%'
      svg.style.height = `${barcodeMaxH}px`
      svg.style.maxHeight = `${barcodeMaxH}px`
      svg.style.display = 'block'
    }
  }, [label.barcode, resolved.barcodeHeight, resolved.barcodeBarWidth, barcodeMaxH, scale, dense])

  if (large) {
    return (
      <div ref={boxRef} className={`w-full h-full min-h-[280px] flex items-center justify-center ${className ?? ''}`}>
        <StickerFace
          label={label}
          resolved={resolved}
          shopName={shopName}
          scale={scale}
          barcodeRef={barcodeRef}
          barcodeMaxH={barcodeMaxH}
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
          barcodeMaxH={barcodeMaxH}
        />
      </div>
    </div>
  )
}
