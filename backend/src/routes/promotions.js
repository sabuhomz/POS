import { Router } from 'express'

import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'

import {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotion,
  listActivePromotions
} from '../controllers/promotionController.js'

const router = Router()

router.use(authenticate)

/*
 * OWNER Web POS
 */

router.get(
  '/',
  requireRole('OWNER'),
  listPromotions
)

router.get(
  '/active',
  listActivePromotions
)

router.get(
  '/:id',
  requireRole('OWNER'),
  getPromotion
)

router.post(
  '/',
  requireRole('OWNER'),
  createPromotion
)

router.put(
  '/:id',
  requireRole('OWNER'),
  updatePromotion
)

router.delete(
  '/:id',
  requireRole('OWNER'),
  deletePromotion
)

router.patch(
  '/:id/toggle',
  requireRole('OWNER'),
  togglePromotion
)

export default router