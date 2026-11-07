import { Router } from 'express'
import { login, me, changePassword, recoveryEmail, requestRecoveryEmailCode, verifyRecoveryEmail, requestPasswordReset, resetPassword } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
const router=Router()
router.post('/login',login)
router.get('/me',authenticate,me)
router.patch('/password',authenticate,requireRole('ADMIN','OWNER'),changePassword)
router.get('/recovery-email',authenticate,requireRole('ADMIN','OWNER'),recoveryEmail)
router.post('/recovery-email/request-code',authenticate,requireRole('ADMIN','OWNER'),requestRecoveryEmailCode)
router.post('/recovery-email/verify',authenticate,requireRole('ADMIN','OWNER'),verifyRecoveryEmail)
router.post('/password-reset/request-code',requestPasswordReset)
router.post('/password-reset/confirm',resetPassword)
export default router
