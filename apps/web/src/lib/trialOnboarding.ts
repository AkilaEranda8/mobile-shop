export type OnboardingStepId =
  | 'shop_profile'
  | 'invoice_setup'
  | 'first_product'
  | 'first_sale'

export interface OnboardingStepDef {
  id: OnboardingStepId
  titleEn: string
  titleSi: string
  descEn: string
  descSi: string
  actionEn: string
  actionSi: string
  href?: string
  opensPos?: boolean
  /** Shown in expanded coach on every page */
  hintsEn: string[]
  hintsSi: string[]
}

export const TRIAL_ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: 'shop_profile',
    titleEn: 'Complete your shop profile',
    titleSi: 'Shop profile එක complete කරන්න',
    descEn: 'Add your shop name, phone, and address so bills and receipts show the right details.',
    descSi: 'Shop name, phone, address add කරන්න — bills/receipts වල correct details පෙන්වයි.',
    actionEn: 'Open Shop Settings',
    actionSi: 'Shop Settings open කරන්න',
    href: '/dashboard/settings?tab=shop',
    hintsEn: [
      'Use your real shop name — it appears on bills and the sidebar.',
      'Add a phone number customers can call from receipts.',
      'Fill the branch address — this prints on invoices.',
      'Click Save at the bottom when all three fields are filled.',
    ],
    hintsSi: [
      'Shop name එක real name එක දාන්න — bills සහ sidebar එකේ පෙන්වයි.',
      'Receipts වලින් customers call කරන්න phone number එක add කරන්න.',
      'Branch address එක fill කරන්න — invoices වල print වෙයි.',
      'Fields ටික fill කරලා Save click කරන්න.',
    ],
  },
  {
    id: 'invoice_setup',
    titleEn: 'Set up your bill / receipt',
    titleSi: 'Bill / receipt setup කරන්න',
    descEn: 'Add shop name, phone, and address on your invoice template before your first sale.',
    descSi: 'First sale එකට පෙර invoice template එකේ shop name, phone, address set කරන්න.',
    actionEn: 'Customize Invoice',
    actionSi: 'Invoice customize කරන්න',
    href: '/dashboard/settings?tab=invoice',
    hintsEn: [
      'Open Settings → Invoice tab.',
      'Set shop name, phone, and address on the bill header.',
      'Upload your logo if you have one — optional but looks professional.',
      'Use Preview to check how the bill will print, then Save.',
    ],
    hintsSi: [
      'Settings → Invoice tab open කරන්න.',
      'Bill header එකේ shop name, phone, address set කරන්න.',
      'Logo එක upload කරන්න — optional, professional look එකට.',
      'Preview බලලා Save කරන්න.',
    ],
  },
  {
    id: 'first_product',
    titleEn: 'Add your first product',
    titleSi: 'First product එක add කරන්න',
    descEn: 'Add at least one item to inventory so you can sell it from POS.',
    descSi: 'Inventory එකට item එකක් add කරන්න — POS එකෙන් sell කරන්න පුළුවන්.',
    actionEn: 'Add Product',
    actionSi: 'Product add කරන්න',
    href: '/inventory/add-product',
    hintsEn: [
      'Go to Inventory → Add Product (or use the button on Inventory page).',
      'Enter product name, selling price, and stock quantity.',
      'Pick a category — create one if needed.',
      'Save the product — it will appear in POS search immediately.',
    ],
    hintsSi: [
      'Inventory → Add Product යන්න.',
      'Product name, selling price, stock quantity enter කරන්න.',
      'Category එක pick කරන්න — නැත්නම් create කරන්න.',
      'Save කරන්න — POS search එකේ straight away පෙන්වයි.',
    ],
  },
  {
    id: 'first_sale',
    titleEn: 'Make your first sale',
    titleSi: 'First sale එක complete කරන්න',
    descEn: 'Open POS, add a product to the cart, and complete a sale to see Hexalyte in action.',
    descSi: 'POS open කරලා cart එකට product add කරලා sale complete කරන්න — system value එක feel වෙයි.',
    actionEn: 'Open POS',
    actionSi: 'POS open කරන්න',
    opensPos: true,
    hintsEn: [
      'Click Open POS from the sidebar or the button below.',
      'Search your product name and add it to the cart.',
      'Choose payment method (Cash / Card) and complete the sale.',
      'The bill prints automatically if auto-print is on in Invoice settings.',
    ],
    hintsSi: [
      'Sidebar හෝ button එකෙන් POS open කරන්න.',
      'Product name search කරලා cart එකට add කරන්න.',
      'Payment method pick කරලා sale complete කරන්න.',
      'Invoice settings වල auto-print on නම් bill එක auto print වෙයි.',
    ],
  },
]

