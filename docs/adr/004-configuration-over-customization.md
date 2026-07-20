# ADR-004: Configuration over Customization

**Status:** Accepted  
**Date:** 2026-07-20

## Context

Tenants request shop-specific behavior: invoice layouts, pricing modes, approval thresholds, reload commission rules, barcode formats. Custom code per tenant does not scale and creates unmaintainable forks.

## Problem

Hardcoding `if (tenant.slug === 'kasthuri')` or customer-specific branches in core modules destroys long-term stability.

## Decision

Prefer **Configuration over Customization**:

1. **TenantFeature** flags for module enablement
2. **Tenant JSON settings** (`invoiceSettings`, `reloadSettings`, etc.) with validated defaults
3. **Business Rules** catalog for conditional logic (Phase 2)
4. **Workflow configuration** for state transition graphs (Phase 3)

Defaults must equal current behavior when config is unset.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Per-tenant code branches | Unmaintainable; untestable matrix |
| White-label forks | Deployment nightmare |
| Plugin runtime (Phase 1) | Premature; adapter pattern sufficient |

## Trade-offs

- One codebase serves all tenants
- Tenant self-service for settings (invoice, labels)
- Configuration UI and validation investment required
- Complex rules may still need Business Rules engine

## Consequences

- Forbidden: tenant slug conditionals in domain logic
- New tenant-specific requests must map to config keys or rule keys
- Configuration Engine normalizes reads/writes

## Future Review

2028-01-20 — Assess Business Rules coverage vs remaining hardcoded conditionals.
