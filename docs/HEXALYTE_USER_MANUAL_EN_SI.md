# Hexalyte User Manual | Hexalyte පරිශීලක Manual

> **For:** Shop owners, managers, cashiers, technicians  
> **සඳහා:** Shop owners, managers, cashiers, technicians  
> **Version:** 1.0 · June 2026

---

## Table of Contents | අන්තර්ගතය

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Point of Sale (POS)](#3-point-of-sale-pos)
4. [Sales History & Returns](#4-sales-history--returns)
5. [Customers](#5-customers)
6. [Inventory & Products](#6-inventory--products)
7. [IMEI Tracker](#7-imei-tracker)
8. [Suppliers & Purchase Orders](#8-suppliers--purchase-orders)
9. [Repair Jobs](#9-repair-jobs)
10. [Warranty](#10-warranty)
11. [Device Exchange](#11-device-exchange)
12. [Finance & Daily Closing](#12-finance--daily-closing)
13. [Reports & Analytics](#13-reports--analytics)
14. [WhatsApp Invoices](#14-whatsapp-invoices)
15. [Daily Reload](#15-daily-reload)
16. [Staff, Branches & Settings](#16-staff-branches--settings)
17. [User Roles — Who Can Do What](#17-user-roles--who-can-do-what)
18. [Keyboard Shortcuts (POS)](#18-keyboard-shortcuts-pos)
19. [Frequently Asked Questions](#19-frequently-asked-questions)

---

## 1. Getting Started

### English

#### 1.1 Open the system

| Where | URL |
|-------|-----|
| Main login | https://app.hexalyte.com/login |
| Your shop (if subdomain set) | https://**your-shop-name**.app.hexalyte.com |

#### 1.2 First login

1. Enter your **email** and **password** given by the shop owner.
2. Click **Sign In**.
3. You land on the **Dashboard**.

#### 1.3 New shop registration (owners only)

1. Go to **Register** page.
2. Enter shop name, your name, email, password.
3. Your shop gets a **14-day free trial**.
4. After registration, login and complete **Settings** (shop name, logo, address, phone).

#### 1.4 Forgot password

1. Click **Forgot password** on login page.
2. Check email for reset link.
3. Set a new password and login again.

---

### සිංහල

#### 1.1 System open කිරීම

| Location | URL |
|----------|-----|
| Login | https://app.hexalyte.com/login |
| ඔබේ shop | https://**shop-name**.app.hexalyte.com |

#### 1.2 Login

1. Owner දුන් **email** + **password** enter කරන්න.
2. **Sign In** click කරන්න.
3. **Dashboard** open වෙනවා.

#### 1.3 නව shop register (owners)

1. **Register** page එකට යන්න.
2. Shop name, name, email, password දාන්න.
3. **14-day trial** start වෙනවා.
4. Login කර **Settings** complete කරන්න (name, logo, address).

#### 1.4 Password reset

Login page → **Forgot password** → email link → new password.

---

## 2. Dashboard Overview

### English

The **Dashboard** shows a quick summary:

- Today's sales
- Recent transactions
- Low stock alerts
- Quick links to POS and common tasks

**Left sidebar** is your main menu. Sections:

| Section | Pages |
|---------|-------|
| Overview | Dashboard |
| Sales | POS, Sales History, Returns, Customers, Services |
| Inventory | Inventory, IMEI Tracker, Suppliers & PO |
| Service | Repair Jobs, Warranty, Device Exchange |
| Finance | Finance, Expenses, Profit Allocation, Daily Closing, Analytics |
| Reports | Reports, Category Report |
| HR & Staff | Staff & Roles |
| Delivery | Delivery Orders |
| Messaging | WhatsApp |
| Reload | Daily Reload |
| System | Release Notes, Branches, Settings |

> Some menu items appear only if enabled for your shop (features).

---

### සිංහala

**Dashboard** — today sales, recent transactions, low stock alerts.

**Left sidebar** — main menu. Sections:

| Section | Pages |
|---------|-------|
| Sales | POS, Sales, Returns, Customers |
| Inventory | Products, IMEI, Suppliers |
| Service | Repairs, Warranty, Exchange |
| Finance | Finance, Expenses, Daily Closing |
| System | Settings, Branches, Staff |

Shop එකට enable කරලා features පමණක් menu එකේ පෙනෙනවා.

---

## 3. Point of Sale (POS)

### English

POS is where you **sell products and print bills**.

#### 3.1 Open POS

- Sidebar → **Point of Sale**, or
- Press POS button on dashboard, or
- Go to `/pos`

#### 3.2 Add products to cart

| Method | Steps |
|--------|-------|
| **Click product** | Find product in grid/list → click to add |
| **Search** | Type product name or SKU in search bar |
| **Scan IMEI** | For IMEI-tracked phones: scan barcode in IMEI field → product auto-adds |
| **Variants** | If product has storage/colour variants → pick variant popup |
| **Services** | Switch to Services category → add service line |
| **Reload** | Use Reload panel for mobile reload / recharge card |

#### 3.3 Select customer

- Click **Customer** area (or press **F2**)
- Search existing customer or add new
- **Required** when cart has warranty products

#### 3.4 Edit cart line

| Action | How |
|--------|-----|
| **Change price** | Click `LKR xxx each` → enter new price → **Save** |
| **Edit warranty** | Click warranty badge → pick period (None / 1 Month / 3 Months / 6 Months / 1 Year / 2 Years) → optional **warranty note** → **Save** |
| **Change quantity** | Use + / − buttons (locked to 1 for IMEI/reload items) |
| **Remove item** | Click **X** on line |

#### 3.5 Apply discount

- In checkout: enter **discount %** or **flat amount**
- Total updates automatically

#### 3.6 Collect payment (Checkout)

1. Press **F9** or click **Pay Now / Checkout**
2. Choose payment: **Cash**, **Card**, or **UPI**
3. For cash: enter amount customer paid → change shown
4. For **credit sale**: customer must be selected → due amount added to their balance
5. Click **Complete Sale**

#### 3.7 After sale

- Bill prints automatically if **Settings → Invoice → POS auto-print** is ON
- Print types: **Thermal (58mm/80mm)** or **Stock Form (A4 tractor)**
- Options on success screen:
  - **Thermal / Stock Form Print** — reprint
  - **A4 Invoice** — on-screen invoice
  - **Download PDF**
  - **WhatsApp** — send to customer (if connected)
- **Warranty certificates** auto-created for warranty items

#### 3.8 Other POS actions

| Action | Shortcut |
|--------|----------|
| Hold current cart | F4 |
| View held carts | F6 (or held carts button) |
| Reprint last bill | F5 |
| New sale (clear) | F10 |
| Day start / Day end | F7 / F11 |
| Calculator | F12 |

---

### සිංහala

POS = **products විකිණීම + bill print**.

#### 3.1 POS open

Sidebar → **Point of Sale** / Dashboard POS button

#### 3.2 Cart එකට products add

| Method | Steps |
|--------|-------|
| Product click | Grid/list එකෙන් click |
| Search | Name / SKU type කරන්න |
| IMEI scan | IMEI barcode scan → auto add |
| Variants | Storage/colour pick |
| Reload | Reload panel use කරන්න |

#### 3.3 Customer select

Customer area click (**F2**) → search / new add  
**Warranty products** තියෙනවා නම් customer **අනිවාර්ය**

#### 3.4 Cart line edit

| Action | How |
|--------|-----|
| Price | `LKR xxx each` click → Save |
| Warranty | Warranty badge click → period + note → Save |
| Qty | + / − (IMEI/reload = 1 fixed) |
| Remove | X button |

#### 3.5 Discount

Checkout → discount % හෝ flat amount

#### 3.6 Payment

1. **F9** / Pay Now
2. Cash / Card / UPI
3. Cash: paid amount → change
4. Credit: customer select → due balance
5. Complete Sale

#### 3.7 Sale එකට පස්සේ

- Auto-print: Settings → Invoice
- Reprint, A4, PDF, WhatsApp
- Warranty auto create

---

## 4. Sales History & Returns

### English

#### Sales History
- **Sales History** → list of all invoices
- Search by invoice number, customer, date
- Click sale → view details, **reprint bill**, download

#### Returns
- **Returns** → select original sale
- Choose items and quantities to return
- Stock restored automatically; IMEI reset to In Stock
- Refund recorded; warranty voided for returned IMEIs

---

### සිංහala

#### Sales History
Invoices list → search → reprint / details

#### Returns
Original sale select → items return → stock restore → refund

---

## 5. Customers

### English

- **Customers** → add, edit, search customers
- Fields: name, phone, address/city, email
- **Outstanding balance** shown for credit customers
- From POS: collect old outstanding during checkout
- View purchase history per customer

---

### සිංහala

Customers add/edit → phone, address  
**Outstanding balance** credit customers  
POS checkout එකේ පරණ balance collect කරන්න පුළුවන්

---

## 6. Inventory & Products

### English

#### View inventory
- **Inventory** → all products, stock levels, filters, search
- Click product → **Product Details** (full info)
- Low stock items highlighted

#### Add new product
1. **Inventory** → **Add Product**
2. Fill sections:
   - **Basic:** name, brand, category, sub-category, device model, SKU, barcode
   - **Pricing:** buying price, selling price, MRP
   - **Stock:** quantity, min stock alert
   - **Warranty:** period + **warranty note** (prints on bill)
   - **IMEI tracking:** enable if phone/device with serial
   - **Variants:** storage + colour combinations
3. Click **Save**

#### Edit product
- Inventory → find product → Edit

#### Import products (CSV)
- **Import** button → download template → fill Excel/CSV → upload
- 16 columns aligned with Add Product fields

#### Add stock (without new product)
- **Add Stock** → select product → enter quantity received

---

### සිංහala

#### Products බලන්න
Inventory → products, stock, details

#### Product add
Add Product → name, brand, category, price, stock, warranty, IMEI, variants → Save

#### CSV import
Template download → fill → upload

#### Stock add
Add Stock → product → qty

---

## 7. IMEI Tracker

### English

*(Available if IMEI feature enabled)*

- Register IMEI numbers when receiving stock
- Status: **In Stock**, **Sold**, etc.
- Scan IMEI in POS to sell specific unit
- Lookup IMEI → see product, status, sale history

---

### සිංහala

IMEI register → In Stock / Sold track  
POS එකේ IMEI scan → exact unit sell  
IMEI lookup → history

---

## 8. Suppliers & Purchase Orders

### English

1. **Suppliers** → add supplier (name, phone, address)
2. **Create Purchase Order (PO)** → select supplier, add items, quantities, costs
3. Send / mark as ordered
4. **Receive goods** → stock increases, IMEIs can be registered on receive

---

### සිංහala

Supplier add → PO create → goods receive → stock increase

---

## 9. Repair Jobs

### English

#### Create repair ticket
1. **Repair Jobs** → **New Repair**
2. Enter customer, device brand/model, IMEI (optional), reported issue
3. Set estimated cost

#### Repair status flow

```
Received → Diagnosed → In-Repair → QC → Ready → Delivered
                              ↓
                          Cancelled
```

- Update status as work progresses
- Assign technician
- Enter **actual cost** when done
- Print repair invoice for customer
- Mark **Delivered** when customer picks up

---

### සිංහala

New Repair → customer, device, issue, estimated cost  
Status update කරන්න: Received → ... → Delivered  
Invoice print → customer pick up

---

## 10. Warranty

### English

#### Automatic warranty on sale
- Product must have **warranty months** set (or edit in POS cart)
- Customer must be selected at checkout
- System creates **warranty certificate** with unique code

#### Warranty page
- View all active/expired warranties
- Search by code, IMEI, customer
- Process **warranty claims** (Open → Assessed → In-Repair → Resolved / Rejected)

#### Public verification
Customer can verify at:  
`https://your-shop.app.hexalyte.com/warranty/verify/WARRANTY-CODE`

#### Bill / warranty note
- **Product warranty note** (set in Add Product) prints on **stock-form bill** under each item
- Edit warranty period & note in **POS cart** before sale (sale-specific override)
- Shop-wide terms: **Settings → Invoice → Warranty & Service Terms**

---

### සිංහala

Sale complete → warranty certificate auto (customer + warranty product need)  
**Warranty** page → certificates, claims  
Public verify link  
Product **warranty note** stock-form bill එකේ  
POS cart එකේ warranty edit → එම sale එකට පමණක්

---

## 11. Device Exchange

### English

*(If Exchange feature enabled)*

1. **Device Exchange** → start new exchange
2. Customer brings old device (IMEI, condition, value)
3. Select new product to sell
4. Trade-in credit applied on bill
5. Exchange bill shows both devices

---

### සිංහala

Exchange start → old device + new product → trade-in credit bill එකේ

---

## 12. Finance & Daily Closing

### English

#### Finance
- View income, expenses summary
- Filter by date range

#### Expenses
- Record shop expenses (rent, utilities, etc.)
- Category and amount

#### Profit Allocation
- Allocate daily profit to funds/categories
- Used for internal shop accounting

#### Daily Closing
1. End of day → open **Daily Closing**
2. Enter **cash count** by denomination (5000, 1000, 500, … coins)
3. System compares with expected cash from sales
4. **Close day** — locks further sales for that business day (if day-lock enabled)
5. Reload card funds and commissions tracked

---

### සිංහala

**Finance** — income/expense summary  
**Expenses** — shop expenses record  
**Profit Allocation** — profit distribute  
**Daily Closing** — cash count by notes → day close → lock

---

## 13. Reports & Analytics

### English

| Page | Shows |
|------|-------|
| **Reports** | Sales reports, export |
| **Category Report** | Sales breakdown by product category |
| **Analytics** | Charts — revenue trends, comparisons |

Use date filters to select period.

---

### සිංහala

Reports → sales export  
Category Report → category-wise sales  
Analytics → charts, trends

---

## 14. WhatsApp Invoices

### English

1. **Settings** or **WhatsApp** page → scan QR to connect shop WhatsApp
2. After POS sale → click **Send WhatsApp Invoice**
3. Customer receives invoice text or PDF

---

### සිංහala

WhatsApp QR connect → sale complete → Send WhatsApp Invoice

---

## 15. Daily Reload

### English

*(If Daily Reload feature enabled)*

- Track **mobile reload** and **recharge card** sales
- Record provider (Dialog, Mobitel, etc.)
- Commission calculated per provider rules
- Reload items added from POS Reload panel

---

### සිංහala

Reload sales track → provider-wise commission  
POS Reload panel එකෙන් add

---

## 16. Staff, Branches & Settings

### English

#### Staff & Roles
- **Staff** → invite/add users
- Assign role: Owner, Manager, Cashier, Technician
- Assign branch access

#### Branches
- Add multiple shop branches
- Users can be limited to specific branch

#### Settings (important for owners)

| Tab | What to configure |
|-----|-------------------|
| **Shop Profile** | Name, logo, address, phone, email |
| **Invoice** | Bill format, thermal width, auto-print, warranty terms, T&C, footer |
| **Features** | View enabled modules |
| **Account** | Change password |

#### Invoice settings explained

| Setting | Effect |
|---------|--------|
| Thermal 58mm / 80mm | Small receipt printer |
| Stock Form | 9.5×11 inch tractor-feed invoice (Kasthuri style) |
| POS auto-print | Print bill automatically after sale |
| Warranty & Service Terms | Printed at bottom of stock-form bill |
| Terms & Conditions | Printed at bottom of stock-form bill |
| Show/hide fields | SKU, IMEI, customer, warranty block on thermal |

---

### සිංහala

#### Staff
Users add → role assign (Owner/Manager/Cashier/Technician)

#### Branches
Branches add → users branch-wise limit

#### Settings
| Tab | Configure |
|-----|-----------|
| Shop Profile | Name, logo, address |
| Invoice | Bill type, auto-print, terms |
| Account | Password |

Stock Form = Kasthuri style big bill  
Thermal = small receipt printer

---

## 17. User Roles — Who Can Do What

### English

| Role | Typical access |
|------|----------------|
| **Owner** | Everything — settings, staff, finance, all modules |
| **Manager** | Sales, inventory, reports, most finance; limited settings |
| **Cashier** | POS, customers, basic sales view |
| **Technician** | Repairs, warranty claims |

Your shop owner controls who gets which role.

---

### සිංහala

| Role | Access |
|------|--------|
| **Owner** | සියල්ල |
| **Manager** | Sales, inventory, reports |
| **Cashier** | POS, customers |
| **Technician** | Repairs, warranty |

Owner role assign කරනවා.

---

## 18. Keyboard Shortcuts (POS)

### English & සිංහala

| Key | Action | ක්‍රියාව |
|-----|--------|----------|
| **F2** | Open customer search | Customer search |
| **F3** | Pay now | Payment |
| **F4** | Hold cart | Cart hold |
| **F5** | Reprint last bill | Reprint |
| **F6** | Reload category / Held carts | Reload / Held |
| **F7** | Day start | Day start |
| **F8** | Cash in | Cash in |
| **F9** | Checkout | Checkout |
| **F10** | New sale | New sale |
| **F11** | Day end | Day end |
| **F12** | Calculator | Calculator |
| **Ctrl+Enter** | Pay now | Pay now |

---

## 19. Frequently Asked Questions

### English

**Q: Bill did not print?**  
A: Allow pop-ups in browser. Check Settings → Invoice → print type. Click Reprint (F5) on success screen.

**Q: Warranty not created?**  
A: Select a customer. Product must have warranty months > 0. Warranty feature must be enabled.

**Q: Cannot sell — insufficient stock?**  
A: Add stock via Add Stock or receive PO. Check correct variant/IMEI.

**Q: IMEI product not adding?**  
A: Scan IMEI in POS scan field. IMEI must be In Stock. Use variation picker if multiple colours.

**Q: Customer credit / due?**  
A: Select customer → complete sale with partial payment → due added to customer balance. Collect later via POS outstanding option.

**Q: How to change bill footer / warranty terms?**  
A: Settings → Invoice → Warranty & Service Terms / Terms & Conditions.

**Q: Product warranty note on bill?**  
A: Set in Add Product → Warranty note field. Prints on stock-form bill. Edit in POS cart for one sale.

**Q: Wrong price on bill?**  
A: Edit price in cart before checkout (click price line).

**Q: How to return a sold item?**  
A: Returns page → find original invoice → select items → process return.

**Q: Forgot password?**  
A: Login page → Forgot password → email link.

---

### සිංහala

**Q: Bill print නැහැ?**  
A: Browser pop-ups allow. Settings → Invoice. F5 reprint.

**Q: Warranty create නැහැ?**  
A: Customer select. Warranty months > 0. Feature enabled.

**Q: Stock insufficient?**  
A: Add Stock / PO receive.

**Q: IMEI add නැහැ?**  
A: IMEI scan. In Stock status. Variant pick.

**Q: Customer credit?**  
A: Customer select → partial pay → due balance. POS outstanding collect.

**Q: Bill terms change?**  
A: Settings → Invoice.

**Q: Warranty note bill එකේ?**  
A: Add Product warranty note. POS cart edit.

**Q: Price වැරදි?**  
A: Cart price edit before checkout.

**Q: Return?**  
A: Returns → invoice → items return.

**Q: Password forgot?**  
A: Forgot password → email.

---

## Quick Reference Card | ඉක්මන් යොමුව

```
┌─────────────────────────────────────────────────┐
│  HEXALYTE POS — DAILY WORKFLOW                  │
├─────────────────────────────────────────────────┤
│  1. Open POS                                    │
│  2. F7 Day Start (if used)                      │
│  3. F2 Select customer (warranty/credit)      │
│  4. Add products / scan IMEI                    │
│  5. Edit price / warranty if needed           │
│  6. F9 Checkout → payment                       │
│  7. Bill prints → F5 reprint if needed          │
│  8. F10 New sale                                │
│  9. F11 Day End / Daily Closing (end of day)    │
└─────────────────────────────────────────────────┘
```

---

## Support | සහාය

**Hexalyte Innovation**  
Phone: **070 313 0100**  
Web: www.hexalyte.com

Bill footer: *Software by Hexalyte Innovation — 0703130100*

---

*© 2026 Hexalyte Innovation. This manual is for authorized users of the Hexalyte platform.*
