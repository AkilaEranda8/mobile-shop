import { Router } from 'express'
import { sendSuccess } from '../../../utils/response'
import { getWholesaleSettings, upsertWholesaleSettings } from './wholesale-settings.service'

export const settingsRouter = Router()

settingsRouter.get('/', async (req, res, next) => {
  try {
    sendSuccess(res, await getWholesaleSettings(req.tenantId!))
  } catch (e) {
    next(e)
  }
})

settingsRouter.patch('/', async (req, res, next) => {
  try {
    sendSuccess(res, await upsertWholesaleSettings(req.tenantId!, req.body ?? {}))
  } catch (e) {
    next(e)
  }
})
