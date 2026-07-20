# Hexalyte — File Architecture

> Folder / file map of the monorepo. Companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md).  
> **Updated:** July 2026

---

## Root

```
windsurf-project/
├── apps/
│   ├── web/                 # Tenant shop UI + POS (Next.js :3000)
│   ├── backend/             # REST API (Express :3001)
│   └── admin/               # Platform admin UI (Next.js :3002)
├── docs/                    # Manuals + architecture
├── nginx/                   # Production reverse proxy
├── scripts/                 # Deploy / SSL / helpers
├── docker-compose.yml
├── docker-compose-hexalyte.yml
├── package.json             # npm workspaces root
└── README.md
```

No `packages/` shared library — types and settings helpers are duplicated in web/backend where needed.

---

## Backend — `apps/backend`

```
apps/backend/
├── prisma/
│   ├── schema.prisma        # All models (shared schema + tenantId)
│   └── migrations/
├── src/
│   ├── app.ts               # Express app: middleware + route mounts
│   ├── config/              # Env, rate-limit settings
│   ├── database/            # Seeds, one-off diagnose scripts
│   ├── jobs/                # Cron-style jobs (e.g. trial expiry)
│   ├── middleware/          # Auth, active-branch, …
│   ├── modules/             # Domain modules (see below)
│   └── utils/               # Shared helpers (stock, SKU, response, …)
└── package.json
```

### Module pattern

Typical domain folder:

```
modules/<domain>/
├── <domain>.routes.ts       # Express router
├── <domain>.controller.ts   # Optional HTTP handlers
├── <domain>.service.ts      # Business logic + Prisma
├── <domain>.schema.ts       # Zod validation (when present)
└── *.util.ts                # Helpers
```

### `src/modules/` (domain map)

| Folder | Responsibility |
|--------|----------------|
| `auth/` | Login, JWT / Keycloak, password flows |
| `users/` | Staff users, roles |
| `tenants/` | Tenant CRUD, features, invoice settings, branches |
| `products/` | Catalog, variants, IMEI routes |
| `inventory/` | Stock transfer |
| `sales/` | POS sales, returns |
| `customers/` | CRM / credit |
| `suppliers/` | Suppliers, POs, payments, label endpoints |
| `repairs/` | Repair tickets |
| `warranty/` | Warranties / certificates |
| `exchanges/` | Device trade-in |
| `finance/` | Expenses, P&L, business financials |
| `accounting/` | GL, journals, AR/AP, payroll, outbox integration |
| `daily-closing/` | Day close / day lock |
| `daily-reload/` | Reload commissions |
| `profit-allocation/` | Profit split / funds |
| `analytics/` | Dashboard analytics routes |
| `whatsapp/` | Baileys sessions, send invoice |
| `delivery/` | Delivery orders / tracking |
| `upload/` | File uploads |
| `services/` | Shop services catalog |
| `device-catalog/` | Device models catalog |
| `master-catalog/` | Platform master products (+ admin routes) |
| `platform/` | Platform-level config |
| `admin/` | `/admin/v1` aggregator |
| `release-notes/` | Release notes (tenant + admin) |
| `feature-suggestions/` | Feedback / notifications |

### Accounting submodule layout

```
modules/accounting/
├── accounting.routes.ts
├── accounting.service.ts
├── coa/                     # Chart of accounts
├── journals/
├── periods/
├── cash-bank/
├── petty-cash/
├── payroll/
├── tax/
├── subledgers/              # AR / AP
├── reports/
├── audit/
├── seed/
└── integration/             # Outbox → auto journals
    ├── accounting-outbox.service.ts
    ├── auto-journal.engine.ts
    └── source-readers/      # sale, purchase, repair, …
```

### Key entry / infra files

| File | Role |
|------|------|
| `src/app.ts` | Mounts all routers under `/api/v1` and `/admin/v1` |
| `src/middleware/` | `authenticate`, tenant access, `active-branch` |
| `prisma/schema.prisma` | Data model source of truth |
| `src/modules/tenants/invoice-settings.*` | Thermal / A4 / barcode label JSON |

---

## Web (shop) — `apps/web`

```
apps/web/
└── src/
    ├── app/                 # Next.js App Router pages
    ├── components/          # Feature UI
    ├── lib/                 # API client, settings, print, offline
    ├── stores/              # Zustand (POS, …)
    ├── types/
    └── i18n/
```

### `src/app/` routes

