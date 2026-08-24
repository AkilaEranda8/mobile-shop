export const SMS_TEMPLATE_VARS = [
  '{{customerName}}',
  '{{invoiceNumber}}',
  '{{ticketNumber}}',
  '{{referenceId}}',
  '{{totalAmount}}',
  '{{paidAmount}}',
  '{{dueAmount}}',
  '{{shopName}}',
  '{{message}}',
] as const

export const DEFAULT_SMS_SALE_BODY =
  'Dear {{customerName}}, sale {{invoiceNumber}} complete. Total LKR {{totalAmount}}, paid LKR {{paidAmount}}, balance LKR {{dueAmount}}. Thank you — {{shopName}}'

export const DEFAULT_SMS_REPAIR_BODY =
  'Dear {{customerName}}, repair {{ticketNumber}} complete. Total LKR {{totalAmount}}, paid LKR {{paidAmount}}, balance LKR {{dueAmount}}. Thank you — {{shopName}}'

export const DEFAULT_SMS_HP_REMINDER_BODY =
  'Dear {{customerName}}, reminder: {{referenceId}} outstanding LKR {{dueAmount}}. Please pay at your earliest. — {{shopName}}'

export const DEFAULT_SMS_DELIVERY_BODY =
  'Dear {{customerName}}, your order {{referenceId}} update: {{message}}. — {{shopName}}'

/** @deprecated use DEFAULT_SMS_SALE_BODY */
export const DEFAULT_SMS_SALE_CREDIT_BODY = DEFAULT_SMS_SALE_BODY
/** @deprecated use DEFAULT_SMS_REPAIR_BODY */
export const DEFAULT_SMS_REPAIR_CREDIT_BODY = DEFAULT_SMS_REPAIR_BODY

export type SmsTemplateVars = Record<string, string | number>

export function renderSmsTemplate(body: string, vars: SmsTemplateVars): string {
  let out = body
  for (const [key, value] of Object.entries(vars)) {
    const token = `{{${key}}}`
    out = out.split(token).join(String(value ?? ''))
  }
  return out.replace(/\{\{[a-zA-Z]+\}\}/g, '').replace(/\s+/g, ' ').trim()
}

export function formatLkr(amount: number): string {
  return (Math.round(Math.max(0, amount) * 100) / 100).toFixed(2)
}

export function smsPreview(body: string, max = 160): string {
  const compact = body.replace(/\s+/g, ' ').trim()
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`
}

export function smsSegmentCount(body: string): number {
  const len = body.length
  if (len <= 160) return 1
  return Math.ceil(len / 153)
}
