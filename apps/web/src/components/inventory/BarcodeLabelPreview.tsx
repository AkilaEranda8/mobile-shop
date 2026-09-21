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
  const pricePt = Math.min(dense ? 7.5 : minimal ? 9.5 : 9, Math.max(resolved.nameFontPt + 1.2, 7))
  const namePt = Math.min(resolved.nameFontPt, dense ? 5.8 : 6.8) * scale * 0.88
  const metaPt = Math.max(8, (dense ? 3.6 : 4) * scale * 0.9)
  const digitsPt = Math.max(9, barcodeDigitsFontPt(label.barcode, dense) * scale * (minimal ? 1.05 : 0.95))
  const gap = Math.max(2, scale * 0.28)
  const padX = Math.max(8, scale * (minimal ? 1.4 : 1.2))
  const padY = Math.max(6, scale * (minimal ? 1.1 : 0.85))

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
        borderRadius: 4,
      }}
    >
      {showTop && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: Math.max(2, gap * 0.55),
            flexShrink: 0,
            width: '100%',
            paddingBottom: Math.max(3, gap * 0.7),
            marginBottom: Math.max(3, gap * 0.55),
            borderBottom: `${Math.max(1, scale * 0.14)}px solid #d4d4d4`,
          }}
        >
          {resolved.showShopName && (
            <p
              className="truncate w-full"
              style={{
                fontSize: `${metaPt}px`,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#525252',
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {shopName?.trim() || 'DEMO SPARE PARTS STORE'}
            </p>
          )}
          {resolved.showProductName && (
            <p
              className="w-full"
              style={{
                fontSize: `${Math.max(10, namePt)}px`,
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
              className="truncate w-full"
              style={{
                fontSize: `${metaPt * 0.95}px`,
                fontWeight: 600,
                letterSpacing: '0.08em',
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

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.max(3, gap * (minimal ? 0.85 : 0.55)),
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
          padding: `${Math.max(2, gap * 0.35)}px 0`,
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
              letterSpacing: '0.12em',
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

      {resolved.showPrice && label.price != null ? (
        <div
          style={{
            width: '100%',
            flexShrink: 0,
            marginTop: Math.max(4, gap * (minimal ? 0.9 : 0.5)),
            paddingTop: Math.max(4, gap * (minimal ? 0.85 : 0.65)),
            borderTop: `${Math.max(1, scale * 0.16)}px solid #a3a3a3`,
          }}
        >
          <p
            className="w-full"
            style={{
              fontSize: `${Math.max(13, pricePt * scale * 0.9)}px`,
              fontWeight: 800,
              letterSpacing: '0.01em',
              color: '#0a0a0a',
              lineHeight: 1.1,
              margin: 0,
              paddingBottom: resolved.showCopyIndex && (label.qty ?? 1) > 1 ? gap : 0,
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
            right: padX * 0.45,
            bottom: Math.max(4, scale * 0.4),
            fontSize: `${Math.max(8, 3.5 * scale * 0.85)}px`,
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
  const minimal =
    !resolved.showShopName &&
    !resolved.showProductName &&
    !resolved.showSku &&
    resolved.showBarcodeText &&
    resolved.showPrice
  const barcodeMaxH = Math.max(
    18,
    Math.min(
      resolved.heightMm * scale * (dense ? 0.18 : minimal ? 0.4 : 0.28),
      (dense ? 3.8 : minimal ? 7.2 : 5.4) * scale,
      resolved.barcodeHeight * scale * (minimal ? 0.32 : 0.22),
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
