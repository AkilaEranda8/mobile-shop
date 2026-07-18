import { Router } from 'express'
import { validate } from '../../middleware/validate.middleware'
import { featureSuggestionsController as ctrl } from './feature-suggestions.controller'
import { adminUpdateSuggestionSchema } from './feature-suggestions.validators'

const router = Router()

router.get('/summary', ctrl.adminSummary)
router.get('/', ctrl.adminList)
router.get('/:id', ctrl.adminGet)
router.patch('/:id', validate(adminUpdateSuggestionSchema), ctrl.adminUpdate)

export default router