```
app/
├── (auth)/                  # login, register, forgot/reset password
├── (dashboard)/             # Authenticated shell (Sidebar + Header)
│   ├── layout.tsx
│   ├── page.tsx             # Home / overview aliases
│   ├── dashboard/           # Canonical feature routes
│   │   ├── pos/
│   │   ├── sales/, returns/
│   │   ├── inventory/, imei/, stock-transfer/
│   │   ├── purchase-orders/, suppliers/, supplier-payments/
│   │   ├── repairs/[id]/
│   │   ├── warranty/, exchanges/, delivery/
│   │   ├── finance/, expenses/, profit-loss/, daily-closing/
│   │   ├── accounting/…     # journals, cash-bank, ar-ap, …
│   │   ├── reports/, analytics/
│   │   ├── whatsapp/, daily-reload/
│   │   ├── settings/, settings/barcode-labels/
│   │   ├── branches/, staff/
│   │   └── …
│   ├── inventory/, repairs/, …   # Short aliases → same features
│   └── settings/
├── warranty/verify/[code]/  # Public warranty verify
├── impersonate/
├── support-session/
├── privacy/, terms/
└── page.tsx                 # Marketing / entry
```

Many features exist both as `/dashboard/...` and shorter aliases (e.g. `/inventory`, `/repairs`).

### `src/components/` (by feature)

| Folder | UI |
|--------|-----|
| `layout/` | Sidebar, Header, branch control, banners |
| `pos/` | POS overlay, cart, reload panel, shortcuts |
| `invoice/` | Thermal, A4, warranty cert, customizers |
| `inventory/` | Add product/stock, barcode label preview/customizer |
| `suppliers/` | PO import, shared supplier UI |
| `repairs/` | Details view/modals, parts profit |
| `delivery/` | Orders, waybill, tracking |
| `exchanges/` | Exchange wizard |
| `finance/`, `daily-closing/`, `accounting/` | Money UIs |
| `whatsapp/` | Connection / invoice / history tabs |
| `reports/`, `dashboard/`, `settings/` | Reports, health card, manuals |
| `table/`, `ui/` | Shared table + primitives |
| `offline/` | Service worker register |

### `src/lib/` (important files)

| File / folder | Role |
|---------------|------|
| `api.ts` | HTTP client (Bearer, tenant, branch headers) |
| `hooks.ts` | Hand-rolled data hooks |
| `auth.ts`, `tenant-context.ts`, `active-branch.ts` | Session / tenancy |
| `invoiceSettings.ts` | Invoice + barcode label settings types |
| `barcode-print.ts` | Sticker sheet print/preview |
| `printReceipt.ts`, `printHtml.ts`, `invoice-pdf.ts` | Print pipelines |
| `tenant-features.ts` | Feature flag helpers |
| `offline/` | IndexedDB queue, product cache, sync |
| `repair-*.util.ts` | Repair print / invoice / statement |

---

## Admin — `apps/admin`

```
apps/admin/
└── src/
    ├── app/
    │   ├── (auth)/login/
    │   └── (admin)/
    │       ├── dashboard/
    │       ├── tenants/[id]/
    │       ├── subscriptions/
    │       ├── master-catalog/
    │       ├── whatsapp/
    │       ├── release-notes/
    │       ├── feature-suggestions/
    │       ├── announcements/, notifications/
    │       ├── support-tools/, system-health/
    │       ├── activity-logs/, analytics/
    │       ├── auth-iam/, settings/
    │       └── layout.tsx
    ├── components/
    │   ├── layout/          # AdminSidebar, AdminHeader
    │   ├── tenants/
    │   ├── subscriptions/
    │   └── ui/
    ├── lib/                 # api.ts, invoice helpers
    └── types/
```

Talks to backend **`/admin/v1`** (platform JWT / admin role).

---

## Ops / config files

| Path | Role |
|------|------|
| `nginx/hexalyte.conf` | Host → web/admin/api routing |
| `docker-compose.yml` | Local/prod-ish stack |
| `.env.example` | Env template |
| `scripts/` | Deploy, SSL, seed helpers |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/HEXALYTE_SYSTEM_GUIDE_EN_SI.md` | Run / use guide |
| `docs/HEXALYTE_USER_MANUAL_EN_SI.md` | End-user manual |

---

## Quick “where do I change X?”

| Change | Start here |
|--------|------------|
| New API endpoint | `apps/backend/src/modules/<domain>/` + mount in `app.ts` |
| DB model | `apps/backend/prisma/schema.prisma` |
| Shop page | `apps/web/src/app/(dashboard)/dashboard/<feature>/` |
| POS UI | `apps/web/src/components/pos/` |
| Invoice / thermal / barcodes | `invoiceSettings` (tenant) + `components/invoice/` + `lib/barcode-print.ts` |
| Tenant features | `modules/tenants/tenant-features.ts` + web `lib/tenant-features.ts` |
| Platform admin screen | `apps/admin/src/app/(admin)/` |
| Nginx / domains | `nginx/hexalyte.conf` |
