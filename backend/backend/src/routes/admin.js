import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'
import { createStore, listStores, getAdminDashboard, createUser, listUsers, updateUserStatus, updateUserPermissions } from '../controllers/adminController.js'
import { query } from '../config/database.js'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))
router.get('/dashboard', getAdminDashboard)
router.get('/stores', listStores)
router.post('/stores', createStore)
router.get('/users', listUsers)
router.post('/users', createUser)
router.patch('/users/:id/status', updateUserStatus)
router.get('/users/:id/permissions', async (req,res,next)=>{ try { const r=await query('SELECT permission_key FROM user_permissions WHERE user_id=$1 ORDER BY permission_key',[req.params.id]); res.json({permissions:r.rows.map(x=>x.permission_key)}) } catch(e){next(e)} })
router.put('/users/:id/permissions', updateUserPermissions)
router.get('/permissions', async (_req,res,next)=>{ try { const r=await query('SELECT permission_key,description FROM permissions ORDER BY permission_key'); res.json({permissions:r.rows}) } catch(e){next(e)} })
export default router
