/** Business-day boundaries for Sri Lanka (Asia/Colombo, UTC+5:30) */
export function businessDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+05:30`)
  const end = new Date(`${dateStr}T23:59:59.999+05:30`)
  return { start, end }
}

export function businessDateFromInstant(at: Date = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Accept YYYY-MM-DD or fall back to today's Colombo business date */
export function normalizeBusinessDate(dateStr?: string | null): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  return businessDateFromInstant()
}

export function businessDateDb(dateStr: string) {
  return new Date(`${dateStr}T00:00:00+05:30`)
}

export function previousBusinessDate(dateStr: string): string {
  const d = businessDateDb(dateStr)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}
