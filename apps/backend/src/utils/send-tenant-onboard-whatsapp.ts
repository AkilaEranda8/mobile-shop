import { whatsappService } from '../modules/whatsapp/whatsapp.service'
import { buildTenantOnboardShareMessage } from './tenant-onboard-message'

export type SendOnboardWhatsAppInput = {
  phone: string
  shopName: string
  ownerName: string
  email: string
  password: string
  plan: string
  subdomain: string
}

export async function sendTenantOnboardWhatsApp(
  billingTenantId: string,
  input: SendOnboardWhatsAppInput,
): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  try {
    const status = await whatsappService.getStatus(billingTenantId)
    if (status.status !== 'connected') {
      return { sent: false, error: 'Platform WhatsApp is not connected. Connect it in Admin → WhatsApp.' }
    }

    const message = buildTenantOnboardShareMessage({
      shopName: input.shopName,
      ownerName: input.ownerName,
      email: input.email,
      password: input.password,
      plan: input.plan,
      subdomain: input.subdomain,
      phone: input.phone,
    })

    const result = await whatsappService.sendMessage(billingTenantId, {
      phone: input.phone,
      message,
      customerName: input.ownerName,
      type: 'custom',
      referenceId: `onboard-${input.subdomain}`,
    })

    return { sent: true, messageId: result.messageId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'WhatsApp send failed'
    return { sent: false, error: msg }
  }
}
