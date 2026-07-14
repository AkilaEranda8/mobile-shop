# Keycloak auth setup (Hexalyte)

Use this checklist before enabling `KEYCLOAK_AUTH_ENABLED=true` in production.

## Realm / client

- **URL:** `https://auth.hexalyte.com` (or your `KEYCLOAK_URL`)
- **Realm:** `hexalyte` (`KC_REALM`)
- **Client:** `hexalyte-backend` (`KC_CLIENT_ID` + `KC_CLIENT_SECRET`)
  - Access type: confidential
  - **Direct Access Grants** (Resource Owner Password Credentials): **ON**
  - Service accounts: **ON** (for Admin API client-credentials)

## Access token mappers (required)

Create **User Attribute** mappers on the client (or dedicated scope) so access tokens include:

| Claim / token claim name | User attribute | Notes |
|--------------------------|----------------|-------|
| `db_user_id` | `db_user_id` | Hexalyte `User.id` |
| `tenant_id` | `tenant_id` | Hexalyte tenant id |
| `user_role` | `user_role` | `OWNER`, `MANAGER`, `CASHIER`, `TECHNICIAN`, `PLATFORM_ADMIN` |

Backend reads these in `verifyKcToken` (`auth.middleware.ts`).

## Username convention

Hexalyte syncs users with **email as Keycloak username** so login and password-grant use the same email users already know.

## Tenant staff create

When a shop OWNER/MANAGER creates a staff user (Staff & Roles), Hexalyte:

1. Creates the Postgres `User` row (roles, branches, bcrypt password)
2. **Requires** Keycloak create/update via `ensureKcUser` (email as username + attributes)
3. If Keycloak fails, the DB user is rolled back and the API returns 503

So every tenant user exists on both Hexalyte and `auth.hexalyte.com` before they can log in.


## Impersonation

Admin “login as shop” still uses a short-lived **app JWT** with claim `impersonation: true`. Middleware accepts those in addition to Keycloak tokens.
