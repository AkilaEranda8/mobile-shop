import { EmploymentEventType, Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import { ensureHrDefaults } from './hr.util'

const deptSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { employees: true } },
} as const

export const organizationService = {
  async listDepartments(tenantId: string) {
    await ensureHrDefaults(tenantId)
    return prisma.hrDepartment.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: deptSelect,
    })
  },

  async createDepartment(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    if (!name) throw new AppError('Department name is required', 400)
    try {
      const row = await prisma.hrDepartment.create({
        data: {
          tenantId,
          name,
          code: body.code ? String(body.code).trim() : null,
          description: body.description ? String(body.description).trim() : null,
          isActive: body.isActive !== false,
          sortOrder: Number(body.sortOrder) || 0,
        },
        select: deptSelect,
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_DEPARTMENT_CREATED',
        entityType: 'HrDepartment',
        entityId: row.id,
        actorEmail,
        afterJson: { name: row.name },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Department name already exists', 409)
      throw e
    }
  },

  async updateDepartment(tenantId: string, id: string, body: Record<string, unknown>, actorEmail?: string) {
    const existing = await prisma.hrDepartment.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Department not found', 404)
    const data: Prisma.HrDepartmentUpdateInput = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    try {
      const row = await prisma.hrDepartment.update({ where: { id }, data, select: deptSelect })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_DEPARTMENT_UPDATED',
        entityType: 'HrDepartment',
        entityId: id,
        actorEmail,
        beforeJson: { name: existing.name, isActive: existing.isActive },
        afterJson: { name: row.name, isActive: row.isActive },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Department name already exists', 409)
      throw e
    }
  },

  async listDesignations(tenantId: string) {
    await ensureHrDefaults(tenantId)
    return prisma.hrDesignation.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { employees: true } },
      },
    })
  },

  async createDesignation(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    if (!name) throw new AppError('Designation name is required', 400)
    try {
      const row = await prisma.hrDesignation.create({
        data: {
          tenantId,
          name,
          code: body.code ? String(body.code).trim() : null,
          description: body.description ? String(body.description).trim() : null,
          isActive: body.isActive !== false,
          sortOrder: Number(body.sortOrder) || 0,
        },
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_DESIGNATION_CREATED',
        entityType: 'HrDesignation',
        entityId: row.id,
        actorEmail,
        afterJson: { name: row.name },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Designation name already exists', 409)
      throw e
    }
  },

  async updateDesignation(tenantId: string, id: string, body: Record<string, unknown>, actorEmail?: string) {
    const existing = await prisma.hrDesignation.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Designation not found', 404)
    const data: Prisma.HrDesignationUpdateInput = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    try {
      const row = await prisma.hrDesignation.update({ where: { id }, data })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_DESIGNATION_UPDATED',
        entityType: 'HrDesignation',
        entityId: id,
        actorEmail,
        beforeJson: { name: existing.name, isActive: existing.isActive },
        afterJson: { name: row.name, isActive: row.isActive },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Designation name already exists', 409)
      throw e
    }
  },
}

export async function recordEmploymentEvent(opts: {
  tenantId: string
  employeeId: string
  branchId?: string | null
  eventType: EmploymentEventType
  note?: string
  beforeJson?: unknown
  afterJson?: unknown
  actorEmail?: string
}) {
  return prisma.employmentEvent.create({
    data: {
      tenantId: opts.tenantId,
      employeeId: opts.employeeId,
      branchId: opts.branchId ?? undefined,
      eventType: opts.eventType,
      note: opts.note,
      beforeJson: opts.beforeJson as Prisma.InputJsonValue | undefined,
      afterJson: opts.afterJson as Prisma.InputJsonValue | undefined,
      actorEmail: opts.actorEmail,
    },
  })
}
