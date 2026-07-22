const ACCESS_TOKEN_KEY = 'hx_access_token'
const REFRESH_TOKEN_KEY = 'hx_refresh_token'
const USER_KEY = 'hx_user'

export type BranchSummary = {
  id: string
  name: string
  city: string
  isHeadquarters: boolean
  isDefault: boolean
  isActive: boolean
}

export type BranchScope = 'single' | 'assigned' | 'all'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  branchIds: string[]
  branches?: BranchSummary[]
  activeBranchId?: string
  branchScope?: BranchScope
  suggestedBranchId?: string
  avatar?: string
}

export const authStorage = {
  getAccessToken: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,

  getRefreshToken: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,

  getUser: (): AuthUser | null => {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  },

  save: (accessToken: string, refreshToken: string, user: AuthUser) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  updateUser: (patch: Partial<AuthUser>) => {
    const user = authStorage.getUser()
    if (!user) return
    localStorage.setItem(USER_KEY, JSON.stringify({ ...user, ...patch }))
  },

  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    // Clear any scoped role-permission caches for this browser
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('hx_role_permissions')) keys.push(k)
      }
      for (const k of keys) localStorage.removeItem(k)
    } catch { /* noop */ }
  },

  isLoggedIn: (): boolean =>
    typeof window !== 'undefined' && !!localStorage.getItem(ACCESS_TOKEN_KEY),
}
