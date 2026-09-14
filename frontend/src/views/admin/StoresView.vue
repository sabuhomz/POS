<script setup>
import { onMounted, ref } from 'vue'
import {
  listStores,
  createStore,
  setStoreStatus,
  listDeleteRequests,
  reviewDeleteRequest
} from '../../services/stores'

const stores = ref([])
const requests = ref([])

const name = ref('')
const error = ref('')
const saving = ref(false)
const loading = ref(true)
const reviewing = ref(null)

async function load() {
  loading.value = true
  error.value = ''

  try {
    const storeList = await listStores()
    const requestList = await listDeleteRequests()

    // ไม่แสดงร้านที่ถูกลบ
    stores.value = (storeList || []).filter(
      store => store.status !== 'DELETED'
    )

    // แสดงเฉพาะคำขอที่ยัง PENDING
    requests.value = (requestList || []).filter(
      request => (request.status || 'PENDING') === 'PENDING'
    )
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'โหลด Store หรือคำขอลบไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!name.value.trim()) return

  saving.value = true
  error.value = ''

  try {
    await createStore(name.value.trim())

    name.value = ''

    await load()
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'สร้าง Store ไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

async function toggle(store) {
  error.value = ''

  const next =
    store.status === 'SUSPENDED'
      ? 'ACTIVE'
      : 'SUSPENDED'

  try {
    await setStoreStatus(store.id, next)

    await load()
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'เปลี่ยนสถานะร้านไม่สำเร็จ'
  }
}

async function review(request, decision) {
  if (reviewing.value) return

  reviewing.value = request.id
  error.value = ''

  try {
    await reviewDeleteRequest(
      request.id,
      decision
    )

    // เอาคำขอนี้ออกจากหน้าจอทันที
    requests.value = requests.value.filter(
      item => item.id !== request.id
    )

    // โหลดข้อมูลใหม่อีกครั้ง
    await load()

  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'ดำเนินการคำขอไม่สำเร็จ'
  } finally {
    reviewing.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold">
        จัดการ Store
      </h1>

      <p class="text-sm text-gray-500">
        Admin สร้างร้าน ระงับร้าน และอนุมัติคำขอลบร้าน
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded bg-red-50 p-3 text-red-700">
      {{ error }}
    </div>

    <!-- Create Store -->
    <div class="flex gap-3 rounded-xl bg-white p-5 shadow-sm">
      <input v-model="name" placeholder="ชื่อร้าน" class="flex-1 rounded-lg border px-3 py-2" @keyup.enter="create" />

      <button @click="create" :disabled="saving"
        class="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:opacity-50">
        {{ saving ? 'กำลังสร้าง...' : 'สร้าง Store' }}
      </button>
    </div>

    <!-- Stores -->
    <div class="rounded-xl bg-white shadow-sm">

      <div v-if="loading" class="p-5 text-gray-500">
        กำลังโหลด...
      </div>

      <div v-for="store in stores" :key="store.id" class="flex items-center justify-between border-b p-5 last:border-0">
        <div>
          <p class="font-medium">
            {{ store.name }}
          </p>

          <p class="text-sm text-gray-500">
            ID: {{ store.id }}
          </p>
        </div>

        <div class="flex items-center gap-3">

          <span :class="store.status === 'ACTIVE'
              ? 'text-green-600'
              : 'text-red-600'
            ">
            {{ store.status }}
          </span>

          <button @click="toggle(store)" class="rounded border px-3 py-1 text-sm">
            {{
              store.status === 'SUSPENDED'
                ? 'เปิดใช้งาน'
                : 'ระงับร้าน'
            }}
          </button>

        </div>
      </div>

      <div v-if="!loading && !stores.length" class="p-5 text-gray-500">
        ยังไม่มีร้าน
      </div>

    </div>

    <!-- Delete Requests -->
    <section class="rounded-xl bg-white p-5 shadow-sm">

      <h2 class="mb-4 text-lg font-semibold">
        คำขอลบร้านจาก Owner
      </h2>

      <div v-if="!requests.length" class="text-gray-500">
        ไม่มีคำขอรออนุมัติ
      </div>

      <div v-for="request in requests" :key="request.id"
        class="flex flex-col gap-3 border-b py-4 last:border-0 md:flex-row md:items-center md:justify-between">

        <div>

          <p class="font-medium">
            {{
              request.store_name ||
              request.storeName ||
              `Store #${request.store_id}`
            }}
          </p>

          <p class="text-sm text-gray-500">
            เหตุผล:
            {{ request.reason || '-' }}
          </p>

          <p class="text-xs text-gray-400">
            สถานะ:
            {{ request.status || 'PENDING' }}
          </p>

        </div>

        <div v-if="(request.status || 'PENDING') === 'PENDING'" class="flex gap-2">

          <button @click="review(request, 'APPROVED')" :disabled="reviewing === request.id"
            class="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50">
            {{
              reviewing === request.id
                ? 'กำลังดำเนินการ...'
                : 'อนุมัติลบ'
            }}
          </button>

          <button @click="review(request, 'REJECTED')" :disabled="reviewing === request.id"
            class="rounded border px-3 py-1 disabled:opacity-50">
            ปฏิเสธ
          </button>

        </div>

      </div>

    </section>

  </div>
</template>