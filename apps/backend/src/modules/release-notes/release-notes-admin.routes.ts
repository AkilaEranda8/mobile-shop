import { Router, Request, Response, NextFunction } from 'express'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { createReleaseSchema, updateReleaseSchema } from './release-notes.schema'
import { releaseNotesService } from './release-notes.service'

const router = Router()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await releaseNotesService.adminList(req)
    sendPaginated(res, r.data, r.total, r.page, r.limit)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await releaseNotesService.adminGetById(req.params.id)
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.post('/', validate(createReleaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = req.user?.email ?? 'Admin'
    const data = await releaseNotesService.adminCreate(req.body, createdBy)
    sendSuccess(res, data, 'Release created', 201)
  } catch (e) { next(e) }
})

router.put('/:id', validate(updateReleaseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await releaseNotesService.adminUpdate(req.params.id, req.body)
    sendSuccess(res, data, 'Release updated')
  } catch (e) { next(e) }
})

router.patch('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await releaseNotesService.adminPublish(req.params.id)
    sendSuccess(res, data, 'Release published')
  } catch (e) { next(e) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await releaseNotesService.adminDelete(req.params.id)
    sendSuccess(res, null, 'Release deleted')
  } catch (e) { next(e) }
})

export default router
