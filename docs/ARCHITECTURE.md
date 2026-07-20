# Hexalyte — System Architecture

> **Source of truth:** monorepo as implemented (not aspirational README claims).  
> **Apps:** `apps/web` · `apps/backend` · `apps/admin`  
> **Updated:** July 2026

Multi-tenant SaaS for mobile shops, repair centers, and multi-branch retail.

| | |
|---|---|
| Workspace | npm workspaces |
| Web | Next.js 15, React 19, Tailwind, Zustand |
| Admin | Next.js 15 |
| API | Express 4, Prisma 5, Zod |
| DB | PostgreSQL 16 (shared schema + `tenantId`) |
| Cache | Redis 7 |
| Auth | App JWT (HS256) + optional Keycloak (RS256) |
| Ports (local) | Web **3000** · API **3001** · Admin **3002** |

> **README vs code:** README may still mention NestJS, schema-per-tenant, or Electron/Flutter. The running system is **Express** + **row-level multi-tenancy** in one Postgres schema. No desktop/mobile apps in this repo.

---

## 1. System context

```
Browser (tenant shop / platform admin)
        │
        ▼
   nginx (TLS, reverse proxy, X-Tenant-Slug)
        │
        ├──► apps/web     :3000   shop UI + POS
        ├──► apps/admin   :3002   platform control plane
        └──► apps/backend :3001   REST /api/v1 + /admin/v1
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   PostgreSQL    Redis      Optional:
   (tenantId)   (sessions,  Keycloak, S3,
                 blacklist,  SMTP, WhatsApp
                 WhatsApp)   (Baileys)
```

| Layer | Component | Role |
|-------|-----------|------|
| Client | `apps/web` :3000 | Tenant shop UI (POS, inventory, repairs, finance) |
| Client | `apps/admin` :3002 | Platform admin (tenants, plans, catalog) |
| Edge | `nginx/hexalyte.conf` | TLS, reverse proxy, `X-Tenant-Slug` |
| API | `apps/backend` :3001 | REST `/api/v1` + `/admin/v1` |
| Data | PostgreSQL 16 | Single schema, `tenantId` isolation |
| Cache | Redis 7 | Rate limits, JWT blacklist, WhatsApp sessions |
| Auth | App JWT + optional Keycloak | Bearer auth |
| Files | Local `/uploads` or AWS S3 | Logos, repair photos |

---

## 2. Monorepo layout

### Workspace apps

| Path | Package | Stack |
|------|---------|-------|
| `apps/web` | `@hexalyte/web` | Next 15, Tailwind, Zustand |
| `apps/backend` | `@hexalyte/backend` | Express, Prisma, Zod |
| `apps/admin` | `@hexalyte/admin` | Next 15 platform UI |

There is **no** `packages/` shared library folder. Feature flags and settings types are duplicated between web and backend where needed.

### Ops & docs

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | postgres, redis, web, backend, admin |
| `nginx/` | Production host routing |
| `scripts/` | Deploy, SSL, seed helpers |
| `docs/` | Keycloak, security, manuals, this architecture |
| `.env.example` | Root env for Compose |

---

## 3. Multi-tenancy & auth

### Tenant isolation

- **Row-level** isolation in one Postgres schema — business tables carry `tenantId`.
- JWT includes `tenantId`; middleware sets `req.tenantId`.
- Subdomain `{slug}.app.hexalyte.com` → nginx `X-Tenant-Slug` → client `x-tenant-id`.
- Branches via `Branch` / `UserBranch` + `x-active-branch-id` header.
- Per-tenant modules via `TenantFeature` (POS, REPAIRS, SUPPLIERS, ACCOUNTING, …).

### Auth / RBAC

- Bearer token on every API call (localStorage on web).
- Optional Keycloak RS256 JWKS; otherwise app JWT HS256.
- Redis blacklist on logout; trial / suspension checks.

**Roles (examples):** `PLATFORM_ADMIN` · `OWNER` · `MANAGER` · `CASHIER` · `TECHNICIAN`

### Request path (happy path)

```
Browser
  → nginx
  → Express authenticate
  → (Keycloak verify or JWT)
  → Redis blacklist check
  → ensureTenantAccess
  → resolveActiveBranch
  → domain service
  → PostgreSQL
  → JSON response
```

---

## 4. Frontend (`apps/web`)

