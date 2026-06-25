import path from 'path'
import fs from 'fs'
import pino from 'pino'
import { prisma } from '../../config/database'

const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR
  ?? path.join(process.cwd(), 'data', 'whatsapp-sessions')

export type QrSessionStatus =
  | 'disconnected'
  | 'qr_pending'
  | 'connecting'
  | 'connected'

export interface QrSessionState {
  status: QrSessionStatus
  qr?: string
  phoneNumber?: string
  displayName?: string
  lastChecked?: string
}

interface TenantRuntime {
  tenantId: string
  status: QrSessionStatus
  qr?: string
  phoneNumber?: string
  displayName?: string
  socket?: any
  starting?: boolean
}

const sessions = new Map<string, TenantRuntime>()

function sessionDir(tenantId: string) {
  return path.join(SESSIONS_DIR, tenantId)
}

function formatPhone(jid?: string | null): string | undefined {
  if (!jid) return undefined
  const digits = jid.split('@')[0]?.split(':')[0]?.replace(/\D/g, '')
  if (!digits) return undefined
  return `+${digits}`
}

function toJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

function getRuntime(tenantId: string): TenantRuntime {
  let rt = sessions.get(tenantId)
  if (!rt) {
    rt = { tenantId, status: 'disconnected' }
    sessions.set(tenantId, rt)
  }
  return rt
}

async function loadBaileys() {
  return import('@whiskeysockets/baileys')
}

async function persistConnected(tenantId: string, phoneNumber?: string, displayName?: string) {
  await prisma.whatsAppConfig.upsert({
    where:  { tenantId },
    create: {
      tenantId,
      connectionMode: 'qr',
      accessToken:    '',
      phoneNumberId:  '',
      wabaId:         '',
      verifyToken:    '',
      enabled:        true,
      status:         'connected',
      phoneNumber:    phoneNumber ?? null,
      displayName:    displayName ?? null,
      lastCheckedAt:  new Date(),
    },
    update: {
      connectionMode: 'qr',
      status:         'connected',
      phoneNumber:    phoneNumber ?? null,
      displayName:    displayName ?? null,
      enabled:        true,
      lastCheckedAt:  new Date(),
    },
  })
}

async function persistDisconnected(tenantId: string) {
  await prisma.whatsAppConfig.updateMany({
    where: { tenantId },
    data:  { status: 'disconnected', lastCheckedAt: new Date() },
  }).catch(() => {})
}

function clearAuthFiles(tenantId: string) {
  const dir = sessionDir(tenantId)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

async function bindSocket(tenantId: string, sock: any) {
  const rt = getRuntime(tenantId)
  rt.socket = sock

  const { DisconnectReason } = await loadBaileys()

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      rt.status = 'qr_pending'
      rt.qr = qr
    }

    if (connection === 'connecting') {
      rt.status = 'connecting'
      rt.qr = undefined
    }

    if (connection === 'open') {
      const jid: string | undefined = sock.user?.id
      rt.status = 'connected'
      rt.qr = undefined
      rt.phoneNumber = formatPhone(jid)
      rt.displayName = sock.user?.name ?? rt.phoneNumber
      await persistConnected(tenantId, rt.phoneNumber, rt.displayName)
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as any)?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut

      rt.socket = undefined
      rt.qr = undefined

      if (loggedOut) {
        rt.status = 'disconnected'
        clearAuthFiles(tenantId)
        await persistDisconnected(tenantId)
        return
      }

      // Network blip — try to restore if creds still on disk
      if (fs.existsSync(sessionDir(tenantId))) {
        rt.status = 'connecting'
        setTimeout(() => { startQrSession(tenantId, { force: false }).catch(() => {}) }, 3000)
      } else {
        rt.status = 'disconnected'
        await persistDisconnected(tenantId)
      }
    }
  })
}

export async function startQrSession(
  tenantId: string,
  opts: { force?: boolean } = {},
): Promise<QrSessionState> {
  const rt = getRuntime(tenantId)

  if (rt.status === 'connected' && rt.socket && !opts.force) {
    return getQrState(tenantId)
  }

  if (rt.starting) return getQrState(tenantId)

  if (opts.force) {
    try { await rt.socket?.logout?.() } catch {}
    rt.socket = undefined
    clearAuthFiles(tenantId)
    rt.status = 'disconnected'
    rt.qr = undefined
  }

  if (rt.socket && !opts.force) return getQrState(tenantId)

  rt.starting = true
  try {
    const baileys = await loadBaileys()
    const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys

    const dir = sessionDir(tenantId)
    fs.mkdirSync(dir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Hexalyte POS', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    })

    sock.ev.on('creds.update', saveCreds)
    await bindSocket(tenantId, sock)

    if (state.creds?.registered) rt.status = 'connecting'
    else rt.status = 'qr_pending'
  } finally {
    rt.starting = false
  }

  return getQrState(tenantId)
}

export function getQrState(tenantId: string): QrSessionState {
  const rt = getRuntime(tenantId)
  return {
    status:      rt.status,
    qr:          rt.qr,
    phoneNumber: rt.phoneNumber,
    displayName: rt.displayName,
    lastChecked: new Date().toISOString(),
  }
}

export function isQrConnected(tenantId: string): boolean {
  const rt = sessions.get(tenantId)
  return rt?.status === 'connected' && !!rt.socket
}

export async function sendQrText(tenantId: string, phone: string, text: string) {
  const rt = getRuntime(tenantId)
  if (!rt.socket || rt.status !== 'connected') {
    throw new Error('WhatsApp QR session is not connected. Scan the QR code first.')
  }
  const jid = toJid(phone)
  await rt.socket.sendMessage(jid, { text })
}

export async function disconnectQrSession(tenantId: string) {
  const rt = getRuntime(tenantId)
  try {
    if (rt.socket) await rt.socket.logout()
  } catch {}
  rt.socket = undefined
  rt.qr = undefined
  rt.status = 'disconnected'
  rt.phoneNumber = undefined
  rt.displayName = undefined
  clearAuthFiles(tenantId)
  await persistDisconnected(tenantId)
}

export async function restoreQrSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return

  const tenants = await prisma.whatsAppConfig.findMany({
    where: { connectionMode: 'qr', status: 'connected' },
    select: { tenantId: true },
  })

  for (const { tenantId } of tenants) {
    if (!fs.existsSync(sessionDir(tenantId))) continue
    startQrSession(tenantId).catch(err => {
      console.warn(`[whatsapp] failed to restore session for ${tenantId}:`, err?.message)
    })
  }
}
