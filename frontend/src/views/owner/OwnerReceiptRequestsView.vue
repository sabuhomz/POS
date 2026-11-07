<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'

const requests = ref([])
const loading = ref(false)
const busyId = ref(null)
const error = ref('')
const message = ref('')
const money = v => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(v || 0))
const date = v => v ? new Intl.DateTimeFormat('th-TH', {dateStyle:'medium',timeStyle:'short'}).format(new Date(v)) : '-'
const actionText = action => action === 'VOID' ? 'ยกเลิกใบเสร็จ / คืนสต็อก' : 'แก้ไขยอดใบเสร็จ'
const statusText = status => ({PENDING:'รออนุมัติ',APPLIED:'ดำเนินการแล้ว',REJECTED:'ปฏิเสธแล้ว'})[status] || status
async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get('/receipts/owner/requests')
    requests.value = data.requests || []
  } catch (e) { error.value = e.response?.data?.message || 'โหลดคำขอไม่สำเร็จ' }
  finally { loading.value = false }
}
async function decide(item, decision) {
  if (busyId.value) return
  const action = decision === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'
  if (!window.confirm(`ยืนยัน${action}คำขอ ${item.receiptNumber} ?\n\nเหตุผล: ${item.reason}\n\nการอนุมัติยกเลิกจะคืนสต็อกตามบาร์โค้ดที่ระบบบันทึกไว้ แต่ไม่ได้คืนเงินลูกค้าให้อัตโนมัติ`)) return
  busyId.value = item.id; error.value = ''; message.value = ''
  try {
    await api.patch(`/receipts/owner/requests/${item.id}/${decision}`)
    message.value = `${action}คำขอสำเร็จ`
    await load()
  } catch (e) { error.value = e.response?.data?.message || 'ดำเนินการไม่สำเร็จ' }
  finally { busyId.value = null }
}
onMounted(load)
</script>

<template>
  <div class="p-6 space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">คำขอแก้ไข / ยกเลิกใบเสร็จ</h1>
        <p class="mt-1 text-sm text-gray-500">ตรวจสอบเหตุผลและยอดเดิมก่อนอนุมัติ รายการที่อนุมัติจะมีประวัติผู้ดำเนินการเก็บไว้</p>
      </div>
      <button class="rounded-lg border px-4 py-2 bg-white" :disabled="loading" @click="load">↻ รีเฟรช</button>
    </div>
    <div v-if="error" role="alert" class="bg-red-50 text-red-700 p-3 rounded-lg">{{ error }}</div>
    <div v-if="message" role="status" class="bg-green-50 text-green-700 p-3 rounded-lg">{{ message }}</div>
    <p class="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">การยกเลิกบิลไม่คืนเงิน PromptPay โดยอัตโนมัติ ต้องดำเนินการคืนเงินกับลูกค้าต่างหาก และบิลเก่าที่ไม่มีข้อมูลบาร์โค้ดขายครบจะไม่สามารถคืนสต็อกอัตโนมัติได้</p>
    <div class="bg-white border rounded-xl overflow-x-auto">
      <table class="w-full min-w-[920px] text-sm text-left">
        <thead class="bg-slate-100"><tr><th class="p-3">ใบเสร็จ</th><th class="p-3">ผู้ขอ / เวลา</th><th class="p-3">รายการ / เหตุผล</th><th class="p-3">ยอดเดิม → ใหม่</th><th class="p-3">สถานะ</th><th class="p-3">จัดการ</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="p-5 text-center text-gray-500">กำลังโหลด...</td></tr>
          <tr v-else-if="!requests.length"><td colspan="6" class="p-5 text-center text-gray-500">ยังไม่มีคำขอ</td></tr>
          <tr v-for="item in requests" :key="item.id" class="border-t align-top">
            <td class="p-3 font-semibold">{{ item.receiptNumber }}</td>
            <td class="p-3">{{ item.requestedBy || 'บัญชีที่ลบแล้ว' }}<div class="text-gray-500">{{ date(item.requested_at) }}</div></td>
            <td class="p-3"><strong>{{ actionText(item.action) }}</strong><div class="text-gray-600 mt-1 whitespace-pre-wrap">{{ item.reason }}</div></td>
            <td class="p-3">{{ money(item.previous_total) }}<template v-if="item.action === 'ADJUST'"> → {{ money(item.requested_total) }}</template></td>
            <td class="p-3">{{ statusText(item.status) }}<div v-if="item.decided_at" class="text-gray-500">{{ item.decidedBy }} · {{ date(item.decided_at) }}</div></td>
            <td class="p-3">
              <div v-if="item.status === 'PENDING'" class="flex gap-2">
                <button class="bg-teal-700 text-white rounded-lg px-3 py-2 disabled:opacity-50" :disabled="!!busyId" @click="decide(item,'approve')">อนุมัติ</button>
                <button class="bg-white text-red-700 border border-red-200 rounded-lg px-3 py-2 disabled:opacity-50" :disabled="!!busyId" @click="decide(item,'reject')">ปฏิเสธ</button>
              </div>
              <span v-else class="text-gray-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
