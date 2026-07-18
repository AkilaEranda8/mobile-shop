import type {
  FeatureSuggestion,
  FeatureSuggestionHistory,
  FeatureSuggestionPriority,
  FeatureSuggestionStatus,
  User,
  UserNotification,
  Tenant,
} from '@prisma/client'
import type {
  AdminSuggestionDto,
  SuggestionHistoryDto,
  UserNotificationDto,
  UserSuggestionDto,
} from './feature-suggestions.types'

type Submitter = Pick<User, 'id' | 'name' | 'email' | 'role'>
type TenantInfo = Pick<Tenant, 'id' | 'name' | 'slug'>

export function toHistoryDto(row: FeatureSuggestionHistory): SuggestionHistoryDto {
  return {
    id: row.id,
    action: row.action,
    oldStatus: row.oldStatus,
    newStatus: row.newStatus,
    oldPriority: row.oldPriority,
    newPriority: row.newPriority,
    publicResponse: row.publicResponse,
    performedByEmail: row.performedByEmail,
    createdAt: row.createdAt,
  }
}

/** Never expose internalNote to shop users. */
export function toUserSuggestionDto(
  row: FeatureSuggestion,
  history?: FeatureSuggestionHistory[],
): UserSuggestionDto {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    publicResponse: row.publicResponse,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(history ? { history: history.map(toHistoryDto) } : {}),
  }
}

export function toAdminSuggestionDto(
  row: FeatureSuggestion & { tenant: TenantInfo; submittedBy: Submitter },
  history?: FeatureSuggestionHistory[],
): AdminSuggestionDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    shopName: row.tenant.name,
    submittedById: row.submittedById,
    submittedByName: row.submittedBy.name,
    submittedByEmail: row.submittedBy.email,
    submittedByRole: row.submittedBy.role,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    publicResponse: row.publicResponse,
    internalNote: row.internalNote,
    respondedByEmail: row.respondedByEmail,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(history ? { history: history.map(toHistoryDto) } : {}),
  }
}

export function toNotificationDto(row: UserNotification): UserNotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    relatedId: row.relatedId,
    isRead: row.isRead,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

export function statusLabel(status: FeatureSuggestionStatus): string {
  switch (status) {
    case 'NEW': return 'New'
    case 'UNDER_REVIEW': return 'Under Review'
    case 'PLANNED': return 'Planned'
    case 'IN_PROGRESS': return 'In Progress'
    case 'RELEASED': return 'Released'
    case 'DECLINED': return 'Declined'
    default: return status
  }
}

export function priorityLabel(priority: FeatureSuggestionPriority): string {
  switch (priority) {
    case 'LOW': return 'Low'
    case 'MEDIUM': return 'Medium'
    case 'HIGH': return 'High'
    case 'CRITICAL': return 'Critical'
    default: return priority
  }
}
