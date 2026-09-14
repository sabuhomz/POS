<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">ยื่นคำขอปิดร้านค้า</h1>
      <p class="mt-1 text-sm text-gray-500">คำขอจะยังไม่ลบร้านจนกว่า Admin จะอนุมัติ</p>
    </div>

    <!-- กรณีที่ 1: สถานะ PENDING (รออนุมัติ) ให้ซ่อนฟอร์มและแสดงข้อความรอ -->
    <div v-if="currentRequest && currentRequest.status === 'PENDING'" class="rounded-xl border bg-white p-6 shadow-sm">
      <div class="flex items-center text-blue-700 bg-blue-50 p-4 rounded-lg">
        <span class="font-bold text-lg">สถานะคำขอ: PENDING (กำลังรอตรวจสอบ)</span>
      </div>
      <p class="mt-4 text-sm text-gray-600">
        คุณได้ยื่นคำขอปิดร้านไปแล้วเมื่อ {{ formatDate(currentRequest.created_at) }}<br>
        กรุณารอผู้ดูแลระบบดำเนินการอนุมัติ
      </p>
    </div>

    <!-- กรณีที่ 2: ไม่มีคำขอเลย หรือ คำขอล่าสุดถูก REJECTED ให้แสดงฟอร์มยื่นใหม่ -->
    <div v-else class="rounded-xl border bg-white p-6 shadow-sm">
      
      <!-- แจ้งเตือนกรณีโดน Reject ก่อนหน้า (ถ้ามี) -->
      <div v-if="currentRequest && currentRequest.status === 'REJECTED'" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p class="font-bold mb-1">สถานะคำขอล่าสุด: REJECTED (ถูกปฏิเสธ)</p>
        <p class="text-sm">คำขอปิดร้านก่อนหน้าของคุณไม่ได้รับการอนุมัติ หากคุณยังต้องการปิดร้านอยู่ คุณสามารถระบุเหตุผลเพื่อยื่นคำขอใหม่ได้ที่ฟอร์มด้านล่าง</p>
      </div>

      <!-- ฟอร์มยื่นคำขอปิดร้าน -->
      <form @submit.prevent="submitDeletionRequest">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">เหตุผลที่ต้องการปิดร้านค้า</label>
          <textarea 
            v-model="reason" 
            rows="4" 
            class="w-full rounded-lg border px-3 py-2 focus:border-red-500 focus:ring focus:ring-red-200"
            placeholder="โปรดระบุเหตุผลในการขอลบร้านค้า (เช่น ต้องการเลิกกิจการ, เปลี่ยนระบบ ฯลฯ)"
            required
          ></textarea>
        </div>
        
        <div class="flex justify-end">
          <button 
            type="submit" 
            class="rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700 disabled:opacity-50 font-medium"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'กำลังส่งคำขอ...' : 'ยืนยันการยื่นคำขอปิดร้าน' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;
const currentRequest = ref(null);
const reason = ref('');
const isSubmitting = ref(false);

const getHeaders = () => {
  const token = localStorage.getItem('access_token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('th-TH');
};

// ดึงข้อมูลคำขอล่าสุด
const fetchCurrentRequest = async () => {
  try {
    // ⚠️ แก้ไข URL ให้ตรงกับ router.get('/stores/delete-requests/me')
    const response = await axios.get(`${API_URL}/stores/delete-requests/me`, getHeaders());
    currentRequest.value = response.data.request; 
  } catch (error) {
    if (error.response && error.response.status !== 404) {
      console.error('Error fetching request:', error);
    } else {
      currentRequest.value = null; 
    }
  }
};

// ยื่นคำขอปิดร้าน
const submitDeletionRequest = async () => {
  if (!reason.value.trim()) return;
  isSubmitting.value = true;

  try {
    const confirmed = window.confirm('ต้องการยื่นคำขอปิดร้านค้าใช่หรือไม่?');
    if (!confirmed) return;

    // ⚠️ แก้ไข URL ให้ตรงกับ router.post('/stores/delete-requests')
    await axios.post(`${API_URL}/stores/delete-requests`, {
      reason: reason.value
    }, getHeaders());

    alert('ยื่นคำขอปิดร้านสำเร็จ กรุณารอ Admin อนุมัติ');
    reason.value = '';
    await fetchCurrentRequest(); // โหลดข้อมูลมาใหม่
  } catch (error) {
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการส่งคำขอ');
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  fetchCurrentRequest();
});
</script>
