import { api } from './api'

export type SmsProviderId = 'hexalyte' | 'twilio' | 'dialog' | 'mobitel' | 'hutch' | 'generic'
export type SmsEventType = 'sale' | 'repair' | 'hpReminder' | 'delivery'
export type SmsGatewayStatus = 'connected' | 'disabled' | 'not_configured'

export type SmsMessageTemplate = {
  enabled: boolean
  body: string
}

export type SmsConfig = {
  enabled: boolean
  provider: SmsProviderId
  apiKey: string
  apiSecret: string
  senderId: string
  hasApiSecret?: boolean
  validatePhones: boolean
  storeFullBody: boolean
  templates: Record<SmsEventType, SmsMessageTemplate>
}

export type SmsStatusInfo = {
  enabled: boolean
  provider: SmsProviderId
  senderId: string
  configured: boolean
  status: SmsGatewayStatus
  totalSent: number
  lastSentAt: string | null
}

export type SmsStats = {
  totalSent: number
  sent: number
  failed: number
  deliveryRate: number
  saleMessages: number
  repairMessages: number
  hpMessages: number
  monthlyData: { month: string; sent: number; failed: number }[]
}

export type SmsHistoryItem = {
  id: string
  referenceId: string
  customerName: string
  phone: string
  eventType: string
  preview: string
  status: 'sent' | 'failed'
  provider: string
  amount: number
  errorMessage: string
  sentAt: string
}

export type SmsRecentMessage = {
  id: string
  to: string
  customerName: string
  eventType: string
  preview: string
  status: 'sent' | 'failed'
  timestamp: string
}

export const DEFAULT_SMS_SALE_BODY =
  'Dear {{customerName}}, sale {{invoiceNumber}} complete. Total LKR {{totalAmount}}, paid LKR {{paidAmount}}, balance LKR {{dueAmount}}. Thank you — {{shopName}}'

export const DEFAULT_SMS_REPAIR_BODY =
  'Dear {{customerName}}, repair {{ticketNumber}} complete. Total LKR {{totalAmount}}, paid LKR {{paidAmount}}, balance LKR {{dueAmount}}. Thank you — {{shopName}}'

export const DEFAULT_SMS_HP_REMINDER_BODY =
  'Dear {{customerName}}, reminder: {{referenceId}} outstanding LKR {{dueAmount}}. Please pay at your earliest. — {{shopName}}'

export const DEFAULT_SMS_DELIVERY_BODY =
  'Dear {{customerName}}, your order {{referenceId}} update: {{message}}. — {{shopName}}'

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

export const SMS_EVENT_META: Record<SmsEventType, { title: string; titleSi: string; description: string; defaultBody: string }> = {
  sale: {
    title: 'New sale',
    titleSi: 'නව විකිණීම',
    description: 'Sent from POS after sale when you tap Send SMS (customer phone required)',
    defaultBody: DEFAULT_SMS_SALE_BODY,
  },
  repair: {
    title: 'Repair complete',
    titleSi: 'Repair අවසන්',
    description: 'Sent from the repair ticket when you tap Send SMS (customer phone required)',
    defaultBody: DEFAULT_SMS_REPAIR_BODY,
  },
  hpReminder: {
    title: 'HP reminder',
    titleSi: 'HP reminder',
    description: 'Hire Purchase payment reminders (SMS channel)',
    defaultBody: DEFAULT_SMS_HP_REMINDER_BODY,
  },
  delivery: {
    title: 'Delivery update',
    titleSi: 'Delivery update',
    description: 'Delivery status notifications to customers',
    defaultBody: DEFAULT_SMS_DELIVERY_BODY,
  },
}

export const DEFAULT_SMS_CONFIG: SmsConfig = {
  enabled: false,
  provider: 'hexalyte',
  apiKey: '',
  apiSecret: '',
  senderId: '',
  hasApiSecret: false,
  validatePhones: true,
  storeFullBody: false,
  templates: {
    sale: { enabled: true, body: DEFAULT_SMS_SALE_BODY },
    repair: { enabled: true, body: DEFAULT_SMS_REPAIR_BODY },
    hpReminder: { enabled: true, body: DEFAULT_SMS_HP_REMINDER_BODY },
    delivery: { enabled: false, body: DEFAULT_SMS_DELIVERY_BODY },
  },
}

export const SMS_PROVIDER_OPTIONS: { id: SmsProviderId; label: string; hint: string }[] = [
  {
    id: 'hexalyte',
    label: 'Hexalyte SMS Gateway',
    hint: 'From smsgateway.hexalyte.com → API credentials: User ID + API Key + approved Sender ID (mask)',
  },
  { id: 'dialog', label: 'Dialog Axiata (ESMS)', hint: 'Paste URL Message Key (esmsqk) as API Key — password optional. Or use portal username + password. Sender ID = approved mask.' },
  { id: 'mobitel', label: 'Mobitel Bulk SMS', hint: 'Username + Password from Mobitel bulk SMS' },
  { id: 'hutch', label: 'Hutch SMS', hint: 'API Key + Secret from Hutch business SMS' },
  { id: 'twilio', label: 'Twilio', hint: 'Account SID + Auth Token' },
  { id: 'generic', label: 'Generic HTTP', hint: 'Put provider URL in Sender ID field' },
]

