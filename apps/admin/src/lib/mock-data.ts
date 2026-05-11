import type {
  Tenant, Subscription, Invoice, ActivityLog, ServiceHealth,
  CronJob, Notification, Announcement, AdminUser, DashboardStats, RealmInfo, TenantNote
} from '@/types'

export const mockStats: DashboardStats = {
  mrr: 4_82_400,
  mrrDelta: 12.4,
  activeTenants: 214,
  activeTenantsDelta: 8,
  trialAccounts: 31,
  trialExpiringSoon: 7,
  totalUsers: 1847,
  totalUsersDelta: 64,
  newTenantsThisMonth: 23,
  churnRate: 2.1,
}

export const mockMrrChart = [
  { month: 'Jun', mrr: 310000 },
  { month: 'Jul', mrr: 342000 },
  { month: 'Aug', mrr: 358000 },
  { month: 'Sep', mrr: 371000 },
  { month: 'Oct', mrr: 389000 },
  { month: 'Nov', mrr: 403000 },
  { month: 'Dec', mrr: 418000 },
  { month: 'Jan', mrr: 429000 },
  { month: 'Feb', mrr: 437000 },
  { month: 'Mar', mrr: 451000 },
  { month: 'Apr', mrr: 463000 },
  { month: 'May', mrr: 482400 },
]

export const mockNewTenants = [
  { month: 'Jan', count: 14 }, { month: 'Feb', count: 18 },
  { month: 'Mar', count: 22 }, { month: 'Apr', count: 17 },
  { month: 'May', count: 23 }, { month: 'Jun', count: 19 },
  { month: 'Jul', count: 26 }, { month: 'Aug', count: 24 },
  { month: 'Sep', count: 20 }, { month: 'Oct', count: 28 },
  { month: 'Nov', count: 31 }, { month: 'Dec', count: 23 },
]

export const mockPlanDistribution = [
  { name: 'Starter', value: 112, color: '#6b7280' },
  { name: 'Pro', value: 78, color: '#111827' },
  { name: 'Enterprise', value: 24, color: '#f59e0b' },
]

export const mockRevByPlan = [
  { month: 'Mar', Starter: 112000, Pro: 234000, Enterprise: 105000 },
  { month: 'Apr', Starter: 118000, Pro: 240000, Enterprise: 105000 },
  { month: 'May', Starter: 124000, Pro: 251000, Enterprise: 108000 },
]

export const mockTenants: Tenant[] = [
  {
    id: 't1', shopName: 'iRepair Hub', realmId: 'irepair-hub',
    ownerName: 'Kamal Perera', ownerEmail: 'kamal@irepair.lk', ownerPhone: '+94771234567',
    plan: 'PRO', status: 'ACTIVE', mrr: 4800, usersCount: 9, storageUsedMB: 4200,
    lastActiveAt: '2026-05-11T10:22:00Z', joinedAt: '2025-03-12T08:00:00Z',
    country: 'LK', city: 'Colombo', nextBillingAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't2', shopName: 'PhoneZone Galle', realmId: 'phonezone-galle',
    ownerName: 'Nimal Silva', ownerEmail: 'nimal@phonezone.lk', ownerPhone: '+94912345678',
    plan: 'STARTER', status: 'ACTIVE', mrr: 1200, usersCount: 3, storageUsedMB: 820,
    lastActiveAt: '2026-05-10T15:44:00Z', joinedAt: '2025-07-22T08:00:00Z',
    country: 'LK', city: 'Galle', nextBillingAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't3', shopName: 'TechFix Pro', realmId: 'techfix-pro',
    ownerName: 'Arun Kumar', ownerEmail: 'arun@techfix.in', ownerPhone: '+919876543210',
    plan: 'ENTERPRISE', status: 'ACTIVE', mrr: 14400, usersCount: 28, storageUsedMB: 18200,
    lastActiveAt: '2026-05-11T09:10:00Z', joinedAt: '2024-11-01T08:00:00Z',
    country: 'IN', city: 'Chennai', nextBillingAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't4', shopName: 'Galaxy Mobile', realmId: 'galaxy-mobile',
    ownerName: 'Priya Kumari', ownerEmail: 'priya@galaxymobile.in', ownerPhone: '+917654321098',
    plan: 'PRO', status: 'TRIAL', mrr: 0, usersCount: 4, storageUsedMB: 340,
    lastActiveAt: '2026-05-09T11:00:00Z', joinedAt: '2026-05-01T08:00:00Z',
    country: 'IN', city: 'Bangalore', trialEndsAt: '2026-05-15T00:00:00Z',
  },
  {
    id: 't5', shopName: 'QuickFix Mobile', realmId: 'quickfix-mobile',
    ownerName: 'Samantha De Silva', ownerEmail: 'sam@quickfix.lk', ownerPhone: '+94751234567',
    plan: 'STARTER', status: 'SUSPENDED', mrr: 0, usersCount: 2, storageUsedMB: 210,
    lastActiveAt: '2026-04-20T08:00:00Z', joinedAt: '2025-10-15T08:00:00Z',
    country: 'LK', city: 'Kandy',
  },
  {
    id: 't6', shopName: 'SmartCell Repair', realmId: 'smartcell',
    ownerName: 'Ravi Shankar', ownerEmail: 'ravi@smartcell.in', ownerPhone: '+918765432109',
    plan: 'PRO', status: 'ACTIVE', mrr: 4800, usersCount: 7, storageUsedMB: 3100,
    lastActiveAt: '2026-05-11T08:30:00Z', joinedAt: '2025-06-10T08:00:00Z',
    country: 'IN', city: 'Mumbai', nextBillingAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't7', shopName: 'iStore Lanka', realmId: 'istore-lanka',
    ownerName: 'Dilshan Fernando', ownerEmail: 'dilshan@istore.lk', ownerPhone: '+94762345678',
    plan: 'ENTERPRISE', status: 'ACTIVE', mrr: 14400, usersCount: 22, storageUsedMB: 14800,
    lastActiveAt: '2026-05-10T17:00:00Z', joinedAt: '2025-01-20T08:00:00Z',
    country: 'LK', city: 'Colombo', nextBillingAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 't8', shopName: 'MobiCare Plus', realmId: 'mobicare-plus',
    ownerName: 'Anjali Mehta', ownerEmail: 'anjali@mobicare.in', ownerPhone: '+919765432101',
    plan: 'STARTER', status: 'TRIAL', mrr: 0, usersCount: 2, storageUsedMB: 120,
    lastActiveAt: '2026-05-11T07:45:00Z', joinedAt: '2026-05-07T08:00:00Z',
    country: 'IN', city: 'Delhi', trialEndsAt: '2026-05-21T00:00:00Z',
  },
]

