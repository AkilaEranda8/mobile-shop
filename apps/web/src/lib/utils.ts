import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'LKR'): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string, format = 'short'): string {
  const date = new Date(dateStr)
  if (format === 'short') {
    return date.toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (format === 'long') {
    return date.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  if (format === 'time') {
    return date.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-LK')
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 9000) + 1000)
  return `${prefix}-${year}${month}-${random}`
}

export function generateTicketNumber(prefix = 'REP'): string {
  const random = String(Math.floor(Math.random() * 90000) + 10000)
  return `${prefix}-${random}`
}

export function maskIMEI(imei: string): string {
  if (!imei || imei.length < 8) return imei
  return imei.slice(0, 4) + '****' + imei.slice(-4)
}

export function validateIMEI(imei: string): boolean {
  if (!imei || imei.length !== 15 || !/^\d+$/.test(imei)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

export function getRepairStatusColor(status: string): string {
  const colors: Record<string, string> = {
    RECEIVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DIAGNOSED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    IN_REPAIR: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    QC: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    READY: 'bg-green-500/20 text-green-400 border-green-500/30',
    DELIVERED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export function getWarrantyStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
    EXPIRED: 'bg-red-500/20 text-red-400 border-red-500/30',
    CLAIMED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    VOID: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }
  return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export function getPOStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    SENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PARTIAL: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    RECEIVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    CLOSED: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  }
  return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export function getTenantStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
    TRIAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    SUSPENDED: 'bg-red-500/20 text-red-400 border-red-500/30',
    CANCELLED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }
  return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export function truncate(str: string, maxLength: number): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timeout: ReturnType<typeof setTimeout>
  return function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function generateQRData(type: 'warranty' | 'invoice' | 'repair', id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hexalyte.com'
  const paths = {
    warranty: `/warranty/verify/${id}`,
    invoice: `/invoice/view/${id}`,
    repair: `/repair-tracking/${id}`,
  }
  return `${baseUrl}${paths[type]}`
}
