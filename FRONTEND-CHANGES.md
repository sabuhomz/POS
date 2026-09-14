# Frontend changes

เพิ่มความสามารถฝั่ง Frontend:

- Admin ระงับ/เปิดใช้งานร้านผ่าน `PATCH /api/admin/stores/:id/status`
- Owner ส่งคำขอลบร้านผ่าน `POST /api/stores/delete-requests`
- Admin ดูคำขอลบผ่าน `GET /api/admin/store-delete-requests`
- Admin อนุมัติ/ปฏิเสธผ่าน `PATCH /api/admin/store-delete-requests/:id`
- Owner ดูสถานะคำขอผ่าน `GET /api/stores/delete-requests/me`
- แก้ Logout ของ Admin และ Owner ให้ล้าง auth แล้ว `router.replace('/login')`

## สำคัญสำหรับ Backend

Frontend นี้คาดหวังชื่อ API ตามด้านบน หาก Backend ใช้ชื่อ route หรือรูปแบบ response ต่างกัน ต้องปรับไฟล์ `frontend/src/services/stores.js` ให้ตรงกับ Backend จริง

การระงับร้านและการบล็อก Owner ต้องตรวจซ้ำที่ Backend ด้วย เช่น middleware ตรวจ `store.status === 'ACTIVE'`; Frontend เพียงซ่อน/นำทางและแสดงสถานะ ไม่สามารถบังคับความปลอดภัยแทน Backend ได้
