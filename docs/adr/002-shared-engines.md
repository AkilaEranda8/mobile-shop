# ADR-002: Shared Engines

**Status:** Accepted  
**Date:** 2026-07-20

## Context

Stock mutations appear in sales, PO receive, returns, repairs, exchanges, and stock transfer. Accounting emissions appear in sales, repairs, suppliers, daily-closing, and opening balances. Logic is duplicated with subtle inconsistencies (reference formats, variant stock, IMEI updates).

## Problem

Duplicated side-effect logic causes production defects that are hard to trace: stock counts diverge from movements, IMEI status wrong after return, accounting double-posts.

## Decision

Extract **Shared Engines** with stable input/output contracts:

- **Inventory Engine** — all stock writes + `StockMovement` + IMEI status
- **Accounting Engine** — outbox enqueue + process + journal (already partially exists)
- Supporting engines: Pricing, Configuration, Report, Template, Validation, Workflow Validators

Modules **call engines**; engines do **not** replace domain aggregates.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Shared utility functions only | No enforcement boundary; modules still inline stock writes |
| Event sourcing for inventory | Full rewrite; breaks backward compatibility |
| Database triggers for stock | Opaque, untestable, bypasses application invariants |

## Trade-offs

- Single place to fix stock/accounting bugs
- Consistent audit trail (`StockMovement`, `IntegrationLink`)
- Initial extraction cost (mitigated by feature-flag rollout)
- Engine API must remain stable once adopted

## Consequences

- New stock writes must go through Inventory Engine (once extracted)
- Engine contracts documented in the enterprise blueprint (Section 4)
- Extraction behind tenant feature flag until proven stable

## Future Review

2027-01-20 — After Inventory Engine covers sales + PO + returns.
