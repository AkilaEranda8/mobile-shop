export type ManualLang = 'en' | 'si' | 'both'

export interface ManualSection {
  id: string
  icon?: string
  titleEn: string
  titleSi: string
  itemsEn: string[]
  itemsSi: string[]
}

export const USER_MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'start',
    titleEn: 'Getting Started',
    titleSi: 'පටන් ගැනීම',
    itemsEn: [
      'Open your shop URL and sign in with the email and password from your owner.',
      'New shop owners can register at the Register page — 14-day trial starts automatically.',
      'Complete Settings → Shop Info (name, phone, address) and Settings → Invoice (logo, bill format).',
      'Forgot password? Use the link on the login page to reset via email.',
    ],
    itemsSi: [
      'Shop URL open කර owner දුන් email/password එකෙන් login වන්න.',
      'නව owners Register page එකෙන් shop register කරන්න — 14-day trial start වෙනවා.',
      'Settings → Shop Info (name, phone, address) සහ Settings → Invoice (logo, bill) complete කරන්න.',
      'Password forgot? Login page → Forgot password → email link.',
    ],
  },
  {
    id: 'pos',
    titleEn: 'Point of Sale (POS)',
    titleSi: 'POS — විකිණීම',
    itemsEn: [
      'Open POS from the sidebar (Point of Sale).',
      'Add products: click a product, search by name/SKU, or scan IMEI barcode for tracked phones.',
      'Select customer (F2) — required for warranty products and credit sales.',
      'Edit price: click the price line under each cart item → Save.',
      'Edit warranty: click the warranty badge → pick period → optional note → Save.',
      'Checkout (F9): choose Cash, Card, or UPI. Enter cash received for change calculation.',
      'Credit sale: select customer first — unpaid amount adds to their outstanding balance.',
      'After sale: reprint (F5), download PDF, or send WhatsApp invoice if connected.',
    ],
    itemsSi: [
      'Sidebar → Point of Sale open කරන්න.',
      'Products: click, search, හෝ IMEI scan කරන්න.',
      'Customer select (F2) — warranty සහ credit sales සඳහා අනිවාර්ය.',
      'Price edit: cart item යට price line click → Save.',
      'Warranty edit: warranty badge click → period + note → Save.',
      'Checkout (F9): Cash / Card / UPI. Cash received දාන්න change සඳහා.',
      'Credit sale: customer select → due balance customer account එකට.',
      'Sale එකට පස්සේ: F5 reprint, PDF, WhatsApp invoice.',
    ],
  },
  {
    id: 'pos-keys',
    titleEn: 'POS Keyboard Shortcuts',
    titleSi: 'POS Keyboard Shortcuts',
    itemsEn: [
      'F2 — Customer search',
      'F3 / Ctrl+Enter — Pay now',
      'F4 — Hold cart',
      'F5 — Reprint last bill',
      'F9 — Checkout',
      'F10 — New sale (clear cart)',
      'F11 — Day end / daily closing',
      'F12 — Calculator',
    ],
    itemsSi: [
      'F2 — Customer search',
      'F3 / Ctrl+Enter — Pay now',
      'F4 — Cart hold',
      'F5 — Bill reprint',
      'F9 — Checkout',
      'F10 — New sale',
      'F11 — Day end',
      'F12 — Calculator',
    ],
  },
  {
    id: 'inventory',
    titleEn: 'Inventory & Products',
    titleSi: 'Inventory & Products',
    itemsEn: [
      'Inventory page — view all products, stock levels, and product details.',
      'Add Product — set name, brand, category, prices, stock, warranty period, warranty note, IMEI tracking, and variants.',
      'Import CSV — download template, fill in Excel, upload for bulk import.',
      'Add Stock — receive stock for existing products without creating a new product.',
      'Warranty note on a product prints on the stock-form bill under that line item.',
    ],
    itemsSi: [
      'Inventory — products, stock, details බලන්න.',
      'Add Product — name, brand, category, price, stock, warranty, IMEI, variants.',
      'CSV Import — template download → fill → upload.',
      'Add Stock — existing product එකට stock add.',
      'Product warranty note stock-form bill එකේ item යට print වෙනවා.',
    ],
  },
  {
    id: 'customers',
    titleEn: 'Customers',
    titleSi: 'Customers',
    itemsEn: [
      'Add and search customers with name, phone, and address.',
      'Outstanding balance is tracked for credit customers.',
      'Collect old outstanding balance from POS checkout when customer is selected.',
    ],
    itemsSi: [
      'Customers add/search — name, phone, address.',
      'Credit customers outstanding balance track වෙනවා.',
      'POS checkout එකේ පරණ outstanding collect කරන්න පුළුවන්.',
    ],
  },
  {
    id: 'sales-returns',
    titleEn: 'Sales & Returns',
    titleSi: 'Sales & Returns',
    itemsEn: [
      'Sales History — view all invoices, search, reprint bills.',
      'Returns — find original sale, select items to return; stock and IMEI are restored automatically.',
    ],
    itemsSi: [
      'Sales History — invoices, reprint.',
      'Returns — original sale → items return → stock restore.',
    ],
  },
  {
    id: 'repairs',
    titleEn: 'Repair Jobs',
    titleSi: 'Repair Jobs',
    itemsEn: [
      'Create repair ticket with customer, device, and reported issue.',
      'Status flow: Received → Diagnosed → In-Repair → QC → Ready → Delivered.',
      'Set estimated and actual cost; print repair invoice when ready.',
    ],
    itemsSi: [
      'Repair ticket create — customer, device, issue.',
      'Status: Received → Diagnosed → In-Repair → QC → Ready → Delivered.',
      'Cost set කර repair invoice print.',
    ],
  },
  {
    id: 'warranty',
    titleEn: 'Warranty',
    titleSi: 'Warranty',
    itemsEn: [
      'Warranty certificates are created automatically on POS sale when product has warranty months and a customer is selected.',
      'Edit warranty period and note in POS cart before checkout (sale-specific).',
      'Warranty page — view certificates and process claims.',
      'Shop-wide warranty terms: Settings → Invoice → Warranty & Service Terms.',
    ],
    itemsSi: [
      'POS sale එකේ warranty auto create (customer + warranty product).',
      'POS cart එකේ warranty period/note edit කරන්න පුළුවන්.',
      'Warranty page — certificates, claims.',
      'Shop terms: Settings → Invoice → Warranty & Service Terms.',
    ],
  },
  {
    id: 'finance',
    titleEn: 'Finance & Daily Closing',
    titleSi: 'Finance & Daily Closing',
    itemsEn: [
      'Finance — income and expense summary by date.',
      'Expenses — record shop running costs.',
      'Daily Closing — count cash by denomination at end of day and close the business day.',
      'Profit Allocation — distribute profit to internal funds (if enabled).',
    ],
    itemsSi: [
      'Finance — income/expense summary.',
      'Expenses — shop expenses record.',
      'Daily Closing — day end cash count, day close.',
      'Profit Allocation — profit distribute (enabled නම්).',
    ],
  },
  {
    id: 'invoice-settings',
    titleEn: 'Invoice & Bill Settings',
    titleSi: 'Invoice & Bill Settings',
    itemsEn: [
      'Settings → Invoice — configure logo, shop name, address, phone on bills.',
      'Print format: Thermal 58mm, Thermal 80mm, or Stock Form (9.5×11 tractor invoice).',
      'POS auto-print — automatically print bill when sale completes.',
      'Warranty & Service Terms and Terms & Conditions print at the bottom of stock-form bills.',
      'Toggle which fields appear on thermal receipts (SKU, IMEI, customer, warranty block).',
    ],
    itemsSi: [
      'Settings → Invoice — logo, shop name, address, phone.',
      'Print format: Thermal 58mm / 80mm / Stock Form.',
      'POS auto-print — sale complete වෙද්දී auto print.',
      'Warranty Terms සහ T&C stock-form bill bottom එකේ.',
      'Thermal receipt fields on/off.',
    ],
  },
  {
    id: 'whatsapp',
    titleEn: 'WhatsApp',
    titleSi: 'WhatsApp',
    itemsEn: [
      'Connect shop WhatsApp from the WhatsApp page (scan QR code).',
      'After a sale, send invoice PDF or message to the customer from the success screen.',
    ],
    itemsSi: [
      'WhatsApp page → QR scan → connect.',
      'Sale complete → customer ට invoice send.',
    ],
  },
  {
    id: 'roles',
    titleEn: 'User Roles',
    titleSi: 'User Roles',
    itemsEn: [
      'Owner — full access including settings and staff.',
      'Manager — sales, inventory, reports, most finance.',
      'Cashier — POS and customers.',
      'Technician — repairs and warranty claims.',
      'Manage team in Settings → Team.',
    ],
    itemsSi: [
      'Owner — සියල්ල including settings.',
      'Manager — sales, inventory, reports.',
      'Cashier — POS, customers.',
      'Technician — repairs, warranty.',
      'Settings → Team — staff manage.',
    ],
  },
  {
    id: 'faq',
    titleEn: 'Common Questions',
    titleSi: 'නිතර අහන ප්‍රශ්න',
    itemsEn: [
      'Bill not printing? Allow browser pop-ups; check Settings → Invoice print type; press F5 to reprint.',
      'Warranty not created? Select a customer; product must have warranty months > 0.',
      'Insufficient stock? Add stock via Add Stock or receive a purchase order.',
      'Wrong price on bill? Edit price in cart before checkout.',
      'Need help? Call Hexalyte Innovation — 070 313 0100.',
    ],
    itemsSi: [
      'Bill print නැහැ? Pop-ups allow; Settings → Invoice; F5 reprint.',
      'Warranty නැහැ? Customer select; warranty months > 0.',
      'Stock insufficient? Add Stock / PO receive.',
      'Price වැරදි? Checkout එකට පෙර cart price edit.',
      'Help: Hexalyte Innovation — 070 313 0100.',
    ],
  },
]

export const USER_MANUAL_WORKFLOW_EN = [
  'Open POS',
  'F7 Day Start (if your shop uses it)',
  'F2 Select customer (warranty / credit)',
  'Add products or scan IMEI',
  'Edit price or warranty if needed',
  'F9 Checkout → payment',
  'Bill prints — F5 reprint if needed',
  'F10 New sale',
  'F11 Day End / Daily Closing at end of day',
]

export const USER_MANUAL_WORKFLOW_SI = [
  'POS open',
  'F7 Day Start (use කරනවා නම්)',
  'F2 Customer select',
  'Products add / IMEI scan',
  'Price / warranty edit',
  'F9 Checkout',
  'Bill print — F5 reprint',
  'F10 New sale',
  'F11 Day End / Daily Closing',
]
