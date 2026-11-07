import { validateId } from '../middleware/validateRequest.js'
import { Router } from 'express'
import multer from 'multer'
import { uploadsDirectory as uploadDir } from '../config/paths.js'
import fs from 'fs'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js'
fs.mkdirSync(uploadDir,{recursive:true})
const storage=multer.diskStorage({destination:uploadDir,filename:(_req,file,cb)=>cb(null,`${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`)})
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(_req,file,cb)=>{if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null,true); const error=new Error('กรุณาอัปโหลดรูป JPEG, PNG, WebP หรือ GIF'); error.status=400; cb(error)}})
const router=Router(); router.param('id', validateId); router.use(authenticate); router.get('/',requirePermission('product.view'),listProducts); router.get('/:id',requirePermission('product.view'),getProduct); router.post('/',requirePermission('product.create'),upload.single('image'),createProduct); router.put('/:id',requirePermission('product.edit'),upload.single('image'),updateProduct); router.delete('/:id',requirePermission('product.delete'),deleteProduct); export default router

