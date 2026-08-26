import { EmploymentEventType, EmploymentStatus, Prisma } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import {
  planEmploymentCreateEvents,
  planEmploymentUpdateEvents,
  planUserLinkEvents,
} from '../hr-engine/hr-engine.service'
import type { EmploymentStatus as EngineStatus } from '../hr-engine/hr-engine.types'
import {
  assertBranchAccess,
  branchFilterForEmployees,
  ensureHrDefaults,
  nextEmployeeCode,
  resolveAllowedBranchIds,
} from './hr.util'
import { recordEmploymentEvent } from './organization.service'

const employeeInclude = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  primaryBranch: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
} as const

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new AppError('Invalid date', 400)
  return d
}

function sanitizeEmployee(row: any) {
  if (!row) return row
  const { user, events, ...rest } = row
  const safeEvents = Array.isArray(events)
    ? events.map((ev: any) => {
        if (ev?.eventType !== 'SALARY_CHANGED') return ev
        const strip = (j: unknown) => {
          if (!j || typeof j !== 'object') return j
          const { basicSalary: _b, ...restJson } = j as Record<string, unknown>
          return restJson
        }
        return { ...ev, beforeJson: strip(ev.beforeJson), afterJson: strip(ev.afterJson) }
      })
    : events
  return { ...rest, ...(events !== undefined ? { events: safeEvents } : {}), user: user ?? null }
}

