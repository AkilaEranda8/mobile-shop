export type HubProduct = 'enterprise' | 'fashion' | 'salon'

export interface ProductDef {
  id: HubProduct
  label: string
  shortLabel: string
  identityLabel: string
  identityType: 'email' | 'username'
  homePath: string
  description: string
}

export const PRODUCTS: ProductDef[] = [
  {
    id: 'enterprise',
    label: 'Hexalyte Enterprise',
    shortLabel: 'Enterprise',
    identityLabel: 'Email',
    identityType: 'email',
    homePath: '/dashboard',
    description: 'Mobile / retail / repair platform',
  },
  {
    id: 'fashion',
    label: 'Fashion ERP',
    shortLabel: 'Fashion',
    identityLabel: 'Email',
    identityType: 'email',
    homePath: '/fashion/dashboard',
    description: 'HexaOne clothing & retail ERP',
  },
  {
    id: 'salon',
    label: 'Salon',
    shortLabel: 'Salon',
    identityLabel: 'Username',
    identityType: 'username',
    homePath: '/salon/dashboard',
    description: 'HexaOne salon SaaS',
  },
]

export function getProduct(id: HubProduct): ProductDef {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0]
}

export const PRODUCT_STORAGE_KEY = 'hx_admin_product'
export const HUB_SESSION_COOKIE = 'hx_hub_session'
