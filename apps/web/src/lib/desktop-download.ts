/** Public URL for the Windows desktop installer (served from `public/downloads`). */
export const DESKTOP_SETUP_FILENAME = 'Hexalyte-Setup.exe'
export const DESKTOP_DOWNLOAD_PATH = `/downloads/${DESKTOP_SETUP_FILENAME}`

export function getDesktopDownloadUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim()
  if (fromEnv) return fromEnv
  return DESKTOP_DOWNLOAD_PATH
}
