import { Request } from 'express'

export interface PaginationParams {
  page: number
  limit: number
  skip: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function getPagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
  const skip = (page - 1) * limit
  const search = req.query.search as string | undefined
  const sortBy = req.query.sortBy as string | undefined
  const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc'

  return { page, limit, skip, search, sortBy, sortOrder }
}
