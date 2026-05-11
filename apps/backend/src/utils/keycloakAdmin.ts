import { env } from '../config/env'

// ── helpers ───────────────────────────────────────────────────────────────────
function kcBase() { return env.KEYCLOAK_URL ?? '' }
function kcRealm() { return env.KC_REALM }
function adminBase() { return `${kcBase()}/admin/realms/${kcRealm()}` }
function isConfigured() { return !!(env.KEYCLOAK_URL && env.KC_CLIENT_ID && env.KC_CLIENT_SECRET) }

interface TokenCache { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

async function getAdminToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token
  const res = await fetch(`${kcBase()}/realms/${kcRealm()}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.KC_CLIENT_ID!,
      client_secret: env.KC_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`KC admin token failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 30) * 1000 }
  return tokenCache.token
}

async function kc(path: string, init: RequestInit = {}) {
  const token = await getAdminToken()
  return fetch(`${adminBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

// ── Groups ─────────────────────────────────────────────────────────────────────
export async function createOrGetGroup(slug: string, name: string): Promise<string> {
  if (!isConfigured()) return ''
  const res = await kc(`/groups?search=${encodeURIComponent(slug)}&exact=true`)
  const groups = await res.json() as { id: string }[]
  if (groups.length > 0) return groups[0].id
  const cr = await kc('/groups', { method: 'POST', body: JSON.stringify({ name: slug, attributes: { tenantName: [name] } }) })
  const loc = cr.headers.get('Location') ?? ''
  return loc.split('/').pop() ?? ''
}

export async function addUserToGroup(kcUserId: string, groupId: string): Promise<void> {
  if (!isConfigured() || !kcUserId || !groupId) return
  await kc(`/users/${kcUserId}/groups/${groupId}`, { method: 'PUT' })
}

export async function deleteGroup(slug: string): Promise<void> {
  if (!isConfigured()) return
  const res = await kc(`/groups?search=${encodeURIComponent(slug)}&exact=true`)
  const groups = await res.json() as { id: string }[]
  if (groups.length > 0) await kc(`/groups/${groups[0].id}`, { method: 'DELETE' })
}

// ── Users ──────────────────────────────────────────────────────────────────────
export async function findKcUserByDbId(dbUserId: string): Promise<string | null> {
  if (!isConfigured()) return null
  const res = await kc(`/users?q=db_user_id:${dbUserId}`)
  const users = await res.json() as { id: string; attributes?: Record<string, string[]> }[]
  const match = users.find(u => u.attributes?.db_user_id?.[0] === dbUserId)
  return match?.id ?? null
}

export async function createKcUser(opts: {
  dbUserId: string
  tenantId: string
  tenantSlug: string
  username: string
  email: string
  name: string
  role: string
  password: string
  groupId?: string
}): Promise<string> {
  if (!isConfigured()) return ''
  const [firstName, ...rest] = opts.name.split(' ')
  const body = {
    username: `${opts.tenantSlug}__${opts.username}`,
    email: opts.email,
    firstName,
    lastName: rest.join(' ') || firstName,
    enabled: true,
    credentials: [{ type: 'password', value: opts.password, temporary: false }],
    attributes: {
      db_user_id: [opts.dbUserId],
      tenant_id: [opts.tenantId],
      tenant_slug: [opts.tenantSlug],
      user_role: [opts.role],
    },
  }
  const res = await kc('/users', { method: 'POST', body: JSON.stringify(body) })
  const loc = res.headers.get('Location') ?? ''
  const kcId = loc.split('/').pop() ?? ''
  if (kcId && opts.groupId) await addUserToGroup(kcId, opts.groupId)
  return kcId
}

export async function updateKcUser(dbUserId: string, updates: {
  name?: string
  role?: string
  isActive?: boolean
}): Promise<void> {
  if (!isConfigured()) return
  const kcId = await findKcUserByDbId(dbUserId)
  if (!kcId) return
  const body: Record<string, unknown> = {}
  if (updates.name) {
    const [firstName, ...rest] = updates.name.split(' ')
    body.firstName = firstName
    body.lastName = rest.join(' ') || firstName
  }
  if (updates.isActive !== undefined) body.enabled = updates.isActive
  if (updates.role) body.attributes = { user_role: [updates.role] }
  await kc(`/users/${kcId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function updateKcPassword(dbUserId: string, newPassword: string): Promise<void> {
  if (!isConfigured()) return
  const kcId = await findKcUserByDbId(dbUserId)
  if (!kcId) return
  await kc(`/users/${kcId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ type: 'password', value: newPassword, temporary: false }),
  })
}

export async function deleteKcUser(dbUserId: string): Promise<void> {
  if (!isConfigured()) return
  const kcId = await findKcUserByDbId(dbUserId)
  if (!kcId) return
  await kc(`/users/${kcId}`, { method: 'DELETE' })
}
