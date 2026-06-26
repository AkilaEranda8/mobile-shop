import { processExpiredTrials } from '../utils/tenant-access'

const INTERVAL_MS = 60 * 60 * 1000 // hourly

let timer: ReturnType<typeof setInterval> | null = null

export function startTrialExpiryJob(): void {
  processExpiredTrials().catch(err => {
    console.error('[trial-expiry] initial run failed:', err?.message ?? err)
  })

  timer = setInterval(() => {
    processExpiredTrials().catch(err => {
      console.error('[trial-expiry] scheduled run failed:', err?.message ?? err)
    })
  }, INTERVAL_MS)

  if (typeof timer.unref === 'function') timer.unref()
}

export function stopTrialExpiryJob(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
