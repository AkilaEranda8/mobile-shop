/**
 * Keycloak Admin API helpers.
 *
 * Prerequisites (realm `hexalyte`, client `hexalyte-backend`):
 * - Direct Access Grants (Resource Owner Password) enabled
 * - Access token mappers for attributes: db_user_id, tenant_id, user_role
 * - Users use email as Keycloak username (password grant with email)
 *
 * See docs/KEYCLOAK_AUTH_SETUP.md
 */
import { env } from '../config/env'

function kcBase() { return env.KEYCLOAK_URL ?? '' }
function kcRealm() { return env.KC_REALM }
function adminBase() { return `${kcBase()}/admin/realms/${kcRealm()}` }

export function isKcConfigured() {
  return !!(env.KEYCLOAK_URL && env.KC_CLIENT_ID && env.KC_CLIENT_SECRET)
}

export function isKcAuthEnabled() {
  return env.KEYCLOAK_AUTH_ENABLED === 'true' && isKcConfigured()
}

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

type KcUserRow = {
  id: string
  username?: string
  email?: string
  attributes?: Record<string, string[]>
}

// ── Groups ─────────────────────────────────────────────────────────────────────
export async function createOrGetGroup(slug: string, name: string): Promise<string> {
  if (!isKcConfigured()) return ''
  const res = await kc(`/groups?search=${encodeURIComponent(slug)}&exact=true`)
  const groups = await res.json() as { id: string }[]
  if (groups.length > 0) return groups[0].id
  const cr = await kc('/groups', { method: 'POST', body: JSON.stringify({ name: slug, attributes: { tenantName: [name] } }) })
  const loc = cr.headers.get('Location') ?? ''
  return loc.split('/').pop() ?? ''
}

export async function addUserToGroup(kcUserId: string, groupId: string): Promise<void> {
  if (!isKcConfigured() || !kcUserId || !groupId) return
  await kc(`/users/${kcUserId}/groups/${groupId}`, { method: 'PUT' })
}

export async function deleteGroup(slug: string): Promise<void> {
  if (!isKcConfigured()) return
  const res = await kc(`/groups?search=${encodeURIComponent(slug)}&exact=true`)
  const groups = await res.json() as { id: string }[]
  if (groups.length > 0) await kc(`/groups/${groups[0].id}`, { method: 'DELETE' })
}

// ── Users ──────────────────────────────────────────────────────────────────────
export async function findKcUserByDbId(dbUserId: string): Promise<string | null> {
  if (!isKcConfigured()) return null
  const res = await kc(`/users?q=db_user_id:${encodeURIComponent(dbUserId)}&max=50`)
  const users = await res.json() as KcUserRow[]
  const match = users.find(u => u.attributes?.db_user_id?.[0] === dbUserId)
  return match?.id ?? null
}

export async function findKcUserByEmail(email: string): Promise<string | null> {
  if (!isKcConfigured()) return null
  const normalized = email.trim().toLowerCase()
  const res = await kc(`/users?email=${encodeURIComponent(normalized)}&exact=true&max=20`)
  const users = await res.json() as KcUserRow[]
  const match = users.find(u => (u.email ?? '').toLowerCase() === normalized)
  return match?.id ?? null
}

