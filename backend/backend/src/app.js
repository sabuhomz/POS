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
import shiftRoutes from './routes/shifts.js'
import { purgeExpiredDeletedStores } from './controllers/storeLifecycleController.js'

import { pool, testDatabaseConnection } from './config/database.js'

const app = express()

app.locals.dbPool = pool

// Allow local development and the current Vercel production frontend by default.
// For custom domains or additional frontends, set CORS_ORIGIN in the backend environment.
const origins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5173,https://pos-fawn-five.vercel.app'
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

app.use(
  '/api/shifts',
  shiftRoutes
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

  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Internal server error'
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

async function cleanExpiredStoreData() {
  try {
    const removed = await purgeExpiredDeletedStores()
    if (removed > 0) console.log(`Purged ${removed} expired deleted store(s)`)
  } catch {
    // The cleanup runs again on the next interval; keep the API available.
  }
}

cleanExpiredStoreData()
const retentionCleanup = setInterval(cleanExpiredStoreData, 60 * 60 * 1000)
retentionCleanup.unref()
