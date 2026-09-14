<template>
  <div class="space-y-6">
    <div class="rounded-xl bg-white p-6 shadow">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">ประวัติการขาย</h1>
          <p class="mt-1 text-sm text-gray-500">ตรวจสอบรายการขาย ใบเสร็จ และรายละเอียดสินค้า</p>
        </div>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="loading" @click="loadSales">
          {{ loading ? 'กำลังโหลด...' : 'รีเฟรช' }}
        </button>
      </div>
    </div>

    <div class="rounded-xl bg-white p-6 shadow">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">ค้นหา</label>
          <input v-model="filters.search" type="text" placeholder="เลขที่ใบเสร็จ / พนักงาน / สินค้า" class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-500" @keyup.enter="applyFilters" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">การชำระเงิน</label>
          <select v-model="filters.paymentMethod" class="w-full rounded-lg border border-gray-300 px-3 py-2">
            <option value="">ทั้งหมด</option>
            <option value="CASH">เงินสด</option>
            <option value="QR">QR</option>
            <option value="CARD">บัตร</option>
            <option value="TRANSFER">โอนเงิน</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">ตั้งแต่วันที่</label>
          <input v-model="filters.from" type="date" class="w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">ถึงวันที่</label>
          <input v-model="filters.to" type="date" class="w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm" @click="clearFilters">ล้างตัวกรอง</button>
        <button type="button" class="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white" @click="applyFilters">ค้นหา</button>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ errorMessage }}</div>

    <div class="rounded-xl bg-white shadow">
      <div v-if="loading" class="p-8 text-center text-gray-500">กำลังโหลดประวัติการขาย...</div>
      <div v-else-if="sales.length === 0" class="p-10 text-center text-gray-500">ไม่พบประวัติการขาย</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="border-b bg-gray-50 text-left">
            <tr>
              <th class="px-4 py-3">วันที่</th>
              <th class="px-4 py-3">เลขที่ใบเสร็จ</th>
              <th class="px-4 py-3">พนักงาน</th>
              <th class="px-4 py-3">สินค้า</th>
              <th class="px-4 py-3 text-right">รวม</th>
              <th class="px-4 py-3">ชำระเงิน</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sale in sales" :key="sale.id" class="border-b last:border-0">
              <td class="whitespace-nowrap px-4 py-3">{{ formatDate(sale.createdAt) }}</td>
              <td class="px-4 py-3 font-medium">{{ sale.receiptNumber }}</td>
              <td class="px-4 py-3">{{ sale.employeeUsername || '-' }}</td>
              <td class="max-w-md px-4 py-3">
                <div v-for="item in sale.items" :key="item.id" class="truncate">{{ item.productName }} × {{ item.quantity }}</div>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right font-semibold">{{ money(sale.total) }}</td>
              <td class="px-4 py-3">{{ paymentLabel(sale.paymentMethod) }}</td>
              <td class="px-4 py-3 text-right">
                <button type="button" class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50" @click="selectedSale = sale">รายละเอียด</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pagination.totalPages > 1" class="flex items-center justify-between border-t p-4 text-sm">
        <span class="text-gray-500">ทั้งหมด {{ pagination.total }} รายการ</span>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-lg border px-3 py-1.5 disabled:opacity-40" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">ก่อนหน้า</button>
          <span>หน้า {{ pagination.page }} / {{ pagination.totalPages }}</span>
          <button type="button" class="rounded-lg border px-3 py-1.5 disabled:opacity-40" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">ถัดไป</button>
        </div>
      </div>
    </div>

    <div v-if="selectedSale" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="selectedSale = null">
      <div class="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold">รายละเอียดการขาย</h2>
            <p class="text-sm text-gray-500">{{ selectedSale.receiptNumber }}</p>
          </div>
          <button type="button" class="text-2xl text-gray-500" @click="selectedSale = null">×</button>
        </div>
        <div class="mt-5 divide-y">
          <div v-for="item in selectedSale.items" :key="item.id" class="flex justify-between gap-4 py-3">
            <div>
              <div class="font-medium">{{ item.productName }}</div>
              <div class="text-sm text-gray-500">{{ item.quantity }} × {{ money(item.unitPrice) }}</div>
            </div>
            <div class="font-medium">{{ money(item.subtotal) }}</div>
          </div>
        </div>
        <div class="mt-4 space-y-2 border-t pt-4 text-sm">
          <div class="flex justify-between"><span>ยอดก่อนลด</span><span>{{ money(selectedSale.subtotal) }}</span></div>
          <div class="flex justify-between"><span>ส่วนลด</span><span>-{{ money(selectedSale.discount) }}</span></div>
          <div class="flex justify-between"><span>ภาษี</span><span>{{ money(selectedSale.tax) }}</span></div>
          <div class="flex justify-between text-lg font-bold"><span>ยอดสุทธิ</span><span>{{ money(selectedSale.total) }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getSalesHistory } from '../../services/sales'

const loading = ref(false)
const errorMessage = ref('')
const sales = ref([])
const selectedSale = ref(null)
const filters = reactive({ search: '', paymentMethod: '', from: '', to: '' })
const pagination = reactive({ page: 1, limit: 20, total: 0, totalPages: 0 })

function money(value) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function paymentLabel(value) {
  return { CASH: 'เงินสด', QR: 'QR', CARD: 'บัตร', TRANSFER: 'โอนเงิน' }[value] || value || '-'
}

async function loadSales() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getSalesHistory({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined
    })
    sales.value = Array.isArray(data?.sales) ? data.sales : []
    Object.assign(pagination, data?.pagination || {})
  } catch (error) {
    console.error('LOAD SALES HISTORY ERROR:', error)
    sales.value = []
    errorMessage.value = error.response?.data?.message || error.response?.data?.error || error.message || 'ไม่สามารถโหลดประวัติการขายได้'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  pagination.page = 1
  loadSales()
}

function clearFilters() {
  Object.assign(filters, { search: '', paymentMethod: '', from: '', to: '' })
  pagination.page = 1
  loadSales()
}

function changePage(page) {
  pagination.page = page
  loadSales()
}

onMounted(loadSales)
</script>