export interface PageContextTip {
  onRightPage: boolean
  headlineEn: string
  headlineSi: string
  tipsEn: string[]
  tipsSi: string[]
}

export function getPageContextTip(
  pathname: string,
  tab: string | null,
  currentStepId: OnboardingStepId | null,
): PageContextTip | null {
  if (!currentStepId) return null
  const step = TRIAL_ONBOARDING_STEPS.find(s => s.id === currentStepId)
  if (!step) return null

  const onSettings = pathname.includes('/settings')
  const onInventoryAdd = pathname.includes('/add-product')
  const onInventory = pathname.includes('/inventory')
  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/'
  const onPos = pathname.includes('/pos')

  switch (currentStepId) {
    case 'shop_profile':
      if (onSettings && tab === 'shop') {
        return {
          onRightPage: true,
          headlineEn: 'You are on Shop Info — fill in the fields below and click Save.',
          headlineSi: 'Shop Info page එකේ ඔයා — fields fill කරලා Save click කරන්න.',
          tipsEn: step.hintsEn,
          tipsSi: step.hintsSi,
        }
      }
      if (onSettings) {
        return {
          onRightPage: false,
          headlineEn: 'Open the Shop Info tab on this page, then fill and Save.',
          headlineSi: 'Settings page එකේ Shop Info tab open කරලා Save කරන්න.',
          tipsEn: step.hintsEn,
          tipsSi: step.hintsSi,
        }
      }
      return {
        onRightPage: false,
        headlineEn: 'Next: open Settings → Shop Info and save your shop details.',
        headlineSi: 'Next: Settings → Shop Info open කරලා shop details save කරන්න.',
        tipsEn: step.hintsEn,
        tipsSi: step.hintsSi,
      }

    case 'invoice_setup':
      if (onSettings && tab === 'invoice') {
        return {
          onRightPage: true,
          headlineEn: 'You are on Invoice settings — customize your bill and click Save.',
          headlineSi: 'Invoice settings page එකේ — bill customize කරලා Save කරන්න.',
          tipsEn: step.hintsEn,
          tipsSi: step.hintsSi,
        }
      }
      if (onSettings) {
        return {
          onRightPage: false,
          headlineEn: 'Open the Invoice tab on this page to set up your bill.',
          headlineSi: 'Settings page එකේ Invoice tab open කරලා bill setup කරන්න.',
          tipsEn: step.hintsEn,
          tipsSi: step.hintsSi,
        }
      }
      return {
        onRightPage: false,
        headlineEn: 'Next: open Settings → Invoice and set up your bill template.',
        headlineSi: 'Next: Settings → Invoice open කරලා bill template setup කරන්න.',
        tipsEn: step.hintsEn,
        tipsSi: step.hintsSi,
      }

    case 'first_product':
      if (onInventoryAdd) {
        return {
          onRightPage: true,
          headlineEn: 'You are on Add Product — fill the form and save your first item.',
          headlineSi: 'Add Product page එකේ — form fill කරලා first item save කරන්න.',
          tipsEn: step.hintsEn,
          tipsSi: step.hintsSi,
        }
      }
      if (onInventory) {
        return {
          onRightPage: true,
          headlineEn: 'You are on Inventory — tap Add Product to continue setup.',
          headlineSi: 'Inventory page එකේ — Add Product tap කරලා setup continue කරන්න.',
          tipsEn: step.hintsEn,
          tipsSi: step.hintsSi,
        }
      }
      return {
        onRightPage: false,
        headlineEn: 'Next: go to Inventory and add at least one product.',
        headlineSi: 'Next: Inventory යන්න product එකක් add කරන්න.',
        tipsEn: step.hintsEn,
        tipsSi: step.hintsSi,
      }

    case 'first_sale':
      return {
        onRightPage: onDashboard || onPos,
        headlineEn: onPos
          ? 'POS is open — add a product to cart and complete the sale.'
          : onDashboard
            ? 'Almost done — open POS and complete one test sale.'
            : 'Next: open POS from the sidebar (or the button above) and complete a sale.',
        headlineSi: onPos
          ? 'POS open — product cart එකට add කරලා sale complete කරන්න.'
          : onDashboard
            ? 'Almost done — POS open කරලා test sale එක complete කරන්න.'
            : 'Next: sidebar POS open කරලා sale complete කරන්න.',
        tipsEn: step.hintsEn,
        tipsSi: step.hintsSi,
      }

    default:
      return null
  }
}

