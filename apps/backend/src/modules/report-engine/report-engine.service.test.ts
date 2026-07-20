/**
 * Run: npx tsx src/modules/report-engine/report-engine.service.test.ts
 */
import {
  buildExportMetadata,
  buildPaginatedReport,
  businessRangeWhere,
  dateWhereClause,
  parseInstantDateRange,
  resolveBusinessReportRange,
  resolveOptionalBusinessReportRange,
} from './report-engine.service'
import type { Request } from 'express'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const range = parseInstantDateRange('2026-07-01', '2026-07-20')
assert(!!range.from && range.from.getFullYear() === 2026, 'from parsed')
assert(!!range.to && range.to.getHours() === 23, 'to end of day')

assert(Object.keys(dateWhereClause('createdAt')).length === 0, 'empty date where')
const dw = dateWhereClause('createdAt', range.from, range.to) as any
assert(dw.createdAt?.gte === range.from, 'gte set')
assert(dw.createdAt?.lte === range.to, 'lte set')

const page = buildPaginatedReport([{ id: 1 }], 25, { page: 2, limit: 10 })
assert(page.total === 25 && page.page === 2 && page.limit === 10 && page.data.length === 1, 'paginated shape')

const meta = buildExportMetadata({
  tenantId: 't1',
  branchId: 'b1',
  page: 1,
  limit: 20,
  skip: 0,
  sortOrder: 'desc',
  dateMode: 'instant',
  from: range.from,
  to: range.to,
  search: 'iphone',
})
assert(meta.tenantId === 't1' && meta.branchId === 'b1', 'export meta ids')
assert(meta.search === 'iphone', 'export meta search')
assert(typeof meta.generatedAt === 'string', 'export meta timestamp')

function mockReq(query: Record<string, string> = {}): Request {
  return { tenantId: 't1', query, headers: {} } as unknown as Request
}

const biz = resolveBusinessReportRange(mockReq({ from: '2026-07-01', to: '2026-07-10' }), {
  defaultFrom: 'month_start',
})
assert(biz.fromKey === '2026-07-01' && biz.toKey === '2026-07-10', 'business keys')
assert(biz.start instanceof Date && biz.end instanceof Date, 'business instants')

const where = businessRangeWhere('createdAt', biz) as any
assert(where.createdAt?.gte === biz.start && where.createdAt?.lte === biz.end, 'business where')

assert(resolveOptionalBusinessReportRange(mockReq({})) === null, 'optional empty')
assert(resolveOptionalBusinessReportRange(mockReq({ days: '7' })) != null, 'optional days')

console.log('report-engine.service.test.ts: all checks passed')
