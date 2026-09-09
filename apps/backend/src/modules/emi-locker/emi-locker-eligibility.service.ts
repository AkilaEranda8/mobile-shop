import type { ManagedDevice, HirePurchaseAgreement, HirePurchaseInstallment } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'

export type EligibilityResult = {
  eligible: boolean
  reason: string
  overdueCount: number
  outstanding: number
  agreementStatus: string
  oldestOverdueDueDate?: string
}

type AgreementWithInstallments = HirePurchaseAgreement & {
  installments: HirePurchaseInstallment[]
}

function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Financial eligibility — reads Hire Purchase only. Never invents a second balance.
 */
export class EmiLockerEligibilityService {
  async loadAgreement(tenantId: string, agreementId: string): Promise<AgreementWithInstallments> {
    const agreement = await prisma.hirePurchaseAgreement.findFirst({
      where: { id: agreementId, tenantId },
      include: {
        installments: { orderBy: { sequence: 'asc' } },
      },
    })
    if (!agreement) throw new AppError('Hire purchase agreement not found', 404)
    return agreement
  }

  overdueInstallments(agreement: AgreementWithInstallments, asOf = utcDay()) {
    return agreement.installments.filter((i) => {
      if (i.status === 'OVERDUE') return true
      if (!['PENDING', 'PARTIAL'].includes(i.status)) return false
      return i.dueDate < asOf
    })
  }

