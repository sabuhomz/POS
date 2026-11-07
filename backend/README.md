# POS Backend

Node.js + Express + PostgreSQL backend สำหรับระบบ POS จริง

## Account flow

1. รัน `database/schema.sql` และ `database/promotion.sql` ใน PostgreSQL
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

เตรียมหรืออัปเดตฐานข้อมูลด้วยสคริปต์ทั้งสองไฟล์จากโฟลเดอร์ `backend`:

```bash
psql -h 127.0.0.1 -U postgres -d YOUR_DATABASE -v ON_ERROR_STOP=1 -f database/schema.sql
psql -h 127.0.0.1 -U postgres -d YOUR_DATABASE -v ON_ERROR_STOP=1 -f database/promotion.sql
```

## Run

```bash
npm install
npm run create-admin -- admin01 YourPassword123
npm run dev
```

Default API: `http://localhost:5000/api`

## Employee shifts and sales per shift

- `GET /api/shifts/current` (EMPLOYEE): returns the employee's currently open shift, if any.
- `POST /api/shifts/start` (EMPLOYEE): opens a shift; only one open shift per employee is allowed.
- `POST /api/shifts/end` (EMPLOYEE): closes the employee's open shift.
- `GET /api/owner/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD` (OWNER with `sale.view`): lists shifts with receipt count and sales total.
- The POS checkout must save each sale's `employee_id` and `created_at`. The report attributes sales made between the shift's start and end timestamps to that employee and shift.

For existing databases, rerun `database/schema.sql` to create `employee_shifts` and its indexes.

## Google Cloud SQL

สามารถเปลี่ยน connection ผ่าน `DATABASE_URL` หรือ DB_* environment variables ได้โดยไม่ต้องเปลี่ยน business logic

## Store deletion retention

- เมื่อ Admin อนุมัติคำขอลบร้าน ระบบจะเปลี่ยนสถานะร้านเป็น `DELETED` และปิดบัญชีที่ใช้งานอยู่ของร้าน
- ข้อมูลร้าน บัญชีพนักงาน สินค้า โปรโมชั่น การขาย และคำขอที่เกี่ยวข้องจะยังอยู่ในฐานข้อมูล 3 เดือน โดย API ส่งวันและเวลาที่กำหนดล้างข้อมูลกลับให้หน้า Admin
- Admin กู้คืนร้านและบัญชีที่เคยเปิดใช้งานได้ผ่าน `POST /api/admin/stores/:id/restore` ก่อนครบกำหนด
- เจ้าของร้านยกเลิกคำขอที่ยัง `PENDING` ได้ผ่าน `PATCH /api/stores/delete-requests/me/cancel`; คำขอจะถูกซ่อนจากคิว Admin แต่เก็บสถานะ `CANCELLED` ไว้เป็นประวัติ
- Backend ล้างข้อมูลและรูปสินค้าถาวรหลังครบกำหนด โดยตรวจทุกชั่วโมง
- สำหรับฐานข้อมูลเดิม ให้รัน schema ที่เพิ่ม migration แบบ `ADD COLUMN IF NOT EXISTS`:

  ```bash
  psql -h 127.0.0.1 -U postgres -d YOUR_DATABASE -v ON_ERROR_STOP=1 -f database/schema.sql
  ```
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
- `PATCH /api/stores/delete-requests/me/cancel` ยกเลิกคำขอที่ยังรออนุมัติ

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

## แก้ Login ขึ้น Internal server error บน localhost

1. หากยังไม่มี `.env` ให้คัดลอก `.env.example` เป็น `.env` ภายใน backend (อย่าเขียนทับไฟล์เดิม)
2. ตั้ง `DB_NAME` ให้ตรงฐานข้อมูลจริง และใส่ `DB_PASSWORD` เป็นรหัสผ่าน PostgreSQL ของ `DB_USER`
3. ตั้ง `JWT_SECRET` เป็นค่าสุ่มลับของเครื่องคุณ
4. รัน `npm run check-db` ต้องแสดง PostgreSQL connected successfully แล้วจึงรัน `npm run dev`
5. Frontend ใช้ `VITE_API_BASE_URL=http://localhost:5000/api` และรีสตาร์ตด้วย `npm run dev`

