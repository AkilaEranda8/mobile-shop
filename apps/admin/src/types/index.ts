export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED'
export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE'
export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN'
export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN'
export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'SENT'
export type AnnouncementTarget = 'ALL' | 'STARTER' | 'PRO' | 'ENTERPRISE' | 'SPECIFIC'

export interface Tenant {
  id: string
  shopName: string
  realmId: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  plan: PlanTier
  status: TenantStatus
  mrr: number
  usersCount: number
  storageUsedMB: number
  lastActiveAt: string
  joinedAt: string
  country: string
  city: string
  trialEndsAt?: string
  nextBillingAt?: string
  notes?: string
}

export interface Subscription {
  id: string
  tenantId: string
  shopName: string
  plan: PlanTier
  mrr: number
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'
  nextBillingAt: string
  pastDueDays?: number
  paymentMethod: string
}

export interface Invoice {
  id: string
  tenantId: string
  shopName: string
  amount: number
  status: 'PAID' | 'OVERDUE' | 'DRAFT'
  issuedAt: string
  dueAt: string
  paidAt?: string
}

export interface ActivityLog {
  id: string
  timestamp: string
  eventType: string
  actor: string
  actorType: 'ADMIN' | 'SYSTEM' | 'TENANT'
  target: string
  details: string
  ip: string
  severity: LogSeverity
  tenantId?: string
}

export interface ServiceHealth {
  name: string
  status: ServiceStatus
  uptime: number
  responseTimeMs: number
  detail: string
  lastChecked: string
}

export interface CronJob {
  name: string
  status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'PENDING'
  lastRun: string
  nextRun: string
  duration?: number
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  severity: 'INFO' | 'WARN' | 'ERROR'
  createdAt: string
  tenantId?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  target: AnnouncementTarget
  status: AnnouncementStatus
  type: 'INFO' | 'WARNING' | 'MAINTENANCE'
  scheduledAt?: string
  sentAt?: string
  seenCount: number
  createdAt: string
  createdBy: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
  mfaEnabled: boolean
  lastLoginAt: string
  createdAt: string
}

export interface DashboardStats {
  mrr: number
  mrrDelta: number
  activeTenants: number
  activeTenantsDelta: number
  trialAccounts: number
  trialExpiringSoon: number
  totalUsers: number
  totalUsersDelta: number
  newTenantsThisMonth: number
  churnRate: number
}

export interface RealmInfo {
  id: string
  name: string
  tenantId?: string
  shopName?: string
  activeSessions: number
  status: 'ACTIVE' | 'DISABLED'
  lastActivity: string
}

export interface TenantNote {
  id: string
  tenantId: string
  note: string
  adminName: string
  ticketRef?: string
  createdAt: string
}
