import { z } from 'zod'

const masterBody = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(32).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const createDepartmentSchema = masterBody
export const updateDepartmentSchema = masterBody.partial()
export const createDesignationSchema = masterBody
export const updateDesignationSchema = masterBody.partial()

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  employeeCode: z.string().trim().max(32).optional(),
  userId: z.string().cuid().optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  designationId: z.string().cuid().optional().nullable(),
  primaryBranchId: z.string().cuid(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  emergencyName: z.string().trim().max(120).optional().nullable(),
  emergencyPhone: z.string().trim().max(40).optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL']).optional(),
  status: z.enum(['CANDIDATE', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED']).optional(),
  joinedAt: z.string().optional().nullable(),
  confirmedAt: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ employeeCode: true })

export const linkUserSchema = z.object({
  userId: z.string().cuid().nullable(),
})
