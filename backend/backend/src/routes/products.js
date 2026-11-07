import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { listProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js'
const uploadDir=path.resolve('uploads'); fs.mkdirSync(uploadDir,{recursive:true})
const storage=multer.diskStorage({destination:uploadDir,filename:(_req,file,cb)=>cb(null,`${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`)})
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(_req,file,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))})
const router=Router(); router.use(authenticate); router.get('/',requirePermission('product.view'),listProducts); router.post('/',requirePermission('product.create'),upload.single('image'),createProduct); router.put('/:id',requirePermission('product.edit'),upload.single('image'),updateProduct); router.delete('/:id',requirePermission('product.delete'),deleteProduct); export default router