export const mockSubscriptions: Subscription[] = mockTenants
  .filter(t => t.status === 'ACTIVE')
  .map(t => ({
    id: `sub-${t.id}`,
    tenantId: t.id,
    shopName: t.shopName,
    plan: t.plan,
    mrr: t.mrr,
    status: 'ACTIVE' as const,
    nextBillingAt: t.nextBillingAt ?? '2026-06-01T00:00:00Z',
    paymentMethod: 'Card',
  }))

export const mockOverdue: Subscription[] = [
  {
    id: 'sub-od1', tenantId: 't9', shopName: 'FixIt Mobile', plan: 'STARTER', mrr: 1200,
    status: 'PAST_DUE', nextBillingAt: '2026-04-01T00:00:00Z', pastDueDays: 40, paymentMethod: 'Card',
  },
  {
    id: 'sub-od2', tenantId: 't10', shopName: 'Reliance Phones', plan: 'PRO', mrr: 4800,
    status: 'PAST_DUE', nextBillingAt: '2026-03-01T00:00:00Z', pastDueDays: 71, paymentMethod: 'UPI',
  },
]

export const mockLogs: ActivityLog[] = [
  { id: 'l1', timestamp: '2026-05-11T10:22:14Z', eventType: 'TENANT_LOGIN', actor: 'kamal@irepair.lk', actorType: 'TENANT', target: 'iRepair Hub', details: 'Owner login from Colombo', ip: '203.94.112.5', severity: 'INFO', tenantId: 't1' },
  { id: 'l2', timestamp: '2026-05-11T10:18:00Z', eventType: 'PLAN_CHANGED', actor: 'super@hexalyte.com', actorType: 'ADMIN', target: 'TechFix Pro', details: 'Plan upgraded: PRO → ENTERPRISE', ip: '10.0.0.1', severity: 'INFO', tenantId: 't3' },
  { id: 'l3', timestamp: '2026-05-11T10:05:00Z', eventType: 'BACKUP_FAILED', actor: 'system', actorType: 'SYSTEM', target: 'DB Scheduler', details: 'Daily backup failed: timeout on schema techfix_pro', ip: '10.0.0.2', severity: 'ERROR' },
  { id: 'l4', timestamp: '2026-05-11T09:55:00Z', eventType: 'TENANT_SUSPENDED', actor: 'billing@hexalyte.com', actorType: 'ADMIN', target: 'QuickFix Mobile', details: 'Suspended due to 40+ days overdue payment', ip: '10.0.0.1', severity: 'WARN', tenantId: 't5' },
  { id: 'l5', timestamp: '2026-05-11T09:40:00Z', eventType: 'NEW_TENANT', actor: 'system', actorType: 'SYSTEM', target: 'MobiCare Plus', details: 'New tenant onboarded, Starter trial started', ip: '10.0.0.2', severity: 'INFO', tenantId: 't8' },
  { id: 'l6', timestamp: '2026-05-11T09:30:00Z', eventType: 'IMPERSONATE', actor: 'support@hexalyte.com', actorType: 'ADMIN', target: 'PhoneZone Galle', details: 'Support session started', ip: '10.0.0.1', severity: 'WARN', tenantId: 't2' },
  { id: 'l7', timestamp: '2026-05-11T09:15:00Z', eventType: 'MFA_RESET', actor: 'super@hexalyte.com', actorType: 'ADMIN', target: 'arun@techfix.in', details: 'Admin reset MFA for user', ip: '10.0.0.1', severity: 'WARN' },
  { id: 'l8', timestamp: '2026-05-11T09:00:00Z', eventType: 'PAYMENT_RECEIVED', actor: 'system', actorType: 'SYSTEM', target: 'iStore Lanka', details: 'Monthly invoice Rs.14,400 paid via card', ip: '10.0.0.2', severity: 'INFO', tenantId: 't7' },
]

