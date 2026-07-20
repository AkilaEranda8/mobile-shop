# Configuration Engine (Phase 1)

Normalize reads/writes of tenant JSON settings domains with defaults + in-process TTL cache.

**Flag:** none — same normalize semantics as before  
**Blueprint:** Section 4.3.4  
**Must not:** change business outcomes when config unset

## Domains

| Domain | Tenant column |
|--------|----------------|
| `invoice` | `invoiceSettings` |
| `reload` | `reloadSettings` |
| `paymentMethod` | `paymentMethodSettings` |
| `productVariant` | `productVariantSettings` |
| `productCode` | `productCodeSettings` |

## Entrypoints

| Function | Use |
|----------|-----|
| `getTenantConfig(tenantId, domain)` | Read + normalize (+ cache) |
| `setTenantConfig(tenantId, domain, patch)` | Write + normalize + invalidate |
| `getAllTenantConfigs(tenantId)` | Aggregated bag |
| `listConfigDomains()` | Domain catalog |
| `invalidateTenantConfigCache` | Manual bust |

## API

- `GET /api/v1/tenants/me/settings` — aggregated settings for current tenant
- `GET /api/v1/tenants/:id/settings` — same for tenant id
- `GET /api/v1/tenants/config-domains` — domain metadata
- Existing per-domain GET/PATCH routes unchanged (now via engine)

## Consumers

- `tenants.service.ts` — all settings get/update methods
