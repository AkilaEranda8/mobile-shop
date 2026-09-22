/**
 * Reliable browser print helpers for POS receipts.
 * - Prefer a pre-opened popup (must be opened in the same user-gesture as checkout click).
 * - If that popup is gone/blocked after async checkout, fall back to a hidden iframe
 *   (iframe.print does not need a user gesture).
 * - Wait for <img> logos to load before print — thermal jobs often miss remote logos otherwise.
 * - Never close the print window within a few hundred ms — that cancels thermal print jobs.
 */

function whenDocumentImagesReady(doc: Document, timeoutMs = 5000): Promise<void> {
  const imgs = Array.from(doc.images ?? [])
  if (!imgs.length) return Promise.resolve()

  return new Promise(resolve => {
    let pending = 0
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const timer = window.setTimeout(finish, timeoutMs)

    const onOne = () => {
      pending -= 1
      if (pending <= 0) {
        window.clearTimeout(timer)
        finish()
      }
    }

    for (const img of imgs) {
      if (img.complete && img.naturalHeight > 0) continue
      pending += 1
      img.addEventListener('load', onOne, { once: true })
      img.addEventListener('error', onOne, { once: true })
    }

    if (pending <= 0) {
      window.clearTimeout(timer)
      finish()
    }
  })
}

function schedulePrint(win: Window, closeAfter: boolean) {
  let closed = false
  const close = () => {
    if (!closeAfter || closed) return
    closed = true
    try { win.close() } catch { /* ignore */ }
  }

  try {
    win.addEventListener('afterprint', close)
  } catch { /* ignore */ }

  const runPrint = () => {
    try {
      win.focus()
      win.print()
    } catch { /* ignore */ }
    // Fallback only — early close cancels Windows thermal spoolers
    if (closeAfter) setTimeout(close, 60_000)
  }

  const doc = win.document
  void whenDocumentImagesReady(doc).then(() => {
    // One more frame so layout/paint settles with the logo
    requestAnimationFrame(() => setTimeout(runPrint, 50))
  })
}

function printViaIframe(html: string): boolean {
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document
    const cw = iframe.contentWindow
    if (!doc || !cw) {
      iframe.remove()
      return false
    }

    doc.open()
    doc.write(html)
    doc.close()

    let removed = false
    const cleanup = () => {
      if (removed) return
      removed = true
      setTimeout(() => {
        try { iframe.remove() } catch { /* ignore */ }
      }, 500)
    }

    try {
      cw.addEventListener('afterprint', cleanup)
    } catch { /* ignore */ }

    void whenDocumentImagesReady(doc).then(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            cw.focus()
            cw.print()
          } catch { /* ignore */ }
          setTimeout(cleanup, 60_000)
        }, 50)
      })
    })

    return true
  } catch {
    return false
  }
}

export function openReceiptPrintWindow(loadingHtml = 'Preparing receipt…'): Window | null {
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return null
  try {
    win.document.open()
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt</title></head>` +
      `<body style="font-family:system-ui,sans-serif;padding:24px;color:#334155"><p>${loadingHtml}</p></body></html>`,
    )
    win.document.close()
  } catch { /* ignore */ }
  return win
}

export function printHtmlDocument(
  html: string,
  opts?: {
    targetWindow?: Window | null
    popupFeatures?: string
    /** Shown only when popup is blocked AND iframe print also fails */
    alertOnBlock?: string
  },
): boolean {
  const pre = opts?.targetWindow && !opts.targetWindow.closed ? opts.targetWindow : null
  let win = pre
  let openedHere = false

  if (!win) {
    win = window.open('', '_blank', opts?.popupFeatures ?? 'width=400,height=600')
    openedHere = !!win && !win.closed
  }

  if (win && !win.closed) {
    try {
      win.document.open()
      win.document.write(html)
      win.document.close()
      schedulePrint(win, true)
      return true
    } catch {
      if (openedHere) {
        try { win.close() } catch { /* ignore */ }
      }
    }
  }

  // Works after await (popup may be blocked or closed during checkout)
  if (printViaIframe(html)) return true

  if (opts?.alertOnBlock) alert(opts.alertOnBlock)
  return false
}

/**
 * Fetch a logo/image and return a data URL so thermal print does not depend on
 * remote image load timing / desktop webview network quirks.
 */
export async function embedImageAsDataUrl(src?: string | null, timeoutMs = 4000): Promise<string | null> {
  const raw = String(src ?? '').trim()
  if (!raw) return null
  if (raw.startsWith('data:')) return raw

  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(raw, { signal: ctrl.signal, mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    window.clearTimeout(timer)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
