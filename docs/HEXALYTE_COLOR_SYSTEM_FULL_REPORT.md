# Hexalyte — Full System Color Report (All Pages)

**Date:** 2026-09-05  
**Intended brand:** Blue `#2563eb` (`--brand-primary`)  
**Companion:** `#3b82f6` / hover `#1d4ed8` / cyan `#06b6d4`  
**Legacy problem:** Violet/purple (`#7c3aed`, `violet-*`) still used across many pages

---

## Verdict

| Layer | Status |
|-------|--------|
| CSS variables `--brand-*` | Aligned blue |
| Default Appearance accent | Blue |
| Tailwind `brand` scale | Still purple (legacy) |
| Most dashboard page chrome | Violet class leftovers |
| Retail POS Hexa / Nova | Blue aligned |
| Wholesale POS | Blue aligned |
| Support Center | Sky isolate (`sky-600`) |
| Hire Purchase | Emerald + sky isolate |
| Marketing / Auth | Purple-forward |
| Admin Hub | Gray isolate (`#111827`) — not Hexalyte blue |

**Note:** Light mode remaps many `violet-*` classes toward blue in `globals.css`, so some screens look bluer than the source suggests. Dark mode + hardcoded `#7c3aed` still show real purple.

---

## Brand tokens (source of truth)

| Token | Light | Dark |
|-------|-------|------|
| `--brand-primary` | `#2563eb` | `#2563eb` |
| `--brand-light` | `#3b82f6` | `#3b82f6` |
| `--brand-hover` | `#1d4ed8` | `#1d4ed8` |
| `--bg-primary` | `#ffffff` | `#080c14` |
| `--bg-card` | `#ffffff` | `#0f1623` |
| `--text-primary` | `#0f172a` | `#f1f5f9` |
| `--text-muted` | `#475569` | `#94a3b8` |

**Files:** `apps/web/src/app/globals.css`, `apps/web/src/lib/appearance.ts`

---

## All pages / areas inventory

### Public & Auth

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Landing | `/` | Dark + **violet** glows, cyan | Purple leftover | High |
| Login | `/login` | Dark; violet orbs; CTA brand blue | Mixed | High |
| Register | `/register` | Violet steps/plans | Purple leftover | High |
| Forgot / Reset | `/forgot-password`, `/reset-password` | Violet blur; brand CTA | Mixed | Medium |
| Privacy / Terms | `/privacy`, `/terms` | Violet links | Purple leftover | Medium |
| Warranty verify | `/warranty/verify/[code]` | Sparse violet | Purple leftover | Low |

### App shell (all dashboard)

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Shell / CSS vars | `(dashboard)/*` | White / dark surfaces; blue active nav | Brand OK | Low |
| Sidebar | global | Blue active; violet badges; sky chips | Mixed | Medium |
| Header / search | global | Search icons violet | Purple leftover | Medium |

### Sales & customers

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Dashboard home | `/dashboard` | Charts blue; links violet; purple KPI chips | Mixed | Medium |
| POS | `/dashboard/pos`, `/pos` | Skin blue (Hexa/Nova) | Blue | Low |
| Sales | `/dashboard/sales` | Heavy violet | Purple leftover | High |
| Returns | `/dashboard/returns` | Violet | Purple leftover | Medium |
| Customers | `/dashboard/customers` | Dense violet | Purple leftover | High |
| Services | `/dashboard/services`, business-services | Violet + brand buttons | Purple leftover | Medium |

### Inventory & purchasing

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Inventory | `/inventory/*` | Heavy violet | Purple leftover | High |
| Stock transfer | `/dashboard/stock-transfer` | Sparse violet | Purple leftover | Low |
| Suppliers | `/dashboard/suppliers` | Dense violet | Purple leftover | High |
| Supplier payments | `/dashboard/supplier-payments` | Violet/cyan tiles | Purple leftover | Medium |
| Purchase orders | `/purchase-orders`, invoice | Violet; KPI `#7c3aed` | Purple leftover | High |
| Purchase returns | `/purchase-returns` | Dense violet | Purple leftover | High |
| Serial Tracker | `/dashboard/imei` | Very dense violet (~35) | Purple leftover | High |
| Barcode labels | `/settings/barcode-labels` | Violet chrome | Purple leftover | Medium |

### Service

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Repairs | `/dashboard/repairs`, `/repairs/[id]` | Violet→purple gradients | Purple leftover | High |
| Warranty | `/dashboard/warranty` | Dense violet (~38) | Purple leftover | High |
| Exchanges | `/dashboard/exchanges` | Lighter violet | Purple leftover | Medium |

### Finance

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Finance | `/dashboard/finance` | Violet + brand charts | Mixed | Medium |
| Profit & Loss | `/dashboard/profit-loss` | Brand charts + violet | Mixed | Medium |
| Expenses | `/dashboard/expenses` | Sparse violet | Purple leftover | Low |
| Profit allocation | `/dashboard/profit-allocation` | `#7c3aed` tone | Purple leftover | High |
| Daily closing | `/dashboard/daily-closing` | Violet | Purple leftover | Medium |
| Hire Purchase | `/dashboard/hire-purchase/*` | **Emerald + sky** | Intentional isolate | Low |
| Accounting | `/dashboard/accounting/*` | Brand totals + violet cards | Mixed | Medium |