| Domain | Primary routes | Feature flag |
|--------|----------------|--------------|
| Overview | `/dashboard` | — |
| POS / Sales | POS overlay, `/dashboard/sales`, returns | `POS` |
| Inventory | `/inventory`, stock-transfer | — |
| Suppliers / PO | `/dashboard/purchase-orders`, suppliers | `SUPPLIERS` |
| IMEI | `/dashboard/imei` | `IMEI` |
| Repairs | `/dashboard/repairs`, `/repairs/[id]` | `REPAIRS` |
| Warranty | `/dashboard/warranty` | `WARRANTY` |
| Finance | expenses, P&L, daily-closing, profit-allocation | various |
| Accounting | `/dashboard/accounting/*` | `ACCOUNTING` |
| Reports | `/dashboard/reports/*` | `REPORTS` |
| WhatsApp / Reload | whatsapp, daily-reload | `WHATSAPP` / `DAILY_RELOAD` |
| Settings | `/dashboard/settings`, barcode-labels, branches | — |

| Concern | Implementation |
|---------|----------------|
| State | Zustand for POS UI; hand-rolled `useApi` hooks (no React Query) |
| Offline | Offline sales queue in IndexedDB |
| API client | `apps/web/src/lib/api.ts` — Bearer + tenant/branch headers; 401 refresh retry |
| Print / invoice | Tenant `invoiceSettings` JSON: thermal, A4 templates, `barcodeLabel` stickers |

---

## 5. Backend modules (`/api/v1`)

| Mount | Domain |
|-------|--------|
| `/auth`, `/users` | Login, JWT/Keycloak, profile |
| `/tenants`, `/branches` | Tenant settings, features, branches |
| `/products`, `/imei`, `/inventory` | Catalog, IMEI units, stock transfer |
| `/sales`, `/customers` | POS sales, returns, customers |
| `/suppliers` | Suppliers, POs, payments, labels |
| `/repairs`, `/warranties`, `/exchanges` | After-sales |
| `/finance`, `/accounting`, `/daily-closing` | Money & GL |
| `/analytics`, `/daily-reloads`, `/profit-allocation` | Ops analytics |
| `/whatsapp`, `/delivery`, `/upload` | Comms & files |
| `/admin/v1` | Platform admin only |

---

## 6. Core domain flows

### Sale (POS)

1. Cart in POS overlay (online or offline queue)
2. `POST /sales` — stock ↓, IMEI sold, warranties
3. Finance transaction + accounting outbox
4. Thermal / PDF print per `invoiceSettings`

### Receive PO + barcodes

1. Create PO → receive (stock ↑, cost average)
2. `GET …/purchase-orders/:id/labels`
3. Preview modal → print stickers
4. Layout from **Settings → Barcode Labels** (`invoiceSettings.barcodeLabel`)

### Repair ticket lifecycle

```
RECEIVED → DIAGNOSED → IN_REPAIR → QC → READY → DELIVERED
```

Parts pull inventory; collect-payment creates a REPAIR sale.

### Settings (invoice / stickers)

- `Tenant.invoiceSettings` JSON (shop, thermal, templates)
- `barcodeLabel` presets + full customize
- `PATCH /tenants/:id/invoice-settings`

---

## 7. Deploy topology

| Host | Upstream |
|------|----------|
| `app.hexalyte.com` | web :3000 |
| `*.app.hexalyte.com` | web + `/api/` → backend |
| `api.shop.hexalyte.com` | backend :3001 |
| `admin2.hexalyte.com` | admin :3002 |

Local / Compose: see `docker-compose.yml` and `docs/HEXALYTE_SYSTEM_GUIDE_EN_SI.md`.

---

## 8. Related docs

| Doc | Contents |
|-----|----------|
| [`FILE_ARCHITECTURE.md`](./FILE_ARCHITECTURE.md) | Folder / file map (web, backend, admin) |
| [`HEXALYTE_SYSTEM_GUIDE_EN_SI.md`](./HEXALYTE_SYSTEM_GUIDE_EN_SI.md) | Run, deploy, modules (EN + SI) |
| [`HEXALYTE_USER_MANUAL_EN_SI.md`](./HEXALYTE_USER_MANUAL_EN_SI.md) | End-user how-to (EN + SI) |

**Code pointers:** `apps/backend/src/app.ts`, `apps/backend/prisma/schema.prisma`, auth middleware, `nginx/hexalyte.conf`, `docker-compose.yml`.

## Official Engineering Bible

For long-term onboarding and maintainability governance, see:
- `docs/ENTERPRISE_PLATFORM_ARCHITECTURE_BLUEPRINT_10Y.md`
- **`docs/ENGINES_PHASE1_REPORT.md`** — **all shared engines Phase 1 summary (start here)**
- `docs/adr/` — Architectural Decision Records (ADR-001–005)
- Per-engine detail: `docs/*-adoption.md` (inventory, pricing, report, workflow, template, audit, notification, configuration, business-rules)
- Modules: `apps/backend/src/modules/{inventory,pricing,report,workflow-validators,template,audit,notification,configuration,business-rules}-engine/`
