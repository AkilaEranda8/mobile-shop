/**
 * Phase 3 bootstrap: ensure acceptance database exists and schema is pushed.
 * Run: npx tsx src/modules/emi-locker/phase3-bootstrap.ts
 */
import { Client } from 'pg'
import { execSync } from 'child_process'

const ADMIN = process.env.PHASE3_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
const DB_NAME = process.env.PHASE3_DB_NAME || 'hexalyte_emi_accept'
const ACCEPT_URL = process.env.PHASE3_DATABASE_URL || `postgresql://postgres:postgres@localhost:5432/${DB_NAME}`

async function main() {
  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME])
  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${DB_NAME}"`)
    console.log(`[phase3] created database ${DB_NAME}`)
  } else {
    console.log(`[phase3] database ${DB_NAME} already exists`)
  }
  await admin.end()

  console.log('[phase3] pushing Prisma schema…')
  execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: ACCEPT_URL },
    cwd: process.cwd(),
  })
  console.log('[phase3] schema ready')
  console.log(`PHASE3_DATABASE_URL=${ACCEPT_URL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