### Wholesale

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Wholesale ops pages | `/dashboard/wholesale/*` (except POS) | Sky/emerald + violet | Mixed | Medium |
| Wholesale POS | `/dashboard/wholesale/pos` | `#3b82f6` / `#2563eb` dark | Blue aligned | Low |

### Reports / ops / HR / system

| Area | Routes | Dominant colors | Alignment | Severity |
|------|--------|-----------------|-----------|----------|
| Reports hub | `/dashboard/reports/*` | Brand charts + violet labels | Mixed | Medium |
| Extra reports | reload/category/customer/purchase… | Violet chips | Purple leftover | Medium–High |
| Daily reload | `/dashboard/daily-reload` | Violet | Purple leftover | Medium |
| Delivery | `/dashboard/delivery` | Violet; waybill `bg-violet-600` | Purple leftover | High |
| WhatsApp | `/dashboard/whatsapp` | Violet tabs + brand charts | Mixed | Medium |
| SMS | `/dashboard/sms` | Violet tabs | Purple leftover | Medium |
| Staff / roles | `/dashboard/staff` | Violet badges | Purple leftover | Medium |
| HR module | `/dashboard/hr/*` | Violet chrome + sky/emerald status | Mixed | Medium–High |
| Branches | `/dashboard/branches` | Dense violet plan badges | Purple leftover | High |
| Settings | `/dashboard/settings` | **Densest violet (~66)** | Purple leftover | High |
| User manual | `/dashboard/user-manual` | Violet TOC | Purple leftover | High |
| Release notes | `/dashboard/release-notes` | Violet | Purple leftover | Medium |
| **Support Center** | `/dashboard/support-tickets` | **Sky-600** CTAs, emerald online | Sky isolate | Low (intentional) |
| Feature suggestions | `/dashboard/feature-suggestions` | Violet cards | Purple leftover | Medium |

### POS skins

| Skin | Colors | Alignment |
|------|--------|-----------|
| Hexa Dark / Light | `#3B82F6` / `#2563EB` | Blue |
| Nova | `#3b82f6` / `#2563eb` | Blue |
| Studio | Teal `#14B8A6` + sky | Intentional isolate |

### Admin Hub (`apps/admin`)

| Area | Routes | Dominant colors | Alignment |
|------|--------|-----------------|-----------|
| Shell / login | `/`, `/login`, `(admin)/*` | Gray-900 buttons/nav | Gray isolate |
| Dashboard, tenants, payments, tickets, live-chat, settings… | `(admin)/*` | Gray + occasional violet/blue badges | Not Hexalyte blue |
| Subscriptions / tenants detail / release-notes | denser violet accents | Purple leftover accents |

---

## Highest-density purple leftover files

| Hits (approx) | File |
|---------------|------|
| ~66 | `apps/web/src/app/(dashboard)/settings/page.tsx` |
| ~59 | `apps/web/src/app/(dashboard)/repairs/page.tsx` |
| ~42 | `apps/web/src/components/repairs/RepairDetailsView.tsx` |
| ~42 | `apps/web/src/app/(dashboard)/inventory/page.tsx` |
| ~38 | `apps/web/src/app/(dashboard)/warranty/page.tsx` |
| ~35 | `apps/web/src/app/(dashboard)/dashboard/imei/page.tsx` |
| ~35 | `apps/web/src/components/suppliers/suppliers-shared.tsx` |
| ~30 | `apps/web/src/app/page.tsx` (landing) |
| ~28 | `apps/web/src/app/(dashboard)/customers/page.tsx` |
| Config | `apps/web/tailwind.config.ts` purple `brand` scale |
| Hardcoded | `purchase-orders/page.tsx`, `profit-allocation/page.tsx` → `#7c3aed` |

---

## Status colors

| Role | Values | Notes |
|------|--------|-------|
| Warn | Light `#0284c7` (sky) · Dark `#f59e0b` | Dual system |
| Success | `#22c55e` / `#16a34a` | No CSS var |
| Error | `#ef4444` / `#dc2626` | No CSS var |
| Info | `#0284c7` / `#3b82f6` | Sky/blue |

---

## Recommended fix order

1. Change Tailwind `brand` scale purple → blue (`#2563eb` family)
2. Replace top density pages: Settings, Repairs, Inventory, Warranty, Serial Tracker, Suppliers, Customers, Landing/Login
3. Replace hardcoded `#7c3aed` KPIs
4. Align Support Center to `--brand-*` **or** keep sky as intentional product skin (document it)
5. Decide Admin: stay gray isolate **or** adopt Hexalyte blue
6. Add `--status-success` / `--status-error` / `--status-info` CSS vars

---

## How to open this report

1. Press **Ctrl + P**
2. Type: `HEXALYTE_COLOR_SYSTEM_FULL_REPORT`
3. Enter

Path: `docs/HEXALYTE_COLOR_SYSTEM_FULL_REPORT.md`
