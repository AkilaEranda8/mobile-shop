# Report Engine (Phase 1+)

Standardized read-filter context for list/report endpoints: pagination, branch scope, date range, export metadata.

**Writes:** none (read-only)  
**Flag:** none — safe facade over existing utils (always available)  
**Blueprint:** Section 4.3.7

## Entrypoints

| Function | Use |
|----------|-----|
| `buildReportFilterContext(req, opts)` | tenant + branch + page/limit + optional dates |
| `resolveBusinessReportRange(req, opts)` | Colombo business-day range (analytics/finance) |
| `resolveOptionalBusinessReportRange(req)` | same, or `null` if no from/to/days |
| `businessRangeWhere(field, range)` | Prisma gte/lte from business range |
| `dateWhereClause(field, from, to)` | Prisma gte/lte fragment |
| `buildPaginatedReport(data, total, ctx)` | `{ data, total, page, limit }` |
| `buildExportMetadata(ctx)` | export/report footer metadata |
| `parseInstantDateRange(from, to)` | ISO/date instant range (end inclusive) |

## Date modes

| Mode | Behavior |
|------|----------|
| `none` | No dates (list APIs) |
| `instant` | `from`/`to` as Date; end of day on `to` (Product Traceability) |
| `business` | Colombo business-day range via `resolveQueryDateRange` |

## Consumers

- `product-traceability.service.ts` — instant dates
- `sales.service.ts` — sale list
- `analytics.routes.ts` — revenue, top-products, category/customer/purchase reports, delivery
- `finance.routes.ts` — summary, P&L, transactions list, daily-summaries

## Next

- Attach `buildExportMetadata` to CSV/Excel exports
- Dashboard fixed windows (optional)
