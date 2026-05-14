import { api } from './api'

export type WAStatus = 'connected' | 'disconnected' | 'token_expired'

export interface WAConfig {
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
  phoneNumber?: string
  displayName?: string
  lastChecked?: string
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
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
  type: 'invoice' | 'test' | 'custom'
  preview: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
}

const BASE = '/whatsapp'

export const whatsappApi = {
  getStatus:         ()                              => api.get<{ data: WAStatusInfo }>(`${BASE}/status`),
  getConfig:         ()                              => api.get<{ data: WAConfig }>(`${BASE}/config`),
  connect:           (body: Partial<WAConfig>)       => api.post<{ data: WAStatusInfo }>(`${BASE}/connect`, body),
  disconnect:        ()                              => api.post<{ data: { success: boolean } }>(`${BASE}/disconnect`, {}),
  updateConfig:      (body: Partial<WAConfig>)       => api.put<{ data: WAConfig }>(`${BASE}/config`, body),
  testConnection:    ()                              => api.post<{ data: { success: boolean; message: string } }>(`${BASE}/test`, {}),
  sendTestMessage:   (phone: string)                 => api.post<{ data: { success: boolean; message: string } }>(`${BASE}/test-message`, { phone }),
  getStats:          ()                              => api.get<{ data: WAStats }>(`${BASE}/stats`),
  getInvoiceHistory: (params?: Record<string, string>) =>
    api.get<{ data: InvoiceHistoryItem[] }>(`${BASE}/invoice-history${params ? '?' + new URLSearchParams(params) : ''}`),
  getRecentMessages: ()                              => api.get<{ data: RecentMessage[] }>(`${BASE}/messages/recent`),
  sendInvoice:       (orderId: string, phone: string) =>
    api.post<{ data: { success: boolean; messageId: string } }>(`${BASE}/send-invoice`, { orderId, phone }),
}

export const WA_CONFIG_KEY = 'hx_wa_config'
export const WA_STATUS_KEY = 'hx_wa_status'

export function getLocalWAConfig(): Partial<WAConfig> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(WA_CONFIG_KEY) ?? '{}') } catch { return {} }
}

export function saveLocalWAConfig(cfg: Partial<WAConfig>) {
  localStorage.setItem(WA_CONFIG_KEY, JSON.stringify(cfg))
}

export function getLocalWAStatus(): WAStatusInfo | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(WA_STATUS_KEY) ?? 'null') } catch { return null }
}

export function saveLocalWAStatus(s: WAStatusInfo) {
  localStorage.setItem(WA_STATUS_KEY, JSON.stringify(s))
}

export function clearLocalWAData() {
  localStorage.removeItem(WA_STATUS_KEY)
  localStorage.removeItem(WA_CONFIG_KEY)
}
