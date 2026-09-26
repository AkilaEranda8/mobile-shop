import { processExpiredTrials } from '../utils/tenant-access'
import { registerJob, runTracked } from '../utils/job-registry'

const INTERVAL_MS = 60 * 60 * 1000 // hourly
const JOB_ID = 'trial-expiry'

let timer: ReturnType<typeof setInterval> | null = null

async function execute(): Promise<void> {
  await processExpiredTrials()
}

export function startTrialExpiryJob(): void {
  registerJob(
    {
      id: JOB_ID,
      name: 'Trial Expiry Checker',
      schedule: 'Every 1 hour',
      description: 'Marks expired trial tenants and enforces access rules',
    },
    execute,
  )

  void runTracked(JOB_ID).then((r) => {
    if (!r.ok) console.error('[trial-expiry] initial run failed:', r.error)
  })

  timer = setInterval(() => {
    void runTracked(JOB_ID).then((r) => {
      if (!r.ok) console.error('[trial-expiry] scheduled run failed:', r.error)
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
