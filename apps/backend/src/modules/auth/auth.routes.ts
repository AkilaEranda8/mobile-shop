import { Router } from 'express'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { loginSchema, registerTenantSchema, refreshSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'

const router = Router()

router.post('/login', validate(loginSchema), authController.login)
router.post('/register', validate(registerTenantSchema), authController.register)
router.post('/refresh', validate(refreshSchema), authController.refresh)
router.post('/logout', authenticate, authController.logout)
router.get('/me', authenticate, authController.me)
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword)
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)

// ── Keycloak proxy (public) ──────────────────────────────────────────────────
router.post('/kc-login', authController.kcLogin)
router.post('/kc-refresh', authController.kcRefresh)
router.post('/kc-logout', authController.kcLogout)

export default router
