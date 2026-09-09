import { env } from '../../config/env'
import { AppError } from '../../middleware/error.middleware'

export type AmapiEnrollmentTokenResult = {
  name: string
  value: string | null
  expirationTimestamp: string
  qrCode: string | null
  mode: 'dry-run' | 'disabled' | 'live'
  amapiDisabled: boolean
  message: string
}

export type AmapiPolicyUpdateResult = {
  policyName: string
  applied: boolean
  mode: 'dry-run' | 'disabled' | 'live'
  detail?: string
}

/**
 * Official Android Management API adapter.
 * Live calls require ANDROID_MANAGEMENT_ENABLED=true + enterprise + credentials + Google quota.
 * Never invents undocumented endpoints or pretends a real Google token exists when AMAPI is disabled.
 */
export class AndroidManagementService {
  get enabled(): boolean {
    return env.ANDROID_MANAGEMENT_ENABLED === 'true'
  }

  get dryRunGlobal(): boolean {
    return env.EMI_LOCKER_DRY_RUN !== 'false'
  }

  get enterpriseName(): string | null {
    return env.ANDROID_MANAGEMENT_ENTERPRISE_NAME?.trim() || null
  }

  isLiveReady(): boolean {
    if (!this.enabled) return false
    if (this.dryRunGlobal) return false
    return Boolean(
      this.enterpriseName
      && (env.GOOGLE_APPLICATION_CREDENTIALS || env.ANDROID_MANAGEMENT_SERVICE_ACCOUNT_JSON),
    )
  }

  effectiveMode(tenantDryRun?: boolean): 'dry-run' | 'disabled' | 'live' {
    if (!this.enabled) return 'disabled'
    if (tenantDryRun !== false && this.dryRunGlobal) return 'dry-run'
    if (tenantDryRun === true) return 'dry-run'
    if (this.isLiveReady()) return 'live'
    return 'dry-run'
  }

  assertAmapiEnabledForLiveOps() {
    if (!this.enabled) {
      throw new AppError('Android Management integration is currently disabled.', 503)
    }
  }

  async createEnrollmentToken(input: {
    enterpriseName?: string | null
    duration?: string
    policyName?: string
    additionalData?: string
    tenantDryRun?: boolean
  }): Promise<AmapiEnrollmentTokenResult> {
    const mode = this.effectiveMode(input.tenantDryRun)
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    if (mode === 'disabled') {
      return {
        name: 'amapi-disabled',
        value: null,
        expirationTimestamp: expires,
        qrCode: null,
        mode: 'disabled',
        amapiDisabled: true,
        message:
          'Android Management integration is currently disabled. Enrollment record can be created for workflow testing, but no Google enrollment QR/token is issued.',
      }
    }

    if (mode === 'live') {
      throw new AppError(
        'Live AMAPI enrollment client is gated until Google quota/credentials integration is completed.',
        503,
      )
    }

    // Dry-run: Hexalyte-internal enrollment payload only — not a real Google provisioning QR
    const value = `hexalyte-dryrun-${Buffer.from(JSON.stringify({
      code: input.additionalData ?? null,
      t: Date.now(),
    })).toString('base64url')}`

    return {
      name: 'enterprises/dry-run/enrollmentTokens/simulated',
      value,
      expirationTimestamp: expires,
      qrCode: JSON.stringify({
        hexalyte: {
          mode: 'dry-run',
          enrollmentCode: input.additionalData ?? null,
          enrollmentToken: value,
          note: 'DRY RUN — not a Google Android Enterprise QR. AMAPI live enrollment is disabled.',
        },
      }),
      mode: 'dry-run',
      amapiDisabled: false,
      message: 'Dry-run enrollment token generated. No Google AMAPI call was made.',
    }
  }

  async updateDevicePolicy(input: {
    deviceName: string | null | undefined
    policyName: string
    policyJson?: Record<string, unknown>
    tenantDryRun?: boolean
  }): Promise<AmapiPolicyUpdateResult> {
    const mode = this.effectiveMode(input.tenantDryRun)
    if (mode === 'live') {
      throw new AppError('Live AMAPI policy update is gated until Phase 17 integration.', 503)
    }
    if (mode === 'disabled') {
      return {
        policyName: input.policyName,
        applied: false,
        mode: 'disabled',
        detail: 'Android Management integration is currently disabled. Policy change was not sent to Google.',
      }
    }
    return {
      policyName: input.policyName,
      applied: false,
      mode: 'dry-run',
      detail: `DRY RUN — simulated policy apply for ${input.deviceName || 'unlinked-device'}`,
    }
  }

  async getManagedDevice(deviceName: string, tenantDryRun?: boolean) {
    const mode = this.effectiveMode(tenantDryRun)
    if (mode === 'live') {
      throw new AppError('Live AMAPI getDevice is gated until Phase 17 integration.', 503)
    }
    return { name: deviceName, lastStatusReportTime: undefined, mode }
  }

  async releaseDevice(deviceName: string, tenantDryRun?: boolean) {
    const mode = this.effectiveMode(tenantDryRun)
    if (mode === 'live') {
      throw new AppError('Live AMAPI devices.delete is gated until Phase 17 integration.', 503)
    }
    return {
      deleted: false,
      mode,
      detail:
        mode === 'disabled'
          ? 'Android Management integration is currently disabled.'
          : 'DRY RUN — release simulated; device was not unenrolled via Google.',
    }
  }

  async issueSupportedDeviceCommand() {
    throw new AppError(
      'Arbitrary device commands are not exposed. Use policy updates / release via supported AMAPI methods only.',
      400,
    )
  }
}

export const androidManagementService = new AndroidManagementService()
