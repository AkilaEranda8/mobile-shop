import { env } from '../config/env'
import { prisma } from '../config/database'
import { emiLockerService } from '../modules/emi-locker/emi-locker.service'
import { registerJob, runTracked } from '../utils/job-registry'

let timer: NodeJS.Timeout | null = null
const HOUR = 60 * 60 * 1000
const JOB_ID = 'emi-locker-enforcement'

export async function runEmiLockerEnforcement() {
  if (env.EMI_LOCKER_ENABLED === 'false') {
    console.log('[emi-locker] worker skipped — EMI_LOCKER_ENABLED=false')
    return
  }

  const enabledTenants = await prisma.tenantFeature.findMany({
    where: { feature: 'EMI_LOCKER', enabled: true },
    select: { tenantId: true },
  })

  for (const { tenantId } of enabledTenants) {
    try {
      const result = await emiLockerService.enforceOverdueForTenant(tenantId)
      if (result.restricted || result.pending || result.softUpdated) {
        console.log(
          `[emi-locker] tenant=${tenantId} scanned=${result.scanned} restricted=${result.restricted} pending=${result.pending} soft=${result.softUpdated}`,
        )
      }
    } catch (error) {
      console.warn(
        '[emi-locker] enforcement failed:',
        error instanceof Error ? error.message : error,
      )
    }
  }
}

export function startEmiLockerEnforcementJob() {
  if (timer) return
  registerJob(
    {
      id: JOB_ID,
      name: 'EMI Locker Enforcement',
      schedule: 'Every 1 hour',
      description: 'Scans overdue EMI devices and applies locker policy',
      enabled: env.EMI_LOCKER_ENABLED !== 'false',
    },
    runEmiLockerEnforcement,
  )
  void runTracked(JOB_ID)
  timer = setInterval(() => {
    void runTracked(JOB_ID)
  }, HOUR)
}

export function stopEmiLockerEnforcementJob() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
