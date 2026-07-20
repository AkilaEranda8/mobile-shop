# ADR-005: Business Rules Engine

**Status:** Accepted  
**Date:** 2026-07-20

## Context

Hardcoded rules exist today: opening balance detection (`OPENING_BALANCE`), accounting skip lists, COGS bucket classification, credit return allocation. These are scattered as magic strings and conditionals.

## Problem

Rules change per tenant or regulation without code deploys. Undocumented conditionals cause regression when refactored.

## Decision

Introduce a **Business Rules Engine** (phased):

- **Phase 1:** Rule registry + evaluator that mirrors current hardcoded defaults (read-only)
- **Phase 2:** Optional tenant overrides in JSON (additive)
- **Phase 3:** Admin UI for rule management

Evaluation precedence: tenant override → feature flag → default implementation.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Rules in database only | No type safety; hard to test |
| External rules engine (Drools) | Over-engineered for current team |
| Keep hardcoding | Does not scale; ADR-004 violated |

## Trade-offs

- Rules testable in isolation
- Tenant differentiation without code deploy
- Indirection; debugging requires rule key tracing
- Must prevent rules from executing side effects in Phase 1

## Consequences

- Magic strings move to `business-rules.constants.ts` then rule keys
- Modules call `evaluateRule(tenantId, key, context)` instead of inline if/else
- No behavior change until tenant explicitly overrides

## Future Review

2027-07-20 — After 10+ rules catalogued and covered by unit tests.
