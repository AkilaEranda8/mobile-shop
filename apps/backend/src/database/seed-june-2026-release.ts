/**
 * Idempotent seed for the June 2026 platform release note.
 * Run: npx tsx src/database/seed-june-2026-release.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VERSION = '2.6.0'

type Item = {
  category: 'NEW_FEATURE' | 'IMPROVEMENT' | 'BUG_FIX' | 'SECURITY'
  module: string
  featureName: string
  description: string
  badge: 'NEW' | 'IMPROVED' | 'FIXED' | 'SECURITY'
  displayOrder: number
}

const ITEMS: Item[] = [
  // ── New features ──────────────────────────────────────────────────────────
  {
    category: 'NEW_FEATURE', module: 'System', badge: 'NEW', displayOrder: 0,
    featureName: 'Release Notes',
    description: 'Shops can read what changed from Dashboard → Release Notes. Admins publish updates from Admin → Release Notes with targeting and popup.',
  },
  {
    category: 'NEW_FEATURE', module: 'POS', badge: 'NEW', displayOrder: 1,
    featureName: 'POS terminal redesign',
    description: 'Full-screen POS overlay matching the Hexa terminal mockup — compact cards, purple theme, cart/checkout split, keyboard shortcuts (F9 checkout), and service/reload sales.',
  },
  {
    category: 'NEW_FEATURE', module: 'POS', badge: 'NEW', displayOrder: 2,
    featureName: 'Offline POS mode',
    description: 'Sales queue locally when the internet drops and auto-sync when back online. Service worker caches the app for faster reload.',
  },
  {
    category: 'NEW_FEATURE', module: 'Finance', badge: 'NEW', displayOrder: 3,
    featureName: 'Daily Closing module',
    description: 'End-of-day summary with charts, history, exports, day lock, and POS opening cash linked to the previous close balance.',
  },
  {
    category: 'NEW_FEATURE', module: 'Finance', badge: 'NEW', displayOrder: 4,
    featureName: 'Profit allocation & funds',
    description: 'Isolated profit allocation module with fund lines (Print, Accessories, Recharge card, etc.), period summary API, save/recalculate/delete, and Excel-aligned daily balance.',
  },
  {
    category: 'NEW_FEATURE', module: 'Reload', badge: 'NEW', displayOrder: 5,
    featureName: 'Daily Reload & provider pay',
    description: 'Sell reload from POS (barcode scan), provider commission settings, Provider Pay tab with partial settlement, and recharge-card fund auto-allocation.',
  },
  {
    category: 'NEW_FEATURE', module: 'Exchanges', badge: 'NEW', displayOrder: 6,
    featureName: 'Device exchange flow',
    description: 'Full exchange wizard with trade-in device, variant picker, balance/payment steps, thermal and A4 receipts showing storage, color, condition, and warranty.',
  },
  {
    category: 'NEW_FEATURE', module: 'Inventory', badge: 'NEW', displayOrder: 7,
    featureName: 'Product variations',
    description: 'Storage and color variants saved as JSON — used in inventory, POS variation picker, purchase orders, purchase invoice, and IMEI registration.',
  },
  {
    category: 'NEW_FEATURE', module: 'IMEI', badge: 'NEW', displayOrder: 8,
    featureName: 'IMEI tracking upgrades',
    description: 'Register IMEIs from purchase orders with progress, validation and health alerts, variant-aware POS picker, and IMEI tracker filters.',
  },
  {
    category: 'NEW_FEATURE', module: 'WhatsApp', badge: 'NEW', displayOrder: 9,
    featureName: 'Per-shop WhatsApp (QR)',
    description: 'Each shop connects its own WhatsApp number via QR. Admin manages platform billing WhatsApp separately — not tenant numbers.',
  },
  {
    category: 'NEW_FEATURE', module: 'WhatsApp', badge: 'NEW', displayOrder: 10,
    featureName: 'WhatsApp PDF invoices',
    description: 'Send invoice PDFs from POS, repairs, and admin subscription billing. Phone validation and manual send button (no auto-send on sale complete).',
  },
  {
    category: 'NEW_FEATURE', module: 'Warranty', badge: 'NEW', displayOrder: 11,
    featureName: 'Warranty module',
    description: 'Warranty months and notes on products, warranty period on POS/thermal bills, public verify page, and repair ticket integration.',
  },
  {
    category: 'NEW_FEATURE', module: 'Invoice', badge: 'NEW', displayOrder: 12,
    featureName: 'Kasthuri invoice template',
    description: 'Branded invoice preset with logo, warranty line, and tenant-specific layout for repairs and sales.',
  },
  {
    category: 'NEW_FEATURE', module: 'Invoice', badge: 'NEW', displayOrder: 13,
    featureName: 'Stock form & thermal customize',
    description: '9.5×11 stock form print for dot-matrix printers. Thermal receipt live preview and shop-info driven layout in Settings.',
  },
  {
    category: 'NEW_FEATURE', module: 'Inventory', badge: 'NEW', displayOrder: 14,
    featureName: 'Add Product full page',
    description: 'Dedicated add-product page with condition (new/used), pricing, variants, warranty fields, and brand auto-select.',
  },
  {
    category: 'NEW_FEATURE', module: 'Admin', badge: 'NEW', displayOrder: 15,
    featureName: 'Admin announcements',
    description: 'Broadcast banner messages from admin to all shops with dismiss support.',
  },
  {
    category: 'NEW_FEATURE', module: 'System', badge: 'NEW', displayOrder: 16,
    featureName: 'Global search',
    description: 'Header search in shop and admin dashboards filters tables and navigates to matching records.',
  },
  {
    category: 'NEW_FEATURE', module: 'Reports', badge: 'NEW', displayOrder: 17,
    featureName: 'Category report expansion',
    description: 'Service catalog and POS service sales grouped correctly; reload lines separated; Print/Accessories COGS in profit allocation.',
  },
  {
    category: 'NEW_FEATURE', module: 'Admin', badge: 'NEW', displayOrder: 18,
    featureName: 'Trial signup & admin tools',
    description: 'Landing-page trial registration creates a real tenant. Admin can reset login rate limits, clear trial data on upgrade, and copy login details via WhatsApp.',
  },
  {
    category: 'NEW_FEATURE', module: 'System', badge: 'NEW', displayOrder: 19,
    featureName: 'Maintenance mode notifications',
    description: 'Shops see a maintenance banner when platform maintenance is enabled, with message from admin settings.',
  },

  // ── Improvements ──────────────────────────────────────────────────────────
  {
    category: 'IMPROVEMENT', module: 'Finance', badge: 'IMPROVED', displayOrder: 20,
    featureName: 'Unified finance timezone',
    description: 'Finance, Reports, Profit Allocation, and Daily Closing use Colombo timezone and the same daily-closing calculations.',
  },
  {
    category: 'IMPROVEMENT', module: 'Purchase', badge: 'IMPROVED', displayOrder: 21,
    featureName: 'Purchase order UX',
    description: 'Card-style PO rows, variation pills, receive restock transaction, and IMEI count on PO list.',
  },
  {
    category: 'IMPROVEMENT', module: 'WhatsApp', badge: 'IMPROVED', displayOrder: 22,
    featureName: 'WhatsApp settings polish',
    description: 'Invoice PDF and phone-validation toggles save instantly. QR connect only when user clicks Show QR — no auto QR on page load.',
  },
  {
    category: 'IMPROVEMENT', module: 'Inventory', badge: 'IMPROVED', displayOrder: 23,
    featureName: 'Inventory filters & categories',
    description: 'Filter bar on inventory list; manage categories page; delete category with product reassignment.',
  },
  {
    category: 'IMPROVEMENT', module: 'POS', badge: 'IMPROVED', displayOrder: 24,
    featureName: 'POS customer & checkout UX',
    description: 'Inline customer register dropdown, outstanding balance collection on checkout, and trimmed sidebar actions.',
  },
  {
    category: 'IMPROVEMENT', module: 'Landing', badge: 'IMPROVED', displayOrder: 25,
    featureName: 'LKR pricing on landing page',
    description: 'Public pricing shown in LKR (Starter Rs. 2,999 / Pro Rs. 4,999) with company details.',
  },
  {
    category: 'IMPROVEMENT', module: 'Admin', badge: 'IMPROVED', displayOrder: 26,
    featureName: 'Configurable API rate limits',
    description: 'Admin Settings → Security tab to adjust API rate limits without redeploying.',
  },
  {
    category: 'IMPROVEMENT', module: 'Invoice', badge: 'IMPROVED', displayOrder: 27,
    featureName: 'Editable invoice terms',
    description: 'Shop invoice policy terms editable in settings; product warranty vs invoice policy clarified in add product.',
  },

  // ── Bug fixes ─────────────────────────────────────────────────────────────
  {
    category: 'BUG_FIX', module: 'System', badge: 'FIXED', displayOrder: 28,
    featureName: 'Release Notes page crash',
    description: 'Fixed client crash when latest release API returned null data (empty release list).',
  },
  {
    category: 'BUG_FIX', module: 'WhatsApp', badge: 'FIXED', displayOrder: 29,
    featureName: 'Send History tab crash',
    description: 'Mapped sent/read WhatsApp statuses so invoice history table no longer throws on render.',
  },
  {
    category: 'BUG_FIX', module: 'WhatsApp', badge: 'FIXED', displayOrder: 30,
    featureName: 'WhatsApp PDF delivery',
    description: 'PDF invoices use Buffer for Baileys v7; clearer connection errors; session ready check before send.',
  },
  {
    category: 'BUG_FIX', module: 'Backend', badge: 'FIXED', displayOrder: 31,
    featureName: 'Backend startup & admin login',
    description: 'Restored missing trial-expiry job and tenant-access modules; platform admin bootstrap and email normalization on login.',
  },
  {
    category: 'BUG_FIX', module: 'Purchase', badge: 'FIXED', displayOrder: 32,
    featureName: 'PO receive restock',
    description: 'Fixed race conditions so all items and variants restock correctly on multi-item purchase order receive.',
  },
  {
    category: 'BUG_FIX', module: 'IMEI / POS', badge: 'FIXED', displayOrder: 33,
    featureName: 'IMEI & POS stability',
    description: 'Load all IMEIs in POS (not capped at 10); null-safe variation parsing; branchId fallback on sale create.',
  },
  {
    category: 'BUG_FIX', module: 'Finance', badge: 'FIXED', displayOrder: 34,
    featureName: 'Daily Closing & reports',
    description: 'Repair revenue double-count removed; invalid default date fixed; preview 500 when IMEI query used wrong field.',
  },
  {
    category: 'BUG_FIX', module: 'Auth', badge: 'FIXED', displayOrder: 35,
    featureName: 'Login & API errors',
    description: 'Non-JSON rate-limit responses handled; relaxed auth rate limit to reduce false 429 lockouts; activity log on login events.',
  },
  {
    category: 'BUG_FIX', module: 'System', badge: 'FIXED', displayOrder: 36,
    featureName: 'Tenant subdomain loading',
    description: 'Nginx IPv4 upstream and same-origin /api proxy so tenant shops load API correctly.',
  },
  {
    category: 'BUG_FIX', module: 'Exchanges', badge: 'FIXED', displayOrder: 37,
    featureName: 'Exchange flow fixes',
    description: 'Idempotent exchange migration; variant stock resolved from SKU; invoice logo from shop settings.',
  },
  {
    category: 'BUG_FIX', module: 'POS', badge: 'FIXED', displayOrder: 38,
    featureName: 'POS checkout & theme',
    description: 'F9 dedicated checkout; fresh credit/outstanding state; light-mode invisible text fixes across POS modals.',
  },
  {
    category: 'BUG_FIX', module: 'Inventory', badge: 'FIXED', displayOrder: 39,
    featureName: 'Inventory & product saves',
    description: 'All product fields persist (brand, variants, JSON columns); search crash on non-string DB values fixed.',
  },
  {
    category: 'BUG_FIX', module: 'Admin', badge: 'FIXED', displayOrder: 40,
    featureName: 'Admin UI fixes',
    description: 'Maintenance toggle stale state; Security tab JSX; tenant feature PUT when priced features lack stored price.',
  },
  {
    category: 'BUG_FIX', module: 'Finance', badge: 'FIXED', displayOrder: 41,
    featureName: 'COGS & cash flow reports',
    description: 'Inflated COGS corrected so cash flow and category costs reflect actual sales and reload exclusions.',
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    category: 'SECURITY', module: 'Security', badge: 'SECURITY', displayOrder: 42,
    featureName: 'Financial & stock hardening',
    description: 'Security review fixes for sale item sanitization, stock correctness, and repair costing with customer credit.',
  },
  {
    category: 'SECURITY', module: 'Admin', badge: 'SECURITY', displayOrder: 43,
    featureName: 'Login monitoring',
    description: 'Failed logins, rate limits, and successes logged to admin activity logs with reset tool for locked accounts.',
  },
]

async function main() {
  const existing = await prisma.release.findFirst({ where: { version: VERSION } })

  if (existing) {
    await prisma.releaseItem.deleteMany({ where: { releaseId: existing.id } })
    await prisma.release.update({
      where: { id: existing.id },
      data: {
        title: 'June 2026 — Major Platform Update',
        summary: 'POS redesign, offline mode, Daily Closing, profit allocation, exchanges, WhatsApp per shop, IMEI upgrades, and 40+ stability fixes across finance, inventory, and admin.',
        releaseDate: new Date('2026-06-26'),
        status: 'PUBLISHED',
        popupEnabled: true,
        active: true,
        targetType: 'ALL',
        items: {
          create: ITEMS.map(i => ({
            category: i.category,
            module: i.module,
            featureName: i.featureName,
            description: i.description,
            badge: i.badge,
            displayOrder: i.displayOrder,
          })),
        },
      },
    })
    console.log(`✅ Updated release ${VERSION} (${ITEMS.length} items)`)
  } else {
    await prisma.release.create({
      data: {
        version: VERSION,
        title: 'June 2026 — Major Platform Update',
        summary: 'POS redesign, offline mode, Daily Closing, profit allocation, exchanges, WhatsApp per shop, IMEI upgrades, and 40+ stability fixes across finance, inventory, and admin.',
        releaseDate: new Date('2026-06-26'),
        status: 'PUBLISHED',
        popupEnabled: true,
        active: true,
        targetType: 'ALL',
        targetPlans: [],
        targetTenants: [],
        createdBy: 'System Seed',
        items: {
          create: ITEMS.map(i => ({
            category: i.category,
            module: i.module,
            featureName: i.featureName,
            description: i.description,
            badge: i.badge,
            displayOrder: i.displayOrder,
          })),
        },
      },
    })
    console.log(`✅ Created release ${VERSION} (${ITEMS.length} items)`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
