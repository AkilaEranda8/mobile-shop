export type SkuCodeFormat =
  | { type: 'numeric'; pad: number }
  | { type: 'prefixed'; prefix: string; pad: number }

/** Parse a base product SKU sequence (numeric 00001 or TENANT-SKU-00001). */
export function parseProductSkuSequence(sku: string):
  | { type: 'numeric'; n: number }
  | { type: 'prefixed'; prefix: string; n: number }
  | null {
  const s = sku.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10)
    return Number.isFinite(n) && n > 0 ? { type: 'numeric', n } : null
  }
  const m = s.match(/^(.+-SKU)-(\d+)$/i)
  if (m) {
    const n = parseInt(m[2], 10)
    return Number.isFinite(n) && n > 0 ? { type: 'prefixed', prefix: m[1], n } : null
  }
  return null
}

export function analyzeProductSkus(skus: string[], defaultPrefix: string): { format: SkuCodeFormat; maxSeq: number } {
  let numericMax = 0
  let numericCount = 0
  const prefixed = new Map<string, { count: number; max: number }>()

  for (const raw of skus) {
    const parsed = parseProductSkuSequence(raw)
    if (!parsed) continue
    if (parsed.type === 'numeric') {
      numericCount++
      numericMax = Math.max(numericMax, parsed.n)
    } else {
      const row = prefixed.get(parsed.prefix) ?? { count: 0, max: 0 }
      row.count++
      row.max = Math.max(row.max, parsed.n)
      prefixed.set(parsed.prefix, row)
    }
  }

  if (numericCount > 0) {
    const pad = Math.max(5, String(numericMax || 1).length)
    return { format: { type: 'numeric', pad }, maxSeq: numericMax }
  }

  let bestPrefix = defaultPrefix
  let bestCount = -1
  let bestMax = 0
  for (const [prefix, row] of prefixed) {
    if (row.count > bestCount || (row.count === bestCount && prefix === defaultPrefix)) {
      bestPrefix = prefix
      bestCount = row.count
      bestMax = row.max
    }
  }

  return {
    format: { type: 'prefixed', prefix: bestPrefix, pad: 5 },
    maxSeq: bestMax,
  }
}

export function formatSkuFromSeq(format: SkuCodeFormat, seq: number): string {
  const padded = String(seq).padStart(format.pad, '0')
  if (format.type === 'numeric') return padded
  return `${format.prefix}-${padded}`
}

export function serializeSkuFormat(format: SkuCodeFormat): string {
  if (format.type === 'numeric') return `numeric:${format.pad}`
  return `prefix:${format.prefix}:${format.pad}`
}

export function deserializeSkuFormat(raw: string, defaultPrefix: string): SkuCodeFormat {
  if (raw.startsWith('numeric:')) {
    const pad = parseInt(raw.slice('numeric:'.length), 10)
    return { type: 'numeric', pad: Number.isFinite(pad) && pad > 0 ? pad : 5 }
  }
  if (raw.startsWith('prefix:')) {
    const parts = raw.split(':')
    const prefix = parts[1] || defaultPrefix
    const pad = parseInt(parts[2] ?? '5', 10)
    return { type: 'prefixed', prefix, pad: Number.isFinite(pad) && pad > 0 ? pad : 5 }
  }
  return { type: 'prefixed', prefix: defaultPrefix, pad: 5 }
}

export function skuFormatsEqual(a: SkuCodeFormat, b: SkuCodeFormat): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'numeric' && b.type === 'numeric') return a.pad === b.pad
  if (a.type === 'prefixed' && b.type === 'prefixed') return a.prefix === b.prefix && a.pad === b.pad
  return false
}
