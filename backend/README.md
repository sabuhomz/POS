# POS Backend

Node.js + Express + PostgreSQL backend สำหรับระบบ POS จริง

## Account flow

1. รัน `schema.sql` ใน PostgreSQL
2. ตั้งค่า `.env`
3. สร้าง Admin คนแรกด้วย `npm run create-admin -- admin01 YourPassword123`
4. Admin login ผ่าน `/api/auth/login`
5. Admin ใช้ `/api/admin/users` สร้าง ADMIN หรือ OWNER
6. OWNER ต้องถูกผูกกับ Store ที่ ACTIVE
7. Password เก็บเป็น bcrypt hash
8. JWT มี role/storeId/permissions และ Backend ตรวจซ้ำทุก request

## Local PostgreSQL

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=pos_database
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
DB_SSL=false
```

## Run

```bash
npm install
npm run create-admin -- admin01 YourPassword123
npm run dev
```

Default API: `http://localhost:5000/api`

## Google Cloud SQL

สามารถเปลี่ยน connection ผ่าน `DATABASE_URL` หรือ DB_* environment variables ได้โดยไม่ต้องเปลี่ยน business logic
