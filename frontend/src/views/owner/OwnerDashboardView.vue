<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">สรุปข้อมูลการขาย</h1>
      </div>

      <button
        class="rounded-lg border px-4 py-2"
        :disabled="loading"
        @click="loadDashboard"
      >
        {{ loading ? 'กำลังโหลด...' : 'รีเฟรช' }}
      </button>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-lg bg-red-50 p-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <p class="text-sm text-gray-500">ยอดขายวันนี้</p>
        <p class="mt-2 text-2xl font-bold">
          {{ formatMoney(summary.todaySales) }}
        </p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <p class="text-sm text-gray-500">จำนวนรายการขายวันนี้</p>
        <p class="mt-2 text-2xl font-bold">
          {{ summary.todayOrders }}
        </p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <p class="text-sm text-gray-500">ยอดเฉลี่ยต่อรายการ</p>
        <p class="mt-2 text-2xl font-bold">
          {{ formatMoney(summary.averageOrderValue) }}
        </p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="rounded-xl border bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold">
          สินค้าขายดี
        </h2>

        <div v-if="topProducts.length === 0" class="text-gray-500">
          ยังไม่มีข้อมูลการขาย
        </div>

        <div
          v-for="product in topProducts"
          :key="product.productId"
          class="flex items-center justify-between border-b py-3 last:border-b-0"
        >
          <div>
            <p class="font-medium">{{ product.name }}</p>
            <p class="text-sm text-gray-500">
              ขายได้ {{ product.quantity }} ชิ้น
            </p>
          </div>

          <p class="font-semibold">
            {{ formatMoney(product.totalSales) }}
          </p>
        </div>
      </section>

      <section class="rounded-xl border bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold">
          ยอดขายรายวัน
        </h2>

        <div v-if="dailySales.length === 0" class="text-gray-500">
          ยังไม่มีข้อมูลยอดขาย
        </div>

        <div
          v-for="item in dailySales"
          :key="item.date"
          class="flex items-center justify-between border-b py-3 last:border-b-0"
        >
          <span>{{ formatDate(item.date) }}</span>
          <span class="font-semibold">
            {{ formatMoney(item.totalSales) }}
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getOwnerDashboard } from '../../services/ownerDashboard'

const loading = ref(false)
const errorMessage = ref('')

const summary = ref({
  todaySales: 0,
  todayOrders: 0,
  averageOrderValue: 0
})

const topProducts = ref([])
const dailySales = ref([])

function formatMoney(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value))
}

function normalizeDashboard(data) {
  summary.value = {
    todaySales: Number(
      data.summary?.todaySales ??
      data.todaySales ??
      0
    ),
    todayOrders: Number(
      data.summary?.todayOrders ??
      data.todayOrders ??
      0
    ),
    averageOrderValue: Number(
      data.summary?.averageOrderValue ??
      data.averageOrderValue ??
      0
    )
  }

  topProducts.value =
    data.topProducts ||
    data.top_products ||
    []

  dailySales.value =
    data.dailySales ||
    data.daily_sales ||
    data.weeklySales ||
    []
}

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await getOwnerDashboard()
    normalizeDashboard(data)
  } catch (error) {
    console.error('Load owner dashboard error:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'ไม่สามารถโหลดข้อมูล Dashboard ได้'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>