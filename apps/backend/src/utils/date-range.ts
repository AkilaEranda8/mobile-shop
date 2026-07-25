/** Business-day boundaries for Sri Lanka (Asia/Colombo, UTC+5:30) */
export function businessDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+05:30`)
  const end = new Date(`${dateStr}T23:59:59.999+05:30`)
  return { start, end }
}

/** Noon Colombo on a calendar day — used when backdating a sale into that business day. */
export function businessDayNoon(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid business date: ${dateStr}`)
  }
  return new Date(`${dateStr}T12:00:00+05:30`)
}

export function businessDateFromInstant(at: Date = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/**
 * Optional payment timestamp from API body.
 * Accepts YYYY-MM-DD (Colombo day start), datetime-local (YYYY-MM-DDTHH:mm), or ISO.
 * Empty / missing → undefined (caller uses "now").
 */
export function parseOptionalPaymentAt(raw: unknown): Date | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim()
  if (!s) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return businessDayRange(s).start
  }
  const local = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/)
  if (local) {
    const sec = local[4] ?? '00'
    return new Date(`${local[1]}T${local[2]}:${local[3]}:${sec}+05:30`)
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid payment date/time')
  }
  return d
}

/** Accept YYYY-MM-DD or fall back to today's Colombo business date */
export function normalizeBusinessDate(dateStr?: string | null): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  return businessDateFromInstant()
}

export function businessDateDb(dateStr: string) {
  // Use UTC midnight for the calendar day. Do NOT use +05:30 here:
  // Prisma/Postgres @db.Date casts timestamps in UTC, so Colombo midnight
  // (previous UTC evening) would match the previous calendar day and incorrectly
  // treat yesterday's CLOSED daily closing as "today" (403 on sales/repairs).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid business date: ${dateStr}`)
  }
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export function previousBusinessDate(dateStr: string): string {
  const d = businessDateDb(dateStr)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

export function monthStartBusinessDate(dateStr?: string | null): string {
  const d = normalizeBusinessDate(dateStr)
  return `${d.slice(0, 7)}-01`
}

/** Shift a Colombo business date by N days (negative = past) */
export function shiftBusinessDate(dateStr: string, deltaDays: number): string {
  const d = businessDateDb(dateStr)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

/** Map PG DATE_TRUNC / Date values to YYYY-MM-DD in Colombo */
export function businessDateKeyFromInstant(at: Date): string {
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

export function resolveQueryDateRange(opts: {
  from?: string | null
  to?: string | null
  days?: number
  defaultFrom?: 'month_start' | 'days'
}) {
  const toKey = normalizeBusinessDate(opts.to)
  let fromKey: string
  if (opts.from) {
    fromKey = normalizeBusinessDate(opts.from)
  } else if (opts.days && opts.days > 0) {
    fromKey = shiftBusinessDate(toKey, -(opts.days - 1))
  } else if (opts.defaultFrom === 'month_start') {
    fromKey = monthStartBusinessDate(toKey)
  } else {
    fromKey = shiftBusinessDate(toKey, -29)
  }
  const { start } = businessDayRange(fromKey)
  const { end } = businessDayRange(toKey)
  return { start, end, fromKey, toKey }
}

/** Inclusive list of Colombo business dates from fromKey through toKey */
export function listBusinessDays(fromKey: string, toKey: string): string[] {
  const start = normalizeBusinessDate(fromKey)
  const end = normalizeBusinessDate(toKey)
  const days: string[] = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    if (cur === end) break
    cur = shiftBusinessDate(cur, 1)
  }
  return days
}
