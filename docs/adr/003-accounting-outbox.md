# ADR-003: Accounting Outbox

**Status:** Accepted  
**Date:** 2026-07-20

## Context

Operational modules (sales, repairs, suppliers) must post to GL when `ACCOUNTING` feature is enabled. Direct synchronous journal creation inside sale transactions risks partial failure, double posting, and blocks operational latency.

## Problem

Sale creation must succeed even if GL posting is temporarily unavailable. Retries must not create duplicate journals.

## Decision

Use **Transactional Outbox** pattern (already implemented):

1. Operational module commits business transaction
2. `emit*Accounting()` enqueues `AccountingOutbox` row (idempotent upsert)
3. `processAccountingOutbox()` processes asynchronously (or inline if `autoPostEnabled`)
4. `IntegrationLink` dedupes `(tenantId, sourceType, sourceId, eventType)`

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Synchronous journal in same TX | GL failure rolls back sale — unacceptable for POS |
| Message queue (RabbitMQ/Kafka) | Additional infra; outbox in Postgres sufficient at scale |
| Polling external ERP | Hexalyte owns GL; no external system |

## Trade-offs

- Eventual consistency with guaranteed delivery
- Idempotent by design
- No extra message broker
- Slight delay before GL reflects operation (acceptable)
- Outbox processor must be monitored

## Consequences

- All new monetary side effects must enqueue outbox, never write journals directly from modules
- New event types require reader + engine handler + IntegrationLink key
- Monitoring: track outbox `FAILED` count and `attempts`

## Future Review

2027-07-20 — Revisit async worker separation if outbox backlog exceeds SLA.
