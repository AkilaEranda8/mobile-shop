/** Today's date in Asia/Colombo (YYYY-MM-DD) */
export function businessToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Shift a Colombo business date by N days (negative = past) */
export function shiftBusinessDate(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00+05:30`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Period start date for N-day window ending on `toDate` (inclusive) */
export function businessPeriodFrom(days: number, toDate?: string): string {
  const end = toDate ?? businessToday()
  return shiftBusinessDate(end, -(days - 1))
}

/** First day of the month for a Colombo business date (YYYY-MM-01) */
export function businessMonthStart(toDate?: string): string {
  const d = toDate ?? businessToday()
  return `${d.slice(0, 7)}-01`
}

/** Format chart label from YYYY-MM-DD without UTC shift */
export function formatBusinessDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+05:30`)
  return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' })
}
