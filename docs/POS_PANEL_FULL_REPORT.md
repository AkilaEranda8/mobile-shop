# POS — all panels report

**Source:** `apps/web` (verified from code)  
**Date:** 5 Sep 2026  
**Scope:** Every retail POS panel/skin/modal + wholesale POS + related settings/templates

| Metric | Count |
|--------|------:|
| Retail layout skins | 4 |
| Always-on retail chrome panels | ~15 |
| POSOverlay modals / overlays | 19 |
| Bottom action ids | 8 |
| Default F-keys | 12 |
| Wholesale chrome regions | ~10 |
| Wholesale modals | 5 |
| Dedicated POS routes | 4 |
| Feature gates affecting POS | 11+ |

---

## 1. Architecture

| Layer | Role | Path |
|-------|------|------|
| Engine | Cart, checkout, day ops, modals, shortcuts | `apps/web/src/components/pos/POSOverlay.tsx` |
| Skins | Visual chrome only (same slots/props) | `HexaPosLayout.tsx`, `StudioPosLayout.tsx`, `NovaPosLayout.tsx` |
| Theme tokens | `hexa-dark` / `hexa-light` / `studio` / `nova` | `apps/web/src/components/pos/pos-theme.ts` |
| Nav / bottom builders | Feature-gated actions | `apps/web/src/components/pos/pos-features.ts` |
| Overlay mount | Global fullscreen when `posOpen` | `(dashboard)/layout.tsx` → `<POSOverlay />` |
| Wholesale POS | Separate full-page shell (not `POSOverlay`) | `apps/web/src/components/wholesale/WholesalePosPage.tsx` |

Skin selection:

- `posUi.theme === 'studio'` → `StudioPosLayout`
- `posUi.theme === 'nova'` → `NovaPosLayout`
- else → `HexaPosLayout` (hexa-dark / hexa-light)

---

## 2. Layout skins & entry routes

### 2.1 Layout skins

| Theme ID | UI label | Layout component | Notes |
|----------|----------|------------------|-------|
| `hexa-dark` | Hexa Dark | `HexaPosLayout` | Default; left icon rail |
| `hexa-light` | Hexa Light | `HexaPosLayout` | Same chrome, light tokens |
| `studio` | Studio Modern | `StudioPosLayout` | Teal/ink; Manrope font |
| `nova` | Nova Counter | `NovaPosLayout` + `nova-pos-skin.css` | Top command bar; no left rail |

Wholesale POS uses `wholesale-pos.css` / `wpos-*` — **not** these skins.

### 2.2 How POS opens

| Name | Path / trigger | What it does |
|------|----------------|--------------|
| Sidebar Point of Sale | Nav `openPos: true` | Calls `openPos()` (does not stay on a POS page) |
| `/dashboard/pos` | `dashboard/pos/page.tsx` | `openPos()` then redirect `/dashboard` |
| `/pos` | `pos/page.tsx` | Same open-and-redirect |
| Header **POS Terminal** | `Header.tsx` | `openPos()`; title Open POS (F2) |
| Global **F2** | `PosGlobalShortcuts.tsx` | Opens POS when closed |
| `OpenPosButton` | Sales / Customers / Services | Labels: POS Terminal / New Sale / Open POS |
| Wholesale POS | `/dashboard/wholesale/pos` | Full page `WholesalePosPage` |
| POS templates gallery | `/dashboard/pos/templates` | Visual gallery only |
| Settings → POS Display | `/dashboard/settings?tab=pos` | Theme, layout, shortcuts, PIN |

Overlay: `aria-label="Point of Sale"`, `z-[100]`.

---

## 3. Always-on retail chrome (main panels)

