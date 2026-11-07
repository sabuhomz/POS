import { validateId } from '../middleware/validateRequest.js'
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
import { updateStoreStatus, listDeleteRequests, reviewDeleteRequest, restoreDeletedStore, requestStoreDeletion, getMyDeleteRequest, cancelStoreDeletionRequest } from '../controllers/storeLifecycleController.js'

const router = Router()
router.param('id', validateId)
router.patch('/admin/stores/:id/status', authenticate, requireRole('ADMIN'), updateStoreStatus)
router.get('/admin/store-delete-requests', authenticate, requireRole('ADMIN'), listDeleteRequests)
router.patch('/admin/store-delete-requests/:id', authenticate, requireRole('ADMIN'), reviewDeleteRequest)
router.post('/admin/stores/:id/restore', authenticate, requireRole('ADMIN'), restoreDeletedStore)
router.post('/stores/delete-requests', authenticate, requireRole('OWNER'), requestStoreDeletion)
router.get('/stores/delete-requests/me', authenticate, requireRole('OWNER'), getMyDeleteRequest)
router.patch('/stores/delete-requests/me/cancel', authenticate, requireRole('OWNER'), cancelStoreDeletionRequest)
export default router

