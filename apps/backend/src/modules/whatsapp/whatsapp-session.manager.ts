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
  /** 8-digit code for mobile "Link with phone number" (no QR scan needed). */
  pairingCode?: string
  phoneNumber?: string
  displayName?: string
  lastChecked?: string
}

interface TenantRuntime {
  tenantId: string
  status: QrSessionStatus
  qr?: string
  pairingCode?: string
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
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  } catch (err) {
    console.warn(`[whatsapp] clearAuthFiles ${tenantId}:`, (err as Error)?.message)
  }
}

/** Kill socket before deleting auth files — otherwise Baileys saveCreds crashes the process (ENOENT). */
async function destroySocket(rt: TenantRuntime) {
  const sock = rt.socket
  rt.socket = undefined
  if (!sock) return
  try { sock.ev?.removeAllListeners?.() } catch {}
  try { await sock.logout?.() } catch {}
  try { sock.end?.(undefined) } catch {}
  // Let in-flight creds.write settle / fail before we rm the folder.
  await new Promise((r) => setTimeout(r, 400))
}

async function bindSocket(tenantId: string, sock: any) {
  const rt = getRuntime(tenantId)
  rt.socket = sock

  const { DisconnectReason } = await loadBaileys()

  sock.ev.on('connection.update', async (update: any) => {
    try {
      // Ignore events from a superseded socket (force refresh / pairing restart).
      if (rt.socket !== sock) return

      const { connection, lastDisconnect, qr } = update

      if (qr) {
        rt.status = 'qr_pending'
        rt.qr = qr
      }

      if (connection === 'connecting') {
        rt.status = 'connecting'
        // Keep last QR visible until a new QR arrives or we open — clearing it leaves the UI blank.
      }

      if (connection === 'open') {
        const jid: string | undefined = sock.user?.id
        rt.status = 'connected'
        rt.qr = undefined
        rt.pairingCode = undefined
        rt.phoneNumber = formatPhone(jid)
        rt.displayName = sock.user?.name ?? rt.phoneNumber
        await persistConnected(tenantId, rt.phoneNumber, rt.displayName)
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as any)?.output?.statusCode
        const loggedOut = code === DisconnectReason.loggedOut

        if (rt.socket === sock) rt.socket = undefined
        rt.qr = undefined
        rt.pairingCode = undefined

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
    } catch (err) {
      console.warn(`[whatsapp] connection.update ${tenantId}:`, (err as Error)?.message)
    }
  })
}

async function waitForQr(rt: TenantRuntime, timeoutMs = 35000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (rt.qr) return
    if (rt.status === 'connected') return
    await new Promise((r) => setTimeout(r, 250))
  }
}

export async function startQrSession(
  tenantId: string,
  opts: { force?: boolean } = {},
): Promise<QrSessionState> {
  const rt = getRuntime(tenantId)

  if (rt.status === 'connected' && rt.socket && !opts.force) {
    return getQrState(tenantId)
  }

  if (rt.starting) {
    await waitForQr(rt)
    return getQrState(tenantId)
  }

  if (opts.force) {
    await destroySocket(rt)
    clearAuthFiles(tenantId)
    rt.status = 'disconnected'
    rt.qr = undefined
    rt.pairingCode = undefined
  }

  if (rt.socket && !opts.force) {
    if (rt.status === 'connected' || rt.status === 'qr_pending' || rt.status === 'connecting') {
      if (!rt.qr && rt.status === 'qr_pending') await waitForQr(rt, 5000)
      return getQrState(tenantId)
    }
    await destroySocket(rt)
  }

  rt.starting = true
  try {
    const baileys = await loadBaileys()
    const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys

    const dir = sessionDir(tenantId)
    fs.mkdirSync(dir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const sockRef: { current: any } = { current: null }
    const safeSaveCreds = async () => {
      try {
        // Force-refresh can delete the folder while Baileys still fires creds.update.
        if (getRuntime(tenantId).socket !== sockRef.current) return
        fs.mkdirSync(dir, { recursive: true })
        await saveCreds()
      } catch (err) {
        console.warn(`[whatsapp] saveCreds ${tenantId}:`, (err as Error)?.message)
      }
    }

    let version: [number, number, number]
    try {
      const latest = await fetchLatestBaileysVersion()
      version = latest.version
    } catch (err) {
      console.warn('[whatsapp] fetchLatestBaileysVersion failed, using default:', (err as Error)?.message)
      version = [2, 3000, 0]
    }

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
      generateHighQualityLinkPreview: false,
    })
    sockRef.current = sock

    sock.ev.on('creds.update', () => { void safeSaveCreds() })
    await bindSocket(tenantId, sock)

    rt.status = state.creds?.registered ? 'connecting' : 'qr_pending'
    await waitForQr(rt)

    if (!rt.qr && (rt.status === 'qr_pending' || rt.status === 'connecting')) {
      throw new Error('Could not generate QR code. Check server internet and try again.')
    }
  } catch (err) {
    rt.status = 'disconnected'
    rt.qr = undefined
    await destroySocket(rt)
    throw err
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
    pairingCode: rt.pairingCode,
    phoneNumber: rt.phoneNumber,
    displayName: rt.displayName,
    lastChecked: new Date().toISOString(),
  }
}

