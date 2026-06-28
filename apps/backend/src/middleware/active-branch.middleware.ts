import { Request, Response, NextFunction } from 'express'
import { resolveActiveBranch } from '../utils/active-branch'

/** Attach req.activeBranchId from header/query; optional required branch for mutations. */
export function attachActiveBranch(options?: { required?: boolean; allowAll?: boolean }) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await resolveActiveBranch(req, options)
      next()
    } catch (e) {
      next(e)
    }
  }
}
