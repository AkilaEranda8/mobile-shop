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
  // Keep price readable but not dominating the sticker
  const pricePt = Math.min(8, Math.max(resolved.nameFontPt + 0.5, 6.5))
  const gap = Math.max(2, scale * 0.35)
  const padY = Math.max(4, scale * 0.9)
  const padX = Math.max(6, scale * 1.1)
  const barcodeMaxH = Math.max(28, resolved.heightMm * scale * 0.32)

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
        justifyContent: 'space-between',
        textAlign: 'center',
        position: 'relative',
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap,
          flexShrink: 0,
          minHeight: 0,
        }}
      >
        {resolved.showShopName && (
          <p
            className="truncate w-full"
            style={{
              fontSize: `${Math.max(9, 4.2 * scale * 0.85)}px`,
              fontWeight: 500,
              color: '#666',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {shopName?.trim() || 'DEMO SPARE PARTS STORE'}
          </p>
        )}
        {resolved.showProductName && (
          <p
            className="w-full font-bold"
            style={{
              fontSize: `${Math.max(11, resolved.nameFontPt * scale * 0.85)}px`,
              color: '#111',
              lineHeight: 1.2,
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
              fontSize: `${Math.max(9, 4.2 * scale * 0.85)}px`,
              fontWeight: 500,
              color: '#777',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {label.sku}
          </p>
        )}
      </div>

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: Math.max(2, gap * 0.7),
          flex: '1 1 auto',
          justifyContent: 'center',
          minHeight: 0,
        }}
      >
        <div
          ref={barcodeRef}
          className="w-full flex justify-center items-center [&_svg]:max-w-full"
          style={{ lineHeight: 0, maxHeight: barcodeMaxH, overflow: 'hidden' }}
        />
        {resolved.showBarcodeText && (
          <p
            className="truncate w-full"
            style={{
              fontSize: `${Math.max(10, 5 * scale * 0.85)}px`,
              fontWeight: 600,
              fontFamily: '"Courier New", Courier, monospace',
              color: '#111',
              lineHeight: 1.15,
              margin: 0,
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
            fontSize: `${Math.max(12, pricePt * scale * 0.85)}px`,
            color: '#000',
            lineHeight: 1.15,
            margin: 0,
            flexShrink: 0,
          }}
        >
          {formatCurrency(label.price)}
        </p>
      ) : (
        <div style={{ height: gap }} />
      )}

      {resolved.showCopyIndex && (label.qty ?? 1) > 1 && (
        <span
          className="absolute font-semibold"
          style={{
            right: padX * 0.5,
            bottom: padY * 0.4,
            fontSize: `${Math.max(8, 4 * scale * 0.8)}px`,
            color: '#555',
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

  useEffect(() => {
    if (!large || !boxRef.current) return
    const el = boxRef.current
    const update = () => {
      const pad = 40
      const availW = Math.max(180, el.clientWidth - pad)
      const availH = Math.max(140, el.clientHeight - pad)
      const sW = availW / resolved.widthMm
      const sH = availH / resolved.heightMm
      // Cap scale so text/layout stay readable and spaced
      setFillScale(Math.max(3.5, Math.min(sW, sH, 9) * 0.88))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [large, resolved.widthMm, resolved.heightMm])

  useEffect(() => {
    if (!barcodeRef.current) return
    const barH = Math.min(resolved.barcodeHeight, Math.round(resolved.heightMm * 1.1))
    barcodeRef.current.innerHTML = renderBarcodeSvg(label.barcode, {
      height: barH,
      width: Math.min(resolved.barcodeBarWidth, 1.4),
      displayValue: false,
    })
    const svg = barcodeRef.current.querySelector('svg')
    if (svg) {
      svg.style.maxHeight = '100%'
      svg.style.width = '100%'
      svg.style.height = 'auto'
    }
  }, [label.barcode, resolved.barcodeHeight, resolved.barcodeBarWidth, resolved.heightMm, scale])

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
