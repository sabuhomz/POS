<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../../services/api'

const tab = ref('receipts')
const restock = ref([])
const receipts = ref([])
const loading = ref(false)
const busy = ref('')
const error = ref('')
const notice = ref('')
const receiptReady = ref(true)
const pendingReceipts = computed(() => receipts.value.filter(x => x.status === 'PENDING'))
const pendingRestocks = computed(() => restock.value.filter(x => x.status === 'PENDING'))
const money = value => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(value || 0))
const date = value => value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const status = value => ({ PENDING:'รออนุมัติ', APPROVED:'อนุมัติแล้ว', REJECTED:'ปฏิเสธแล้ว', APPLIED:'ดำเนินการแล้ว' })[value] || value
const receiptAction = value => value === 'VOID' ? 'ยกเลิกใบเสร็จ' : 'แก้ไขยอดใบเสร็จ'
const sorted = list => [...list].sort((a,b) => (b.status === 'PENDING') - (a.status === 'PENDING') || Number(b.id) - Number(a.id))

async function load() {
  loading.value = true
  error.value = ''
  receiptReady.value = true
  const results = await Promise.allSettled([
    api.get('/restock/requests'),
    api.get('/receipts/owner/requests')
  ])
  if (results[0].status === 'fulfilled') {
    const data = results[0].value.data
    restock.value = Array.isArray(data) ? data : (data.requests || [])
  } else {
    error.value = results[0].reason.response?.data?.message || 'โหลดคำขอเพิ่มสต็อกไม่สำเร็จ'
  }
  if (results[1].status === 'fulfilled') {
    receipts.value = results[1].value.data.requests || []
  } else {
    receiptReady.value = false
    error.value = [error.value, 'โหลดคำขอใบเสร็จไม่สำเร็จ: ตรวจสอบว่าติดตั้งระบบใบเสร็จและรัน SQL Migration แล้ว']
      .filter(Boolean).join(' | ')
  }
  loading.value = false
}

