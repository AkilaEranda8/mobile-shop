import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { featureSuggestionsController as ctrl } from './feature-suggestions.controller'
import {
  rejectIdentitySpoofing,
  suggestionSubmitLimiter,
} from './feature-suggestions.middleware'
import { createSuggestionSchema } from './feature-suggestions.validators'

const router = Router()
router.use(authenticate)

router.post(
  '/',
  suggestionSubmitLimiter,
  rejectIdentitySpoofing,
  validate(createSuggestionSchema),
  ctrl.create,
)

router.get('/', ctrl.listOwn)
router.get('/:id', ctrl.getOwn)

export default router
