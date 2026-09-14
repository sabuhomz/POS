<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAdminDashboard } from '../../services/adminDashboard'

const loading = ref(true)
const error = ref('')
const stores = ref([])

const totalStores = computed(() => stores.value.length)

async function loadDashboard() {
  loading.value = true
  error.value = ''

  try {
    const data = await getAdminDashboard()

    stores.value = data.stores || []
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'ไม่สามารถโหลดข้อมูล Dashboard ได้'
  } finally {
    loading.value = false
  }
}

function formatDate(date) {
  if (!date) return '-'

  return new Date(date).toLocaleDateString('th-TH')
}

function statusText(status) {
  if (status === 'suspended') return 'Suspended'
  return 'Active'
}

onMounted(loadDashboard)
</script>

<template>
  <div class="space-y-6">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">
        Admin Dashboard
      </h1>

      <p class="mt-1 text-sm text-gray-500">
        ภาพรวมการจัดการร้านค้า
      </p>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="rounded-lg bg-red-50 p-4 text-red-700"
    >
      {{ error }}
    </div>

    <!-- Summary -->
    <div class="grid gap-5 md:grid-cols-3">

      <div class="rounded-xl bg-white p-6 shadow-sm">
        <p class="text-sm text-gray-500">
          จำนวนร้านทั้งหมด
        </p>

        <div
          v-if="loading"
          class="mt-3 text-gray-400"
        >
          กำลังโหลด...
        </div>

        <div v-else class="mt-3">
          <span class="text-3xl font-bold text-gray-900">
            {{ totalStores }}
          </span>

          <span class="ml-2 text-sm text-gray-500">
            ร้าน
          </span>
        </div>
      </div>

    </div>

    <!-- Stores Table -->
    <div class="overflow-hidden rounded-xl bg-white shadow-sm">

      <div class="border-b p-5">
        <h2 class="text-lg font-semibold text-gray-900">
          ร้านค้าทั้งหมด
        </h2>

        <p class="mt-1 text-sm text-gray-500">
          รายชื่อร้านและเจ้าของร้านในระบบ
        </p>
      </div>

      <div
        v-if="loading"
        class="p-10 text-center text-gray-500"
      >
        กำลังโหลดข้อมูลร้านจาก API...
      </div>

      <div
        v-else-if="!stores.length"
        class="p-10 text-center text-gray-500"
      >
        ยังไม่มีข้อมูลร้านค้า
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">

          <thead class="border-b bg-gray-50 text-sm text-gray-500">
            <tr>
              <th class="p-4">#</th>
              <th class="p-4">ชื่อร้าน</th>
              <th class="p-4">เจ้าของร้าน</th>
              <th class="p-4">สถานะ</th>
              <th class="p-4">วันที่สร้าง</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(store, index) in stores"
              :key="store.id"
              class="border-b last:border-b-0 hover:bg-gray-50"
            >
              <td class="p-4 text-gray-500">
                {{ index + 1 }}
              </td>

              <td class="p-4 font-medium text-gray-900">
                {{ store.name }}
              </td>

              <td class="p-4 text-gray-700">
                {{
                  store.owner_name ||
                  store.ownerName ||
                  store.owner?.name ||
                  store.owner?.username ||
                  '-'
                }}
              </td>

              <td class="p-4">
                <span
                  class="rounded-full px-3 py-1 text-xs"
                  :class="
                    store.status === 'suspended'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  "
                >
                  {{ statusText(store.status) }}
                </span>
              </td>

              <td class="p-4 text-gray-600">
                {{
                  formatDate(
                    store.created_at ||
                    store.createdAt
                  )
                }}
              </td>
            </tr>
          </tbody>

        </table>
      </div>

    </div>

  </div>
</template>