import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { getOwnerDashboard, getSlowMovingInventory } from '../controllers/ownerDashboardController.js'
import { getSalesHistory } from '../controllers/salesHistoryController.js'
import { getOwnerSalesAnalytics } from '../controllers/ownerAnalyticsController.js'
import { listStoreShifts } from '../controllers/shiftController.js'

const router = Router()

router.use(authenticate)

router.get('/dashboard', requirePermission('report.view'), getOwnerDashboard)
router.get('/dashboard/analytics', requirePermission('report.view'), getOwnerSalesAnalytics)
router.get('/slow-moving-inventory', requirePermission('inventory.view'), getSlowMovingInventory)
router.get('/sales-history', requirePermission('sale.view'), getSalesHistory)
router.get('/shifts', requirePermission('sale.view'), listStoreShifts)

export default router
