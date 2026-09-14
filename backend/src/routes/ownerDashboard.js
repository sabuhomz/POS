import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { getOwnerDashboard } from '../controllers/ownerDashboardController.js'
import { getSalesHistory } from '../controllers/salesHistoryController.js'

const router = Router()

router.use(authenticate)

router.get('/dashboard', requirePermission('report.view'), getOwnerDashboard)
router.get('/sales-history', requirePermission('sale.view'), getSalesHistory)

export default router
