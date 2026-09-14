import express from 'express'
import path from 'path'
import cors from 'cors'
import 'dotenv/config'

import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import permissionRoutes from './routes/permissions.js'
import productRoutes from './routes/products.js'
import storeLifecycleRoutes from './routes/storeLifecycle.js'
import ownerDashboardRoutes from './routes/ownerDashboard.js'
import employeeRoutes from './routes/employees.js'
import restockRoutes from './routes/restock.js'
import promotionRoutes from './routes/promotions.js'

import { pool, testDatabaseConnection } from './config/database.js'

const app = express()

app.locals.dbPool = pool

const origins = (
  process.env.CORS_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map(x => x.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: origins.length === 1
      ? origins[0]
      : origins
  })
)

app.use(express.json())

app.use(
  '/uploads',
  express.static(path.resolve('uploads'))
)

app.get('/api/health', async (_req, res) => {
  try {
    const db = await testDatabaseConnection()

    res.json({
      ok: true,
      database: 'connected',
      time: db.now
    })
  } catch {
    res.status(503).json({
      ok: false,
      database: 'disconnected'
    })
  }
})


/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

app.use(
  '/api/auth',
  authRoutes
)


/*
|--------------------------------------------------------------------------
| ADMIN
|--------------------------------------------------------------------------
*/

app.use(
  '/api/admin',
  adminRoutes
)

app.use(
  '/api/admin',
  permissionRoutes
)


/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
*/

app.use(
  '/api/products',
  productRoutes
)


/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

app.use(
  '/api/owner',
  ownerDashboardRoutes
)


/*
|--------------------------------------------------------------------------
| EMPLOYEES
|--------------------------------------------------------------------------
*/

app.use(
  '/api/employees',
  employeeRoutes
)


/*
|--------------------------------------------------------------------------
| RESTOCK
|--------------------------------------------------------------------------
*/

app.use(
  '/api/restock',
  restockRoutes
)


/*
|--------------------------------------------------------------------------
| PROMOTIONS
|--------------------------------------------------------------------------
*/

app.use(
  '/api/promotions',
  promotionRoutes
)


/*
|--------------------------------------------------------------------------
| STORE
|--------------------------------------------------------------------------
*/

app.use(
  '/api',
  storeLifecycleRoutes
)


/*
|--------------------------------------------------------------------------
| ERROR
|--------------------------------------------------------------------------
*/

app.use((err, _req, res, _next) => {
  console.error(err)

  res.status(500).json({
    message: 'Internal server error'
  })
})


/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

const port = Number(
  process.env.PORT || 5000
)

app.listen(
  port,
  () => {
    console.log(
      `POS backend listening at http://localhost:${port}`
    )
  }
)