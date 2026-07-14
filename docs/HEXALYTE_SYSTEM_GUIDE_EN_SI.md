# Hexalyte System Guide | Hexalyte පද්ධති මාර්ගෝපදේශය

> **Version:** 1.0 · **Updated:** June 2026  
> Complete guide to run, use, and manage the Hexalyte mobile shop platform.  
> Hexalyte mobile shop platform එක run කරන්න, use කරන්න, manage කරන්න සම්පූර්ණ මාර්ගෝපදේශය.

---

## Table of Contents | අන්තර්ගතය

1. [What is Hexalyte?](#1-what-is-hexalyte)
2. [System Architecture](#2-system-architecture)
3. [Requirements](#3-requirements)
4. [Run the Full System Locally](#4-run-the-full-system-locally)
5. [Production URLs & Deploy](#5-production-urls--deploy)
6. [Login & User Roles](#6-login--user-roles)
7. [Module Guide — How to Use Each Feature](#7-module-guide--how-to-use-each-feature)
8. [POS Quick Reference](#8-pos-quick-reference)
9. [Settings & Invoice / Bill Setup](#9-settings--invoice--bill-setup)
10. [Troubleshooting](#10-troubleshooting)
11. [Useful Commands Cheat Sheet](#11-useful-commands-cheat-sheet)

---

## 1. What is Hexalyte?

### English

**Hexalyte** is an all-in-one SaaS platform for mobile phone shops, repair centers, and accessory stores. One system handles:

- **POS / Billing** — sell products, print thermal or stock-form bills
- **Inventory** — products, IMEI tracking, stock, CSV import
- **Customers** — CRM, credit/outstanding balance
- **Repairs** — repair tickets from received to delivered
- **Warranty** — IMEI-bound warranty certificates & claims
- **Suppliers & Purchase Orders** — buying stock from suppliers
- **Finance** — income, expenses, daily closing, profit allocation
- **Reports & Analytics** — sales, category reports
- **WhatsApp** — send invoices to customers
- **Daily Reload** — mobile reload commission tracking
- **Device Exchange** — trade-in / exchange flow
- **Delivery** — delivery orders
- **Staff & Branches** — multi-user, multi-branch

Each shop is a **tenant** (separate business account). Data is isolated per tenant.

### සිංහල

**Hexalyte** යනු mobile phone shops, repair centers, accessory stores සඳහා all-in-one SaaS platform එකකි. එක system එකකින්:

- **POS / Billing** — products විකිණීම, thermal / stock-form bills print කිරීම
- **Inventory** — products, IMEI tracking, stock, CSV import
- **Customers** — CRM, credit/outstanding balance
- **Repairs** — repair tickets (received → delivered)
- **Warranty** — IMEI-bound warranty certificates & claims
- **Suppliers & Purchase Orders** — suppliers ගෙන් stock ගැනීම
- **Finance** — income, expenses, daily closing, profit allocation
- **Reports & Analytics** — sales, category reports
- **WhatsApp** — customers ට invoices යැවීම
- **Daily Reload** — reload commission tracking
- **Device Exchange** — trade-in / exchange
- **Delivery** — delivery orders
- **Staff & Branches** — multi-user, multi-branch

Shop එකක් = **tenant** (වෙනම business account). Data tenant එකකට isolate වෙනවා.

---

## 2. System Architecture

### English

| Component | Technology | Port (local) |
|-----------|------------|--------------|
| **Web App** (shop UI + POS) | Next.js 15, React, TypeScript | **3000** |
| **Admin Panel** (platform admin) | Next.js 15 | **3002** |
| **Backend API** | Node.js 20, Express, Prisma | **3001** |
| **Database** | PostgreSQL 16 | **5432** |
| **Cache / Sessions** | Redis 7 | **6379** |

**Project folder structure:**

```
windsurf-project/
├── apps/
│   ├── web/          ← Shop dashboard + POS
│   ├── admin/        ← Platform admin console
│   └── backend/      ← REST API
├── docker-compose.yml
├── .env.example
├── docs/             ← Documentation (this file)
└── scripts/          ← Deploy scripts
```

**API base URL (local):** `http://localhost:3001/api/v1`  
**Health check:** `http://localhost:3001/health`

### සිංහල

| Component | Technology | Port (local) |
|-----------|------------|--------------|
| **Web App** (shop UI + POS) | Next.js 15, React | **3000** |
| **Admin Panel** | Next.js 15 | **3002** |
| **Backend API** | Node.js, Express, Prisma | **3001** |
| **Database** | PostgreSQL 16 | **5432** |
| **Cache** | Redis 7 | **6379** |

**API (local):** `http://localhost:3001/api/v1`

---

## 3. Requirements

### English

Before you start, install:

| Tool | Minimum version |
|------|-----------------|
| **Node.js** | 20+ |
| **npm** | 10+ |
| **Docker Desktop** | Latest (for Postgres + Redis) |
| **Git** | Any recent version |

Optional: **PuTTY/plink** (for remote production deploy from Windows)

### සිංහල

පටන් ගැනීමට පෙර install කරන්න:

| Tool | Version |
|------|---------|
| **Node.js** | 20+ |
| **npm** | 10+ |
| **Docker Desktop** | Latest |
| **Git** | Recent |

Production deploy කරන්න Windows එකෙන් නම් **PuTTY/plink** optional.

---

## 4. Run the Full System Locally

### English — Step by step

#### Step 1 — Clone & install

```bash
git clone https://github.com/AkilaEranda8/mobile-shop.git
cd mobile-shop
cp .env.example .env
npm install --workspaces --include-workspace-root
```

Edit `.env` and set at minimum:

```env
DATABASE_URL=postgresql://hexalyte:YOUR_DB_PASSWORD@localhost:5432/hexalyte
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@localhost:6379
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
FRONTEND_URL=http://localhost:3000
PLATFORM_ADMIN_EMAIL=admin@hexalyte.com
PLATFORM_ADMIN_PASSWORD=YourSecurePassword123
```

> **Note:** Redis passwords with `@`, `#`, etc. must be URL-encoded in `REDIS_URL`. See `.env.example`.

#### Step 2 — Start database & Redis (Docker)

```bash
docker compose up -d postgres redis
```

Wait ~10 seconds for Postgres to be healthy.

#### Step 3 — Start Backend (Terminal 1)

```bash
npm run dev --workspace=apps/backend
```

This will:
- Apply database schema (`prisma db push`)
- Generate Prisma client
- Start API on **http://localhost:3001**

First run creates platform admin if `PLATFORM_ADMIN_EMAIL` + `PLATFORM_ADMIN_PASSWORD` are set.

#### Step 4 — Start Web App (Terminal 2)

```bash
npm run dev:web
```

Open **http://localhost:3000**

#### Step 5 — Start Admin Panel (Terminal 3 — optional)

```bash
npm run dev --workspace=apps/admin
```

Open **http://localhost:3002** (platform admin only)

#### Alternative — Full stack in Docker

```bash
docker compose up --build
```

Runs postgres, redis, backend, web, admin together.  
Web Docker build points to production API URLs — **for development, native run (Steps 1–4) is recommended.**

#### Register a new shop (tenant)

1. Go to **http://localhost:3000/register**
2. Fill shop name, owner email, password
3. 14-day trial starts automatically
4. Login and use the dashboard

#### Verify everything works

| Check | URL / Action |
|-------|----------------|
| API health | http://localhost:3001/health |
| Login page | http://localhost:3000/login |
| POS | Dashboard → POS (or `/pos`) |
| Database GUI | `npm run db:studio --workspace=apps/backend` |

---

### සිංහala — පියවරෙන් පියවර

#### පියවර 1 — Clone & install

```bash
git clone https://github.com/AkilaEranda8/mobile-shop.git
cd mobile-shop
cp .env.example .env
npm install --workspaces --include-workspace-root
```

`.env` file එක edit කර minimum values set කරන්න (English section එක බලන්න).

#### පියවර 2 — Database & Redis start (Docker)

```bash
docker compose up -d postgres redis
```

Postgres healthy වෙන්න ~10 seconds wait කරන්න.

#### පියවර 3 — Backend start (Terminal 1)

```bash
npm run dev --workspace=apps/backend
```

API **http://localhost:3001** එකේ run වෙනවා.

#### පියවර 4 — Web App start (Terminal 2)

```bash
npm run dev:web
```

Browser එකේ **http://localhost:3000** open කරන්න.

#### පියවර 5 — Admin Panel (Terminal 3 — optional)

```bash
npm run dev --workspace=apps/admin
```

**http://localhost:3002** — platform admin only.

#### නව shop register කිරීම

1. **http://localhost:3000/register** යන්න
2. Shop name, email, password දාන්න
3. 14-day trial auto start
4. Login කර dashboard use කරන්න

#### System හරිද verify කිරීම

| Check | URL |
|-------|-----|
| API | http://localhost:3001/health |
| Login | http://localhost:3000/login |
| POS | Dashboard → POS |
| DB GUI | `npm run db:studio --workspace=apps/backend` |

---

## 5. Production URLs & Deploy

### English

**Live production (Kasthuri / Hexalyte server):**

| Service | URL |
|---------|-----|
| Shop Web App | https://app.hexalyte.com |
| Tenant shops | https://{shop-slug}.app.hexalyte.com |
| API | https://api.shop.hexalyte.com |
| Admin Panel | https://admin2.hexalyte.com |

**Deploy to production server** (from developer machine, after commit & push):

```bash
# On server (157.180.113.249) — typical web-only update:
cd /opt/hexalyte
git pull origin main
docker compose build web
docker compose up -d --no-deps --force-recreate web
```

Full stack rebuild:

```bash
docker compose build
docker compose up -d --remove-orphans
docker compose exec -T backend npx prisma migrate deploy
```

### සිංහala

**Production URLs:**

| Service | URL |
|---------|-----|
| Shop App | https://app.hexalyte.com |
| Tenant shop | https://{shop-slug}.app.hexalyte.com |
| API | https://api.shop.hexalyte.com |
| Admin | https://admin2.hexalyte.com |

**Deploy (web update):**

```bash
cd /opt/hexalyte
git pull origin main
docker compose build web
docker compose up -d --no-deps --force-recreate web
```

---

## 6. Login & User Roles

### English

| Role | Access |
|------|--------|
| **OWNER** | Full shop access — settings, staff, finance, all modules |
| **MANAGER** | Most operations — sales, inventory, reports |
| **CASHIER** | POS, sales, customers (limited admin) |
| **TECHNICIAN** | Repairs, warranty claims |
| **PLATFORM_ADMIN** | Admin panel only — manage all tenants, subscriptions |

**Login flow:**
1. Open shop URL (or localhost:3000)
2. Enter email + password
3. JWT token stored in browser
4. Session expires — use refresh or login again

**Forgot password:** `/forgot-password` → email link → `/reset-password`

### සිංහala

| Role | Access |
|------|--------|
| **OWNER** | Full access — settings, staff, finance |
| **MANAGER** | Sales, inventory, reports |
| **CASHIER** | POS, sales |
| **TECHNICIAN** | Repairs, warranty |
| **PLATFORM_ADMIN** | Admin panel — all tenants |

**Login:** email + password → browser token save.  
**Password reset:** `/forgot-password` → email link.

---

## 7. Module Guide — How to Use Each Feature

### 7.1 POS (Point of Sale)

#### English
1. Open **POS** from sidebar or `/pos`
2. Search/scan products or scan IMEI barcode
3. Add customer (required for warranty products)
4. Edit price or **warranty period/note** per cart line (click warranty badge)
5. Apply discount if needed
6. Press **F9** or **Pay Now** → choose payment method
7. Bill auto-prints if enabled in Settings → Invoice
8. Stock-form bill shows warranty note + terms at page bottom

**Keyboard shortcuts:** F2 customer · F3 pay · F5 reprint · F9 checkout · F10 new sale

#### සිංහala
1. Sidebar → **POS** open කරන්න
2. Products search කරන්න / IMEI scan කරන්න
3. Customer select කරන්න (warranty products සඳහා අනිවාර්ය)
4. Price / **warranty period & note** cart line එකෙන් edit කරන්න
5. Discount apply කරන්න
6. **F9** / **Pay Now** → payment method
7. Settings → Invoice එකේ auto-print on/off
8. Stock-form bill එකේ warranty note + terms page bottom එකේ

---

### 7.2 Inventory / Products

#### English
- **Inventory** → view all products, stock, filters
- **Add Product** → brand, category, sub-category, device model, pricing, warranty, IMEI tracking, warranty note
- **Import CSV** → bulk import aligned with Create Product fields
- **Product Details** → click product → full info modal
- **Add Stock** → receive stock / PO receive
- **IMEI Tracker** → register & track serial numbers

#### සිංහala
- **Inventory** → products, stock බලන්න
- **Add Product** → brand, category, price, warranty, IMEI, warranty note
- **Import CSV** → bulk products add
- **Product Details** → product click → full details
- **Add Stock** → stock receive
- **IMEI Tracker** → IMEI register & track

---

### 7.3 Sales & Returns

#### English
- **Sales** → all invoices, reprint, filter by date
- **Returns** → process sale returns, restock items

#### සිංහala
- **Sales** → invoices, reprint
- **Returns** → return process, stock restore

---

### 7.4 Customers

#### English
- Add/edit customers with phone, address
- Track **outstanding balance** (credit sales)
- Collect outstanding from POS checkout

#### සිංහala
- Customers add/edit
- **Outstanding balance** track
- POS එකෙන් outstanding collect

---

### 7.5 Repairs

#### English
Flow: **Received → Diagnosed → In-Repair → QC → Ready → Delivered**

1. Create repair ticket with device + issue
2. Assign technician, update status
3. Set estimated/actual cost
4. Print repair invoice (Kasthuri format available)

#### සිංහala
Flow: **Received → Diagnosed → In-Repair → QC → Ready → Delivered**

Ticket create → technician assign → status update → invoice print.

---

### 7.6 Warranty

#### English
- Auto-created on POS sale for products with warranty months > 0
- **Warranty** page → view all certificates, claims
- Public verify: `/warranty/verify/{code}`
- POS: edit warranty period & note before checkout
- Bill: product warranty note on stock-form invoice

#### සිංහala
- POS sale එකේ warranty months > 0 නම් auto create
- **Warranty** page → certificates, claims
- Public verify link
- POS: checkout එකට පෙර warranty edit
- Bill: stock-form invoice එකේ warranty note

---

### 7.7 Suppliers & Purchase Orders

#### English
- Manage suppliers
- Create PO → send → receive goods → stock updates

#### සිංහala
- Suppliers manage
- PO create → receive → stock update

---

### 7.8 Finance

#### English
- **Finance** → transactions, daily summary
- **Expenses** → record shop expenses
- **Daily Closing** → end-of-day cash count, denomination breakdown, day lock
- **Profit Allocation** → distribute profit to funds/categories

#### සිංහala
- **Finance** → transactions
- **Expenses** → expenses record
- **Daily Closing** → day end cash count, lock
- **Profit Allocation** → profit distribute

---

### 7.9 Reports & Analytics

#### English
- **Reports** → sales reports, export
- **Category Report** → sales by category
- **Analytics** → charts, trends

#### සිංහala
- **Reports** → sales reports
- **Category Report** → category-wise sales
- **Analytics** → charts

---

### 7.10 WhatsApp

#### English
1. Settings → connect WhatsApp (QR scan)
2. From completed sale → send invoice PDF/text to customer

#### සිංහala
1. Settings → WhatsApp QR connect
2. Sale complete → customer ට invoice send

---

### 7.11 Daily Reload

#### English
Track mobile reload / recharge card sales and commissions per provider.

#### සිංහala
Reload / recharge card sales & commission track.

---

### 7.12 Device Exchange

#### English
Exchange old device for new — trade-in credit on bill, exchange wizard.

#### සිංහala
Device exchange — trade-in credit bill එකේ.

---

### 7.13 Staff & Settings

#### English
- **Staff** → add users, assign roles & branches
- **Settings** → shop profile, invoice/thermal settings, features, password

#### සිංහala
- **Staff** → users, roles
- **Settings** → shop info, invoice settings, features

---

### 7.14 Admin Panel (Platform)

#### English
URL: **https://admin2.hexalyte.com** (or localhost:3002)

- Manage all tenant shops
- Enable/disable features per tenant
- Subscriptions, trials, suspensions
- System health, release notes

Login requires **PLATFORM_ADMIN** role.

#### සිංහala
**Admin panel** — all shops manage, features on/off, subscriptions, trials.  
PLATFORM_ADMIN role අවශ්‍ය.

---

## 8. POS Quick Reference

### English

| Action | How |
|--------|-----|
| Add product | Click product card |
| Add IMEI product | Scan IMEI barcode |
| Edit price | Click price line → edit → Save |
| Edit warranty | Click warranty badge → pick period → note → Save |
| Select customer | F2 or customer dropdown |
| Checkout | F9 |
| Reprint last bill | F5 |
| New sale | F10 |
| Hold cart | F4 |
| Auto-print bill | Settings → Invoice → POS auto-print toggle |
| Bill format | Settings → Invoice → Thermal / Stock Form |

### සිංහala

| Action | How |
|--------|-----|
| Product add | Product card click |
| IMEI product | IMEI scan |
| Price edit | Price line click → Save |
| Warranty edit | Warranty badge click → period + note → Save |
| Customer | F2 |
| Checkout | F9 |
| Reprint | F5 |
| New sale | F10 |
| Auto-print | Settings → Invoice |
| Bill type | Settings → Invoice → Thermal / Stock Form |

---

## 9. Settings & Invoice / Bill Setup

### English

Go to **Settings → Invoice**:

| Setting | Purpose |
|---------|---------|
| Shop name, logo, address | Bill header |
| Thermal width (58mm / 80mm / Stock Form) | Print format |
| POS auto-print | Auto print on sale complete |
| Warranty & Service Terms | Bottom of stock-form bill |
| Terms & Conditions | Bottom of stock-form bill |
| Footer note | "Thank you" message |

**Product warranty note** (per product): set in Add Product → prints under each line item on stock-form bill.

**POS warranty edit** overrides period/note for that sale only.

### සිංහala

**Settings → Invoice:**

| Setting | Purpose |
|---------|---------|
| Shop name, logo, address | Bill header |
| Thermal / Stock Form | Print format |
| POS auto-print | Sale complete වෙද්දී auto print |
| Warranty & Service Terms | Bill bottom |
| Terms & Conditions | Bill bottom |

**Product warranty note:** Add Product → stock-form bill item යට print.  
**POS warranty edit:** එම sale එකට පමණක් override.

---

## 10. Troubleshooting

### English

| Problem | Solution |
|---------|----------|
| Backend won't start | Check Postgres running: `docker compose ps`. Check DATABASE_URL in `.env` |
| Redis connection error | Use password in REDIS_URL: `redis://:HxR3d1s%402025%23Secure@localhost:6379` |
| Web can't reach API | Set `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`, restart web |
| Login fails | Check backend logs; verify user exists; reset password |
| POS products empty | Check backend running; login again; check network tab for API errors |
| Bill won't print | Allow pop-ups in browser; check Settings → Invoice print type |
| Warranty requires customer | Select customer before checkout for warranty items |
| `npm run dev:backend` fails | Use `npm run dev --workspace=apps/backend` instead |
| Docker web uses prod API | For local dev, run web natively with `npm run dev:web` |
| Database schema outdated | `npm run db:push --workspace=apps/backend` |

### සිංහala

| Problem | Solution |
|---------|----------|
| Backend start නැහැ | Postgres run වෙනවද බලන්න: `docker compose ps` |
| Redis error | REDIS_URL password correct ද බලන්න |
| Web API reach නැහැ | `NEXT_PUBLIC_API_URL` set කර web restart |
| Login fail | Backend logs; password reset |
| POS products empty | Backend + login check |
| Print fail | Browser pop-ups allow; Invoice settings |
| Warranty customer need | Customer select කරන්න |
| dev:backend fail | `npm run dev --workspace=apps/backend` use කරන්න |
| DB schema | `npm run db:push --workspace=apps/backend` |

---

## 11. Useful Commands Cheat Sheet

### English

```bash
# Install all dependencies
npm install --workspaces --include-workspace-root

# Start infrastructure
docker compose up -d postgres redis

# Development (3 terminals)
npm run dev --workspace=apps/backend    # API :3001
npm run dev:web                          # Web :3000
npm run dev --workspace=apps/admin       # Admin :3002

# Database
npm run db:studio --workspace=apps/backend   # GUI
npm run db:seed --workspace=apps/backend     # Seed data
npm run db:migrate --workspace=apps/backend  # Migrations (dev)

# Build for production
npm run build:web
npm run build:backend

# Full Docker stack
docker compose up --build

# Stop Docker
docker compose down
```

### සිංහala

```bash
# Dependencies install
npm install --workspaces --include-workspace-root

# Database + Redis
docker compose up -d postgres redis

# Development
npm run dev --workspace=apps/backend    # API
npm run dev:web                          # Web
npm run dev --workspace=apps/admin       # Admin

# Database GUI
npm run db:studio --workspace=apps/backend

# Production build
npm run build:web
npm run build:backend

# Docker full stack
docker compose up --build
docker compose down
```

---

## Port Summary | Port සාරාංශය

| Service | Local URL | Docker container |
|---------|-----------|------------------|
| Web | http://localhost:3000 | hexalyte_web |
| API | http://localhost:3001 | hexalyte_backend |
| Admin | http://localhost:3002 | hexalyte_admin |
| PostgreSQL | localhost:5432 | hexalyte_postgres |
| Redis | localhost:6379 | hexalyte_redis |

---

## Support

**English:** For technical support contact Hexalyte Innovation — **070 313 0100**  
Software footer on bills: *Software by Hexalyte Innovation*

**සිංහala:** Technical support — **070 313 0100**  
Bill footer: *Software by Hexalyte Innovation*

---

*© 2026 Hexalyte Innovation. Proprietary software.*