export const mockServices: ServiceHealth[] = [
  { name: 'API Gateway', status: 'HEALTHY', uptime: 99.98, responseTimeMs: 42, detail: 'All nodes responsive', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'Keycloak (auth.hexalyte.com)', status: 'HEALTHY', uptime: 99.95, responseTimeMs: 61, detail: '3 nodes active', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'PostgreSQL Cluster', status: 'HEALTHY', uptime: 99.99, responseTimeMs: 8, detail: '214 schemas · 12 active connections', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'Redis', status: 'HEALTHY', uptime: 99.99, responseTimeMs: 2, detail: 'Hit rate 94.2% · 512MB used', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'ClickHouse Analytics', status: 'DEGRADED', uptime: 98.10, responseTimeMs: 380, detail: 'High query latency detected', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'S3 Storage', status: 'HEALTHY', uptime: 99.99, responseTimeMs: 95, detail: '1.2 TB used · Last backup 02:00', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'WebSocket Server', status: 'HEALTHY', uptime: 99.80, responseTimeMs: 15, detail: '412 active connections', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'Email (SendGrid)', status: 'HEALTHY', uptime: 99.90, responseTimeMs: 210, detail: '1,204 emails sent today', lastChecked: '2026-05-11T10:22:00Z' },
  { name: 'SMS Gateway', status: 'DOWN', uptime: 95.20, responseTimeMs: 0, detail: 'Dialog gateway timeout — investigating', lastChecked: '2026-05-11T10:22:00Z' },
]

export const mockCronJobs: CronJob[] = [
  { name: 'Daily DB Backup', status: 'FAILED', lastRun: '2026-05-11T02:00:00Z', nextRun: '2026-05-12T02:00:00Z', duration: 0 },
  { name: 'Warranty Expiry Alerts', status: 'SUCCESS', lastRun: '2026-05-11T06:00:00Z', nextRun: '2026-05-12T06:00:00Z', duration: 14 },
  { name: 'Trial Expiry Checker', status: 'SUCCESS', lastRun: '2026-05-11T07:00:00Z', nextRun: '2026-05-12T07:00:00Z', duration: 3 },
  { name: 'Analytics Aggregation', status: 'RUNNING', lastRun: '2026-05-11T10:00:00Z', nextRun: '2026-05-11T11:00:00Z', duration: 0 },
  { name: 'Payment Retry', status: 'SUCCESS', lastRun: '2026-05-11T09:30:00Z', nextRun: '2026-05-12T09:30:00Z', duration: 8 },
]

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'TRIAL_EXPIRING', title: 'Trial Expiring Soon', message: 'Galaxy Mobile trial expires in 4 days', read: false, severity: 'WARN', createdAt: '2026-05-11T08:00:00Z', tenantId: 't4' },
  { id: 'n2', type: 'PAYMENT_OVERDUE', title: 'Payment Overdue', message: 'Reliance Phones — 71 days overdue (Rs.4,800)', read: false, severity: 'ERROR', createdAt: '2026-05-10T09:00:00Z' },
  { id: 'n3', type: 'BACKUP_FAILED', title: 'Backup Failed', message: 'Daily backup failed for techfix_pro schema', read: false, severity: 'ERROR', createdAt: '2026-05-11T02:05:00Z' },
  { id: 'n4', type: 'NEW_TENANT', title: 'New Tenant Registered', message: 'MobiCare Plus joined on Starter trial', read: true, severity: 'INFO', createdAt: '2026-05-11T07:00:00Z', tenantId: 't8' },
  { id: 'n5', type: 'SYSTEM_ERROR', title: 'SMS Gateway Down', message: 'Dialog SMS gateway is unresponsive', read: false, severity: 'ERROR', createdAt: '2026-05-11T10:00:00Z' },
  { id: 'n6', type: 'HIGH_API_USAGE', title: 'High API Usage', message: 'TechFix Pro exceeded 80% API quota', read: true, severity: 'WARN', createdAt: '2026-05-11T09:30:00Z', tenantId: 't3' },
]

