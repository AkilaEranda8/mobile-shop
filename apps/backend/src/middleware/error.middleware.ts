import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: string[],
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(`[Error] ${err.name}: ${err.message}`)

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors })
    return
  }

  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    res.status(422).json({ success: false, message: 'Validation error', errors })
    return
  }

  if (err instanceof PrismaClientKnownRequestError) {
    // Log DB internals server-side only; never leak table/column/constraint names to clients.
    console.error(`[Prisma ${err.code}]`, JSON.stringify(err.meta))
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Record already exists (unique constraint)' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Record not found' })
      return
    }
    if (err.code === 'P2011' || err.code === 'P2012') {
      res.status(400).json({ success: false, message: 'Required field missing' })
      return
    }
    res.status(400).json({ success: false, message: 'Database error' })
    return
  }

  if (err instanceof PrismaClientValidationError) {
    res.status(400).json({ success: false, message: 'Invalid data provided' })
    return
  }

  console.error('[Unhandled]', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, message: 'Route not found' })
}
