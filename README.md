# Hexalyte — Enterprise Mobile Shop & Repair SaaS

> The complete all-in-one platform for mobile phone shops, repair centers, accessory stores, and multi-branch retail operations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Desktop POS | Electron (offline-ready, IndexedDB sync) |
| Mobile | Flutter (Dart) |
| Backend | NestJS 10 (modular monolith → microservice-ready) |
| Database | PostgreSQL 16 (schema-per-tenant) + Redis 7 |
| Auth | Keycloak 24+ (auth.hexalyte.com) |
| Storage | Amazon S3 |
| PDF | Puppeteer (invoices, warranty certificates) |
| Printing | ESC/POS thermal receipts |
| Realtime | WebSockets (NestJS + Socket.IO) |
| Containers | Docker + Kubernetes |

---

## Core Modules

1. **Authentication & Authorization** — Keycloak 24+ per-tenant realm isolation, JWT RS256, MFA, SSO
2. **Shop Management** — Multi-tenant, multi-branch, subscription-ready
3. **Inventory Management** — IMEI/serial tracking, barcode, stock transfers, low-stock alerts
4. **POS / Billing** — Offline-ready, thermal + PDF receipts, QR invoice, WhatsApp sharing
5. **Customer Management** — CRM, loyalty points, due tracking, SMS notifications
6. **Repair Management** — FSM (Received→Delivered), technician assignment, public tracking portal
7. **Warranty Management** — IMEI-bound, PDF certificates, QR verification, expiry reminders
8. **Supplier Management** — PO workflow (Draft→Closed), GRN, price history
9. **Financial Management** — Daily summary, expenses, profit reports, cashflow
10. **Analytics Dashboard** — Revenue charts, branch comparison, technician KPIs

---

## Project Structure

```
hexalyte/
├── apps/
│   ├── web/            # Next.js 14 frontend
│   └── backend/        # NestJS modular backend
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm 10+

### 1. Clone & Install

```bash
git clone https://github.com/hexalyte/hexalyte.git
cd hexalyte
cp .env.example .env
npm install --workspaces --include-workspace-root
```

### 2. Start Infrastructure (Docker)

```bash
docker-compose up -d postgres redis keycloak
```

### 3. Run Backend

```bash
npm run dev:backend
# API runs on http://localhost:3001
# Swagger: http://localhost:3001/api/docs
```

### 4. Run Frontend

```bash
npm run dev:web
# App runs on http://localhost:3000
```

### 5. Full Stack (Docker)

```bash
docker-compose up --build
```

---

## Architecture

### Multi-Tenant Strategy
- **PostgreSQL schema-per-tenant**: Each shop gets isolated schema `shop_{tenantId}`
- **Keycloak realm-per-tenant**: `shop-{tenantId}` realm for complete auth isolation
- **Tenant middleware**: Extracts tenant from JWT, sets DB schema per request

### Authentication Flow
```
Client → API Gateway → JWT Validation (JWKS) → Tenant Middleware → Controller
                ↑
         Keycloak JWKS endpoint (RS256)
```

### Repair FSM
```
Received → Diagnosed → In-Repair → QC → Ready → Delivered
     ↓ (at any stage)
  Cancelled
```

### Warranty Claim FSM
```
Open → Assessed → In-Repair → Resolved
            ↓
         Rejected
```

---

## Subscription Plans

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|-----------|
| Branches | 1 | 5 | Unlimited |
| Users | 3 | 15 | Unlimited |
| Products | 500 | 5,000 | Unlimited |
| Monthly Price | ₹999 | ₹2,499 | Custom |
| Offline POS | ✗ | ✓ | ✓ |
| API Access | ✗ | ✗ | ✓ |
| White Label | ✗ | ✗ | ✓ |

---

## API Documentation

Swagger UI available at `http://localhost:3001/api/docs` when running in development.

---

## License

Proprietary — © 2024 Hexalyte Technologies Pvt. Ltd.