async function setKcPassword(kcUserId: string, password: string): Promise<void> {
  const res = await kc(`/users/${kcUserId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ type: 'password', value: password, temporary: false }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`KC set password failed: ${res.status} ${text}`)
  }
}

export async function createKcUser(opts: {
  dbUserId: string
  tenantId: string
  tenantSlug: string
  username?: string
  email: string
  name: string
  role: string
  password: string
  groupId?: string
}): Promise<string> {
  if (!isKcConfigured()) return ''
  const email = opts.email.trim().toLowerCase()
  const [firstName, ...rest] = opts.name.split(' ')
  const body = {
    username: email,
    email,
    emailVerified: true,
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
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '')
    throw new Error(`KC create user failed: ${res.status} ${text}`)
  }
  let kcId = (res.headers.get('Location') ?? '').split('/').pop() ?? ''
  if (!kcId) {
    kcId = (await findKcUserByEmail(email)) ?? (await findKcUserByDbId(opts.dbUserId)) ?? ''
  }
  if (kcId && opts.groupId) await addUserToGroup(kcId, opts.groupId)
  return kcId
}

/**
 * Ensure a Hexalyte user exists in Keycloak with correct attributes + password.
 * Uses email as username so password-grant login works with the same email.
 */
export async function ensureKcUser(opts: {
  dbUserId: string
  tenantId: string
  tenantSlug: string
  email: string
  name: string
  role: string
  password: string
  groupId?: string
  isActive?: boolean
}): Promise<string> {
  if (!isKcConfigured()) throw new Error('Keycloak is not configured')

  const email = opts.email.trim().toLowerCase()
  let kcId = await findKcUserByDbId(opts.dbUserId)
  if (!kcId) kcId = await findKcUserByEmail(email)

  if (!kcId) {
    kcId = await createKcUser({
      dbUserId: opts.dbUserId,
      tenantId: opts.tenantId,
      tenantSlug: opts.tenantSlug,
      email,
      name: opts.name,
      role: opts.role,
      password: opts.password,
      groupId: opts.groupId,
    })
    if (!kcId) throw new Error('Keycloak user create returned no id')
    return kcId
  }

  // Fetch current representation so PUT does not wipe required fields
  const getRes = await kc(`/users/${kcId}`)
  if (!getRes.ok) throw new Error(`KC get user failed: ${getRes.status}`)
  const current = await getRes.json() as KcUserRow & {
    firstName?: string
    lastName?: string
    enabled?: boolean
    emailVerified?: boolean
  }

  const [firstName, ...rest] = opts.name.split(' ')
  const attributes = {
    ...(current.attributes ?? {}),
    db_user_id: [opts.dbUserId],
    tenant_id: [opts.tenantId],
    tenant_slug: [opts.tenantSlug],
    user_role: [opts.role],
  }

  const putRes = await kc(`/users/${kcId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...current,
      id: kcId,
      username: email,
      email,
      emailVerified: true,
      firstName,
      lastName: rest.join(' ') || firstName,
      enabled: opts.isActive !== false,
      attributes,
    }),
  })
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '')
    throw new Error(`KC update user failed: ${putRes.status} ${text}`)
  }

  await setKcPassword(kcId, opts.password)
  if (opts.groupId) await addUserToGroup(kcId, opts.groupId)
  return kcId
}

export async function updateKcUser(dbUserId: string, updates: {
  name?: string
  role?: string
  isActive?: boolean
  tenantId?: string
  tenantSlug?: string
  email?: string
}): Promise<void> {
  if (!isKcConfigured()) return
  const kcId = await findKcUserByDbId(dbUserId)
  if (!kcId) return

  const getRes = await kc(`/users/${kcId}`)
  if (!getRes.ok) return
  const current = await getRes.json() as KcUserRow & {
    firstName?: string
    lastName?: string
    enabled?: boolean
    email?: string
    username?: string
  }

  const body: Record<string, unknown> = { ...current, id: kcId }
  if (updates.name) {
    const [firstName, ...rest] = updates.name.split(' ')
    body.firstName = firstName
    body.lastName = rest.join(' ') || firstName
  }
  if (updates.isActive !== undefined) body.enabled = updates.isActive
  if (updates.email) {
    const email = updates.email.trim().toLowerCase()
    body.email = email
    body.username = email
  }

  const attrs = { ...(current.attributes ?? {}) }
  if (updates.role) attrs.user_role = [updates.role]
  if (updates.tenantId) attrs.tenant_id = [updates.tenantId]
  if (updates.tenantSlug) attrs.tenant_slug = [updates.tenantSlug]
  if (updates.role || updates.tenantId || updates.tenantSlug) {
    attrs.db_user_id = attrs.db_user_id?.length ? attrs.db_user_id : [dbUserId]
    body.attributes = attrs
  }

  await kc(`/users/${kcId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function updateKcPassword(dbUserId: string, newPassword: string): Promise<void> {
  if (!isKcConfigured()) return
  const kcId = await findKcUserByDbId(dbUserId)
  if (!kcId) return
  await setKcPassword(kcId, newPassword)
}

export async function deleteKcUser(dbUserId: string): Promise<void> {
  if (!isKcConfigured()) return
  const kcId = await findKcUserByDbId(dbUserId)
  if (!kcId) return
  await kc(`/users/${kcId}`, { method: 'DELETE' })
}
