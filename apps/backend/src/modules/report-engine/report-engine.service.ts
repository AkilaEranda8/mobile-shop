import type { Request } from 'express'
import { effectiveBranchId } from '../../utils/active-branch'
import { getPagination } from '../../utils/pagination'
import { resolveQueryDateRange } from '../../utils/date-range'
import type {
  BusinessReportRange,
  PaginatedReport,
  ReportExportMetadata,
  ReportFilterContext,
  ReportFilterOptions,
} from './report-engine.types'

/** Instant range: parse ISO/date strings; end date inclusive through end of local day. */
export function parseInstantDateRange(fromRaw?: string, toRaw?: string): { from?: Date; to?: Date } {
  const from = fromRaw ? new Date(fromRaw) : undefined
  const to = toRaw ? new Date(toRaw) : undefined
  if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999)
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  }
}

/** Prisma-friendly `{ field: { gte, lte } }` fragment. */
export function dateWhereClause(
  field: string,
  from?: Date,
  to?: Date,
): Record<string, unknown> {
  if (!from && !to) return {}
  return {
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  }
}

/**
 * Standardized read-filter context for list/report endpoints.
 * Pure facade over pagination + branch + date-range utils (behavior-preserving).
 */
export function buildReportFilterContext(
  req: Request,
  opts: ReportFilterOptions = {},
): ReportFilterContext {
  const tenantId = req.tenantId!
  const pagination = getPagination(req)
  const dateMode = opts.dateMode ?? 'none'

  let branchId: string | undefined
  if (opts.allowQueryBranchOverride) {
    branchId = (req.query.branchId as string | undefined) || effectiveBranchId(req) || undefined
  } else {
    branchId = effectiveBranchId(req) || undefined
  }

  const ctx: ReportFilterContext = {
    tenantId,
    branchId,
    ...pagination,
    dateMode,
  }

  if (dateMode === 'instant') {
    const range = parseInstantDateRange(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    )
    ctx.from = range.from
    ctx.to = range.to
  } else if (dateMode === 'business') {
    const range = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      days: opts.days ?? (typeof req.query.days === 'string' ? Number(req.query.days) : undefined),
      defaultFrom: opts.defaultFrom ?? 'days',
    })
    ctx.from = range.start
    ctx.to = range.end
    ctx.fromKey = range.fromKey
    ctx.toKey = range.toKey
  }

  return ctx
}

export function buildPaginatedReport<T>(
  data: T[],
  total: number,
  ctx: Pick<ReportFilterContext, 'page' | 'limit'>,
): PaginatedReport<T> {
  return {
    data,
    total,
    page: ctx.page,
    limit: ctx.limit,
  }
}

export function buildExportMetadata(
  ctx: ReportFilterContext,
  extras?: { total?: number },
): ReportExportMetadata {
  return {
    generatedAt: new Date().toISOString(),
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    page: ctx.page,
    limit: ctx.limit,
    total: extras?.total,
    from: ctx.from?.toISOString(),
    to: ctx.to?.toISOString(),
    fromKey: ctx.fromKey,
    toKey: ctx.toKey,
    search: ctx.search,
  }
}

/**
 * Business-day range for analytics/finance endpoints.
 * Same semantics as `resolveQueryDateRange` on query params (+ branch scope).
 */
export function resolveBusinessReportRange(
  req: Request,
  opts: Omit<ReportFilterOptions, 'dateMode'> = {},
): BusinessReportRange {
  const ctx = buildReportFilterContext(req, { ...opts, dateMode: 'business' })
  return {
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    start: ctx.from!,
    end: ctx.to!,
    fromKey: ctx.fromKey!,
    toKey: ctx.toKey!,
  }
}

/**
 * Like `resolveBusinessReportRange`, but returns null when the client did not
 * send from/to/days — preserves “all time” list endpoints (e.g. top-products).
 */
export function resolveOptionalBusinessReportRange(
  req: Request,
  opts: Omit<ReportFilterOptions, 'dateMode'> = {},
): BusinessReportRange | null {
  if (!(req.query.from || req.query.to || req.query.days)) return null
  return resolveBusinessReportRange(req, opts)
}

/** Prisma `{ createdAt: { gte, lte } }` (or other field) from a business range. */
export function businessRangeWhere(
  field: string,
  range: Pick<BusinessReportRange, 'start' | 'end'>,
): Record<string, unknown> {
  return dateWhereClause(field, range.start, range.end)
}
