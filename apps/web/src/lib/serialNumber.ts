/** Unit identity: phone IMEI (15 digits) or general serial (laptops, PCs, etc.). Both are first-class. */

export const SERIAL_MIN_LEN = 5
export const SERIAL_MAX_LEN = 64

/** Classic GSMA IMEI — still accepted as a serial value. */
export function isClassicImei(value: string): boolean {
  return /^\d{15}$/.test(value.trim())
}

export function normalizeSerial(value: string): string {
  return value.trim().toUpperCase()
}

/** Accept 15-digit IMEI or alphanumeric serial (letters, digits, hyphen). */
export function isValidUnitSerial(value: string): boolean {
  const v = normalizeSerial(value)
  if (!v) return false
  if (isClassicImei(v)) return true
  if (v.length < SERIAL_MIN_LEN || v.length > SERIAL_MAX_LEN) return false
  return /^[A-Z0-9][A-Z0-9\-]*$/i.test(v)
}

export function serialValidationMessage(value: string): string | null {
  const raw = value.trim()
  if (!raw) return 'Serial number or IMEI is required'
  if (isValidUnitSerial(raw)) return null
  if (/^\d+$/.test(raw) && raw.length !== 15) {
    return 'Phone IMEI = exactly 15 digits. Laptop/PC serial = 5–64 characters (letters/numbers).'
  }
  return 'Enter a Serial Number (5–64 chars) or a 15-digit IMEI — both are supported'
}

export function serialFieldLabel(short = false): string {
  return short ? 'Serial / IMEI' : 'Serial Number or IMEI'
}

export function serialFieldHint(): string {
  return 'Both work: Serial Number (laptops/PCs) or 15-digit IMEI (phones)'
}
