import express from 'express'
import { pathToFileURL } from 'node:url'
import { uploadsDirectory } from './config/paths.js'
import { normalizeBody } from './middleware/validateRequest.js'
import cors from 'cors'
import './config/environment.js'
import { errorHandler } from './middleware/errorHandler.js'

import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import productRoutes from './routes/products.js'
import storeLifecycleRoutes from './routes/storeLifecycle.js'
import ownerDashboardRoutes from './routes/ownerDashboard.js'
import ownerPermissionsRoutes from './routes/ownerPermissions.js'
import employeeRoutes from './routes/employees.js'
import restockRoutes from './routes/restock.js'
import promotionRoutes from './routes/promotions.js'
import shiftRoutes from './routes/shifts.js'
import salesRoutes from './routes/sales.js'
import saleCorrectionRoutes from './routes/saleCorrections.js'
import { purgeExpiredDeletedStores } from './controllers/storeLifecycleController.js'

import { pool, testDatabaseConnection } from './config/database.js'

export const app = express()

app.locals.dbPool = pool

// Allow local development by default.
// For custom domains or additional frontends, set CORS_ORIGIN in the backend environment.
const origins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5173,http://127.0.0.1:5173'
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
app.use(normalizeBody)

app.use(
  '/uploads',
  express.static(uploadsDirectory)
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

app.use('/api/owner', ownerPermissionsRoutes)


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



app.use('/api/sales', salesRoutes)
app.use('/api/receipts', saleCorrectionRoutes)/*
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

app.use('/api', (_req, res) => res.status(404).json({ message: 'ไม่พบ API ที่เรียกใช้งาน' }))
app.use(errorHandler)


/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

const port = Number(
  process.env.PORT || 5000
)

async function cleanExpiredStoreData() {
  try {
    const removed = await purgeExpiredDeletedStores()
    if (removed > 0) console.log(`Purged ${removed} expired deleted store(s)`)
  } catch {
    // The cleanup runs again on the next interval; keep the API available.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(
    port,
    process.env.HOST || '127.0.0.1',
    () => {
      console.log(
        `POS backend listening at http://localhost:${port}`
      )
    }
  )

  cleanExpiredStoreData()
  const retentionCleanup = setInterval(cleanExpiredStoreData, 60 * 60 * 1000)
  retentionCleanup.unref()
}