| # | Panel | File(s) | How opened | What it does | Skins |
|---|-------|---------|------------|--------------|-------|
| 1 | Command / top bar | Layout shells | Always when POS open | Search (F1), scan, filters, customer, close | All |
| 2 | Left nav rail | Hexa/Studio + `buildPosNavItems` | If `layout.showSidebar` | Products, Sales, Customers, (+IMEI, Cash, Returns, Reload) | Hexa + Studio (hidden on Nova) |
| 3 | Category bar | `POSOverlay` slot | Always | All / Services* / Reload* / categories; grid/list | All |
| 4 | Product grid / list | `POSOverlay` | Default; nav `products` | Browse/add products | All |
| 5 | Reload / Recharge panel | `PosReloadPanel.tsx` | Category RELOAD, nav, F6 | Provider + amount → cart line | All (`DAILY_RELOAD`) |
| 6 | Pagination | Layout slot | Multi-page catalog | Prev/next | All |
| 7 | Cart — Items | `cartView === 'items'` | Default cart | Lines, qty, clear, checkout | All |
| 8 | Cart — Checkout | `cartView === 'checkout'` | Checkout / F9 | Customer, discount, pay methods, Pay Now, HP | All |
| 9 | Sale Complete | After successful sale | Post-checkout | A4, thermal, PDF, WA, SMS, New Sale | All |
| 10 | Bottom action bar | `buildBottomActions` | If `showBottomActions` | New / Hold / Recent / Reload* / Day* / Cash / More | All |
| 11 | Footer status | Layout footers | Desktop | Shop / sync / Synced | All |
| 12 | Mobile Products \| Cart | Layouts | `< lg` | `mobileView` switch | All |
| 13 | IMEI / Serial scan slot | `showScanInput` | Scan / nav `imei` | Inline serial search | All |
| 14 | Filters strip | `showFilters` | Filters button | Hide OOS; Favorites | All |
| 15 | Customer slot / dropdown | Header + cart | F2 / Change | Search, Walk-in, register | All |

\*Feature-flag gated (§8).

---

## 4. Left / top nav items

| Nav id | UI label | Opens | Gate |
|--------|----------|-------|------|
| `products` | Products | Product catalog | Always |
| `sales` | Sales | Recent Invoices modal | Always |
| `customers` | Customers | Customer picker | Always |
| `imei` | IMEI / Serial | Scan input | `IMEI` |
| `cash` | Cash In/Out | Cash In/Out modal | `FINANCE` |
| `returns` | Returns | Process Return modal | Always |
| `reload` | Reload | Reload category panel | `DAILY_RELOAD` |

**Nova top actions:** New Sale, Sales History, Hold, Filters, Settings (`/dashboard/settings`).

**Nav ids that leave POS** (confirm if cart): `repairs`, `purchase`, `inventory`, `reports`, `expenses`, `settings`.

---

## 5. Bottom actions & More menu

### 5.1 Bottom bar

| id | UI label | Shortcut | Gate / notes |
|----|----------|----------|--------------|
| `newSale` | New Sale (F10) | F10 | Always |
| `hold` | Hold Sales (F4) | F4 | Always |
| `recent` | Recent Sales (F5) | F5 | Always |
| `reload` | Reload (F6) | F6 | `DAILY_RELOAD` |
| `dayStart` | Day Start / Opening Cash (F7) | F7 | Label depends on `DAILY_CLOSING` |
| `dayEnd` | Day End (F11) | F11 | `DAILY_CLOSING` only |
| `cashFlow` | Cash In/Out (F8) | F8 | Always in catalog |
| `more` | More (N) | — | Badge = held count |

Order configurable in Settings → POS Display.

### 5.2 More Actions menu

| Label | Action |
|-------|--------|
| Held Carts (N) | Held Carts modal |
| Calculator (F12) | Calculator |
| Open Cash Drawer | `openDrawer()` |
| Quote (Ctrl+F7) | Quotation preview |
| Draft invoice (Ctrl+F8) | Draft invoice preview |
| WhatsApp Share | Share current/draft sale |

### 5.3 Default F-keys

| Key | Action |
|-----|--------|
| F1 | Focus search |
| F2 | Customer picker (opens POS when closed) |
| F3 | Pay now |
| F4 | Hold |
| F5 | Recent |
| F6 | Reload |
| F7 | Day start |
| F8 | Cash in/out |
| F9 | Checkout |
| F10 | New sale |
| F11 | Day end |
| F12 | Calculator |

Also: **Ctrl+F7** Quote, **Ctrl+F8** Draft, digits **1–5** payment methods, **C** checkout from cart items, **Esc** modal stack.

---

## 6. All modals / overlays (`POSOverlay`)

