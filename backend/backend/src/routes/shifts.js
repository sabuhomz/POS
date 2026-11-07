import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
import { getCurrentShift, startShift, endShift } from '../controllers/shiftController.js'

const router = Router()
router.use(authenticate, requireRole('EMPLOYEE'))
router.get('/current', getCurrentShift)
router.post('/start', startShift)
router.post('/end', endShift)

export default router
