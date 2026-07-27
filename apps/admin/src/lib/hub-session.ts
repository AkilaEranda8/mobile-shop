import {
  type HubProduct,
  PRODUCT_STORAGE_KEY,
  HUB_SESSION_COOKIE,
  getProduct,
} from './products'
import { adminAuth } from './api'

const FASHION_TOKEN = 'hx_fashion_token'
const FASHION_USER = 'hx_fashion_user'
const FASHION_TENANT = 'hx_fashion_tenant'
const SALON_TOKEN = 'hx_salon_token'
const SALON_USER = 'hx_salon_user'
const COOKIE_MAX = 60 * 60 * 8

export type HubUserInfo = { id?: string; name: string; email: string; role: string }

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX}; SameSite=Strict`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

export const hubSession = {
  getProduct(): HubProduct {
    if (typeof window === 'undefined') return 'enterprise'
    const raw = localStorage.getItem(PRODUCT_STORAGE_KEY)
    if (raw === 'fashion' || raw === 'salon' || raw === 'enterprise') return raw
    return 'enterprise'
  },

  setProduct(product: HubProduct) {
    localStorage.setItem(PRODUCT_STORAGE_KEY, product)
    setCookie(HUB_SESSION_COOKIE, product)
  },

  getUser(product?: HubProduct): HubUserInfo | null {
    const p = product ?? hubSession.getProduct()
    if (p === 'enterprise') return adminAuth.getUser()
    if (typeof window === 'undefined') return null
    try {
      const key = p === 'fashion' ? FASHION_USER : SALON_USER
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as HubUserInfo) : null
    } catch {
      return null
    }
  },

  getToken(product?: HubProduct): string | null {
    const p = product ?? hubSession.getProduct()
    if (p === 'enterprise') return adminAuth.getToken()
    if (typeof window === 'undefined') return null
    return localStorage.getItem(p === 'fashion' ? FASHION_TOKEN : SALON_TOKEN)
  },

  hasSession(product: HubProduct): boolean {
    return !!hubSession.getToken(product)
  },

  setEnterpriseSession(token: string, user: HubUserInfo) {
    adminAuth.setToken(token)
    adminAuth.setUser(user)
    hubSession.setProduct('enterprise')
  },

  setFashionSession(token: string, user: HubUserInfo, tenantSlug = 'platform') {
    localStorage.setItem(FASHION_TOKEN, token)
    localStorage.setItem(FASHION_USER, JSON.stringify(user))
    localStorage.setItem(FASHION_TENANT, tenantSlug)
    setCookie(FASHION_TOKEN, token)
    hubSession.setProduct('fashion')
  },

  getFashionTenant(): string {
    if (typeof window === 'undefined') return 'platform'
    return localStorage.getItem(FASHION_TENANT) || 'platform'
  },

  setSalonSession(token: string, user: HubUserInfo) {
    localStorage.setItem(SALON_TOKEN, token)
    localStorage.setItem(SALON_USER, JSON.stringify(user))
    setCookie(SALON_TOKEN, token)
    hubSession.setProduct('salon')
  },

  clearProduct(product: HubProduct) {
    if (product === 'enterprise') {
      adminAuth.clear()
    } else if (product === 'fashion') {
      localStorage.removeItem(FASHION_TOKEN)
      localStorage.removeItem(FASHION_USER)
      localStorage.removeItem(FASHION_TENANT)
      clearCookie(FASHION_TOKEN)
    } else {
      localStorage.removeItem(SALON_TOKEN)
      localStorage.removeItem(SALON_USER)
      clearCookie(SALON_TOKEN)
    }
  },

  /** Clear active product session and hub cookie. */
  logoutActive() {
    const p = hubSession.getProduct()
    hubSession.clearProduct(p)
    clearCookie(HUB_SESSION_COOKIE)
    localStorage.removeItem(PRODUCT_STORAGE_KEY)
  },

  /** Switch product if session exists; otherwise return login path. */
  switchProduct(product: HubProduct): { ok: true; path: string } | { ok: false; loginPath: string } {
    if (!hubSession.hasSession(product)) {
      return { ok: false, loginPath: `/login?product=${product}` }
    }
    hubSession.setProduct(product)
    return { ok: true, path: getProduct(product).homePath }
  },
}