export const SMS_EVENT_LABELS: Record<string, string> = {
  SALE: 'Sale',
  REPAIR: 'Repair',
  HP_REMINDER: 'HP Reminder',
  DELIVERY: 'Delivery',
  TEST: 'Test',
  MANUAL: 'Manual',
}

export function previewSmsTemplate(body: string): string {
  return body
    .replace(/\{\{customerName\}\}/g, 'Kamal')
    .replace(/\{\{invoiceNumber\}\}/g, 'INV-00123')
    .replace(/\{\{ticketNumber\}\}/g, 'RPR-00456')
    .replace(/\{\{referenceId\}\}/g, 'HP-00789')
    .replace(/\{\{totalAmount\}\}/g, '25,000.00')
    .replace(/\{\{paidAmount\}\}/g, '5,000.00')
    .replace(/\{\{dueAmount\}\}/g, '20,000.00')
    .replace(/\{\{shopName\}\}/g, 'My Mobile Shop')
    .replace(/\{\{message\}\}/g, 'Out for delivery')
}

export function smsSegmentCount(body: string): number {
  const len = body.length
  if (len <= 160) return 1
  return Math.ceil(len / 153)
}

function mergeConfig(data: Partial<SmsConfig> | null | undefined): SmsConfig {
  const templates = { ...DEFAULT_SMS_CONFIG.templates }
  for (const key of Object.keys(templates) as SmsEventType[]) {
    const raw = data?.templates?.[key]
    const legacy = key === 'sale'
      ? (data?.templates as any)?.saleCredit
      : key === 'repair'
        ? (data?.templates as any)?.repairCredit
        : undefined
    templates[key] = {
      ...templates[key],
      ...(legacy ?? {}),
      ...(raw ?? {}),
    }
  }
  return {
    ...DEFAULT_SMS_CONFIG,
    ...data,
    templates,
  }
}

const BASE = '/sms'

export const smsApi = {
  getStatus:         () => api.get<{ data: SmsStatusInfo }>(`${BASE}/status`),
  getConfig:         () => api.get<{ data: SmsConfig }>(`${BASE}/config`),
  updateConfig:      (body: Partial<SmsConfig>) => api.put<{ data: SmsConfig }>(`${BASE}/config`, body),
  testConnection:    (phone: string, message?: string) =>
    api.post<{ data: { to: string; messageId?: string; segments: number } }>(`${BASE}/test-message`, { phone, message }),
  sendMessage:       (body: { phone: string; message: string; customerName?: string }) =>
    api.post<{ data: { to: string; messageId?: string; segments: number } }>(`${BASE}/send-message`, body),
  sendSaleSms:       (body: { saleId: string; phone?: string }) =>
    api.post<{ data: { to: string; messageId?: string; segments: number } }>(`${BASE}/send-sale`, body),
  sendRepairSms:     (body: { repairId: string; phone?: string }) =>
    api.post<{ data: { to: string; messageId?: string; segments: number } }>(`${BASE}/send-repair`, body),
  getStats:          () => api.get<{ data: SmsStats }>(`${BASE}/stats`),
  getHistory:        () => api.get<{ data: SmsHistoryItem[] }>(`${BASE}/history`),
  getRecentMessages: () => api.get<{ data: SmsRecentMessage[] }>(`${BASE}/messages/recent`),
}

export async function fetchSmsConfig(): Promise<SmsConfig> {
  const res: any = await smsApi.getConfig()
  return mergeConfig(res?.data ?? res)
}

export async function saveSmsConfig(patch: Partial<SmsConfig>): Promise<SmsConfig> {
  const res: any = await smsApi.updateConfig(patch)
  return mergeConfig(res?.data ?? res)
}

/** @deprecated use fetchSmsConfig */
export async function fetchSmsSettings(): Promise<SmsConfig> {
  return fetchSmsConfig()
}

/** @deprecated use saveSmsConfig */
export async function pushSmsSettings(patch: Partial<SmsConfig>): Promise<SmsConfig> {
  return saveSmsConfig(patch)
}

/** @deprecated use smsApi.testConnection */
export async function sendSmsTest(phone: string, message?: string): Promise<void> {
  await smsApi.testConnection(phone, message)
}

export type SmsSettings = SmsConfig
export const DEFAULT_SMS_SETTINGS = DEFAULT_SMS_CONFIG
export const DEFAULT_SMS_SALE_CREDIT_BODY = DEFAULT_SMS_SALE_BODY
export const DEFAULT_SMS_REPAIR_CREDIT_BODY = DEFAULT_SMS_REPAIR_BODY
