import { whatsappService } from '../whatsapp/whatsapp.service'
import type { SendInvoiceInput } from '../whatsapp/whatsapp.schema'
import type { ChannelDispatchResult } from './notification-engine.types'

export async function dispatchWhatsAppText(
  tenantId: string,
  phone: string,
  message: string,
): Promise<ChannelDispatchResult> {
  try {
    await whatsappService.sendTextMessage(tenantId, phone, message)
    return { channel: 'whatsapp', ok: true }
  } catch (e: any) {
    return { channel: 'whatsapp', ok: false, error: e?.message ?? 'whatsapp text failed' }
  }
}

export async function dispatchWhatsAppSaleInvoice(
  tenantId: string,
  input: SendInvoiceInput,
): Promise<ChannelDispatchResult> {
  try {
    const data = await whatsappService.sendInvoice(tenantId, input)
    return {
      channel: 'whatsapp',
      ok: true,
      messageId: typeof data === 'object' && data && 'messageId' in data
        ? String((data as any).messageId)
        : undefined,
    }
  } catch (e: any) {
    return { channel: 'whatsapp', ok: false, error: e?.message ?? 'whatsapp invoice failed' }
  }
}
