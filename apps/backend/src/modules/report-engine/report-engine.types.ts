import type { Request } from 'express'
import type { PaginationParams } from '../../utils/pagination'

export type ReportDateMode = 'none' | 'business' | 'instant'

export type ReportFilterOptions = {
  /** How to interpret from/to query params. Default: none */
  dateMode?: ReportDateMode
  /** For business mode when `from` omitted */
  defaultFrom?: 'month_start' | 'days'
  days?: number
  /**
   * Prefer `?branchId=` over active-branch header/context.
   * Product Traceability uses this; most list APIs do not.
   */
  allowQueryBranchOverride?: boolean
}

export type ReportFilterContext = PaginationParams & {
  tenantId: string
  branchId?: string
  from?: Date
  to?: Date
  /** Colombo business date keys when dateMode=business */
  fromKey?: string
  toKey?: string
  dateMode: ReportDateMode
}

export type PaginatedReport<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

export type ReportExportMetadata = {
  generatedAt: string
  tenantId: string
  branchId?: string
  page: number
  limit: number
  total?: number
  from?: string
  to?: string
  fromKey?: string
  toKey?: string
  search?: string
}

/** Business-day range resolved from a request (analytics / finance). */
export type BusinessReportRange = {
  tenantId: string
  branchId?: string
  /** Inclusive Colombo day start */
  start: Date
  /** Inclusive Colombo day end */
  end: Date
  fromKey: string
  toKey: string
}