| # | UI name | State / component | How opened | What it does |
|---|---------|-------------------|------------|--------------|
| 1 | Variation / Configure (`Set Sale Price` on Nova) | `VariationPickerModal` | Multi-variant / IMEI product | Storage, color, IMEI, warranty, price mode |
| 2 | Set Sale Price | `PricePromptModal` | Simple product price/qty | Sale price + qty; Retail/Wholesale/Cash |
| 3 | Recent Invoices | `showRecentInvoices` | F5, Recent, nav Sales | List + reprint |
| 4 | Held Carts | `showHeldCarts` | F4, Hold, More | Resume/hold carts |
| 5 | Calculator | `showCalc` | F12, toolbar, More | Floating calculator |
| 6 | Opening Cash | `showOpeningCash` | F7 / Day Start | Float / start shift |
| 7 | Day End | `showDayEnd` | F11 | Cash count, close day |
| 8 | Cash In / Out | `showCashFlow` | F8, nav Cash | Record IN/OUT |
| 9 | More Actions | `showMoreMenu` | Bottom More | Secondary list |
| 10 | Process Return | `PosReturnModal` | Nav Returns | Search sale → refund |
| 11 | Filters | `showFilters` | Filters control | Stock/favorites |
| 12 | Hire Purchase Wizard | `HirePurchaseWizard` | Checkout HP button | 5 steps; portal `data-hp-wizard` |
| 13 | A4 Invoice | `showA4Invoice` | Sale Complete → A4 | Full A4 viewer |
| 14 | Quotation / Draft Invoice | `showDocPreview` | Ctrl+F7 / Ctrl+F8 / More | Preview, PDF, print, checkout |
| 15 | POS locked / Switch cashier | `PosPinGate` | Idle lock / Switch | PIN unlock (`POS_QUICK_PIN`) |
| 16 | Staff PIN must-change | `StaffPinModal` / `PinMustChangeGate` | `pinMustChange` | Force new PIN |
| 17 | New Customer (inline) | `showRegister` | Customer Register | Create customer |
| 18 | Customer dropdowns | `showCustDrop` / `showCartCustDrop` | F2 / chips | Search & select |
| 19 | Serial / IMEI Search | `showScanInput` | Scan / nav IMEI | Attach/find serial |

Thermal print is a print-window path (`ThermalReceipt`), not a persistent panel.

---

## 7. Cart / checkout sub-surfaces

| Name | Trigger | Notes |
|------|---------|-------|
| Cart (N) | Default | Line editor |
| Checkout | Checkout / F9 | Payments, discount, credit |
| Collect Outstanding | Empty cart + customer due / F9 | Credit collection |
| Hire Purchase / Installments | Checkout button | Opens HP wizard |
| Pay Now (F3 / Enter) | Checkout CTA | Completes sale |
| Price type: Retail / Wholesale / Cash | Variation & price modals | `PriceModeToggle` |

---

## 8. Feature flags

| Flag | Surface |
|------|---------|
| `POS` | Entire overlay |
| `IMEI` | IMEI nav, serial stock, qty lock |
| `FINANCE` | Cash In/Out nav |
| `DAILY_RELOAD` | Reload tab + F6 |
| `SERVICES` | Services category |
| `DAILY_CLOSING` | Day Start/End UX |
| `WARRANTY` | Warranty badges / required customer |
| `HIRE_PURCHASE` | HP checkout path |
| `CUSTOMER_CREDIT` | Store credit / outstanding |
| `POS_QUICK_PIN` | PIN gate / switch / must-change |
| WhatsApp feature | WA share/send on success |

`REPAIRS` exists on types but has no dedicated POS panel (leave-POS nav only).

---

## 9. Wholesale POS (all panels)

**Route:** `/dashboard/wholesale/pos`  
**Component:** `WholesalePosPage.tsx`  
**Skin:** wholesale-only — not nova/hexa/studio

### 9.1 Main chrome

| Name | How opened | What it does |
|------|------------|--------------|
| Wholesale POS shell | Route / sidebar | Full-screen B2B counter |
| Mode: Counter Sales | Header (active) | Current page mode |
| Mode: Rep / Van Sales | → `/rep` | Leaves POS |
| Mode: Delivery Orders | → `/dashboard/wholesale/orders` | Leaves POS |
| Branch selector | Header | Branch for ATP/pricing |
| Catalog + search/scan | Body left | Product grid; F1 search |
| Category chips | Body | All, Phones, Accessories, … |
| Side: Select Dealer (F2) | Always | Dealer search/credit |
| Side: Cart | Always | Lines, units, discount |
| Cart actions | Save Draft / Hold / Checkout (F9) | Hold or checkout |
| Mobile View Cart | ≤1024 | Opens side panel |
| Settings | Header | Wholesale settings |

### 9.2 Wholesale modals

| UI name | How opened | What it does |
|---------|------------|--------------|
| Review & Pay | Checkout / F9 | Cash/Card/Bank/Credit → Complete Wholesale Sale |
| Select IMEI | Add IMEI product | Multi-select IMEIs |
| Hold Orders | Hold Orders button | Resume/delete holds |
| Recent Wholesale Sales | Recent Sales | Session recent table |
| Wholesale Invoice Created | After checkout | Print / share / new sale |

