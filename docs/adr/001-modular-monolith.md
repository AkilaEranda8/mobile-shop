# ADR-001: Modular Monolith

**Status:** Accepted  
**Date:** 2026-07-20

## Context

Hexalyte serves thousands of tenant shops with POS, inventory, repairs, suppliers, finance, and optional GL accounting. The team is small relative to domain breadth. Operational complexity must remain manageable for 10+ years.

## Problem

Microservices would fragment transactions (sale + stock + accounting), increase deployment overhead, and multiply failure modes — without current scale justification.

## Decision

Adopt a **modular monolith**: one deployable backend (`apps/backend`) with clear domain modules (`sales`, `suppliers`, `repairs`, etc.) and shared engines for cross-cutting side effects.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Microservices per domain | Cross-domain transactions (sale→stock→GL) require distributed sagas; team size cannot support ops burden |
| Schema-per-tenant | Migration and reporting complexity; current row-level `tenantId` works at scale |
| Serverless functions | Cold starts, transaction boundaries, and Prisma connection pooling unsuitable for POS latency |

## Trade-offs

- Single transaction boundary for sale + stock + outbox
- One deployment pipeline
- Easier local development
- All modules share runtime; noisy neighbor possible (mitigated by rate limits)
- Must enforce module boundaries via code review, not network isolation

## Consequences

- New features go into existing modules or new module folders under `src/modules/`
- Cross-module calls must use engines/events, not direct service imports across domains
- Horizontal scaling = replicate entire backend (acceptable at current scale)

## Future Review

2028-07-20 — Revisit if tenant count exceeds 5,000 active or p99 API latency degrades under monolith load.
