# Frontend API Connection

Frontend uses the real Backend API. No Mock/Demo data is used for authentication or inventory.

## 1. Local backend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 2. Backend on friend's PC through ngrok

Friend runs:

```bash
npm run dev
ngrok http 5000
```

If ngrok returns:

```text
https://example.ngrok-free.app
```

set:

```env
VITE_API_BASE_URL=https://example.ngrok-free.app/api
```

Then restart Vite:

```bash
npm run dev
```

## 3. Connected APIs

### Authentication

```text
POST /api/auth/login
GET  /api/auth/me
```

### Admin

```text
GET  /api/admin/stores
POST /api/admin/stores
GET  /api/admin/users
POST /api/admin/users
PATCH /api/admin/users/:id/status
GET  /api/admin/users/:id/permissions
PUT  /api/admin/users/:id/permissions
```

### Products / Inventory

```text
GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

All requests automatically send:

```text
Authorization: Bearer <JWT>
```

## Important

`localhost` in the frontend means the frontend user's own PC. If Backend is on another PC, use the friend's ngrok HTTPS URL instead.
