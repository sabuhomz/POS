import { Router } from 'express'

import { authenticate } from '../middleware/auth.js'
import { requirePermission, requireRole } from '../middleware/permission.js'

import {
  listEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee
} from '../controllers/employeeController.js'

const router = Router()

router.use(authenticate)

// OWNER / ADMIN สามารถจัดการบัญชีพนักงาน
router.get(
  '/',
  requireRole('OWNER', 'ADMIN'),
  listEmployees
)

router.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  createEmployee
)

router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  updateEmployee
)

router.patch(
  '/:id/status',
  requireRole('OWNER', 'ADMIN'),
  updateEmployeeStatus
)
router.delete('/:id',
  requireRole('OWNER', 'ADMIN'),
  deleteEmployee)
export default router
