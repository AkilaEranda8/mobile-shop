import { prisma } from '../../config/database'
import { sendMail } from '../../utils/mailer'
import { env } from '../../config/env'

export async function notifyTenantUser(opts: {
  tenantId: string
  userId: string
  type: 'SUPPORT_TICKET' | 'SUPPORT_CHAT' | 'CUSTOMER_SERVICE_TICKET'
  title: string
  message: string
  link?: string
  relatedId?: string
  emailTo?: string | null
}) {
  await prisma.userNotification.create({
    data: {
      tenantId: opts.tenantId,
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
      relatedId: opts.relatedId ?? null,
    },
  })

  if (opts.emailTo && env.SMTP_USER && env.SMTP_PASSWORD) {
    try {
      await sendMail(
        opts.emailTo,
        opts.title,
        `<p>${opts.message}</p>${opts.link ? `<p><a href="${opts.link}">Open in Hexalyte</a></p>` : ''}`,
      )
    } catch {
      /* SMTP optional */
    }
  }
}

export async function notifySupportInbox(subject: string, html: string) {
  const to = env.SUPPORT_NOTIFY_EMAIL
  if (!to || !env.SMTP_USER || !env.SMTP_PASSWORD) return
  try {
    await sendMail(to, subject, html)
  } catch {
    /* ignore */
  }
}
