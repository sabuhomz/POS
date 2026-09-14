import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { getOwnerDashboard } from '../controllers/ownerDashboardController.js'
const router=Router(); router.use(authenticate); router.get('/dashboard',requirePermission('report.view'),getOwnerDashboard); export default router
