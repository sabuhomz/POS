import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
import { getUserPermissions, updateUserPermissions } from '../controllers/permissionController.js'

const router = Router()
router.use(authenticate)
router.use(requireRole('ADMIN'))
router.get('/users/:userId/permissions', getUserPermissions)
router.put('/users/:userId/permissions', updateUserPermissions)

export default router
