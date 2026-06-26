import { api } from './api'
import { authStorage } from './auth'

export type WAStatus = 'connected' | 'disconnected' | 'token_expired' | 'qr_pending' | 'connecting'
export type WAConnectionMode = 'qr' | 'meta'

export interface WAConfig {
  connectionMode?: WAConnectionMode
  accessToken: string
  phoneNumberId: string
  wabaId: string
  verifyToken: string
  enabled: boolean
  autoSendInvoice: boolean
  sendPdfInvoice: boolean
  invoiceTemplate: string
  validatePhones: boolean
}

export interface WAStatusInfo {
  status: WAStatus
  connectionMode?: WAConnectionMode
  enabled?: boolean
  qr?: string
  phoneNumber?: string
  displayName?: string
  lastChecked?: string
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
}

export interface WAQrSession {
  status: 'disconnected' | 'qr_pending' | 'connecting' | 'connected'
  connectionMode: 'qr'
  qr?: string
  phoneNumber?: string
  displayName?: string
  lastChecked?: string
}

export interface WAStats {
  totalSent: number
  delivered: number
  failed: number
  pending: number
  invoicesSent: number
  deliveryRate: number
  monthlyData: { month: string; sent: number; delivered: number }[]
}

export interface InvoiceHistoryItem {
  id: string
  orderId: string
  customerName: string
  phone: string
  amount: number
  status: 'delivered' | 'failed' | 'pending'
  sentAt: string
}

export interface RecentMessage {
  id: string
  to: string
  customerName: string
  type: 'invoice' | 'quote' | 'repair' | 'test' | 'custom'
  preview: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
}

export type WAMessageType = 'invoice' | 'quote' | 'repair' | 'custom'

/** Format a local/Sri Lanka phone number for WhatsApp API (+94…). */
export function formatWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('94') && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 10) return `+94${digits.slice(1)}`
  if (digits.length >= 9) return `+94${digits}`
  return null
}

const BASE = '/whatsapp'
const WA_CONFIG_KEY = 'hx_wa_config'
const WA_STATUS_KEY = 'hx_wa_status'

/** Resolve tenant id so each shop's WhatsApp cache stays isolated in localStorage. */
export function getWhatsAppTenantId(): string | null {
  return authStorage.getUser()?.tenantId ?? null
}

function scopedKey(base: string, tenantId?: string | null): string | null {
  const tid = tenantId ?? getWhatsAppTenantId()
  return tid ? `${base}_${tid}` : null
}

export const whatsappApi = {
  getStatus:         ()                              => api.get<{ data: WAStatusInfo }>(`${BASE}/status`),
  getConfig:         ()                              => api.get<{ data: WAConfig }>(`${BASE}/config`),
  getQrSession:      ()                              => api.get<{ data: WAQrSession }>(`${BASE}/qr`),
  startQrConnect:    ()                              => api.post<{ data: WAQrSession }>(`${BASE}/qr/start`, {}),
  refreshQrConnect:  ()                              => api.post<{ data: WAQrSession }>(`${BASE}/qr/refresh`, {}),
  connect:           (body: Partial<WAConfig>)       => api.post<{ data: WAStatusInfo }>(`${BASE}/connect`, body),
  disconnect:        ()                              => api.post<{ data: { success: boolean } }>(`${BASE}/disconnect`, {}),
  updateConfig:      (body: Partial<WAConfig>)       => api.put<{ data: WAConfig }>(`${BASE}/config`, body),
  testConnection:    ()                              => api.post<{ data: { success: boolean; message: string } }>(`${BASE}/test`, {}),
  sendTestMessage:   (phone: string)                 => api.post<{ data: { success: boolean; message: string } }>(`${BASE}/test-message`, { phone }),
  getStats:          ()                              => api.get<{ data: WAStats }>(`${BASE}/stats`),
  getInvoiceHistory: (params?: Record<string, string>) =>
    api.get<{ data: InvoiceHistoryItem[] }>(`${BASE}/invoice-history${params ? '?' + new URLSearchParams(params) : ''}`),
  getRecentMessages: ()                              => api.get<{ data: RecentMessage[] }>(`${BASE}/messages/recent`),
  sendInvoice:       (body: {
    orderId: string
    phone: string
    customerName?: string
    amount?: number
    message?: string
    pdfBase64?: string
    pdfFilename?: string
  }) =>
    api.post<{ data: { success: boolean; messageId: string } }>(`${BASE}/send-invoice`, body),
  sendMessage:       (body: {
    phone: string
    message: string
    customerName?: string
    referenceId?: string
    type?: WAMessageType
    amount?: number
  }) =>
    api.post<{ data: { success: boolean; messageId: string } }>(`${BASE}/send-message`, body),
}

export function getLocalWAConfig(tenantId?: string | null): Partial<WAConfig> {
  if (typeof window === 'undefined') return {}
  const key = scopedKey(WA_CONFIG_KEY, tenantId)
  if (!key) return {}
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') } catch { return {} }
}

export function saveLocalWAConfig(cfg: Partial<WAConfig>, tenantId?: string | null) {
  const key = scopedKey(WA_CONFIG_KEY, tenantId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(cfg))
}

export function getLocalWAStatus(tenantId?: string | null): WAStatusInfo | null {
  if (typeof window === 'undefined') return null
  const key = scopedKey(WA_STATUS_KEY, tenantId)
  if (!key) return null
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
}

export function saveLocalWAStatus(s: WAStatusInfo, tenantId?: string | null) {
  const key = scopedKey(WA_STATUS_KEY, tenantId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(s))
}

export function clearLocalWAData(tenantId?: string | null) {
  const cfgKey = scopedKey(WA_CONFIG_KEY, tenantId)
  const statusKey = scopedKey(WA_STATUS_KEY, tenantId)
  if (cfgKey) localStorage.removeItem(cfgKey)
  if (statusKey) localStorage.removeItem(statusKey)
}
