import { Response } from 'express'

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): void {
  res.status(statusCode).json({ success: true, data, message })
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: string[],
): void {
  res.status(statusCode).json({ success: false, message, errors })
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  res.status(200).json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}
