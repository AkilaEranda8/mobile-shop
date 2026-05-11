-- Hexalyte PostgreSQL Initialization
-- This runs once when the Docker postgres container first starts.
-- Prisma migrations handle the actual schema; this just ensures
-- the secondary DB for Keycloak auth is available.

SELECT 'CREATE DATABASE hexalyte_auth'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'hexalyte_auth'
)\gexec

GRANT ALL PRIVILEGES ON DATABASE hexalyte_auth TO hexalyte;