export function onboardingDismissKey(tenantId: string) {
  return `hx_trial_onboarding_dismissed_${tenantId}`
}

export function onboardingCollapsedKey(tenantId: string) {
  return `hx_trial_onboarding_collapsed_${tenantId}`
}

export function onboardingCompleteKey(tenantId: string) {
  return `hx_trial_onboarding_complete_${tenantId}`
}

export function onboardingExpandedKey(tenantId: string) {
  return `hx_trial_onboarding_expanded_${tenantId}`
}

export function onboardingWelcomeKey(tenantId: string) {
  return `hx_trial_onboarding_welcome_${tenantId}`
}

/** sessionStorage — optional nudge right after self-register */
export const FIRST_LOGIN_ONBOARDING_KEY = 'hx_trial_first_login_onboarding'

export function enableFirstLoginOnboarding() {
  try { sessionStorage.setItem(FIRST_LOGIN_ONBOARDING_KEY, '1') } catch { /* noop */ }
}

export function clearFirstLoginOnboarding() {
  try { sessionStorage.removeItem(FIRST_LOGIN_ONBOARDING_KEY) } catch { /* noop */ }
}

export function isFirstLoginOnboardingActive(): boolean {
  try { return sessionStorage.getItem(FIRST_LOGIN_ONBOARDING_KEY) === '1' } catch { return false }
}

function pickBranch(tenant: any, branchId?: string) {
  if (!tenant?.branches?.length) return null
  if (branchId) {
    const match = tenant.branches.find((b: any) => b.id === branchId)
    if (match) return match
  }
  return (
    tenant.branches.find((b: any) => b.isHeadquarters)
    ?? tenant.branches[0]
  )
}

export function isShopProfileComplete(tenant: any, branchId?: string): boolean {
  if (!tenant) return false
  const branch = pickBranch(tenant, branchId)
  const name = String(tenant.name ?? '').trim()
  const phone = String(branch?.phone ?? '').trim()
  const address = String(branch?.address ?? '').trim()
  return name.length >= 2 && phone.length >= 6 && address.length >= 3
}

export function isInvoiceSetupComplete(invoice: {
  shopName?: string
  phone?: string
  address?: string
} | null | undefined): boolean {
  if (!invoice) return false
  const shopName = String(invoice.shopName ?? '').trim()
  const phone = String(invoice.phone ?? '').trim()
  const address = String(invoice.address ?? '').trim()
  return shopName.length >= 2 && phone.length >= 6 && address.length >= 3
}

export function trialDaysRemaining(trialEndsAt?: string | null): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt)
  if (Number.isNaN(end.getTime())) return null
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}
