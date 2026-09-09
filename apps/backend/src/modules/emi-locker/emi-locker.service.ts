import type { DeviceCommandType, ManagedDeviceStatus, Prisma } from '@prisma/client'
import { env } from '../../config/env'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { recordAuditEvent } from '../audit-engine/audit-engine.service'
import { androidManagementService } from './android-management.service'
import { emiLockerEligibilityService } from './emi-locker-eligibility.service'
import {
  buildIdempotencyKey,
  generateEnrollmentSecrets,
  hashEnrollmentToken,
} from './emi-locker.schema'

type Actor = { userId?: string; email?: string }

const DEFAULT_CONSENT =
  'This device is being provided under an EMI / hire-purchase agreement. Device management and payment-related restrictions may be applied according to the agreed terms after applicable payment and grace periods.'

async function getOrCreateSettings(tenantId: string, branchId: string) {
  return prisma.emiLockerSettings.upsert({
    where: { tenantId_branchId: { tenantId, branchId } },
    create: {
      tenantId,
      branchId,
      consentText: DEFAULT_CONSENT,
      dryRunEnabled: true,
      enabled: true,
    },
    update: {},
  })
}

function isDryRun(settings: { dryRunEnabled: boolean }): boolean {
  if (env.EMI_LOCKER_DRY_RUN !== 'false') return true
  if (env.ANDROID_MANAGEMENT_ENABLED !== 'true') return true
  return settings.dryRunEnabled
}

async function ensureDefaultPolicies(tenantId: string, branchId: string) {
  const kinds = [
    { name: 'active-default', kind: 'ACTIVE' as const },
    { name: 'restricted-default', kind: 'RESTRICTED' as const },
  ]
  for (const row of kinds) {
    await prisma.devicePolicy.upsert({
      where: { tenantId_name: { tenantId, name: row.name } },
      create: {
        tenantId,
        branchId,
        name: row.name,
        kind: row.kind,
        isDefault: true,
        policyJson: {
          kind: row.kind,
          note: row.kind === 'RESTRICTED'
            ? 'EMI payment required — managed restriction policy (non-destructive)'
            : 'Normal operation policy',
        },
      },
      update: {},
    })
  }
}

function onlineStatusFromLastSeen(
  lastSeenAt: Date | null | undefined,
  thresholdHours: number,
): 'ONLINE' | 'OFFLINE' | 'UNKNOWN' {
  if (!lastSeenAt) return 'UNKNOWN'
  const ageMs = Date.now() - lastSeenAt.getTime()
  return ageMs <= thresholdHours * 3600_000 ? 'ONLINE' : 'OFFLINE'
}

