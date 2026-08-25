import { Router } from 'express'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { loginSchema, registerTenantSchema, refreshSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, impersonateExchangeSchema, sessionExchangeSchema } from './auth.schema'
import { posPinController } from '../pos-pin/pos-pin.controller'
import {
  posPinLoginSchema,
  posPinSwitchSchema,
  posPinUnlockSchema,
  setOwnPosPinSchema,
} from '../pos-pin/pos-pin.schema'

const router = Router()

router.post('/login', validate(loginSchema), authController.login)
router.post('/register', validate(registerTenantSchema), authController.register)
router.post('/refresh', validate(refreshSchema), authController.refresh)
router.post('/logout', authenticate, authController.logout)
router.get('/me', authenticate, authController.me)
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword)
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)
router.post('/impersonate-exchange', validate(impersonateExchangeSchema), authController.impersonateExchange)
router.post('/session-exchange', validate(sessionExchangeSchema), authController.sessionExchange)

// POS Quick PIN
router.post('/pos-pin/login', validate(posPinLoginSchema), posPinController.login)
router.post('/pos-pin/switch', authenticate, validate(posPinSwitchSchema), posPinController.switchUser)
router.post('/pos-pin/unlock', authenticate, validate(posPinUnlockSchema), posPinController.unlock)
router.post('/pos-pin/me', authenticate, validate(setOwnPosPinSchema), posPinController.setOwnPin)
router.get('/pos-pin/me/status', authenticate, posPinController.myStatus)

// ── Keycloak proxy (public) ──────────────────────────────────────────────────
router.post('/kc-login', authController.kcLogin)
router.post('/kc-refresh', authController.kcRefresh)
router.post('/kc-logout', authController.kcLogout)

export default router