  async isDeviceEligibleForRestriction(input: {
    tenantId: string
    device: Pick<ManagedDevice, 'id' | 'deviceStatus' | 'agreementId' | 'enrollmentStatus'>
    gracePeriodDays: number
    restrictionExtraGraceDays?: number
  }): Promise<EligibilityResult> {
    const agreement = await this.loadAgreement(input.tenantId, input.device.agreementId)
    if (!agreement.deviceMgmtEnabled) {
      return {
        eligible: false,
        reason: 'device_management_not_consented',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }
    if (!['ENROLLED', 'ACTIVE'].includes(input.device.enrollmentStatus)) {
      return {
        eligible: false,
        reason: 'device_not_enrolled',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }
    if (input.device.deviceStatus === 'RESTRICTED') {
      return {
        eligible: false,
        reason: 'already_restricted',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }
    if (input.device.deviceStatus === 'RELEASED') {
      return {
        eligible: false,
        reason: 'device_released',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }
    if (['COMPLETED', 'CANCELLED'].includes(agreement.status)) {
      return {
        eligible: false,
        reason: 'agreement_not_active',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }

    const today = utcDay()
    const overdue = this.overdueInstallments(agreement, today)
    if (overdue.length === 0) {
      return {
        eligible: false,
        reason: 'no_overdue_installments',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }

    const oldest = overdue.reduce((a, b) => (a.dueDate < b.dueDate ? a : b))
    const graceEnd = new Date(oldest.dueDate)
    graceEnd.setUTCDate(
      graceEnd.getUTCDate()
        + agreement.gracePeriodDays
        + (input.gracePeriodDays || 0)
        + (input.restrictionExtraGraceDays || 0),
    )
    if (graceEnd >= today) {
      return {
        eligible: false,
        reason: 'still_in_grace_period',
        overdueCount: overdue.length,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
        oldestOverdueDueDate: oldest.dueDate.toISOString().slice(0, 10),
      }
    }

    return {
      eligible: true,
      reason: 'overdue_past_grace',
      overdueCount: overdue.length,
      outstanding: agreement.outstandingBalance,
      agreementStatus: agreement.status,
      oldestOverdueDueDate: oldest.dueDate.toISOString().slice(0, 10),
    }
  }

  async isDeviceEligibleForRestore(input: {
    tenantId: string
    agreementId: string
    restoreWithRemainingOverdue: boolean
    autoRestoreEnabled?: boolean
  }): Promise<EligibilityResult> {
    if (input.autoRestoreEnabled === false) {
      const agreement = await this.loadAgreement(input.tenantId, input.agreementId)
      return {
        eligible: false,
        reason: 'auto_restore_disabled',
        overdueCount: this.overdueInstallments(agreement).length,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }

    const agreement = await this.loadAgreement(input.tenantId, input.agreementId)
    const overdue = this.overdueInstallments(agreement)
    const outstanding = agreement.outstandingBalance

    if (agreement.status === 'COMPLETED' || outstanding <= 0.001) {
      return {
        eligible: true,
        reason: 'agreement_settled',
        overdueCount: overdue.length,
        outstanding,
        agreementStatus: agreement.status,
      }
    }
    if (overdue.length === 0) {
      return {
        eligible: true,
        reason: 'no_overdue',
        overdueCount: 0,
        outstanding,
        agreementStatus: agreement.status,
      }
    }
    if (input.restoreWithRemainingOverdue) {
      return {
        eligible: true,
        reason: 'settings_allow_remaining_overdue',
        overdueCount: overdue.length,
        outstanding,
        agreementStatus: agreement.status,
      }
    }
    return {
      eligible: false,
      reason: 'overdue_installments_remain',
      overdueCount: overdue.length,
      outstanding,
      agreementStatus: agreement.status,
    }
  }

  async isDeviceEligibleForRelease(input: {
    tenantId: string
    agreementId: string
    autoReleaseEnabled?: boolean
  }): Promise<EligibilityResult> {
    if (input.autoReleaseEnabled === false) {
      const agreement = await this.loadAgreement(input.tenantId, input.agreementId)
      return {
        eligible: false,
        reason: 'auto_release_disabled',
        overdueCount: 0,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }

    const agreement = await this.loadAgreement(input.tenantId, input.agreementId)
    const openInstallments = agreement.installments.filter((i) =>
      ['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status),
    )

    if (agreement.status !== 'COMPLETED') {
      return {
        eligible: false,
        reason: 'agreement_not_completed',
        overdueCount: openInstallments.length,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }
    if (agreement.outstandingBalance > 0.001) {
      return {
        eligible: false,
        reason: 'outstanding_balance_remains',
        overdueCount: openInstallments.length,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }
    if (openInstallments.length > 0) {
      return {
        eligible: false,
        reason: 'open_installments_remain',
        overdueCount: openInstallments.length,
        outstanding: agreement.outstandingBalance,
        agreementStatus: agreement.status,
      }
    }

    return {
      eligible: true,
      reason: 'hire_purchase_completed',
      overdueCount: 0,
      outstanding: 0,
      agreementStatus: agreement.status,
    }
  }

  /** Derive soft status from HP without applying restriction. */
  deriveSoftStatus(agreement: AgreementWithInstallments, warningDays: number): 'ACTIVE' | 'PAYMENT_DUE' | 'WARNING' | 'GRACE_PERIOD' | 'OVERDUE' {
    const today = utcDay()
    const overdue = this.overdueInstallments(agreement, today)
    if (overdue.length > 0) {
      const oldest = overdue.reduce((a, b) => (a.dueDate < b.dueDate ? a : b))
      const graceEnd = new Date(oldest.dueDate)
      graceEnd.setUTCDate(graceEnd.getUTCDate() + agreement.gracePeriodDays)
      if (graceEnd >= today) return 'GRACE_PERIOD'
      return 'OVERDUE'
    }

    const upcoming = agreement.installments.filter((i) =>
      ['PENDING', 'PARTIAL'].includes(i.status) && i.dueDate >= today,
    )
    if (upcoming.length === 0) return 'ACTIVE'
    const next = upcoming.reduce((a, b) => (a.dueDate < b.dueDate ? a : b))
    const warnStart = new Date(next.dueDate)
    warnStart.setUTCDate(warnStart.getUTCDate() - Math.max(0, warningDays))
    if (today >= warnStart && today < next.dueDate) return 'WARNING'
    if (next.dueDate.getTime() === today.getTime()) return 'PAYMENT_DUE'
    return 'ACTIVE'
  }
}

export const emiLockerEligibilityService = new EmiLockerEligibilityService()