Backend ฟังที่ 127.0.0.1 เป็นค่าเริ่มต้น ไม่ต้องใช้ ngrok
ไฟล์ .env โหลดจากโฟลเดอร์ backend เสมอ แม้เรียกโปรแกรมจากโฟลเดอร์อื่น
หากไม่ได้ตั้งรหัสผ่าน Backend จะหยุดพร้อมข้อความบอกวิธีแก้ ก่อนรับคำขอ Login
รหัสผ่านผิดหรือ PostgreSQL ไม่ทำงานจะตอบ 503 พร้อมคำแนะนำ โดยไม่ส่งรหัสผ่านหรือรายละเอียด SQL กลับไป
โค้ดไม่สามารถเดาหรือเปลี่ยนรหัสผ่าน PostgreSQL ในเครื่องคุณให้เองได้

## ใช้ localhost โดยไม่ใส่รหัสผ่านฐานข้อมูล

ตั้ง backend/.env (ใช้ชื่อฐานข้อมูลจริงของคุณ):

```env
DB_HOST=127.0.0.1
DB_NAME=pos_db
DB_USER=postgres
DB_PASSWORDLESS=true
```

ลบ DB_PASSWORD ได้ และอย่าตั้ง DATABASE_URL เพราะ URL มีลำดับความสำคัญเหนือ DB_*.
ตั้ง JWT_SECRET ต่อไปตามปกติ

ใน pgAdmin Query Tool ใช้ `SHOW hba_file;` เพื่อหาตำแหน่ง pg_hba.conf.
สำรองไฟล์ แล้วเพิ่มบรรทัดต่อไปนี้ไว้ก่อน host rule เดิม (เปลี่ยนชื่อฐานข้อมูล/ผู้ใช้ให้ตรง .env):

```conf
host    pos_db    postgres    127.0.0.1/32    trust
```

trust อนุญาตโปรแกรมในเครื่องเข้า pos_db ในนาม postgres โดยไม่ใช้รหัสผ่าน.
กฎนี้จำกัดเฉพาะฐานข้อมูลและ localhost ห้ามขยายเป็น 0.0.0.0/0.
โหลด config ใหม่ด้วย `SELECT pg_reload_conf();` หรือรีสตาร์ตบริการ PostgreSQL.
จากนั้นรีสตาร์ต Backend และรัน `npm run check-db` ก่อนลอง Login.
หากยังขึ้น SCRAM แสดงว่า PostgreSQL ยังเลือกกฎที่ต้องใช้รหัสผ่าน ต้องตรวจลำดับ host rules.


## อัปเดตฐานข้อมูลและตรวจข้อผิดพลาด API

หลังดึงโค้ดล่าสุด ให้หยุด Backend แล้วรันจากโฟลเดอร์ backend:

```bash
npm install
npm run check-db
npm run setup-db
npm run dev
```

`setup-db` ใช้ฐานข้อมูลตาม `.env` และรัน schema.sql กับ promotion.sql ใน transaction เดียว
เพื่อเพิ่มตาราง/คอลัมน์ที่รองรับใน migration โดยไม่ล้างบัญชีหรือข้อมูลร้านเดิม
หากฐานข้อมูลยังไม่มี ต้องสร้างฐานข้อมูลและตั้ง DB_NAME ให้ตรงก่อน
โหมดไม่มีรหัสผ่านยังต้องตั้ง DB_PASSWORDLESS=true และกฎ localhost trust ใน PostgreSQL ตามหัวข้อก่อนหน้า

API ตรวจข้อมูลที่จำเป็น ราคา วันที่ รหัสรายการ และรูปภาพก่อนบันทึก
ข้อมูลไม่ถูกต้องตอบ 400, ข้อมูลซ้ำ/ขัดแย้งตอบ 409 และปัญหาเชื่อมต่อ/ตารางไม่ครบตอบ 503 พร้อมคำแนะนำ
ปัญหาที่ไม่คาดคิดยังตอบ 500 โดยไม่เปิดเผย SQL หรือข้อมูลลับ และบันทึกรายละเอียดไว้ใน Terminal ของ Backend

การตรวจสอบสำหรับผู้พัฒนา:

```bash
npm test
```

ชุดทดสอบ API ใช้ PostgreSQL แบบฝังผ่าน PGlite กับฐานข้อมูลชั่วคราว
ตรวจ Login, Admin/Owner, สินค้า, พนักงาน, โปรโมชั่น, สต็อก, กะ, การขาย, รายงาน, การลบ/กู้คืนร้าน
รวมทั้งการแยกข้อมูลระหว่างร้าน กรณีข้อมูลผิด และการเชื่อมต่อขัดข้อง โดยไม่ใช้ฐานข้อมูลจริงในเครื่อง
รัน `npm run build` จาก frontend เพื่อตรวจการ build หน้าเว็บ
