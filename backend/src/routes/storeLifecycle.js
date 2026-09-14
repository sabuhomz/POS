import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
import { updateStoreStatus, listDeleteRequests, reviewDeleteRequest, requestStoreDeletion, getMyDeleteRequest } from '../controllers/storeLifecycleController.js'

const router = Router()
router.patch('/admin/stores/:id/status', authenticate, requireRole('ADMIN'), updateStoreStatus)
router.get('/admin/store-delete-requests', authenticate, requireRole('ADMIN'), listDeleteRequests)
router.patch('/admin/store-delete-requests/:id', authenticate, requireRole('ADMIN'), reviewDeleteRequest)
router.post('/stores/delete-requests', authenticate, requireRole('OWNER'), requestStoreDeletion)
router.get('/stores/delete-requests/me', authenticate, requireRole('OWNER'), getMyDeleteRequest)
export default router
