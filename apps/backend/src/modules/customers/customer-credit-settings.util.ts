export type CustomerCreditChannels = {
  sms: boolean
  whatsapp: boolean
}

export type CustomerCreditReminderSettings = {
  enabled: boolean
  minDaysOverdue: number
  cooldownDays: number
  channels: CustomerCreditChannels
}

export type CustomerCreditWhatsAppTemplate = {
  enabled: boolean
  body: string
}

export type CustomerCreditSettings = {
  reminder: CustomerCreditReminderSettings
  whatsappTemplate: CustomerCreditWhatsAppTemplate
}

export const DEFAULT_CREDIT_WHATSAPP_BODY =
  'Dear {{customerName}}, reminder: outstanding LKR {{dueAmount}} ({{invoiceCount}} invoice(s), oldest {{oldestDueDate}}). Please settle soon. Thank you — {{shopName}}'

export const DEFAULT_CUSTOMER_CREDIT_SETTINGS: CustomerCreditSettings = {
  reminder: {
    enabled: false,
    minDaysOverdue: 3,
    cooldownDays: 3,
    channels: { sms: true, whatsapp: true },
  },
  whatsappTemplate: {
    enabled: true,
    body: DEFAULT_CREDIT_WHATSAPP_BODY,
  },
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function asBool(raw: unknown, fallback: boolean): boolean {
  if (raw === true || raw === 'true') return true
  if (raw === false || raw === 'false') return false
  return fallback
}

export function normalizeCustomerCreditSettings(
  raw: unknown,
  prev?: Partial<CustomerCreditSettings>,
): CustomerCreditSettings {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const previous: CustomerCreditSettings = {
    reminder: {
      ...DEFAULT_CUSTOMER_CREDIT_SETTINGS.reminder,
      ...prev?.reminder,
      channels: {
        ...DEFAULT_CUSTOMER_CREDIT_SETTINGS.reminder.channels,
        ...prev?.reminder?.channels,
      },
    },
    whatsappTemplate: {
      ...DEFAULT_CUSTOMER_CREDIT_SETTINGS.whatsappTemplate,
      ...prev?.whatsappTemplate,
    },
  }

  const reminderRaw =
    input.reminder && typeof input.reminder === 'object'
      ? (input.reminder as Record<string, unknown>)
      : {}
  const channelsRaw =
    reminderRaw.channels && typeof reminderRaw.channels === 'object'
      ? (reminderRaw.channels as Record<string, unknown>)
      : {}
  const waRaw =
    input.whatsappTemplate && typeof input.whatsappTemplate === 'object'
      ? (input.whatsappTemplate as Record<string, unknown>)
      : {}

  const bodyRaw = waRaw.body != null ? String(waRaw.body) : previous.whatsappTemplate.body

  return {
    reminder: {
      enabled: asBool(reminderRaw.enabled, previous.reminder.enabled),
      minDaysOverdue: clampInt(reminderRaw.minDaysOverdue, previous.reminder.minDaysOverdue, 0, 365),
      cooldownDays: clampInt(reminderRaw.cooldownDays, previous.reminder.cooldownDays, 0, 90),
      channels: {
        sms: asBool(channelsRaw.sms, previous.reminder.channels.sms),
        whatsapp: asBool(channelsRaw.whatsapp, previous.reminder.channels.whatsapp),
      },
    },
    whatsappTemplate: {
      enabled: asBool(waRaw.enabled, previous.whatsappTemplate.enabled),
      body: bodyRaw.trim().slice(0, 1000) || DEFAULT_CREDIT_WHATSAPP_BODY,
    },
  }
}
