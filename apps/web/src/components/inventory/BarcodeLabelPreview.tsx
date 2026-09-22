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
  const pricePt = Math.max(6, Math.min(resolved.priceFontPt, Math.max(8, resolved.heightMm * 0.55)))
  const namePt = Math.min(resolved.nameFontPt, dense ? 5.8 : 6.8) * scale * 0.92
  const metaPt = Math.max(9, (dense ? 3.8 : 4.2) * scale * 0.95)
  const digitsPt = Math.max(10, barcodeDigitsFontPt(label.barcode, dense) * scale * (minimal ? 1.08 : 1))
  const gap = Math.max(3, scale * 0.32)
  const padX = Math.max(10, scale * (minimal ? 1.5 : 1.35))
  const padY = Math.max(8, scale * (minimal ? 1.2 : 1))
  const shop = shopName?.trim() || 'DEMO SPARE PARTS STORE'
  const shopTracking = shop.length > 22 ? '0.04em' : shop.length > 14 ? '0.08em' : '0.12em'
  const pricePx = Math.max(14, pricePt * scale * 0.98)
  const rule = Math.max(1, Math.round(scale * 0.14))

  return (
    <div
      className="bg-white text-black shadow-lg border border-slate-300/90"
      style={{
        width: `${resolved.widthMm * scale}px`,
        height: `${resolved.heightMm * scale}px`,
        padding: `${padY}px ${padX}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: minimal ? 'center' : 'space-between',
        textAlign: 'center',
        position: 'relative',
        fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius: Math.max(4, scale * 0.35),
      }}
    >
      {/* 1 — Header: shop → product → sku */}
      {showTop && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: Math.max(2, gap * 0.45),
            flex: '0 0 auto',
            width: '100%',
            paddingBottom: Math.max(4, gap * 0.65),
            borderBottom: `${rule}px solid #d4d4d4`,
          }}
        >
          {resolved.showShopName && (
            <p
              className="w-full"
              style={{
                fontSize: `${metaPt}px`,
                fontWeight: 700,
                letterSpacing: shopTracking,
                textTransform: 'uppercase',
                color: '#525252',
                lineHeight: 1.2,
                margin: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
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
                fontSize: `${Math.max(11, namePt)}px`,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: '#0a0a0a',
                lineHeight: 1.18,
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
                fontSize: `${metaPt * 0.92}px`,
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

      {/* 2 — Barcode + digits */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.max(4, gap * 0.7),
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
          padding: `${Math.max(4, gap * 0.5)}px 0`,
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
              fontSize: `${digitsPt}px`,
              fontWeight: 600,
              fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
              letterSpacing: '0.1em',
              color: '#171717',
              lineHeight: 1.2,
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
            marginTop: 0,
            paddingTop: Math.max(5, gap * 0.75),
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
              lineHeight: 1.12,
              margin: 0,
              paddingBottom: resolved.showCopyIndex && (label.qty ?? 1) > 1 ? gap * 0.6 : 0,
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
            right: padX * 0.4,
            bottom: Math.max(5, scale * 0.45),
            fontSize: `${Math.max(9, 3.6 * scale * 0.9)}px`,
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

/** Full sticker preview — clean: shop/name/sku → barcode → digits → price */
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
  const barcodeMaxH = Math.max(
    22,
    Math.min(
      resolved.heightMm * scale * (dense ? 0.2 : minimal ? 0.42 : 0.3),
      (dense ? 4.2 : minimal ? 7.8 : 5.8) * scale,
      resolved.barcodeHeight * scale * (minimal ? 0.34 : 0.24),
    ),
  )

  useEffect(() => {
    if (!large || !boxRef.current) return
    const el = boxRef.current
    const update = () => {
      const pad = 28
      const availW = Math.max(220, el.clientWidth - pad)
      const availH = Math.max(200, el.clientHeight - pad)
      const sW = availW / resolved.widthMm
      const sH = availH / resolved.heightMm
      // Fill most of the preview pane so the sticker reads clearly
      setFillScale(Math.max(5.5, Math.min(sW, sH, 16) * 0.97))
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
      width: Math.min(resolved.barcodeBarWidth, dense ? 1.15 : minimal ? 1.55 : 1.4),
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
        className={`w-full h-full min-h-[320px] flex flex-col items-center justify-center gap-3 ${className ?? ''}`}
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
