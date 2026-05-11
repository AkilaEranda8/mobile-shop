const ACCESS_TOKEN_KEY = 'hx_access_token'
const REFRESH_TOKEN_KEY = 'hx_refresh_token'
const USER_KEY = 'hx_user'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  branchIds: string[]
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

  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },

  isLoggedIn: (): boolean =>
    typeof window !== 'undefined' && !!localStorage.getItem(ACCESS_TOKEN_KEY),
}