Related but **not** Wholesale POS panels: `/rep`, `/dashboard/wholesale/*` ops, `/dashboard/returns`.

---

## 10. Templates & settings pages

| Page | Path | Purpose |
|------|------|---------|
| POS UI templates | `/dashboard/pos/templates` | Gallery: Hexa Dark/Light, Studio, Nova |
| Settings → POS Display | `/dashboard/settings?tab=pos` | Theme, accent, density, cart, badges, bottom actions, F-keys, price mode |
| Settings → POS Quick PIN | same + Security | PIN policy / self PIN |
| Payment methods | Settings payments | Methods at Pay Now |

---

## 11. Supporting components (not full screens)

| Component | Path | Role |
|-----------|------|------|
| `OpenPosButton` | `OpenPosButton.tsx` | Opens overlay |
| `PosGlobalShortcuts` | `PosGlobalShortcuts.tsx` | Global F2 |
| `PosPinKeypad` | `PosPinKeypad.tsx` | PIN keypad |
| `PinMustChangeGate` | `PinMustChangeGate.tsx` | Force PIN change |
| `usePosCartResize` | `usePosCartResize.tsx` | Drag cart width |
| `cart-rules.ts` | helpers | Logic only |
| `HirePurchaseWizard` | `hire-purchase/HirePurchaseWizard.tsx` | Portaled from POS |

---

## 12. File map

```
apps/web/src/components/pos/
  POSOverlay.tsx          # Engine + retail modals (~5245 lines)
  HexaPosLayout.tsx       # hexa-dark / hexa-light
  StudioPosLayout.tsx     # studio
  NovaPosLayout.tsx       # nova
  nova-pos-skin.css
  pos-theme.ts
  pos-features.ts
  PosReturnModal.tsx
  PosReloadPanel.tsx
  PosPinGate.tsx
  PosPinKeypad.tsx
  PinMustChangeGate.tsx
  PosGlobalShortcuts.tsx
  OpenPosButton.tsx
  usePosCartResize.tsx
  cart-rules.ts
  types.ts

apps/web/src/components/wholesale/
  WholesalePosPage.tsx
  wholesale-pos.css

apps/web/src/app/(dashboard)/
  pos/page.tsx
  dashboard/pos/page.tsx
  dashboard/pos/templates/page.tsx
  dashboard/wholesale/pos/page.tsx
  layout.tsx                 # mounts POSOverlay
  settings/page.tsx          # POS Display tab

apps/web/src/lib/posUiSettings.ts
apps/web/src/components/hire-purchase/HirePurchaseWizard.tsx
```

---

## 13. Recent production-readiness pass (5 Sep 2026)

| Item | Status |
|------|--------|
| F2 closed→open POS / open→customer (capture, no dual fire) | Done |
| ESC priority stack (modals → dropdowns → checkout → keep cart) | Done |
| Desktop Close POS + confirm with cart | Verified (all skins) |
| Cart merge: warranty / variation / price / IMEI never wrong-merge | Done (`canMergeCartLine`) |
| Cart line unit-price edit (`POS_PRICE_EDIT`) + qty validation | Done |
| F6/F8 respect feature gates (no Held Carts fallback on F6) | Done |
| Payment selected state + no purple totals | Done (prior + verified) |
| Redundant LKR form labels trimmed | Done |
| Wholesale POS code path untouched | Verified |
| Production deploy (`HEXALYTE_SSH_PASS`) | Risk — ops |

---

## 14. Known risks (UX audit leftovers)


| ID | Issue | Area |
|----|-------|------|
| C1/C2 | F2 customer vs close / dropdown paths | Shortcuts + customer UI |
| C3 | Esc stack: modal → checkout → close POS | Keyboard |
| C4 | Desktop close affordance | Layout toolbar |
| C5–C7 | Cart line edit / warranty merge | Cart + `addToCart` |
| Ops | Custom pay labels (`retrun`, `grdcx`) = tenant data | Payment methods admin |
| Size | `POSOverlay` ~5k lines — high change risk | Architecture |

---

## 15. Next steps

1. Commit uncommitted POS / HP / CSS changes if needed.
2. Deploy with `.\scripts\deploy.ps1` when SSH pass is set.
3. Optional: re-verify Esc / F2 / customer UX on Nova.
4. Optional: expand this doc if new POS panels land (keep wholesale separate).
