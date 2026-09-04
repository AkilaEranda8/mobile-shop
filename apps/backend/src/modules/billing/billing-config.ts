import { prisma } from '../../config/database'
import {
  DEFAULT_DUE_DAYS_AFTER_ISSUE,
  DEFAULT_GRACE_DAYS,
} from './billing-dates'

export type BillingBankSettings = {
  bankName: string
  accountName: string
  accountNumber: string
  branch: string
  swift: string
  instructions: string
}

export type BillingConfig = {
  graceDays: number
  dueDaysAfterIssue: number
  bank: BillingBankSettings
}

const DEFAULT_BANK: BillingBankSettings = {
  bankName: 'Commercial Bank',
  accountName: 'Akila Eranda Gankewela',
  accountNumber: '2000124779',
  branch: '',
  swift: 'CCEYLKLX',
  instructions: 'Please complete the bank transfer and upload your payment slip for verification.',
}

const KEYS = {
  graceDays: 'billing_grace_days',
  dueDays: 'billing_due_days_after_issue',
  bankName: 'billing_bank_name',
  accountName: 'billing_account_name',
  accountNumber: 'billing_account_number',
  branch: 'billing_branch',
  swift: 'billing_swift',
  instructions: 'billing_payment_instructions',
} as const

function parseIntSafe(v: string | undefined, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export async function getBillingConfig(): Promise<BillingConfig> {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { startsWith: 'billing_' } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value

  return {
    graceDays: parseIntSafe(map[KEYS.graceDays], DEFAULT_GRACE_DAYS),
    dueDaysAfterIssue: parseIntSafe(map[KEYS.dueDays], DEFAULT_DUE_DAYS_AFTER_ISSUE),
    bank: {
      bankName: map[KEYS.bankName] || DEFAULT_BANK.bankName,
      accountName: map[KEYS.accountName] || DEFAULT_BANK.accountName,
      accountNumber: map[KEYS.accountNumber] || DEFAULT_BANK.accountNumber,
      branch: map[KEYS.branch] || DEFAULT_BANK.branch,
      swift: map[KEYS.swift] || DEFAULT_BANK.swift,
      instructions: map[KEYS.instructions] || DEFAULT_BANK.instructions,
    },
  }
}

export async function upsertBillingConfig(input: {
  graceDays?: number
  dueDaysAfterIssue?: number
  bank?: Partial<BillingBankSettings>
}): Promise<BillingConfig> {
  const pairs: Array<[string, string]> = []
  if (input.graceDays != null) {
    pairs.push([KEYS.graceDays, String(Math.max(0, Math.floor(input.graceDays)))])
  }
  if (input.dueDaysAfterIssue != null) {
    pairs.push([KEYS.dueDays, String(Math.max(0, Math.floor(input.dueDaysAfterIssue)))])
  }
  if (input.bank) {
    const b = input.bank
    if (b.bankName != null) pairs.push([KEYS.bankName, b.bankName])
    if (b.accountName != null) pairs.push([KEYS.accountName, b.accountName])
    if (b.accountNumber != null) pairs.push([KEYS.accountNumber, b.accountNumber])
    if (b.branch != null) pairs.push([KEYS.branch, b.branch])
    if (b.swift != null) pairs.push([KEYS.swift, b.swift])
    if (b.instructions != null) pairs.push([KEYS.instructions, b.instructions])
  }

  for (const [key, value] of pairs) {
    await prisma.platformConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  }

  return getBillingConfig()
}
