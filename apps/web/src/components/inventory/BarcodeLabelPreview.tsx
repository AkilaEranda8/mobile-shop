'use client'

import { useEffect, useRef, useState } from 'react'
import { barcodeDigitsFontPt, renderBarcodeSvg, type BarcodeLabelItem } from '@/lib/barcode-print'
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

/** Convert print points → screen px when `scale` is px-per-mm. */
const PT_MM = 25.4 / 72
function ptToPx(pt: number, scale: number) {
  return Math.max(1, pt * PT_MM * scale)
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
  const showTop =
    resolved.showShopName ||
    resolved.showProductName ||
    (resolved.showSku && !!label.sku)
  const minimal =
    !resolved.showShopName &&
    !resolved.showProductName &&
    !resolved.showSku &&
    resolved.showBarcodeText &&
    resolved.showPrice

  // Cap price so it never dominates a 25–30mm tall sticker
  const pricePt = Math.max(6, Math.min(resolved.priceFontPt, resolved.heightMm * 0.42, dense ? 10 : 12))
  const namePt = Math.min(resolved.nameFontPt, dense ? 5.2 : 5.8)
  const shopPt = dense ? 3.4 : 3.8
  const digitsPt = Math.min(barcodeDigitsFontPt(label.barcode, dense), dense ? 4.2 : 4.8)

  const shopPx = ptToPx(shopPt, scale)
  const namePx = ptToPx(namePt, scale)
  const digitsPx = ptToPx(digitsPt, scale)
  const pricePx = ptToPx(pricePt, scale)
  const skuPx = ptToPx(shopPt * 0.92, scale)

  const gap = Math.max(1, scale * 0.22)
  const padX = Math.max(4, scale * 1.1)
  const padY = Math.max(3, scale * 0.85)
  const shop = shopName?.trim() || 'DEMO SPARE PARTS STORE'
  const shopTracking = shop.length > 22 ? '0.03em' : shop.length > 14 ? '0.06em' : '0.1em'
  const rule = Math.max(1, Math.round(scale * 0.12))

  return (
    <div
      className="bg-white text-black shadow-md border border-slate-300/90"
      style={{
        width: `${resolved.widthMm * scale}px`,
        height: `${resolved.heightMm * scale}px`,
        padding: `${padY}px ${padX}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: minimal ? 'center' : 'flex-start',
        textAlign: 'center',
        position: 'relative',
        fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius: Math.max(3, scale * 0.28),
      }}
    >
      {/* 1 — Header */}
      {showTop && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: Math.max(1, gap * 0.4),
            flex: '0 0 auto',
            width: '100%',
            paddingBottom: Math.max(2, gap * 0.55),
            marginBottom: Math.max(2, gap * 0.45),
            borderBottom: `${rule}px solid #d4d4d4`,
          }}
        >
          {resolved.showShopName && (
            <p
              className="w-full truncate"
              style={{
                fontSize: `${shopPx}px`,
                fontWeight: 700,
                letterSpacing: shopTracking,
                textTransform: 'uppercase',
                color: '#525252',
                lineHeight: 1.15,
                margin: 0,
              }}
              title={shop}
            >
              {shop}
            </p>
          )}
          {resolved.showProductName && (
            <p
              className="w-full"
              style={{
                fontSize: `${namePx}px`,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: '#0a0a0a',
                lineHeight: 1.15,
                display: '-webkit-box',
                WebkitLineClamp: resolved.nameMaxLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {label.name}
            </p>
          )}
          {resolved.showSku && label.sku && (
            <p
              className="w-full truncate"
              style={{
                fontSize: `${skuPx}px`,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#737373',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {label.sku}
            </p>
          )}
        </div>
      )}

      {/* 2 — Barcode + digits (kept together, never clipped into each other) */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.max(2, gap * 0.55),
          flex: '1 1 auto',
          minHeight: barcodeMaxH + digitsPx + gap,
          overflow: 'hidden',
          padding: `${Math.max(1, gap * 0.25)}px 0`,
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
            className="w-full truncate"
            style={{
              fontSize: `${digitsPx}px`,
              fontWeight: 600,
              fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
              letterSpacing: '0.08em',
              color: '#171717',
              lineHeight: 1.15,
              margin: 0,
              flexShrink: 0,
            }}
          >
            {label.barcode}
          </p>
        )}
      </div>

      {/* 3 — Price */}
      {resolved.showPrice && label.price != null ? (
        <div
          style={{
            width: '100%',
            flex: '0 0 auto',
            marginTop: Math.max(2, gap * 0.45),
            paddingTop: Math.max(2, gap * 0.55),
            borderTop: `${rule}px solid #a3a3a3`,
          }}
        >
          <p
            className="w-full"
            style={{
              fontSize: `${pricePx}px`,
              fontWeight: 800,
              letterSpacing: '0.01em',
              color: '#0a0a0a',
              lineHeight: 1.1,
              margin: 0,
              paddingBottom: resolved.showCopyIndex && (label.qty ?? 1) > 1 ? gap * 0.5 : 0,
            }}
          >
            {formatCurrency(label.price)}
          </p>
        </div>
      ) : null}

      {resolved.showCopyIndex && (label.qty ?? 1) > 1 && (
        <span
          className="absolute font-semibold"
          style={{
            right: padX * 0.35,
            bottom: Math.max(2, scale * 0.35),
            fontSize: `${ptToPx(3.2, scale)}px`,
            color: '#737373',
            lineHeight: 1,
            letterSpacing: '0.04em',
          }}
        >
          1/{label.qty ?? 1}
        </span>
      )}
    </div>
  )
}

/** Full sticker preview — shop → name → barcode → digits → price */
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
  /** Larger on-screen preview (Settings page) */
  large?: boolean
}) {
  const barcodeRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [fillScale, setFillScale] = useState(large ? 5 : 2)

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
  const minimal =
    !resolved.showShopName &&
    !resolved.showProductName &&
    !resolved.showSku &&
    resolved.showBarcodeText &&
    resolved.showPrice

  // Barcode band ~22–28% of sticker height so text + price still fit cleanly
  const barcodeMaxH = Math.max(
    scale * 4.5,
    Math.min(
      resolved.heightMm * scale * (dense ? 0.22 : minimal ? 0.36 : 0.26),
      (dense ? 6.2 : minimal ? 10 : 7.5) * scale,
    ),
  )

  useEffect(() => {
    if (!large || !boxRef.current) return
    const el = boxRef.current
    const update = () => {
      const pad = 48
      const availW = Math.max(160, el.clientWidth - pad)
      const availH = Math.max(120, el.clientHeight - pad)
      const sW = availW / resolved.widthMm
      const sH = availH / resolved.heightMm
      // Readable but not oversized — true print proportions
      setFillScale(Math.max(3.2, Math.min(sW, sH, 7.5) * 0.88))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [large, resolved.widthMm, resolved.heightMm])

  useEffect(() => {
    if (!barcodeRef.current) return
    const renderH = Math.max(14, Math.round(barcodeMaxH / Math.max(scale, 1)))
    barcodeRef.current.innerHTML = renderBarcodeSvg(label.barcode, {
      height: Math.min(resolved.barcodeHeight, renderH),
      width: Math.min(resolved.barcodeBarWidth, dense ? 1.1 : minimal ? 1.45 : 1.25),
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
  }, [label.barcode, resolved.barcodeHeight, resolved.barcodeBarWidth, barcodeMaxH, scale, dense, minimal])

  if (large) {
    return (
      <div
        ref={boxRef}
        className={`w-full h-full min-h-[260px] flex flex-col items-center justify-center gap-2.5 ${className ?? ''}`}
      >
        <StickerFace
          label={label}
          resolved={resolved}
          shopName={shopName}
          scale={scale}
          barcodeRef={barcodeRef}
          barcodeMaxH={barcodeMaxH}
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          Print size {resolved.widthMm}×{resolved.heightMm} mm
          {resolved.showPrice ? ` · price ${resolved.priceFontPt}pt` : ''}
        </p>
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
