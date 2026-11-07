import { validateId } from '../middleware/validateRequest.js'
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
import { createStore, listStores, getAdminDashboard, createUser, listUsers, updateUserStatus } from '../controllers/adminController.js'

const router = Router()
router.param('id', validateId)
router.use(authenticate, requireRole('ADMIN'))
router.get('/dashboard', getAdminDashboard)
router.get('/stores', listStores)
router.post('/stores', createStore)
router.get('/users', listUsers)
router.post('/users', createUser)
router.patch('/users/:id/status', updateUserStatus)
export default router