export const mockAnnouncements: Announcement[] = [
  { id: 'a1', title: 'Scheduled Maintenance — May 14', body: 'Platform will be in maintenance mode from 02:00–04:00 IST on May 14. All services will be unavailable.', target: 'ALL', status: 'SCHEDULED', type: 'MAINTENANCE', scheduledAt: '2026-05-13T20:00:00Z', seenCount: 0, createdAt: '2026-05-11T09:00:00Z', createdBy: 'super@hexalyte.com' },
  { id: 'a2', title: 'New Feature: WhatsApp Receipts', body: 'Enterprise plan now includes WhatsApp receipt sending. Configure in Settings → Integrations.', target: 'ENTERPRISE', status: 'SENT', type: 'INFO', sentAt: '2026-05-08T10:00:00Z', seenCount: 18, createdAt: '2026-05-07T15:00:00Z', createdBy: 'super@hexalyte.com' },
  { id: 'a3', title: 'Draft: June Pricing Update', body: 'We will be updating our Starter plan pricing from Rs.999 to Rs.1,199/month effective June 1.', target: 'STARTER', status: 'DRAFT', type: 'WARNING', seenCount: 0, createdAt: '2026-05-10T14:00:00Z', createdBy: 'billing@hexalyte.com' },
]

export const mockAdmins: AdminUser[] = [
  { id: 'a1', name: 'Super Admin', email: 'super@hexalyte.com', role: 'SUPER_ADMIN', mfaEnabled: true, lastLoginAt: '2026-05-11T09:00:00Z', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'a2', name: 'Billing Admin', email: 'billing@hexalyte.com', role: 'BILLING_ADMIN', mfaEnabled: true, lastLoginAt: '2026-05-10T14:00:00Z', createdAt: '2024-03-15T00:00:00Z' },
  { id: 'a3', name: 'Support Admin', email: 'support@hexalyte.com', role: 'SUPPORT_ADMIN', mfaEnabled: true, lastLoginAt: '2026-05-11T10:00:00Z', createdAt: '2024-06-01T00:00:00Z' },
]

export const mockRealms: RealmInfo[] = [
  { id: 'master', name: 'hexalyte-master', activeSessions: 3, status: 'ACTIVE', lastActivity: '2026-05-11T10:22:00Z' },
  ...mockTenants.map(t => ({
    id: t.realmId,
    name: t.realmId,
    tenantId: t.id,
    shopName: t.shopName,
    activeSessions: Math.floor(Math.random() * 8),
    status: t.status === 'SUSPENDED' ? 'DISABLED' as const : 'ACTIVE' as const,
    lastActivity: t.lastActiveAt,
  })),
]

export const mockTenantNotes: TenantNote[] = [
  { id: 'tn1', tenantId: 't5', note: 'Customer contacted about overdue payment. Promised to settle by May 20.', adminName: 'Support Admin', ticketRef: 'TKT-2045', createdAt: '2026-05-09T10:00:00Z' },
  { id: 'tn2', tenantId: 't3', note: 'Enterprise plan upgraded. Custom onboarding session scheduled.', adminName: 'Super Admin', createdAt: '2026-05-08T15:00:00Z' },
]

export const mockAnalyticsData = {
  totalGMV: 182_400_000,
  totalInvoices: 48_291,
  totalRepairs: 22_840,
  totalWarrantyClaims: 3_412,
  avgInvoicesPerTenantPerDay: 4.8,
  topTenantsByInvoice: [
    { shopName: 'TechFix Pro', invoices: 4820, mrr: 14400 },
    { shopName: 'iStore Lanka', invoices: 3940, mrr: 14400 },
    { shopName: 'iRepair Hub', invoices: 2890, mrr: 4800 },
    { shopName: 'SmartCell Repair', invoices: 2340, mrr: 4800 },
    { shopName: 'PhoneZone Galle', invoices: 1820, mrr: 1200 },
  ],
  apiCallsByTenant: [
    { shopName: 'TechFix Pro', calls: 142000 },
    { shopName: 'iStore Lanka', calls: 118000 },
    { shopName: 'iRepair Hub', calls: 84000 },
    { shopName: 'SmartCell Repair', calls: 61000 },
    { shopName: 'PhoneZone Galle', calls: 32000 },
  ],
}