/** Digits-only WhatsApp number with country code (e.g. 94771234567). */
function toPairingPhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length >= 9) {
    digits = `94${digits.slice(1)}`
  }
  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Enter a valid WhatsApp number with country code (e.g. 0771234567 or +94771234567)')
  }
  return digits
}

/**
 * Mobile-friendly link: request an 8-digit pairing code so the user can enter it in
 * WhatsApp → Linked Devices → Link with phone number (no QR scan on the same phone).
 */
export async function requestPairingCode(
  tenantId: string,
  phone: string,
): Promise<QrSessionState & { pairingCode: string }> {
  const digits = toPairingPhoneDigits(phone)
  const rt = getRuntime(tenantId)

  if (rt.status === 'connected' && rt.socket) {
    throw new Error('WhatsApp is already connected. Disconnect first to link again.')
  }

  // Fresh socket so pairing can run (registered sessions skip the pairing window).
  const needsFresh =
    !rt.socket ||
    !!rt.socket?.authState?.creds?.registered ||
    rt.status === 'disconnected'

  await startQrSession(tenantId, { force: needsFresh })

  const live = getRuntime(tenantId)
  const sock = live.socket
  if (!sock) {
    throw new Error('Could not start WhatsApp session. Try again.')
  }

  if (sock.authState?.creds?.registered) {
    throw new Error('Session already registered. Disconnect WhatsApp, then try pairing again.')
  }

  // Baileys is ready to pair once the first QR update arrives (even if we ignore the QR).
  if (!live.qr) await waitForQr(live, 25000)
  if (!live.socket) {
    throw new Error('WhatsApp session dropped while waiting. Try again.')
  }

  let raw: string
  try {
    raw = await live.socket.requestPairingCode(digits)
  } catch (err: any) {
    throw new Error(err?.message || 'Could not generate pairing code. Check the number and try again.')
  }

  const cleaned = String(raw ?? '').replace(/\D/g, '')
  if (cleaned.length < 8) {
    throw new Error('WhatsApp did not return a pairing code. Try New code again.')
  }
  const pairingCode = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`
  live.pairingCode = pairingCode
  live.status = 'qr_pending'
  live.phoneNumber = `+${digits}`

  return { ...getQrState(tenantId), pairingCode }
}

export function isQrConnected(tenantId: string): boolean {
  const rt = sessions.get(tenantId)
  return rt?.status === 'connected' && !!rt.socket?.user?.id
}

/** Wait until QR socket is fully authenticated (needed after server restart). */
export async function ensureQrSessionReady(tenantId: string, timeoutMs = 30000): Promise<void> {
  if (isQrConnected(tenantId)) return

  if (!sessions.get(tenantId)?.socket) {
    await startQrSession(tenantId).catch(() => {})
  }

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (isQrConnected(tenantId)) return
    await new Promise(r => setTimeout(r, 400))
  }

  throw new Error(
    'WhatsApp QR session is not ready. Connect WhatsApp in your dashboard and ensure it shows Connected.',
  )
}

export async function sendQrText(tenantId: string, phone: string, text: string) {
  await ensureQrSessionReady(tenantId)
  const rt = getRuntime(tenantId)
  if (!rt.socket || rt.status !== 'connected') {
    throw new Error('WhatsApp QR session is not connected. Scan the QR code first.')
  }
  const jid = toJid(phone)
  await rt.socket.sendMessage(jid, { text })
}

export async function sendQrDocument(
  tenantId: string,
  phone: string,
  buffer: Buffer,
  filename: string,
  caption?: string,
) {
  await ensureQrSessionReady(tenantId)
  const rt = getRuntime(tenantId)
  if (!rt.socket || rt.status !== 'connected') {
    throw new Error('WhatsApp QR session is not connected. Scan the QR code first.')
  }
  const jid = toJid(phone)
  const pdf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const safeName = (filename || 'invoice.pdf').trim() || 'invoice.pdf'
  await rt.socket.sendMessage(jid, {
    document: pdf,
    mimetype: 'application/pdf',
    fileName: safeName,
    caption: caption || undefined,
  })
}

export async function disconnectQrSession(tenantId: string) {
  const rt = getRuntime(tenantId)
  await destroySocket(rt)
  rt.qr = undefined
  rt.pairingCode = undefined
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
