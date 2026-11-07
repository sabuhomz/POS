# POS Frontend

เว็บ POS สำหรับผู้ดูแลระบบ (ADMIN) และเจ้าของร้าน (OWNER) พัฒนาด้วย Vue 3, Vite, Pinia และ Vue Router เชื่อมข้อมูลกับ REST API ของ backend

## ความต้องการ

- Node.js และ npm
- Backend ของ POS ที่กำลังทำงานอยู่
- ฐานข้อมูล PostgreSQL ที่ backend เชื่อมต่อได้

ดูวิธีตั้งค่าและเปิด backend ที่ [`../backend/README.md`](../backend/README.md)

## เริ่มใช้งานในเครื่อง

1. เปิด backend ใน terminal แรก และตรวจให้แน่ใจว่า API พร้อมใช้งานที่ `http://localhost:5000/api`
2. เปิด terminal อีกหน้าต่าง แล้วเข้าโฟลเดอร์ frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. เปิด `http://localhost:5173` ในเบราว์เซอร์ แล้วเข้าสู่ระบบด้วยบัญชี ADMIN หรือ OWNER ที่มีอยู่ในฐานข้อมูล

ไฟล์ `.env` ใช้กำหนด API URL สำหรับการพัฒนาในเครื่อง:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

ถ้าเปลี่ยน URL ให้รีสตาร์ต Vite หลังแก้ไฟล์ ค่า `localhost` ใช้ได้เฉพาะเมื่อเปิด backend บนเครื่องเดียวกับ frontend เท่านั้น

## การเชื่อมต่อ API

ตัวเรียก API กลางอยู่ที่ `src/services/api.js` และแนบ access token เป็น `Authorization: Bearer <token>` ให้อัตโนมัติ หน้าเข้าสู่ระบบส่ง `username` และ `password` ไปที่ `POST /auth/login` เมื่อสำเร็จจะเก็บ access token และข้อมูลผู้ใช้ใน `localStorage` จนกว่าจะออกจากระบบหรือ token หมดอายุ

ตั้งค่า `VITE_API_BASE_URL` ให้เป็น URL หลักของ backend โดยลงท้ายด้วย `/api` เช่น:

```env
VITE_API_BASE_URL=https://api.example.com/api
```

สำหรับ deployment ให้ตั้งค่านี้ใน environment variables ของระบบที่ build frontend และตั้งค่า CORS ของ backend ให้ยอมรับ origin ของเว็บด้วย ห้ามใช้ `localhost` เป็น API URL ของเว็บที่เผยแพร่ เพราะจะชี้กลับไปยังเครื่องของผู้เข้าชม

## หน้าตามสิทธิ์ผู้ใช้

### ADMIN

- Dashboard
- จัดการร้านค้าและคำขอปิดร้าน; หลังอนุมัติข้อมูลที่เกี่ยวข้องจะเก็บไว้ 3 เดือน พร้อมวันและเวลาที่จะล้างข้อมูล
- กู้คืนร้านและบัญชีเดิมได้ก่อนวันหมดกำหนดเก็บข้อมูล
- สร้าง/ปิดใช้งานบัญชี ADMIN และ OWNER
- กำหนดสิทธิ์ให้ OWNER
- เปลี่ยนรหัสผ่านของตัวเองผ่านเมนูบัญชีมุมขวาบน

### OWNER

- Dashboard และประวัติการขาย
- คลังสินค้าและคำขอเติมสินค้า
- จัดการพนักงานและโปรโมชั่น
- ส่งและยกเลิกคำขอปิดร้านที่ยังรออนุมัติ
- เปลี่ยนรหัสผ่านของตัวเองผ่านเมนูบัญชีมุมขวาบน

หน้าเว็บตรวจ role และ permission ก่อนเปลี่ยนหน้าเพื่อช่วยนำทาง ส่วน backend ยังคงเป็นผู้ตรวจสอบ token และสิทธิ์ก่อนเข้าถึงหรือแก้ไขข้อมูลจริง

## คำสั่งที่ใช้บ่อย

```bash
npm run dev      # เปิด development server
npm run build    # สร้างไฟล์สำหรับ deploy ไว้ใน dist/
npm run preview  # เปิดดูไฟล์ที่ build แล้วในเครื่อง
```
