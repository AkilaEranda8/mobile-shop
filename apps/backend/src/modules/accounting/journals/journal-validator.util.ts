import { AppError } from '../../../middleware/error.middleware'

export type JournalDraftLine = {
  accountId: string
  debit: number
  credit: number
  description?: string
  taxCodeId?: string
  customerId?: string
  supplierId?: string
  metadata?: Record<string, unknown>
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function assertBalanced(lines: JournalDraftLine[]) {
  if (!lines.length) throw new AppError('Journal has no lines', 400)
  let dr = 0
  let cr = 0
  for (const l of lines) {
    const d = Number(l.debit ?? 0)
    const c = Number(l.credit ?? 0)
    if (!Number.isFinite(d) || d < 0) throw new AppError('Invalid debit amount', 400)
    if (!Number.isFinite(c) || c < 0) throw new AppError('Invalid credit amount', 400)
    if (d > 0 && c > 0) throw new AppError('A journal line cannot have both debit and credit', 400)
    if (d === 0 && c === 0) throw new AppError('A journal line must have debit or credit', 400)
    dr += d
    cr += c
  }
  dr = round2(dr)
  cr = round2(cr)
  if (dr !== cr) throw new AppError(`Journal not balanced (debit ${dr} != credit ${cr})`, 400)
  return { totalDebit: dr, totalCredit: cr }
}

