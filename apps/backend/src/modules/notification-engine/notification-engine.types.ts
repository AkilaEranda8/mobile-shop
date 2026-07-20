import type { Prisma, UserNotificationType } from '@prisma/client'
import type { SendInvoiceInput } from '../whatsapp/whatsapp.schema'

export type NotificationChannel = 'whatsapp' | 'in_app'

export type NotificationEventType =
  | 'SALE_INVOICE'
  | 'DELIVERY_STATUS'
  | 'FEATURE_SUGGESTION'
  | 'GENERIC_TEXT'
  | 'IN_APP'

export type NotificationRecipient = {
  phone?: string | null
  userId?: string | null
}

export type ChannelDispatchResult = {
  channel: NotificationChannel
  ok: boolean
  messageId?: string
  error?: string
}

export type DispatchNotificationInput = {
  tenantId: string
  channels: NotificationChannel[]
  eventType: NotificationEventType
  recipient: NotificationRecipient
  /** Plain text body for whatsapp text / in-app message */
  message?: string
  title?: string
  link?: string | null
  relatedId?: string | null
  inAppType?: UserNotificationType
  /** When set, routes to WhatsApp sendInvoice */
  saleInvoice?: SendInvoiceInput
  db?: Prisma.TransactionClient
}

export type DispatchNotificationResult = {
  eventType: NotificationEventType
  results: ChannelDispatchResult[]
}
