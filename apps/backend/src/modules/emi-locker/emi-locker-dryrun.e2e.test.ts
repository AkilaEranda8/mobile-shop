/**
 * Dry-run E2E script (Phase 2).
 * Run: npx tsx src/modules/emi-locker/emi-locker-dryrun.e2e.test.ts
 *
 * Validates AMAPI disabled honesty + dry-run enrollment payload shape without DB.
 */
import { AndroidManagementService } from './android-management.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const svc = new AndroidManagementService()

async function main() {
  // Force disabled path by checking effectiveMode with ANDROID_MANAGEMENT_ENABLED default false
  const disabled = await svc.createEnrollmentToken({
    additionalData: 'ENR-TEST1',
    tenantDryRun: true,
  })
  assert(disabled.mode === 'disabled' || disabled.mode === 'dry-run', 'mode is disabled or dry-run')
  if (disabled.mode === 'disabled') {
    assert(disabled.amapiDisabled === true, 'amapiDisabled true')
    assert(disabled.qrCode === null, 'no fake Google QR when disabled')
    assert(disabled.value === null, 'no AMAPI enrollment value when disabled')
    assert(
      disabled.message.toLowerCase().includes('disabled'),
      'message mentions disabled',
    )
  }

  const dryPolicy = await svc.updateDevicePolicy({
    deviceName: 'devices/test',
    policyName: 'restricted-default',
    tenantDryRun: true,
  })
  assert(dryPolicy.applied === false, 'dry-run/disabled does not claim applied live policy')
  assert(dryPolicy.mode === 'disabled' || dryPolicy.mode === 'dry-run', 'policy mode gated')

  console.log('emi-locker-dryrun.e2e.test.ts: OK', {
    enrollmentMode: disabled.mode,
    policyMode: dryPolicy.mode,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
