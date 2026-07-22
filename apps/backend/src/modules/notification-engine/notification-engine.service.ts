import { whatsappService } from '../whatsapp/whatsapp.service'
import { dispatchInAppNotification } from './notification-engine.adapter.in-app'
import {
  dispatchWhatsAppSaleInvoice,
  dispatchWhatsAppText,
} from './notification-engine.adapter.whatsapp'
import type {
  ChannelDispatchResult,
  DispatchNotificationInput,
  DispatchNotificationResult,
} from './notification-engine.types'

/**
 * Central dispatch: route event → channel adapters.
 * Adapters own channel-specific I/O; this function does not render templates.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput,
): Promise<DispatchNotificationResult> {
  const results: ChannelDispatchResult[] = []

  for (const channel of input.channels) {
    if (channel === 'whatsapp') {
      if (input.eventType === 'SALE_INVOICE' && input.saleInvoice) {
        results.push(await dispatchWhatsAppSaleInvoice(input.tenantId, input.saleInvoice))
        continue
      }
      const phone = input.recipient.phone?.trim()
      const message = input.message?.trim()
      if (!phone || !message) {
        results.push({
          channel: 'whatsapp',
          ok: false,
          error: 'WhatsApp requires recipient.phone and message',
        })
        continue
      }
      results.push(await dispatchWhatsAppText(input.tenantId, phone, message))
      continue
    }

    if (channel === 'in_app') {
      const userId = input.recipient.userId?.trim()
      if (!userId) {
        results.push({ channel: 'in_app', ok: false, error: 'in_app requires recipient.userId' })
        continue
      }
      results.push(
        await dispatchInAppNotification(
          {
            tenantId: input.tenantId,
            userId,
            type: input.inAppType ?? 'SYSTEM',
            title: input.title ?? 'Notification',
            message: input.message ?? '',
            link: input.link,
            relatedId: input.relatedId,
          },
          input.db,
        ),
      )
      continue
    }

    results.push({ channel, ok: false, error: `Unknown channel: ${channel}` })
  }

  return { eventType: input.eventType, results }
}

/** Convenience: delivery tracking WhatsApp text (errors returned, not thrown). */
export async function notifyDeliveryDispatched(opts: {
  tenantId: string
  phone: string
  message: string
}): Promise<ChannelDispatchResult> {
  const { results } = await dispatchNotification({
    tenantId: opts.tenantId,
    channels: ['whatsapp'],
    eventType: 'DELIVERY_STATUS',
    recipient: { phone: opts.phone },
    message: opts.message,
  })
  return results[0] ?? { channel: 'whatsapp', ok: false, error: 'no result' }
}

/** Convenience: sale invoice WhatsApp — preserves sendInvoice return / errors. */
export async function notifySaleInvoice(
  tenantId: string,
  input: NonNullable<DispatchNotificationInput['saleInvoice']>,
  branchId?: string,
) {
  return whatsappService.sendInvoice(tenantId, input, branchId)
}