export const employeesService = {
  async overview(tenantId: string, req: Request) {
    await ensureHrDefaults(tenantId)
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)
    const base = { tenantId, ...branchWhere }
    const [total, active, candidate, onLeave, departments, designations, byBranch] = await Promise.all([
      prisma.employee.count({ where: base }),
      prisma.employee.count({ where: { ...base, status: 'ACTIVE' } }),
      prisma.employee.count({ where: { ...base, status: 'CANDIDATE' } }),
      prisma.employee.count({ where: { ...base, status: 'ON_LEAVE' } }),
      prisma.hrDepartment.count({ where: { tenantId, isActive: true } }),
      prisma.hrDesignation.count({ where: { tenantId, isActive: true } }),
      prisma.employee.groupBy({
        by: ['primaryBranchId'],
        where: base,
        _count: { _all: true },
      }),
    ])
    const branchIds = byBranch.map(b => b.primaryBranchId)
    const branches = branchIds.length
      ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
      : []
    const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]))
    return {
      total,
      active,
      candidate,
      onLeave,
      departments,
      designations,
      byBranch: byBranch.map(b => ({
        branchId: b.primaryBranchId,
        branchName: branchMap[b.primaryBranchId] ?? 'Branch',
        count: b._count._all,
      })),
    }
  },

  async list(tenantId: string, req: Request) {
    await ensureHrDefaults(tenantId)
    const { skip, limit, page, search } = getPagination(req)
    const allowed = await resolveAllowedBranchIds(req)
    const status = req.query.status as EmploymentStatus | undefined
    const departmentId = req.query.departmentId as string | undefined
    const and: Prisma.EmployeeWhereInput[] = [{ tenantId, ...branchFilterForEmployees(req, allowed) }]
    if (status) and.push({ status })
    if (departmentId) and.push({ departmentId })
    if (search) {
      and.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    const where = { AND: and }
    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        include: employeeInclude,
      }),
      prisma.employee.count({ where }),
    ])
    return { data: data.map(sanitizeEmployee), total, page, limit }
  },

  async getById(tenantId: string, id: string, req: Request) {
    const row = await prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        ...employeeInclude,
        events: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    if (!row) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, row.primaryBranchId)
    return sanitizeEmployee(row)
  },

  async create(tenantId: string, body: Record<string, unknown>, req: Request, actorEmail?: string) {
    await ensureHrDefaults(tenantId)
    const primaryBranchId = String(body.primaryBranchId ?? '')
    if (!primaryBranchId) throw new AppError('Primary branch is required', 400)
    await assertBranchAccess(req, primaryBranchId)
    const branch = await prisma.branch.findFirst({ where: { id: primaryBranchId, tenantId, isActive: true } })
    if (!branch) throw new AppError('Invalid branch', 400)

    let userId = body.userId ? String(body.userId) : null
    if (userId) {
      const user = await prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true } })
      if (!user) throw new AppError('Linked user not found', 400)
      const taken = await prisma.employee.findFirst({ where: { userId } })
      if (taken) throw new AppError('User is already linked to another employee', 409)
    }

    const departmentId = body.departmentId ? String(body.departmentId) : null
    const designationId = body.designationId ? String(body.designationId) : null
    if (departmentId) {
      const dept = await prisma.hrDepartment.findFirst({ where: { id: departmentId, tenantId }, select: { id: true } })
      if (!dept) throw new AppError('Invalid department', 400)
    }
    if (designationId) {
      const des = await prisma.hrDesignation.findFirst({ where: { id: designationId, tenantId }, select: { id: true } })
      if (!des) throw new AppError('Invalid designation', 400)
    }

    const employeeCode = body.employeeCode
      ? String(body.employeeCode).trim()
      : await nextEmployeeCode(tenantId)

    const email = body.email ? String(body.email).trim().toLowerCase() : null
    const joinedAt = parseDate(body.joinedAt) ?? new Date()

    try {
      const row = await prisma.employee.create({
        data: {
          tenantId,
          employeeCode,
          userId,
          departmentId,
          designationId,
          primaryBranchId,
          fullName: String(body.fullName).trim(),
          email: email || null,
          phone: body.phone ? String(body.phone).trim() : null,
          emergencyName: body.emergencyName ? String(body.emergencyName).trim() : null,
          emergencyPhone: body.emergencyPhone ? String(body.emergencyPhone).trim() : null,
          employmentType: (body.employmentType as any) ?? 'FULL_TIME',
          status: (body.status as any) ?? 'ACTIVE',
          joinedAt,
          confirmedAt: parseDate(body.confirmedAt),
          notes: body.notes ? String(body.notes).trim() : null,
        },
        include: employeeInclude,
      })

      const createEvents = planEmploymentCreateEvents({
        employeeCode,
        fullName: row.fullName,
        status: row.status as EngineStatus,
        userId,
      })
      for (const ev of createEvents) {
        await recordEmploymentEvent({
          tenantId,
          employeeId: row.id,
          branchId: primaryBranchId,
          eventType: ev.eventType as EmploymentEventType,
          note: ev.note,
          afterJson: ev.afterJson,
          actorEmail,
        })
      }
      void recordAuditEventSafe({
        tenantId,
        branchId: primaryBranchId,
        eventType: 'HR_EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: row.id,
        actorEmail,
        afterJson: { employeeCode, fullName: row.fullName, status: row.status },
      })
      return sanitizeEmployee(row)
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Employee code already exists', 409)
      throw e
    }
  },

  async update(tenantId: string, id: string, body: Record<string, unknown>, req: Request, actorEmail?: string) {
    const existing = await prisma.employee.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, existing.primaryBranchId)

    const data: Prisma.EmployeeUpdateInput = {}
    if (body.fullName != null) data.fullName = String(body.fullName).trim()
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim().toLowerCase() : null
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null
    if (body.emergencyName !== undefined) data.emergencyName = body.emergencyName ? String(body.emergencyName).trim() : null
    if (body.emergencyPhone !== undefined) data.emergencyPhone = body.emergencyPhone ? String(body.emergencyPhone).trim() : null
    if (body.employmentType != null) data.employmentType = body.employmentType as any
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null
    if (body.confirmedAt !== undefined) data.confirmedAt = parseDate(body.confirmedAt)
    if (body.joinedAt !== undefined) data.joinedAt = parseDate(body.joinedAt)
    if (body.departmentId !== undefined) {
      if (body.departmentId) {
        const dept = await prisma.hrDepartment.findFirst({
          where: { id: String(body.departmentId), tenantId },
          select: { id: true },
        })
        if (!dept) throw new AppError('Invalid department', 400)
        data.department = { connect: { id: dept.id } }
      } else {
        data.department = { disconnect: true }
      }
    }
    if (body.designationId !== undefined) {
      if (body.designationId) {
        const des = await prisma.hrDesignation.findFirst({
          where: { id: String(body.designationId), tenantId },
          select: { id: true },
        })
        if (!des) throw new AppError('Invalid designation', 400)
        data.designation = { connect: { id: des.id } }
      } else {
        data.designation = { disconnect: true }
      }
    }

    if (body.primaryBranchId && String(body.primaryBranchId) !== existing.primaryBranchId) {
      const newBranchId = String(body.primaryBranchId)
      await assertBranchAccess(req, newBranchId)
      const branch = await prisma.branch.findFirst({ where: { id: newBranchId, tenantId, isActive: true } })
      if (!branch) throw new AppError('Invalid branch', 400)
      data.primaryBranch = { connect: { id: newBranchId } }
    }

    const changePlan = planEmploymentUpdateEvents({
      before: {
        status: existing.status as EngineStatus,
        primaryBranchId: existing.primaryBranchId,
        departmentId: existing.departmentId,
        designationId: existing.designationId,
        userId: existing.userId,
        isActive: existing.isActive,
        leftAt: existing.leftAt,
        confirmedAt: existing.confirmedAt,
      },
      nextStatus: body.status != null ? (body.status as EngineStatus) : undefined,
      nextBranchId: body.primaryBranchId ? String(body.primaryBranchId) : undefined,
    })

    if (changePlan.statusPlan) {
      data.status = changePlan.statusPlan.status as EmploymentStatus
      if (changePlan.fieldPatches.leftAt !== undefined) data.leftAt = changePlan.fieldPatches.leftAt
      if (changePlan.fieldPatches.isActive !== undefined) data.isActive = changePlan.fieldPatches.isActive
    }

    const row = await prisma.employee.update({
      where: { id },
      data,
      include: employeeInclude,
    })

    for (const ev of changePlan.events) {
      if (ev.eventType === 'BRANCH_CHANGED') {
        await recordEmploymentEvent({
          tenantId,
          employeeId: id,
          branchId: String(body.primaryBranchId),
          eventType: 'BRANCH_CHANGED',
          beforeJson: ev.beforeJson,
          afterJson: ev.afterJson,
          actorEmail,
        })
        continue
      }
      await recordEmploymentEvent({
        tenantId,
        employeeId: id,
        branchId: row.primaryBranchId,
        eventType: ev.eventType as EmploymentEventType,
        beforeJson: ev.beforeJson,
        afterJson: ev.afterJson,
        actorEmail,
      })
    }
    void recordAuditEventSafe({
      tenantId,
      branchId: row.primaryBranchId,
      eventType: 'HR_EMPLOYEE_UPDATED',
      entityType: 'Employee',
      entityId: id,
      actorEmail,
      beforeJson: { status: existing.status, primaryBranchId: existing.primaryBranchId },
      afterJson: {
        status: row.status,
        primaryBranchId: row.primaryBranchId,
        hrEngineVersion: changePlan.engineVersion,
      },
    })
    return sanitizeEmployee(row)
  },

  async linkUser(tenantId: string, id: string, userId: string | null, req: Request, actorEmail?: string) {
    const existing = await prisma.employee.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, existing.primaryBranchId)

    if (userId) {
      const user = await prisma.user.findFirst({ where: { id: userId, tenantId, isActive: true } })
      if (!user) throw new AppError('User not found', 400)
      const taken = await prisma.employee.findFirst({ where: { userId, NOT: { id } } })
      if (taken) throw new AppError('User is already linked to another employee', 409)
    }

    const row = await prisma.employee.update({
      where: { id },
      data: { userId },
      include: employeeInclude,
    })
    const linkEvents = planUserLinkEvents({
      previousUserId: existing.userId,
      nextUserId: userId,
    })
    for (const ev of linkEvents) {
      await recordEmploymentEvent({
        tenantId,
        employeeId: id,
        branchId: row.primaryBranchId,
        eventType: ev.eventType as EmploymentEventType,
        beforeJson: ev.beforeJson,
        afterJson: ev.afterJson,
        actorEmail,
      })
    }
    void recordAuditEventSafe({
      tenantId,
      branchId: row.primaryBranchId,
      eventType: userId ? 'HR_EMPLOYEE_USER_LINKED' : 'HR_EMPLOYEE_USER_UNLINKED',
      entityType: 'Employee',
      entityId: id,
      actorEmail,
      afterJson: { userId },
    })
    return sanitizeEmployee(row)
  },
}
