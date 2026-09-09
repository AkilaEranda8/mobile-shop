/**
 * Phase 4 viewport matrix for EMI Locker UI (real Next.js + API).
 * Login as Phase4 browser owner; measure overflow at required widths.
 *
 * Run from repo root (with web :3000 up):
 *   node apps/backend/src/modules/emi-locker/phase4-viewport-check.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.WEB_BASE || 'http://localhost:3000'
const API = process.env.API_BASE || 'http://localhost:3001/api/v1'
const EMAIL = 'emi-phase4-owner@hexalyte.test'
const PASSWORD = 'Phase4@Test1'
const WIDTHS = [320, 375, 390, 412, 768, 820, 1024]
const DEVICE_ID = process.env.EMI_DEVICE_ID || 'cmtto2l1s002e98rcdgf316ny'
const ROUTES = [
  '/dashboard/emi-locker',
  '/dashboard/emi-locker/devices',
  `/dashboard/emi-locker/devices/${DEVICE_ID}`,
  '/dashboard/emi-locker/enrollment',
  '/dashboard/emi-locker/commands',
  '/dashboard/emi-locker/policies',
  '/dashboard/emi-locker/settings',
  '/dashboard/emi-locker/reports',
]

function measure() {
  const overflowX =
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  const main = document.querySelector('main')
  const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0
  const tableWrap = document.querySelector('.overflow-x-auto')
  const modal = document.querySelector('[role="dialog"], .fixed.inset-0')
  const modalOverflow = modal
    ? Math.max(0, modal.scrollWidth - modal.clientWidth)
    : 0
  // Ignore off-canvas sidebar and cells inside intentional horizontal scroll wrappers
  const clippedPrimary = [...document.querySelectorAll('main button, main a, main [role=button]')]
    .filter((el) => {
      if (el.closest('.overflow-x-auto, .overflow-x-scroll')) return false
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      return r.right > window.innerWidth + 2 || r.left < -2
    })
    .map((el) => (el.textContent || '').trim().slice(0, 40))
  return {
    overflowX,
    mainOverflow,
    tableScroll: tableWrap ? getComputedStyle(tableWrap).overflowX : null,
    modalOverflow,
    clippedPrimary: clippedPrimary.slice(0, 6),
    h1: document.querySelector('h1')?.textContent?.trim() || '',
  }
}

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const loginJson = await loginRes.json()
  const data = loginJson.data || loginJson
  const accessToken = data.accessToken || data.tokens?.accessToken
  const refreshToken = data.refreshToken || data.tokens?.refreshToken
  const user = data.user
  if (!accessToken || !user) {
    throw new Error(`Login failed: ${JSON.stringify(loginJson).slice(0, 300)}`)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  await context.addInitScript(
    ({ accessToken, refreshToken, user }) => {
      localStorage.setItem('hx_access_token', accessToken)
      localStorage.setItem('hx_refresh_token', refreshToken || '')
      localStorage.setItem('hx_user', JSON.stringify(user))
    },
    { accessToken, refreshToken, user },
  )

  const page = await context.newPage()
  const issues = []
  const matrix = []

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(700)
      const m = await page.evaluate(measure)
      const row = { width, route, ...m }
      matrix.push(row)
      const bad =
        m.overflowX > 2 ||
        m.mainOverflow > 2 ||
        m.modalOverflow > 2 ||
        (m.clippedPrimary && m.clippedPrimary.length > 0)
      if (bad) issues.push(row)
      const mark = bad ? 'FAIL' : 'PASS'
      console.log(`[${mark}] ${width}px ${route} overflowX=${m.overflowX} main=${m.mainOverflow} clipped=${m.clippedPrimary.length}`)
    }
  }

  await browser.close()
  console.log(`\nViewport matrix: ${matrix.length - issues.length}/${matrix.length} ok`)
  if (issues.length) {
    console.log('ISSUES', JSON.stringify(issues, null, 2))
    process.exit(1)
  }
  console.log('VIEWPORT_OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
