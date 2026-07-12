'use client'

import { useEffect, useRef } from 'react'
import { renderBarcodeSvg } from '@/lib/barcode-print'

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
