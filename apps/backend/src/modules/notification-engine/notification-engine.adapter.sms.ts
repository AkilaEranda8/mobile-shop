import { sendManualSms } from '../sms/sms.service'
import type { ChannelDispatchResult } from './notification-engine.types'

export async function dispatchSmsText(
  tenantId: string,
  phone: string,
  message: string,
  branchId?: string,
  customerName?: string,
): Promise<ChannelDispatchResult> {
  try {
    const data = await sendManualSms(tenantId, phone, message, branchId, customerName)
    return { channel: 'sms', ok: true, messageId: data.messageId }
  } catch (e: any) {
    return { channel: 'sms', ok: false, error: e?.message ?? 'sms send failed' }
  }
}
