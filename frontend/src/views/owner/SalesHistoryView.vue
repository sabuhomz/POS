<template>
  <div class="space-y-6">
    <div class="rounded-xl bg-white p-6 shadow">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">ประวัติการขาย</h1>
          
        </div>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="loading" @click="loadSales">
          {{ loading ? 'กำลังโหลด...' : 'รีเฟรช' }}
        </button>
      </div>
    </div>

    <section class="overflow-hidden rounded-xl border border-blue-100 bg-white shadow">
      <div class="flex flex-wrap items-end justify-between gap-4 border-b bg-blue-50/70 p-6">
        <div>
          <h2 class="text-lg font-bold">ยอดขายแยกตามกะพนักงาน</h2>
          
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <label class="text-sm text-gray-700">ตั้งแต่
            <input v-model="shiftFrom" type="date" class="mt-1 block rounded-lg border bg-white px-3 py-2">
          </label>
          <label class="text-sm text-gray-700">ถึง
            <input v-model="shiftTo" type="date" class="mt-1 block rounded-lg border bg-white px-3 py-2">
          </label>
          <button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" :disabled="shiftLoading" @click="loadShifts">
            {{ shiftLoading ? 'กำลังโหลด...' : 'ค้นหากะ' }}
          </button>
        </div>
      </div>

      <p v-if="shiftError" class="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ shiftError }}</p>

      <div class="grid gap-3 border-b p-5 sm:grid-cols-3">
        <div class="rounded-lg bg-gray-50 p-4"><p class="text-sm text-gray-500">จำนวนกะ</p><p class="mt-1 text-xl font-bold">{{ shiftRows.length }}</p></div>
        <div class="rounded-lg bg-gray-50 p-4"><p class="text-sm text-gray-500">จำนวนบิลในกะ</p><p class="mt-1 text-xl font-bold">{{ shiftOrderCount }}</p></div>
        <div class="rounded-lg bg-gray-50 p-4"><p class="text-sm text-gray-500">ยอดขายรวมในกะ</p><p class="mt-1 text-xl font-bold text-blue-700">{{ money(shiftSalesTotal) }}</p></div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b bg-gray-50">
            <tr>
              <th class="px-4 py-3">พนักงาน</th>
              <th class="px-4 py-3">เริ่มกะ</th>
              <th class="px-4 py-3">จบกะ</th>
              <th class="px-4 py-3 text-right">บิล</th>
              <th class="px-4 py-3 text-right">ยอดขาย</th>
              <th class="px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="shiftLoading"><td colspan="6" class="p-8 text-center text-gray-500">กำลังโหลดรายงานกะ...</td></tr>
            <tr v-else-if="shiftRows.length === 0"><td colspan="6" class="p-8 text-center text-gray-500">ไม่พบกะในช่วงวันที่เลือก</td></tr>
            <template v-else>
              <tr v-for="shift in shiftRows" :key="shift.id" class="border-b last:border-0 hover:bg-gray-50">
                <td class="whitespace-nowrap px-4 py-3 font-medium">{{ shift.employeeUsername }}</td>
                <td class="whitespace-nowrap px-4 py-3">{{ formatDate(shift.startedAt) }}</td>
                <td class="whitespace-nowrap px-4 py-3">{{ shift.endedAt ? formatDate(shift.endedAt) : '-' }}</td>
                <td class="px-4 py-3 text-right">{{ shift.orderCount }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right font-semibold">{{ money(shift.totalSales) }}</td>
                <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs" :class="shift.endedAt ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'">{{ shift.endedAt ? 'จบกะแล้ว' : 'กำลังทำงาน' }}</span></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-xl border bg-white p-5 shadow">
      <div class="mb-4">
        <h2 class="text-lg font-bold">ประวัติยอดขายย้อนหลังของสินค้าที่เลือก</h2>
        <p class="mt-1 text-sm text-gray-500">แสดงจำนวนขายและยอดขายสุทธิรายวันของสินค้ารายการเดียว โดยไม่นับบิลที่ยกเลิกแล้ว</p>
      </div>
      <form class="grid gap-3 md:grid-cols-4 md:items-end" @submit.prevent="loadProductHistory">
        <label class="text-sm font-medium">เลือกสินค้า
          <select v-model="selectedProductId" class="mt-1 block w-full rounded-lg border bg-white px-3 py-2" required>
            <option value="">เลือกสินค้า...</option>
            <option v-for="product in productCatalog" :key="product.id" :value="String(product.id)">{{ product.name }} ({{ product.sku }})</option>
          </select>
        </label>
        <label class="text-sm font-medium">ตั้งแต่วันที่
          <input v-model="productFrom" type="date" :max="productTo" class="mt-1 block w-full rounded-lg border px-3 py-2" required />
        </label>
        <label class="text-sm font-medium">ถึงวันที่
          <input v-model="productTo" type="date" :min="productFrom" class="mt-1 block w-full rounded-lg border px-3 py-2" required />
        </label>
        <button type="submit" class="rounded-lg bg-teal-700 px-4 py-2 font-bold text-white disabled:opacity-50" :disabled="productLoading || !selectedProductId">{{ productLoading ? 'กำลังโหลด...' : 'ดูยอดขายสินค้า' }}</button>
      </form>
      <p v-if="productError" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ productError }}</p>
      <template v-if="productHistory">
        <div class="my-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg bg-gray-50 p-4">รวมขายได้ <strong class="block text-xl">{{ productHistory.summary.quantity }} ชิ้น</strong></div>
          <div class="rounded-lg bg-gray-50 p-4">ยอดขายสุทธิ <strong class="block text-xl">{{ money(productHistory.summary.revenue) }}</strong></div>
          <div class="rounded-lg bg-gray-50 p-4">จำนวนบิล <strong class="block text-xl">{{ productHistory.summary.orders }} บิล</strong></div>
        </div>
        <div v-if="!productHistory.rows.length" class="py-6 text-center text-gray-500">ไม่พบยอดขายสินค้านี้ในช่วงวันที่เลือก</div>
        <div v-else class="max-h-[390px] overflow-auto rounded-lg border">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead class="sticky top-0 bg-gray-100"><tr><th class="p-3">วันที่</th><th class="p-3 text-right">จำนวนขาย</th><th class="p-3 text-right">จำนวนบิล</th><th class="p-3 text-right">ยอดขายสุทธิ</th></tr></thead>
            <tbody>
              <tr v-for="row in productHistory.rows" :key="row.day" class="border-t">
                <td class="p-3">{{ row.day }}</td><td class="p-3 text-right">{{ row.quantity }} ชิ้น</td>
                <td class="p-3 text-right">{{ row.orders }}</td><td class="p-3 text-right">{{ money(row.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <div class="rounded-xl bg-white p-6 shadow">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">ค้นหา</label>
          <input v-model="filters.search" type="text" placeholder="เลขที่ใบเสร็จ / พนักงาน / สินค้า" class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-500" @keyup.enter="applyFilters" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">การชำระเงิน</label>
          <select v-model="filters.paymentMethod" class="w-full rounded-lg border border-gray-300 px-3 py-2">
            <option value="QR">QR</option>
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
              <td class="px-4 py-3 font-medium">{{ sale.receiptNumber }}<span v-if="sale.correctionStatus === 'VOID'" class="ml-2 rounded bg-red-100 px-2 py-1 text-xs text-red-700">ยกเลิกแล้ว</span></td>
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
            <p class="text-sm text-gray-500">{{ selectedSale.receiptNumber }}</p> <span v-if="selectedSale.correctionStatus === 'VOID'" class="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">ใบเสร็จยกเลิกแล้ว · ไม่รวมในยอดขาย</span> <p class="text-sm text-gray-500">{{ formatDate(selectedSale.createdAt) }}</p> <p class="text-sm text-gray-500">ผู้ขาย: {{ selectedSale.employeeUsername }}</p>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { getSalesHistory } from '../../services/sales'
import api from '../../services/api'

const loading = ref(false)
const errorMessage = ref('')
const sales = ref([])
const selectedSale = ref(null)
const filters = reactive({ search: '', paymentMethod: '', from: '', to: '' })
const pagination = reactive({ page: 1, limit: 20, total: 0, totalPages: 0 })
const shiftRows = ref([])
const productCatalog = ref([])
const selectedProductId = ref('')
const productHistory = ref(null)
const productLoading = ref(false)
const productError = ref('')
const shiftLoading = ref(false)
const shiftError = ref('')
const today = new Date()
const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const shiftFrom = ref(localToday)
const shiftTo = ref(localToday)
const productTo = ref(localToday)
const productFrom = ref((() => { const d = new Date(); d.setDate(d.getDate() - 30); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })())
const shiftOrderCount = computed(() => shiftRows.value.reduce((sum, shift) => sum + Number(shift.orderCount || 0), 0))
const shiftSalesTotal = computed(() => shiftRows.value.reduce((sum, shift) => sum + Number(shift.totalSales || 0), 0))

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

async function loadShifts() {
  shiftLoading.value = true
  shiftError.value = ''
  try {
    const { data } = await api.get('/owner/shifts', {
      params: { from: shiftFrom.value || undefined, to: shiftTo.value || undefined }
    })
    shiftRows.value = Array.isArray(data?.shifts) ? data.shifts : []
  } catch (error) {
    shiftRows.value = []
    shiftError.value = error.response?.data?.message || 'ไม่สามารถโหลดรายงานกะพนักงานได้'
  } finally {
    shiftLoading.value = false
  }
}

async function loadProductCatalog() {
  try {
    const { data } = await api.get('/products')
    productCatalog.value = Array.isArray(data) ? data : (data.products || [])
  } catch (error) {
    productError.value = error.response?.data?.message || 'โหลดรายการสินค้าไม่สำเร็จ'
  }
}

async function loadProductHistory() {
  if (!selectedProductId.value) return
  productLoading.value = true
  productError.value = ''
  productHistory.value = null
  try {
    const { data } = await api.get('/owner/product-sales-history', {
      params: { productId: selectedProductId.value, from: productFrom.value, to: productTo.value }
    })
    productHistory.value = data
  } catch (error) {
    productError.value = error.response?.data?.message || 'โหลดประวัติยอดขายสินค้าไม่สำเร็จ'
  } finally {
    productLoading.value = false
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

onMounted(() => {
  loadSales()
  loadShifts()
  loadProductCatalog()
})
</script>