async function decide(type, item, decision) {
  if (busy.value || item.status !== 'PENDING') return
  const action = decision === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'
  const subject = type === 'receipt' ? `${receiptAction(item.action)} เลขที่ ${item.receiptNumber}` :
    `เพิ่มสต็อก ${item.product_name} จำนวน ${item.quantity} ชิ้น`
  const detail = type === 'receipt' ? `\nเหตุผล: ${item.reason}\nยอดเดิม: ${money(item.previous_total)}${item.action === 'ADJUST' ? `\nยอดใหม่: ${money(item.requested_total)}` : ''}\n\nการยกเลิกไม่คืนเงิน PromptPay อัตโนมัติ` : ''
  if (!window.confirm(`ยืนยัน${action}: ${subject}?${detail}`)) return
  busy.value = `${type}-${item.id}`
  notice.value = ''
  error.value = ''
  try {
    const url = type === 'receipt'
      ? `/receipts/owner/requests/${item.id}/${decision}`
      : `/restock/requests/${item.id}/${decision}`
    await api.patch(url)
    notice.value = `${action}คำขอเรียบร้อย`
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'ดำเนินการคำขอไม่สำเร็จ'
  } finally {
    busy.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5 p-4 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">คำขอ</h1>
        <p class="mt-1 text-sm text-gray-500">ตรวจสอบและอนุมัติคำขอเพิ่มสต็อก ยกเลิกใบเสร็จ หรือแก้ไขยอดใบเสร็จ</p>
      </div>
      <button type="button" class="rounded-lg border bg-white px-4 py-2" :disabled="loading || !!busy" @click="load">
        {{ loading ? 'กำลังโหลด...' : '↻ รีเฟรช' }}
      </button>
    </div>
    <div v-if="error" role="alert" class="rounded-lg bg-red-50 p-4 text-red-700">{{ error }}</div>
    <div v-if="notice" role="status" class="rounded-lg bg-green-50 p-4 text-green-700">{{ notice }}</div>
    <div class="flex flex-wrap gap-2 border-b pb-3">
      <button type="button" class="rounded-lg border px-4 py-3 font-semibold"
        :class="tab === 'receipts' ? 'border-teal-700 bg-teal-700 text-white' : 'bg-white text-slate-700'"
        @click="tab = 'receipts'">ยกเลิก / แก้ไขใบเสร็จ ({{ pendingReceipts.length }})</button>
      <button type="button" class="rounded-lg border px-4 py-3 font-semibold"
        :class="tab === 'stock' ? 'border-teal-700 bg-teal-700 text-white' : 'bg-white text-slate-700'"
        @click="tab = 'stock'">เพิ่มสต็อก ({{ pendingRestocks.length }})</button>
    </div>

    <template v-if="tab === 'receipts'">
      <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">อนุมัติยกเลิกบิลแล้วต้องคืนเงินลูกค้าแยกต่างหาก ระบบจะไม่โอนคืนผ่าน PromptPay โดยอัตโนมัติ</p>
      <div class="overflow-x-auto rounded-xl border bg-white">
        <table class="w-full min-w-[940px] text-left text-sm">
          <thead class="bg-slate-100"><tr>
            <th class="p-3">ใบเสร็จ</th><th class="p-3">ประเภท</th><th class="p-3">ผู้ขอ / เวลา</th>
            <th class="p-3">เหตุผล</th><th class="p-3">ยอดเดิม → ใหม่</th><th class="p-3">สถานะ</th><th class="p-3">จัดการ</th>
          </tr></thead>
          <tbody>
            <tr v-if="!receiptReady"><td colspan="7" class="p-5 text-center text-amber-800">ยังเชื่อมต่อ API คำขอใบเสร็จไม่ได้</td></tr>
            <tr v-else-if="!receipts.length"><td colspan="7" class="p-5 text-center text-gray-500">ยังไม่มีคำขอใบเสร็จ</td></tr>
            <tr v-for="item in sorted(receipts)" :key="item.id" class="border-t align-top">
              <td class="p-3 font-semibold">{{ item.receiptNumber }}</td>
              <td class="p-3">{{ receiptAction(item.action) }}</td>
              <td class="p-3">{{ item.requestedBy || 'บัญชีเดิม' }}<div class="mt-1 text-xs text-slate-500">{{ date(item.requested_at) }}</div></td>
              <td class="max-w-[240px] whitespace-pre-wrap p-3">{{ item.reason }}</td>
              <td class="p-3">{{ money(item.previous_total) }}<span v-if="item.action === 'ADJUST'"> → {{ money(item.requested_total) }}</span></td>
              <td class="p-3">{{ status(item.status) }}</td>
              <td class="p-3">
                <div v-if="item.status === 'PENDING'" class="flex gap-2">
                  <button type="button" class="rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-50" :disabled="!!busy" @click="decide('receipt', item, 'approve')">อนุมัติ</button>
                  <button type="button" class="rounded-lg border border-rose-200 px-3 py-2 text-rose-700 disabled:opacity-50" :disabled="!!busy" @click="decide('receipt', item, 'reject')">ปฏิเสธ</button>
                </div>
                <span v-else class="text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="overflow-x-auto rounded-xl border bg-white">
        <table class="w-full min-w-[800px] text-left text-sm">
          <thead class="bg-slate-100"><tr>
            <th class="p-3">สินค้า</th><th class="p-3">ผู้ขอ / เวลา</th><th class="p-3">จำนวน</th>
            <th class="p-3">บาร์โค้ด</th><th class="p-3">สถานะ</th><th class="p-3">จัดการ</th>
          </tr></thead>
          <tbody>
            <tr v-if="!restock.length"><td colspan="6" class="p-5 text-center text-gray-500">ยังไม่มีคำขอเพิ่มสต็อก</td></tr>
            <tr v-for="item in sorted(restock)" :key="item.id" class="border-t align-top">
              <td class="p-3"><strong>{{ item.product_name }}</strong><div class="text-xs text-gray-500">{{ item.sku }}</div></td>
              <td class="p-3">{{ item.employee_username || '—' }}<div class="mt-1 text-xs text-slate-500">{{ date(item.created_at) }}</div></td>
              <td class="p-3">{{ item.quantity }} ชิ้น</td>
              <td class="max-w-[240px] break-all p-3 text-xs">
                {{ (item.items || []).map(unit => unit.barcode).join(', ') || '—' }}
              </td>
              <td class="p-3">{{ status(item.status) }}</td>
              <td class="p-3">
                <div v-if="item.status === 'PENDING'" class="flex gap-2">
                  <button type="button" class="rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-50" :disabled="!!busy" @click="decide('stock', item, 'approve')">อนุมัติ</button>
                  <button type="button" class="rounded-lg border border-rose-200 px-3 py-2 text-rose-700 disabled:opacity-50" :disabled="!!busy" @click="decide('stock', item, 'reject')">ปฏิเสธ</button>
                </div>
                <span v-else class="text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
