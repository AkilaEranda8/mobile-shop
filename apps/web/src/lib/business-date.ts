/** Today's date in Asia/Colombo (YYYY-MM-DD) */
export function businessToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Current Colombo date-time for `<input type="datetime-local" max=…>` (no future picks). */
export function datetimeLocalMaxNow(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Clamp a datetime-local value so it is never after "now" (Colombo). */
export function clampDatetimeLocalToNow(value: string): string {
  if (!value) return value
  const max = datetimeLocalMaxNow()
  return value > max ? max : value
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
