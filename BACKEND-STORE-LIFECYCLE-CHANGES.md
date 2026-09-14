# Backend Store Lifecycle Changes

เพิ่ม API สำหรับวงจรร้านค้า โดยใช้ Node.js + Express + PostgreSQL จริง

## APIs

### Admin
- `PATCH /api/admin/stores/:id/status` body `{ "status": "SUSPENDED" }` หรือ `{ "status": "ACTIVE" }`
- `GET /api/admin/store-delete-requests`
- `PATCH /api/admin/store-delete-requests/:id` body `{ "decision": "APPROVED" }` หรือ `{ "decision": "REJECTED" }`

### Owner
- `POST /api/stores/delete-requests` body `{ "reason": "..." }`
- `GET /api/stores/delete-requests/me`

ทุก endpoint ต้องส่ง `Authorization: Bearer <JWT>`

## Database migration

รันส่วนเพิ่มเติมใน `database/schema.sql` เพื่อสร้างตาราง `store_deletion_requests`:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

หรือรัน SQL ส่วน `CREATE TABLE store_deletion_requests ...` ใน Cloud SQL

## พฤติกรรม

- Admin ระงับร้านได้ด้วย `SUSPENDED`; Owner จะ login ไม่ได้ เพราะ auth ตรวจสถานะร้าน
- Owner ส่งคำขอลบได้ครั้งละหนึ่งคำขอที่ยังเป็น `PENDING`
- Admin ต้องอนุมัติจึงเปลี่ยนร้านเป็น `DELETED` และปิดใช้งาน Owner ของร้านนั้น
- การอนุมัติ/ลบทำใน transaction เดียวกัน
