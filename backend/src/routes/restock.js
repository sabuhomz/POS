import { Router } from 'express'

import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

import {
  createRestockRequest,
  ownerAddStock,
  listRestockRequests,
  approveRestockRequest,
  rejectRestockRequest
} from '../controllers/restockController.js'

const router = Router()

router.use(authenticate)


// ======================================================
// EMPLOYEE
// ======================================================

router.post(
  '/requests',
  requirePermission('inventory.restock.request'),
  createRestockRequest
)


// ======================================================
// OWNER
// ======================================================

// เพิ่ม Stock โดยตรง
router.post(
  '/owner/add',
  requirePermission('inventory.edit'),
  ownerAddStock
)

// ดูรายการ Restock
router.get(
  '/requests',
  requirePermission('inventory.restock.view'),
  listRestockRequests
)

// อนุมัติ
router.patch(
  '/requests/:id/approve',
  requirePermission('inventory.restock.approve'),
  approveRestockRequest
)

// ปฏิเสธ
router.patch(
  '/requests/:id/reject',
  requirePermission('inventory.restock.reject'),
  rejectRestockRequest
)

export default router