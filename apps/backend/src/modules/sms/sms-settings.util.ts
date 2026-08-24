import {
  DEFAULT_SMS_DELIVERY_BODY,
  DEFAULT_SMS_HP_REMINDER_BODY,
  DEFAULT_SMS_REPAIR_BODY,
  DEFAULT_SMS_SALE_BODY,
} from './sms-template.util'

export const SMS_PROVIDER_IDS = ['hexalyte', 'twilio', 'dialog', 'mobitel', 'hutch', 'generic'] as const
export type SmsProviderId = (typeof SMS_PROVIDER_IDS)[number]

export const SMS_EVENT_TYPES = ['sale', 'repair', 'hpReminder', 'delivery'] as const
export type SmsEventType = (typeof SMS_EVENT_TYPES)[number]

export type SmsMessageTemplate = {
  enabled: boolean
  body: string
}

export type SmsSettings = {
  enabled: boolean
  provider: SmsProviderId
  apiKey: string
  apiSecret: string
  senderId: string
  validatePhones: boolean
  storeFullBody: boolean
  templates: Record<SmsEventType, SmsMessageTemplate>
}

export type SmsSettingsView = SmsSettings & {
  hasApiSecret: boolean
}

const DEFAULT_TEMPLATES: Record<SmsEventType, SmsMessageTemplate> = {
  sale: { enabled: true, body: DEFAULT_SMS_SALE_BODY },
  repair: { enabled: true, body: DEFAULT_SMS_REPAIR_BODY },
  hpReminder: { enabled: true, body: DEFAULT_SMS_HP_REMINDER_BODY },
  delivery: { enabled: false, body: DEFAULT_SMS_DELIVERY_BODY },
}

const DEFAULTS: SmsSettings = {
  enabled: false,
  provider: 'dialog',
  apiKey: '',
  apiSecret: '',
  senderId: '',
  validatePhones: true,
  storeFullBody: false,
  templates: DEFAULT_TEMPLATES,
}

const SECRET_MASK = '********'

const LEGACY_TEMPLATE_KEYS: Record<string, SmsEventType> = {
  saleCredit: 'sale',
  repairCredit: 'repair',
  saleNew: 'sale',
  repairComplete: 'repair',
}

function pickProvider(raw: unknown): SmsProviderId {
  const p = String(raw ?? '').toLowerCase()
  if (p === 'hexalyte' || p === 'smsgateway' || p === 'sms gateway' || p === 'hexalyte sms') return 'hexalyte'
  if (p === 'twilio') return 'twilio'
  if (p === 'mobitel') return 'mobitel'
  if (p === 'hutch') return 'hutch'
  if (p === 'generic') return 'generic'
  if (p === 'dialog' || p === 'dialog axiata') return 'dialog'
  return 'dialog'
}

function normalizeTemplate(
  raw: unknown,
  prev: SmsMessageTemplate,
  defaultBody: string,
): SmsMessageTemplate {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const bodyRaw = o.body != null ? String(o.body) : prev.body
  return {
    enabled: o.enabled === false || o.enabled === 'false'
      ? false
      : o.enabled === true || o.enabled === 'true'
        ? true
        : prev.enabled,
    body: bodyRaw.trim().slice(0, 500) || defaultBody,
  }
}

function readTemplateRaw(
  templatesRaw: Record<string, unknown>,
  key: SmsEventType,
  prevTemplates: Record<SmsEventType, SmsMessageTemplate>,
): unknown {
  if (templatesRaw[key] != null) return templatesRaw[key]
  for (const [legacy, mapped] of Object.entries(LEGACY_TEMPLATE_KEYS)) {
    if (mapped === key && templatesRaw[legacy] != null) return templatesRaw[legacy]
  }
  return undefined
}

export function normalizeSmsSettings(
  raw: unknown,
  prev?: Partial<SmsSettings>,
): SmsSettings {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const previous = { ...DEFAULTS, ...prev, templates: { ...DEFAULT_TEMPLATES, ...prev?.templates } }
  const templatesRaw = input.templates && typeof input.templates === 'object'
    ? (input.templates as Record<string, unknown>)
    : {}

  let apiSecret = String(input.apiSecret ?? '').trim()
  if (!apiSecret || apiSecret === SECRET_MASK) {
    apiSecret = previous.apiSecret ?? ''
  }

  const templates = {} as Record<SmsEventType, SmsMessageTemplate>
  for (const key of SMS_EVENT_TYPES) {
    templates[key] = normalizeTemplate(
      readTemplateRaw(templatesRaw, key, previous.templates),
      previous.templates[key],
      DEFAULT_TEMPLATES[key].body,
    )
  }

  return {
    enabled: input.enabled === true || input.enabled === 'true',
    provider: pickProvider(input.provider ?? previous.provider),
    apiKey: String(input.apiKey ?? previous.apiKey ?? '').trim(),
    apiSecret,
    senderId: String(input.senderId ?? previous.senderId ?? '').trim(),
    validatePhones: input.validatePhones === false || input.validatePhones === 'false'
      ? false
      : input.validatePhones === true || input.validatePhones === 'true'
        ? true
        : previous.validatePhones,
    storeFullBody: input.storeFullBody === true || input.storeFullBody === 'true',
    templates,
  }
}

export function maskSmsSettingsForClient(settings: SmsSettings): SmsSettingsView {
  return {
    ...settings,
    apiSecret: settings.apiSecret ? SECRET_MASK : '',
    hasApiSecret: !!settings.apiSecret,
  }
}

export function normalizePhoneForSms(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('94') && digits.length >= 11) return digits
  if (digits.startsWith('0') && digits.length >= 10) return `94${digits.slice(1)}`
  if (digits.length >= 9) return `94${digits}`
  return digits
}

export function smsEventLogType(eventType: SmsEventType | string): string {
  const map: Record<string, string> = {
    sale: 'SALE',
    repair: 'REPAIR',
    hpReminder: 'HP_REMINDER',
    delivery: 'DELIVERY',
    test: 'TEST',
    manual: 'MANUAL',
  }
  return map[eventType] ?? String(eventType).toUpperCase()
}
