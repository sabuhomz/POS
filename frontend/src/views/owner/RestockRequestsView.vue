<template>
  <div class="space-y-5 p-6">
    <div class="flex items-center justify-between gap-3">
      <div><h1 class="text-2xl font-bold">คำขอเพิ่มสต็อกสินค้า</h1></div>
      <button class="rounded-lg border bg-white px-4 py-2" :disabled="loading" @click="load">รีเฟรช</button>
    </div>
    <p v-if="errorMessage" class="rounded-lg bg-red-50 p-3 text-red-700">{{ errorMessage }}</p>
    <p v-if="successMessage" class="rounded-lg bg-green-50 p-3 text-green-700">{{ successMessage }}</p>
    <div v-if="loading" class="rounded-xl bg-white p-6">กำลังโหลดข้อมูล...</div>
    <div v-else-if="!requests.length" class="rounded-xl bg-white p-6 text-gray-500">ยังไม่มีคำขอเพิ่มสต็อก</div>
    <div v-for="r in requests" :key="r.id" class="rounded-xl border bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-semibold">{{ r.product_name }} ({{ r.sku }})</h2>
          <p class="text-sm text-gray-500">คำขอ #{{ r.id }} • {{ r.employee_username || 'พนักงาน' }} • {{ new Date(r.created_at).toLocaleString('th-TH') }}</p>
          <p class="mt-1 text-sm">จำนวน {{ r.quantity }} ชิ้น • <strong>{{ statusText(r.status) }}</strong></p>
        </div>
        <div v-if="r.status === 'PENDING'" class="flex gap-2">
          <button class="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50" :disabled="working === r.id" @click="decide(r,'approve')">อนุมัติ</button>
          <button class="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50" :disabled="working === r.id" @click="decide(r,'reject')">ปฏิเสธ</button>
        </div>
      </div>
      <details class="mt-3"><summary class="cursor-pointer text-sm text-blue-700">ดูรายการบาร์โค้ด ({{ (r.items || []).length }})</summary>
        <ul class="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="item in r.items || []" :key="item.id" class="rounded bg-gray-50 px-3 py-2 font-mono">{{ item.barcode }}</li>
        </ul>
      </details>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '../../services/api'

const requests = ref([])
const loading = ref(false)
const working = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const statusText = status => ({ PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ปฏิเสธ' })[status] || status

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/restock/requests')
    requests.value = data
  } catch (e) { errorMessage.value = e.response?.data?.message || 'โหลดคำขอไม่สำเร็จ' }
  finally { loading.value = false }
}

async function decide(r, action) {
  if (!window.confirm(`${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอ #${r.id} จำนวน ${r.quantity} ชิ้น?`)) return
  working.value = r.id
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await api.patch(`/restock/requests/${r.id}/${action}`)
    successMessage.value = action === 'approve' ? 'อนุมัติคำขอแล้ว สินค้าพร้อมขาย' : 'ปฏิเสธคำขอแล้ว'
    await load()
  } catch (e) { errorMessage.value = e.response?.data?.message || 'ดำเนินการไม่สำเร็จ' }
  finally { working.value = null }
}

onMounted(load)
</script>