export class EmiLockerService {
  async getDashboard(tenantId: string, branchId: string | null) {
    const deviceWhere: Prisma.ManagedDeviceWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
    }
    const agreementWhere: Prisma.HirePurchaseAgreementWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
      status: { in: ['ACTIVE', 'DEFAULTED'] },
    }

    const today = new Date()
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 86_400_000)

    const [
      activeAgreements,
      financeAgg,
      dueToday,
      dueWeek,
      overdueInstallments,
      restrictedDevices,
      activeDevices,
      paymentDueDevices,
      graceDevices,
      releasedDevices,
      devices,
      sampleSettings,
    ] = await Promise.all([
      prisma.hirePurchaseAgreement.count({ where: agreementWhere }),
      prisma.hirePurchaseAgreement.aggregate({
        where: agreementWhere,
        _sum: { financeAmount: true, paidAmount: true, outstandingBalance: true },
      }),
      prisma.hirePurchaseInstallment.count({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          dueDate: startOfDay,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
      }),
      prisma.hirePurchaseInstallment.count({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          dueDate: { gte: startOfDay, lt: endOfWeek },
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
      }),
      prisma.hirePurchaseInstallment.count({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          status: 'OVERDUE',
        },
      }),
      prisma.managedDevice.count({ where: { ...deviceWhere, deviceStatus: 'RESTRICTED' } }),
      prisma.managedDevice.count({ where: { ...deviceWhere, deviceStatus: 'ACTIVE' } }),
      prisma.managedDevice.count({ where: { ...deviceWhere, deviceStatus: 'PAYMENT_DUE' } }),
      prisma.managedDevice.count({ where: { ...deviceWhere, deviceStatus: 'GRACE_PERIOD' } }),
      prisma.managedDevice.count({ where: { ...deviceWhere, deviceStatus: 'RELEASED' } }),
      prisma.managedDevice.findMany({
        where: deviceWhere,
        select: { onlineStatus: true, lastSeenAt: true, branchId: true },
      }),
      branchId
        ? getOrCreateSettings(tenantId, branchId)
        : prisma.emiLockerSettings.findFirst({ where: { tenantId } }),
    ])

    const offlineDevices = devices.filter(d => d.onlineStatus === 'OFFLINE').length
    const financed = financeAgg._sum.financeAmount ?? 0
    const collected = financeAgg._sum.paidAmount ?? 0
    const outstanding = financeAgg._sum.outstandingBalance ?? 0
    const collectionPct = financed > 0 ? Math.round((collected / financed) * 1000) / 10 : 0
    const dryRun = sampleSettings ? isDryRun(sampleSettings) : true

    return {
      activeAgreements,
      financedAmount: financed,
      collectedAmount: collected,
      outstandingAmount: outstanding,
      collectionPercentage: collectionPct,
      dueToday,
      dueThisWeek: dueWeek,
      overdueAccounts: overdueInstallments,
      restrictedDevices,
      activeDevices,
      paymentDueDevices,
      gracePeriodDevices: graceDevices,
      releasedDevices,
      offlineDevices,
      unknownOnlineDevices: devices.filter(d => d.onlineStatus === 'UNKNOWN').length,
      dryRunMode: dryRun,
      androidManagementEnabled: env.ANDROID_MANAGEMENT_ENABLED === 'true',
      androidManagementMode: androidManagementService.effectiveMode(dryRun),
      androidManagementLiveReady: androidManagementService.isLiveReady(),
    }
  }

  async listDevices(
    tenantId: string,
    branchId: string | null,
    opts: {
      status?: string
      enrollmentStatus?: string
      onlineStatus?: string
      brand?: string
      model?: string
      search?: string
      page: number
      limit: number
    },
  ) {
    const where: Prisma.ManagedDeviceWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
      ...(opts.status ? { deviceStatus: opts.status as ManagedDeviceStatus } : {}),
      ...(opts.enrollmentStatus
        ? { enrollmentStatus: opts.enrollmentStatus as Prisma.EnumManagedEnrollmentStatusFilter['equals'] }
        : {}),
      ...(opts.onlineStatus
        ? { onlineStatus: opts.onlineStatus as Prisma.EnumManagedDeviceOnlineStatusFilter['equals'] }
        : {}),
      ...(opts.brand ? { brand: { contains: opts.brand, mode: 'insensitive' } } : {}),
      ...(opts.model ? { model: { contains: opts.model, mode: 'insensitive' } } : {}),
      ...(opts.search
        ? {
            OR: [
              { imei1: { contains: opts.search, mode: 'insensitive' } },
              { imei2: { contains: opts.search, mode: 'insensitive' } },
              { brand: { contains: opts.search, mode: 'insensitive' } },
              { model: { contains: opts.search, mode: 'insensitive' } },
              { serialNumber: { contains: opts.search, mode: 'insensitive' } },
              { id: { contains: opts.search, mode: 'insensitive' } },
              { customer: { name: { contains: opts.search, mode: 'insensitive' } } },
              { agreement: { agreementNumber: { contains: opts.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.managedDevice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true } },
          agreement: {
            select: {
              id: true,
              agreementNumber: true,
              outstandingBalance: true,
              status: true,
              firstDueDate: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.managedDevice.count({ where }),
    ])
    return { rows, total }
  }

  async updateDevice(
    tenantId: string,
    id: string,
    input: {
      imei2?: string | null
      serialNumber?: string | null
      brand?: string | null
      model?: string | null
      androidVersion?: string | null
      activePolicyId?: string | null
    },
    actor: Actor,
    ip?: string,
  ) {
    const existing = await prisma.managedDevice.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Managed device not found', 404)

    if (input.activePolicyId) {
      const policy = await prisma.devicePolicy.findFirst({
        where: { id: input.activePolicyId, tenantId },
      })
      if (!policy) throw new AppError('Policy not found for this tenant', 404)
    }

    const updated = await prisma.managedDevice.update({
      where: { id },
      data: {
        ...(input.imei2 !== undefined ? { imei2: input.imei2 } : {}),
        ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.androidVersion !== undefined ? { androidVersion: input.androidVersion } : {}),
        ...(input.activePolicyId !== undefined ? { activePolicyId: input.activePolicyId } : {}),
      },
    })

    await recordAuditEvent({
      tenantId,
      branchId: existing.branchId,
      actor: { userId: actor.userId, email: actor.email },
      eventType: 'EMI_LOCKER_DEVICE_UPDATED',
      entityType: 'ManagedDevice',
      entityId: id,
      beforeJson: {
        brand: existing.brand,
        model: existing.model,
        serialNumber: existing.serialNumber,
      },
      afterJson: {
        brand: updated.brand,
        model: updated.model,
        serialNumber: updated.serialNumber,
      },
      ip,
    })

    return updated
  }

  async listCommands(
    tenantId: string,
    branchId: string | null,
    opts: {
      commandType?: string
      status?: string
      deviceId?: string
      search?: string
      page: number
      limit: number
    },
  ) {
    const where: Prisma.DeviceCommandWhereInput = {
      tenantId,
      ...(branchId ? { branchId } : {}),
      ...(opts.commandType ? { commandType: opts.commandType as Prisma.EnumDeviceCommandTypeFilter['equals'] } : {}),
      ...(opts.status ? { status: opts.status as Prisma.EnumDeviceCommandStatusFilter['equals'] } : {}),
      ...(opts.deviceId ? { deviceId: opts.deviceId } : {}),
      ...(opts.search
        ? {
            OR: [
              { reason: { contains: opts.search, mode: 'insensitive' } },
              { requestedBy: { contains: opts.search, mode: 'insensitive' } },
              { device: { imei1: { contains: opts.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.deviceCommand.findMany({
        where,
        include: {
          device: {
            select: {
              id: true,
              imei1: true,
              brand: true,
              model: true,
              deviceStatus: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.deviceCommand.count({ where }),
    ])
    return { rows, total }
  }

  async getDevice(tenantId: string, id: string) {
    const device = await prisma.managedDevice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        agreement: {
          include: {
            installments: { orderBy: { sequence: 'asc' } },
          },
        },
        activePolicy: true,
        enrollments: { orderBy: { createdAt: 'desc' }, take: 5 },
        commands: { orderBy: { createdAt: 'desc' }, take: 20 },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!device) throw new AppError('Managed device not found', 404)

    const relatedIds = [
      ...device.enrollments.map((e) => e.id),
      ...device.commands.map((c) => c.id),
    ]

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        OR: [
          { entityType: 'ManagedDevice', entityId: id },
          ...(relatedIds.length
            ? [{ entityId: { in: relatedIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        eventType: true,
        entityType: true,
        entityId: true,
        actorEmail: true,
        createdAt: true,
        afterJson: true,
      },
    })

    return { ...device, auditEvents }
  }

  async registerDevice(
    tenantId: string,
    branchId: string,
    input: {
      agreementId: string
      customerId?: string
      imei1: string
      imei2?: string | null
      serialNumber?: string | null
      brand?: string | null
      model?: string | null
      androidVersion?: string | null
      imeiRecordId?: string | null
      consentVersion?: string
      consented?: boolean
    },
    actor: Actor,
    ip?: string,
  ) {
    const agreement = await prisma.hirePurchaseAgreement.findFirst({
      where: { id: input.agreementId, tenantId },
    })
    if (!agreement) throw new AppError('Hire purchase agreement not found', 404)
    if (agreement.branchId !== branchId) throw new AppError('Agreement belongs to another branch', 400)
    if (!['ACTIVE', 'PENDING', 'DEFAULTED'].includes(agreement.status)) {
      throw new AppError('Agreement is not eligible for device management', 400)
    }

    const customerId = input.customerId || agreement.customerId
    if (customerId !== agreement.customerId) {
      throw new AppError('Customer must match the EMI agreement', 400)
    }

    if (input.consented) {
      await prisma.hirePurchaseAgreement.update({
        where: { id: agreement.id },
        data: {
          deviceMgmtEnabled: true,
          deviceMgmtConsentedAt: new Date(),
          deviceMgmtConsentVersion: input.consentVersion || 'v1',
        },
      })
    } else if (!agreement.deviceMgmtEnabled) {
      throw new AppError('Customer device-management consent is required before registration', 400)
    }

    await ensureDefaultPolicies(tenantId, branchId)
    const settings = await getOrCreateSettings(tenantId, branchId)

    const existing = await prisma.managedDevice.findFirst({
      where: { tenantId, imei1: input.imei1 },
    })
    if (existing) throw new AppError('A managed device with this IMEI already exists', 409)

    const device = await prisma.managedDevice.create({
      data: {
        tenantId,
        branchId,
        customerId,
        agreementId: agreement.id,
        imeiRecordId: input.imeiRecordId || agreement.imeiRecordId,
        imei1: input.imei1,
        imei2: input.imei2 || null,
        serialNumber: input.serialNumber || null,
        brand: input.brand || agreement.brandName,
        model: input.model || agreement.modelName,
        androidVersion: input.androidVersion || null,
        enrollmentStatus: 'CREATED',
        deviceStatus: 'PENDING_ENROLLMENT',
        onlineStatus: 'UNKNOWN',
      },
    })

    await prisma.deviceEvent.create({
      data: {
        tenantId,
        branchId,
        deviceId: device.id,
        eventType: 'DEVICE_REGISTERED',
        source: 'admin',
        payload: { imei1: device.imei1, agreementId: agreement.id },
      },
    })

    await recordAuditEvent({
      tenantId,
      branchId,
      actor: { userId: actor.userId, email: actor.email },
      eventType: 'EMI_LOCKER_DEVICE_REGISTERED',
      entityType: 'ManagedDevice',
      entityId: device.id,
      afterJson: { imei1: device.imei1, agreementId: agreement.id },
      ip,
    })

    return { device, settings }
  }

  async createEnrollment(
    tenantId: string,
    deviceId: string,
    input: { consentVersion?: string; consented: true; ttlMinutes: number },
    actor: Actor,
    ip?: string,
  ) {
    const device = await prisma.managedDevice.findFirst({
      where: { id: deviceId, tenantId },
      include: { agreement: true },
    })
    if (!device) throw new AppError('Managed device not found', 404)
    if (!device.agreement.deviceMgmtEnabled && !input.consented) {
      throw new AppError('Consent required before enrollment', 400)
    }

    const settings = await getOrCreateSettings(tenantId, device.branchId)
    const { enrollmentCode, rawToken, tokenHash } = generateEnrollmentSecrets()
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000)

    const amapi = await androidManagementService.createEnrollmentToken({
      enterpriseName: settings.amapiEnterpriseName || androidManagementService.enterpriseName,
      duration: `${input.ttlMinutes * 60}s`,
      additionalData: enrollmentCode,
      tenantDryRun: isDryRun(settings),
    })

    const qrPayload = {
      enrollmentCode,
      expiresAt: expiresAt.toISOString(),
      // Hexalyte one-time enrollment token — never passwords, JWTs, or Google SA credentials
      enrollmentToken: rawToken,
      amapiEnrollmentValue: amapi.value,
      amapiMode: amapi.mode,
      amapiDisabled: amapi.amapiDisabled,
      amapiMessage: amapi.message,
      provisioningQr: amapi.qrCode,
      dryRun: amapi.mode === 'dry-run' || isDryRun(settings),
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      await tx.deviceEnrollment.updateMany({
        where: {
          deviceId: device.id,
          status: { in: ['CREATED', 'ENROLLMENT_PENDING', 'QR_GENERATED'] },
        },
        data: { status: 'CANCELLED' },
      })

      const row = await tx.deviceEnrollment.create({
        data: {
          tenantId,
          branchId: device.branchId,
          deviceId: device.id,
          agreementId: device.agreementId,
          enrollmentCode,
          tokenHash,
          tokenPreview: rawToken.slice(0, 6) + '…',
          amapiEnrollmentToken: amapi.value,
          qrPayloadJson: qrPayload,
          status: amapi.amapiDisabled ? 'ENROLLMENT_PENDING' : 'QR_GENERATED',
          expiresAt,
          consentVersion: input.consentVersion || settings.consentTextVersion,
          consentedAt: new Date(),
          createdBy: actor.userId || actor.email,
        },
      })

      await tx.managedDevice.update({
        where: { id: device.id },
        data: {
          enrollmentStatus: amapi.amapiDisabled ? 'ENROLLMENT_PENDING' : 'QR_GENERATED',
        },
      })

      if (!device.agreement.deviceMgmtEnabled) {
        await tx.hirePurchaseAgreement.update({
          where: { id: device.agreementId },
          data: {
            deviceMgmtEnabled: true,
            deviceMgmtConsentedAt: new Date(),
            deviceMgmtConsentVersion: input.consentVersion || settings.consentTextVersion,
          },
        })
      }

      await tx.deviceEvent.create({
        data: {
          tenantId,
          branchId: device.branchId,
          deviceId: device.id,
          eventType: 'ENROLLMENT_QR_GENERATED',
          source: 'admin',
          payload: { enrollmentCode, expiresAt: expiresAt.toISOString(), mode: amapi.mode },
        },
      })

      return row
    })

    await recordAuditEvent({
      tenantId,
      branchId: device.branchId,
      actor: { userId: actor.userId, email: actor.email },
      eventType: 'EMI_LOCKER_ENROLLMENT_CREATED',
      entityType: 'DeviceEnrollment',
      entityId: enrollment.id,
      afterJson: { enrollmentCode, expiresAt: expiresAt.toISOString(), mode: amapi.mode },
      ip,
    })

    return {
      enrollment: {
        id: enrollment.id,
        enrollmentCode,
        expiresAt,
        status: enrollment.status,
        amapiMode: amapi.mode,
        amapiDisabled: amapi.amapiDisabled,
        message: amapi.message,
      },
      // Returned once to admin UI — Hexalyte token only; provisioningQr is null when AMAPI disabled
      qr: qrPayload,
      consentText: settings.consentText || DEFAULT_CONSENT,
      dryRun: isDryRun(settings),
      amapiDisabled: amapi.amapiDisabled,
    }
  }

  async consumeEnrollmentToken(tenantId: string, enrollmentCode: string, rawToken: string) {
    const enrollment = await prisma.deviceEnrollment.findFirst({
      where: { tenantId, enrollmentCode },
      include: { device: true },
    })
    if (!enrollment) throw new AppError('Enrollment not found', 404)
    if (enrollment.consumedAt) throw new AppError('Enrollment token already used', 409)
    if (enrollment.expiresAt.getTime() < Date.now()) {
      await prisma.deviceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'EXPIRED' },
      })
      throw new AppError('Enrollment token expired', 410)
    }
    if (hashEnrollmentToken(rawToken) !== enrollment.tokenHash) {
      throw new AppError('Invalid enrollment token', 401)
    }
    if (!enrollment.deviceId || !enrollment.device) {
      throw new AppError('Enrollment is not linked to a device', 400)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.deviceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'ENROLLED',
          consumedAt: new Date(),
          tokenPreview: null,
        },
      })
      const device = await tx.managedDevice.update({
        where: { id: enrollment.deviceId! },
        data: {
          enrollmentStatus: 'ENROLLED',
          deviceStatus: 'ACTIVE',
          enrolledAt: new Date(),
          lastSeenAt: new Date(),
          onlineStatus: 'ONLINE',
        },
      })
      await tx.deviceEvent.create({
        data: {
          tenantId,
          branchId: enrollment.branchId,
          deviceId: enrollment.deviceId!,
          eventType: 'DEVICE_ENROLLED',
          source: 'device',
          payload: { enrollmentCode },
        },
      })
      return { row, device }
    })

    await recordAuditEvent({
      tenantId,
      branchId: enrollment.branchId,
      actor: { email: 'device' },
      eventType: 'EMI_LOCKER_DEVICE_ENROLLED',
      entityType: 'ManagedDevice',
      entityId: enrollment.deviceId,
      afterJson: { enrollmentCode },
    })

    return updated
  }

  private async queueCommand(input: {
    tenantId: string
    branchId: string
    deviceId: string
    commandType: DeviceCommandType
    reason?: string
    idempotencyKey: string
    requestedBy?: string
    autoApprove: boolean
  }) {
    const existing = await prisma.deviceCommand.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    })
    if (existing) return { command: existing, created: false }

    const command = await prisma.deviceCommand.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        deviceId: input.deviceId,
        commandType: input.commandType,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        requestedBy: input.requestedBy,
        status: input.autoApprove ? 'APPROVED' : 'PENDING',
        approvedAt: input.autoApprove ? new Date() : null,
        approvedBy: input.autoApprove ? (input.requestedBy || 'system') : null,
      },
    })
    return { command, created: true }
  }

  async executeCommand(tenantId: string, commandId: string) {
    const command = await prisma.deviceCommand.findFirst({
      where: { id: commandId, tenantId },
      include: { device: { include: { activePolicy: true } } },
    })
    if (!command) throw new AppError('Command not found', 404)
    if (['EXECUTED', 'DRY_RUN', 'FAILED', 'CANCELLED', 'SUPERSEDED'].includes(command.status)) {
      return { command, device: command.device }
    }

    const settings = await getOrCreateSettings(tenantId, command.branchId)
    if (command.status === 'PENDING' && settings.manualApprovalRequired) {
      return { command, device: command.device }
    }

    const dryRun = isDryRun(settings)
    const policyKind =
      command.commandType === 'APPLY_RESTRICTION'
        ? 'RESTRICTED'
        : command.commandType === 'RELEASE_DEVICE'
          ? 'RELEASED'
          : 'ACTIVE'

    const policy = await prisma.devicePolicy.findFirst({
      where: { tenantId, kind: policyKind, isActive: true },
      orderBy: { isDefault: 'desc' },
    })

    await prisma.deviceCommand.update({
      where: { id: command.id },
      data: { status: 'SENT', sentAt: new Date(), approvedAt: command.approvedAt ?? new Date() },
    })

    try {
      if (command.commandType === 'RELEASE_DEVICE') {
        await androidManagementService.releaseDevice(
          command.device.androidDeviceName || `dry-run/devices/${command.deviceId}`,
          dryRun,
        )
      } else if (
        command.commandType === 'APPLY_RESTRICTION'
        || command.commandType === 'REMOVE_RESTRICTION'
        || command.commandType === 'SYNC_POLICY'
      ) {
        await androidManagementService.updateDevicePolicy({
          deviceName: command.device.androidDeviceName,
          policyName: policy?.amapiPolicyName || policy?.name || policyKind.toLowerCase(),
          policyJson: (policy?.policyJson as Record<string, unknown> | null) ?? undefined,
          tenantDryRun: dryRun,
        })
      } else if (command.commandType === 'REFRESH_STATUS') {
        if (command.device.androidDeviceName) {
          await androidManagementService.getManagedDevice(command.device.androidDeviceName, dryRun)
        }
      }

      // Dry-run: record intended outcome without claiming live AMAPI success as production apply
      if (dryRun) {
        const dryCommand = await prisma.deviceCommand.update({
          where: { id: command.id },
          data: {
            status: 'DRY_RUN',
            executedAt: new Date(),
            acknowledgedAt: new Date(),
            failureReason: null,
          },
        })
        const nextStatus: ManagedDeviceStatus =
          command.commandType === 'APPLY_RESTRICTION'
            ? 'RESTRICTED'
            : command.commandType === 'RELEASE_DEVICE'
              ? 'RELEASED'
              : command.commandType === 'REMOVE_RESTRICTION'
                ? 'ACTIVE'
                : command.device.deviceStatus

        const device = await prisma.managedDevice.update({
          where: { id: command.deviceId },
          data: {
            deviceStatus: nextStatus,
            pendingRestriction: false,
            activePolicyId: policy?.id,
            restrictedAt:
              command.commandType === 'APPLY_RESTRICTION' ? new Date() : command.device.restrictedAt,
            restoredAt:
              command.commandType === 'REMOVE_RESTRICTION' ? new Date() : command.device.restoredAt,
            releasedAt:
              command.commandType === 'RELEASE_DEVICE' ? new Date() : command.device.releasedAt,
            policyStatus: `${policyKind}:DRY_RUN`,
            managementStatus: 'DRY_RUN',
          },
        })

        await prisma.deviceEvent.create({
          data: {
            tenantId,
            branchId: command.branchId,
            deviceId: command.deviceId,
            eventType: `COMMAND_${command.commandType}_DRY_RUN`,
            source: 'system',
            payload: { commandId: command.id, policyKind, dryRun: true },
          },
        })

        return { command: dryCommand, device, dryRun: true }
      }

      const nextStatus: ManagedDeviceStatus =
        command.commandType === 'APPLY_RESTRICTION'
          ? 'RESTRICTED'
          : command.commandType === 'RELEASE_DEVICE'
            ? 'RELEASED'
            : 'ACTIVE'

      const device = await prisma.managedDevice.update({
        where: { id: command.deviceId },
        data: {
          deviceStatus: nextStatus,
          pendingRestriction: false,
          activePolicyId: policy?.id,
          restrictedAt:
            command.commandType === 'APPLY_RESTRICTION' ? new Date() : command.device.restrictedAt,
          restoredAt:
            command.commandType === 'REMOVE_RESTRICTION' ? new Date() : command.device.restoredAt,
          releasedAt:
            command.commandType === 'RELEASE_DEVICE' ? new Date() : command.device.releasedAt,
          policyStatus: policyKind,
          managementStatus: 'LIVE',
        },
      })

      const executed = await prisma.deviceCommand.update({
        where: { id: command.id },
        data: { status: 'EXECUTED', executedAt: new Date(), acknowledgedAt: new Date() },
      })

      await prisma.deviceEvent.create({
        data: {
          tenantId,
          branchId: command.branchId,
          deviceId: command.deviceId,
          eventType: `COMMAND_${command.commandType}_EXECUTED`,
          source: 'system',
          payload: { commandId: command.id, policyKind },
        },
      })

      return { command: executed, device, dryRun: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command failed'
      await prisma.deviceCommand.update({
        where: { id: command.id },
        data: { status: 'FAILED', failureReason: message },
      })
      if (command.commandType === 'RELEASE_DEVICE') {
        await prisma.managedDevice.update({
          where: { id: command.deviceId },
          data: { deviceStatus: 'RELEASE_FAILED', managementStatus: 'ERROR' },
        })
      } else {
        await prisma.managedDevice.update({
          where: { id: command.deviceId },
          data: { deviceStatus: 'MANAGEMENT_ERROR', managementStatus: 'ERROR' },
        })
      }
      throw new AppError(message, 502)
    }
  }

  async requestRestrict(
    tenantId: string,
    deviceId: string,
    opts: { reason?: string; idempotencyKey?: string; actor: Actor; ip?: string; force?: boolean },
  ) {
    const device = await this.getDevice(tenantId, deviceId)
    const settings = await getOrCreateSettings(tenantId, device.branchId)

    if (device.deviceStatus === 'RELEASED') {
      throw new AppError('Released devices cannot be restricted', 400)
    }
    if (device.deviceStatus === 'RESTRICTED') {
      throw new AppError('Device is already restricted', 409)
    }

    if (!opts.force) {
      const eligibility = await emiLockerEligibilityService.isDeviceEligibleForRestriction({
        tenantId,
        device,
        gracePeriodDays: settings.gracePeriodDays,
        restrictionExtraGraceDays: settings.restrictionExtraGraceDays,
      })
      if (!eligibility.eligible) {
        throw new AppError(
          `Device is not eligible for restriction (${eligibility.reason})`,
          400,
        )
      }
    }

    const key =
      opts.idempotencyKey
      || buildIdempotencyKey(['restrict', deviceId, device.agreementId, String(device.deviceStatus)])

    if (!settings.automaticRestriction && !opts.force) {
      const updated = await prisma.managedDevice.update({
        where: { id: deviceId },
        data: { pendingRestriction: true, deviceStatus: 'OVERDUE' },
      })
      await recordAuditEvent({
        tenantId,
        branchId: device.branchId,
        actor: { userId: opts.actor.userId, email: opts.actor.email },
        eventType: 'EMI_LOCKER_RESTRICTION_PENDING_APPROVAL',
        entityType: 'ManagedDevice',
        entityId: deviceId,
        afterJson: { reason: opts.reason },
        ip: opts.ip,
      })
      return { device: updated, pendingApproval: true }
    }

    const { command } = await this.queueCommand({
      tenantId,
      branchId: device.branchId,
      deviceId,
      commandType: 'APPLY_RESTRICTION',
      reason: opts.reason || 'EMI overdue after grace period',
      idempotencyKey: key,
      requestedBy: opts.actor.userId || opts.actor.email,
      autoApprove: !settings.manualApprovalRequired || Boolean(opts.force),
    })

    const result = await this.executeCommand(tenantId, command.id)
    await recordAuditEvent({
      tenantId,
      branchId: device.branchId,
      actor: { userId: opts.actor.userId, email: opts.actor.email },
      eventType: 'EMI_LOCKER_RESTRICTION_REQUESTED',
      entityType: 'DeviceCommand',
      entityId: command.id,
      afterJson: { deviceId, reason: opts.reason },
      ip: opts.ip,
    })
    return result
  }

  async isRestoreEligible(tenantId: string, deviceId: string) {
    const device = await prisma.managedDevice.findFirst({
      where: { id: deviceId, tenantId },
    })
    if (!device) throw new AppError('Managed device not found', 404)
    const settings = await getOrCreateSettings(tenantId, device.branchId)
    return emiLockerEligibilityService.isDeviceEligibleForRestore({
      tenantId,
      agreementId: device.agreementId,
      restoreWithRemainingOverdue: settings.restoreWithRemainingOverdue,
      autoRestoreEnabled: settings.autoRestoreEnabled,
    })
  }

  async requestRelease(
    tenantId: string,
    deviceId: string,
    opts: { reason?: string; idempotencyKey?: string; actor: Actor; ip?: string; force?: boolean },
  ) {
    const device = await this.getDevice(tenantId, deviceId)
    const settings = await getOrCreateSettings(tenantId, device.branchId)
    const eligibility = await emiLockerEligibilityService.isDeviceEligibleForRelease({
      tenantId,
      agreementId: device.agreementId,
      autoReleaseEnabled: opts.force ? true : settings.autoReleaseEnabled,
    })
    if (!eligibility.eligible) {
      throw new AppError(
        `Device is not eligible for release (${eligibility.reason}; agreement=${eligibility.agreementStatus})`,
        400,
      )
    }

    const key =
      opts.idempotencyKey
      || buildIdempotencyKey(['release', deviceId, device.agreementId, eligibility.agreementStatus])

    const { command } = await this.queueCommand({
      tenantId,
      branchId: device.branchId,
      deviceId,
      commandType: 'RELEASE_DEVICE',
      reason: opts.reason || 'Hire purchase completed — supported device release',
      idempotencyKey: key,
      requestedBy: opts.actor.userId || opts.actor.email,
      autoApprove: true,
    })
    const result = await this.executeCommand(tenantId, command.id)
    await recordAuditEvent({
      tenantId,
      branchId: device.branchId,
      actor: { userId: opts.actor.userId, email: opts.actor.email },
      eventType: 'EMI_LOCKER_RELEASE_COMPLETED',
      entityType: 'ManagedDevice',
      entityId: deviceId,
      afterJson: eligibility as unknown as Prisma.InputJsonValue,
      ip: opts.ip,
    })
    return result
  }

  async requestRestore(
    tenantId: string,
    deviceId: string,
    opts: { reason?: string; idempotencyKey?: string; actor: Actor; ip?: string },
  ) {
    const eligibility = await this.isRestoreEligible(tenantId, deviceId)
    if (!eligibility.eligible) {
      throw new AppError(
        `Device is not eligible for restore (${eligibility.reason}; overdue=${eligibility.overdueCount})`,
        400,
      )
    }
    const device = await this.getDevice(tenantId, deviceId)
    const key =
      opts.idempotencyKey
      || buildIdempotencyKey(['restore', deviceId, String(eligibility.overdueCount), String(eligibility.outstanding)])

    const { command } = await this.queueCommand({
      tenantId,
      branchId: device.branchId,
      deviceId,
      commandType: 'REMOVE_RESTRICTION',
      reason: opts.reason || 'Payment verified / overdue cleared',
      idempotencyKey: key,
      requestedBy: opts.actor.userId || opts.actor.email,
      autoApprove: true,
    })
    const result = await this.executeCommand(tenantId, command.id)
    await recordAuditEvent({
      tenantId,
      branchId: device.branchId,
      actor: { userId: opts.actor.userId, email: opts.actor.email },
      eventType: 'EMI_LOCKER_DEVICE_RESTORED',
      entityType: 'ManagedDevice',
      entityId: deviceId,
      afterJson: eligibility,
      ip: opts.ip,
    })
    return result
  }

  async syncDevice(tenantId: string, deviceId: string, actor: Actor) {
    const device = await this.getDevice(tenantId, deviceId)
    const settings = await getOrCreateSettings(tenantId, device.branchId)
    const key = buildIdempotencyKey(['sync', deviceId, String(Date.now()).slice(0, -5)])
    const { command } = await this.queueCommand({
      tenantId,
      branchId: device.branchId,
      deviceId,
      commandType: 'REFRESH_STATUS',
      reason: 'Manual sync',
      idempotencyKey: key,
      requestedBy: actor.userId || actor.email,
      autoApprove: true,
    })
    await this.executeCommand(tenantId, command.id)
    const onlineStatus = onlineStatusFromLastSeen(device.lastSeenAt, settings.offlineThresholdHours)
    return prisma.managedDevice.update({
      where: { id: deviceId },
      data: { onlineStatus },
    })
  }

  async getSettings(tenantId: string, branchId: string) {
    await ensureDefaultPolicies(tenantId, branchId)
    return getOrCreateSettings(tenantId, branchId)
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Prisma.EmiLockerSettingsUpdateInput,
    actor: Actor,
    ip?: string,
  ) {
    const before = await getOrCreateSettings(tenantId, branchId)
    const updated = await prisma.emiLockerSettings.update({
      where: { id: before.id },
      data,
    })
    await recordAuditEvent({
      tenantId,
      branchId,
      actor: { userId: actor.userId, email: actor.email },
      eventType: 'EMI_LOCKER_SETTINGS_UPDATED',
      entityType: 'EmiLockerSettings',
      entityId: updated.id,
      beforeJson: before as unknown as Prisma.InputJsonValue,
      afterJson: updated as unknown as Prisma.InputJsonValue,
      ip,
    })
    return updated
  }

  /**
   * After a verified HP payment — attempt restore on linked managed devices.
   * Never throws to callers (payment path must stay successful).
   */
  async tryRestoreAfterVerifiedPayment(tenantId: string, agreementId: string, actor: Actor) {
    try {
      const devices = await prisma.managedDevice.findMany({
        where: {
          tenantId,
          agreementId,
          deviceStatus: { in: ['RESTRICTED', 'OVERDUE', 'WARNING', 'GRACE_PERIOD', 'SUSPENDED'] },
        },
        select: { id: true },
      })
      const results = []
      for (const d of devices) {
        const eligibility = await this.isRestoreEligible(tenantId, d.id)
        if (!eligibility.eligible) {
          results.push({ deviceId: d.id, restored: false, ...eligibility })
          continue
        }
        await this.requestRestore(tenantId, d.id, {
          reason: 'Hire purchase payment verified',
          actor,
          idempotencyKey: buildIdempotencyKey([
            'pay-restore',
            d.id,
            agreementId,
            String(eligibility.outstanding),
            String(eligibility.overdueCount),
          ]),
        })
        results.push({ deviceId: d.id, restored: true, ...eligibility })
      }
      return results
    } catch (error) {
      console.warn(
        '[emi-locker] restore-after-payment failed:',
        error instanceof Error ? error.message : error,
      )
      return []
    }
  }

  /**
   * Called by enforcement worker after HP grace — never wipe/brick.
   * Soft-status updates + restriction (or DRY_RUN) via eligibility service.
   */
  async enforceOverdueForTenant(tenantId: string) {
    if (env.EMI_LOCKER_ENABLED === 'false') {
      return { scanned: 0, restricted: 0, pending: 0, softUpdated: 0 }
    }

    const settingsRows = await prisma.emiLockerSettings.findMany({ where: { tenantId } })
    const settingsByBranch = new Map(settingsRows.map(s => [s.branchId, s]))

    const devices = await prisma.managedDevice.findMany({
      where: {
        tenantId,
        deviceStatus: {
          in: ['ACTIVE', 'ENROLLED', 'WARNING', 'PAYMENT_DUE', 'GRACE_PERIOD', 'OVERDUE'],
        },
        enrollmentStatus: { in: ['ENROLLED', 'ACTIVE'] },
      },
    })

    let restricted = 0
    let pending = 0
    let softUpdated = 0

    for (const device of devices) {
      const settings = settingsByBranch.get(device.branchId) || await getOrCreateSettings(tenantId, device.branchId)
      if (settings.enabled === false) continue

      const agreement = await emiLockerEligibilityService.loadAgreement(tenantId, device.agreementId)
      if (!agreement.deviceMgmtEnabled) continue

      const soft = emiLockerEligibilityService.deriveSoftStatus(agreement, settings.warningDays)
      if (
        soft !== device.deviceStatus
        && !['RESTRICTED', 'RELEASED'].includes(device.deviceStatus)
      ) {
        await prisma.managedDevice.update({
          where: { id: device.id },
          data: { deviceStatus: soft },
        })
        softUpdated += 1
      }

      const eligibility = await emiLockerEligibilityService.isDeviceEligibleForRestriction({
        tenantId,
        device,
        gracePeriodDays: settings.gracePeriodDays,
        restrictionExtraGraceDays: settings.restrictionExtraGraceDays,
      })
      if (!eligibility.eligible) continue

      const result = await this.requestRestrict(tenantId, device.id, {
        reason: `Automatic enforcement after grace (${eligibility.oldestOverdueDueDate || 'overdue'})`,
        actor: { email: 'system' },
        idempotencyKey: buildIdempotencyKey([
          'auto-restrict',
          device.id,
          eligibility.oldestOverdueDueDate || 'x',
          String(eligibility.overdueCount),
        ]),
      })
      if ('pendingApproval' in result && result.pendingApproval) pending += 1
      else restricted += 1
    }

    // Auto-release completed HP devices
    const completedLinked = await prisma.managedDevice.findMany({
      where: {
        tenantId,
        deviceStatus: { notIn: ['RELEASED', 'PENDING_ENROLLMENT'] },
        agreement: { status: 'COMPLETED' },
      },
      select: { id: true, branchId: true },
    })
    for (const d of completedLinked) {
      const settings = settingsByBranch.get(d.branchId) || await getOrCreateSettings(tenantId, d.branchId)
      if (!settings.autoReleaseEnabled) continue
      try {
        await this.requestRelease(tenantId, d.id, {
          actor: { email: 'system' },
          reason: 'Automatic release — hire purchase completed',
        })
      } catch {
        // eligibility may still fail; leave for manual
      }
    }

    return { scanned: devices.length, restricted, pending, softUpdated }
  }
}

export const emiLockerService = new EmiLockerService()
