import { getDesktopDownloadUrl } from '@/lib/desktop-download'

export type DesktopVersionManifest = {
  version: string
  downloadUrl?: string
  message?: string
}

export type HexalyteDesktopBridge = {
  isDesktop?: boolean
  platform?: string
  version?: string
  getVersion?: () => Promise<string>
  getShopSlug?: () => Promise<string | null>
  setShopSlug?: (slug: string) => Promise<string | null>
  clearShopSlug?: () => Promise<boolean>
  openShopLogin?: (slug: string) => Promise<{ slug: string | null; url: string }>
  installUpdate?: (
    url?: string,
    meta?: { version?: string },
  ) => Promise<{ ok: boolean; reason?: string }>
  checkUpdate?: () => Promise<void>
  onUpdateProgress?: (
    callback: (payload: {
      phase?: string
      progress?: number
      version?: string
      label?: string
      message?: string
    }) => void,
  ) => () => void
}

export function getHexalyteDesktopBridge(): HexalyteDesktopBridge | null {
  if (typeof window === 'undefined') return null
  try {
    const bridge = (window as Window & { hexalyteDesktop?: HexalyteDesktopBridge }).hexalyteDesktop
    if (bridge?.isDesktop) return bridge
  } catch {
    /* ignore */
  }
  return null
}

/** Compare dotted versions. Returns 1 if a>b, -1 if a<b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/i, '').split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

export async function fetchDesktopVersionManifest(): Promise<DesktopVersionManifest | null> {
  try {
    const res = await fetch(`/downloads/desktop-version.json?t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as DesktopVersionManifest
    if (!data?.version || typeof data.version !== 'string') return null
    return data
  } catch {
    return null
  }
}

export function resolveDesktopDownloadHref(manifest?: DesktopVersionManifest | null): string {
  const fromManifest = manifest?.downloadUrl?.trim()
  if (fromManifest) {
    if (fromManifest.startsWith('http://') || fromManifest.startsWith('https://')) return fromManifest
    return fromManifest
  }
  return getDesktopDownloadUrl()
}
