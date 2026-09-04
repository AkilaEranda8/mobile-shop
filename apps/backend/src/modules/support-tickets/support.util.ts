import type { SupportTicketPriority } from '@prisma/client'

const SLA_HOURS: Record<SupportTicketPriority, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 8,
}

export function slaHoursFor(priority: SupportTicketPriority): number {
  return SLA_HOURS[priority] ?? 48
}

export function computeSlaDueAt(priority: SupportTicketPriority, from = new Date()): Date {
  return new Date(from.getTime() + slaHoursFor(priority) * 60 * 60 * 1000)
}

export function isSlaBreached(slaDueAt: Date, status: string, now = new Date()): boolean {
  if (status === 'RESOLVED' || status === 'CLOSED') return false
  return now.getTime() > slaDueAt.getTime()
}

export function ticketNumberFor(date = new Date(), seq: number): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `SR-${y}${m}${d}-${String(seq).padStart(4, '0')}`
}

export function customerSrNumberFor(date = new Date(), seq: number): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `CSR-${y}${m}${d}-${String(seq).padStart(4, '0')}`
}

export function sanitizeText(input: string, max = 8000): string {
  return String(input || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max)
}
