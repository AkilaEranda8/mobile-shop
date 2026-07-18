import rateLimit from 'express-rate-limit'
import type { Request, Response, NextFunction } from 'express'

/** Soft per-user submission limiter (service also enforces 5/day). */
export const suggestionSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = req.user?.userId ?? 'anon'
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    return `fs-submit:${userId}:${ip}`
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many suggestion submissions. Please try again later.',
    })
  },
} as any)

/** Reject mass-assignment of identity fields from the client. */
export function rejectIdentitySpoofing(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object') {
    next()
    return
  }
  const forbidden = [
    'tenantId',
    'submittedById',
    'userId',
    'role',
    'email',
    'id',
    'status',
    'priority',
    'publicResponse',
    'internalNote',
    'respondedByEmail',
    'respondedAt',
    'createdAt',
    'updatedAt',
  ]
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      delete (req.body as Record<string, unknown>)[key]
    }
  }
  next()
}
