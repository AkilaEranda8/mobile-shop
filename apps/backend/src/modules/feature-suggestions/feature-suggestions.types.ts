import type {
  FeatureSuggestionHistoryAction,
  FeatureSuggestionPriority,
  FeatureSuggestionStatus,
  UserNotificationType,
} from '@prisma/client'

export const FEATURE_SUGGESTION_CATEGORIES = [
  'POS',
  'Inventory',
  'Sales',
  'Purchasing',
  'Repairs',
  'Customers',
  'Suppliers',
  'Accounting',
  'Reports',
  'Dashboard',
  'Mobile App',
  'Printing',
  'Barcode',
  'Integrations',
  'Performance',
  'Security',
  'Other',
] as const

export type FeatureSuggestionCategory = (typeof FEATURE_SUGGESTION_CATEGORIES)[number]

export const MAX_PAGE_SIZE = 50
export const MAX_SUGGESTIONS_PER_DAY = 5
export const DUPLICATE_WINDOW_HOURS = 24

export type CreateSuggestionInput = {
  category: FeatureSuggestionCategory
  title: string
  description: string
}

export type AdminUpdateSuggestionInput = {
  status?: FeatureSuggestionStatus
  priority?: FeatureSuggestionPriority
  publicResponse?: string | null
  internalNote?: string | null
}

export type AdminSuggestionFilters = {
  page: number
  limit: number
  cursor?: string
  search?: string
  status?: FeatureSuggestionStatus
  priority?: FeatureSuggestionPriority
  category?: string
  tenant?: string
  dateFrom?: string
  dateTo?: string
}

export type SuggestionHistoryDto = {
  id: string
  action: FeatureSuggestionHistoryAction
  oldStatus: FeatureSuggestionStatus | null
  newStatus: FeatureSuggestionStatus | null
  oldPriority: FeatureSuggestionPriority | null
  newPriority: FeatureSuggestionPriority | null
  publicResponse: string | null
  performedByEmail: string
  createdAt: Date
}

export type UserSuggestionDto = {
  id: string
  category: string
  title: string
  description: string
  status: FeatureSuggestionStatus
  priority: FeatureSuggestionPriority
  publicResponse: string | null
  createdAt: Date
  updatedAt: Date
  history?: SuggestionHistoryDto[]
}

export type AdminSuggestionDto = {
  id: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  shopName: string
  submittedById: string
  submittedByName: string
  submittedByEmail: string
  submittedByRole: string
  category: string
  title: string
  description: string
  status: FeatureSuggestionStatus
  priority: FeatureSuggestionPriority
  publicResponse: string | null
  internalNote: string | null
  respondedByEmail: string | null
  respondedAt: Date | null
  createdAt: Date
  updatedAt: Date
  history?: SuggestionHistoryDto[]
}

export type SuggestionSummaryDto = {
  total: number
  new: number
  underReview: number
  planned: number
  inProgress: number
  released: number
  declined: number
  highPriority: number
  criticalPriority: number
}

export type UserNotificationDto = {
  id: string
  type: UserNotificationType
  title: string
  message: string
  link: string | null
  relatedId: string | null
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

export type HistoryCreateInput = {
  suggestionId: string
  action: FeatureSuggestionHistoryAction
  oldStatus?: FeatureSuggestionStatus | null
  newStatus?: FeatureSuggestionStatus | null
  oldPriority?: FeatureSuggestionPriority | null
  newPriority?: FeatureSuggestionPriority | null
  publicResponse?: string | null
  performedByEmail: string
}
