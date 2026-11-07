<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  listStores,
  createStore,
  setStoreStatus,
  listDeleteRequests,
  reviewDeleteRequest,
  restoreDeletedStore
} from '../../services/stores'

const stores = ref([])
const requests = ref([])

const name = ref('')
const error = ref('')
const saving = ref(false)
const loading = ref(true)
const reviewing = ref(null)
const restoring = ref(null)
let requestRefreshTimer
const pendingRequests = computed(() => requests.value.filter(request => request.status === 'PENDING'))
const retainedRequests = computed(() => requests.value.filter(
  request => request.status === 'APPROVED' && !request.restored_at
))

function supportsRetention(request) {
  return Object.hasOwn(request, 'retention_until') && Object.hasOwn(request, 'restored_at')
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatRetentionDeadline(value) {
  if (!value) return '-'
  const date = new Date(value)
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(date)
  const time = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date)
  return `${day} ${time} น.`
}

function retentionExpired(request) {
  return !request.retention_until || new Date(request.retention_until).getTime() <= Date.now()
}

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

    requests.value = requestList || []
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'โหลด Store หรือคำขอลบไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

async function refreshRequests() {
  if (reviewing.value || restoring.value) return
  try {
    requests.value = await listDeleteRequests()
  } catch {
    // Keep the current list if a background refresh briefly fails.
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
  if (decision === 'APPROVED' && !supportsRetention(request)) {
    error.value = 'Backend ที่เชื่อมอยู่ยังไม่รองรับการเก็บข้อมูล 3 เดือน จึงปิดการอนุมัติไว้เพื่อป้องกันข้อมูลถูกลบถาวร กรุณาอัปเดต backend และฐานข้อมูลก่อน'
    return
  }

  reviewing.value = request.id
  error.value = ''

  try {
    const result = await reviewDeleteRequest(
      request.id,
      decision
    )

    if (decision === 'APPROVED') {
      if (!result?.retention_until) {
        throw new Error('Backend ไม่ได้ยืนยันวันหมดอายุการเก็บข้อมูล จึงยังไม่สามารถแสดงรายการเก็บรักษาได้')
      }
      requests.value = [
        ...requests.value.filter(item => item.id !== request.id),
        {
          ...request,
          status: 'APPROVED',
          decided_at: new Date().toISOString(),
          retention_until: result.retention_until,
          restored_at: null
        }
      ]
    } else {
      requests.value = requests.value.filter(item => item.id !== request.id)
    }

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

async function restore(request) {
  if (restoring.value || retentionExpired(request)) return

  const confirmed = window.confirm(`ต้องการกู้คืนร้าน "${request.store_name}" พร้อมบัญชีและข้อมูลเดิมใช่หรือไม่?`)
  if (!confirmed) return

  restoring.value = request.store_id
  error.value = ''
  try {
    await restoreDeletedStore(request.store_id)
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || 'กู้คืนร้านไม่สำเร็จ'
  } finally {
    restoring.value = null
  }
}

onMounted(() => {
  load()
  requestRefreshTimer = window.setInterval(refreshRequests, 10000)
})

onBeforeUnmount(() => {
  window.clearInterval(requestRefreshTimer)
})
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
        คำขอลบร้านจากเจ้าของร้าน
      </h2>
      <p class="mb-4 text-sm text-gray-500">
        เมื่ออนุมัติ ร้านจะถูกปิดและปิดบัญชีผู้ใช้ ข้อมูลทั้งหมดเก็บไว้ 3 เดือน โดยสามารถกู้คืนได้ก่อนหมดกำหนด
      </p>
      <p class="mb-4 text-xs text-gray-400">คิวคำขออัปเดตอัตโนมัติทุก 10 วินาที</p>
      <p v-if="pendingRequests.some(request => !supportsRetention(request))"
        class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        Backend ที่เชื่อมอยู่ยังไม่รองรับการเก็บข้อมูล 3 เดือน ปุ่มอนุมัติจะถูกปิดไว้จนกว่าจะอัปเดต backend และฐานข้อมูล
      </p>

      <div v-if="!pendingRequests.length" class="text-gray-500">
        ไม่มีคำขอรออนุมัติ
      </div>

      <div v-for="request in pendingRequests" :key="request.id"
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

          <button @click="review(request, 'APPROVED')" :disabled="reviewing === request.id || !supportsRetention(request)"
            class="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50">
            {{
              reviewing === request.id
                ? 'กำลังดำเนินการ...'
                : 'อนุมัติลบ (เก็บข้อมูล 3 เดือน)'
            }}
          </button>

          <button @click="review(request, 'REJECTED')" :disabled="reviewing === request.id"
            class="rounded border px-3 py-1 disabled:opacity-50">
            ปฏิเสธ
          </button>

        </div>

      </div>

    </section>

    <section class="rounded-xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-semibold">ร้านที่อนุมัติลบ: เก็บข้อมูลไว้ 3 เดือน</h2>
      <p class="mb-4 mt-1 text-sm text-gray-500">
        บัญชีพนักงาน สินค้า ประวัติการขาย และข้อมูลที่เกี่ยวข้องยังเก็บไว้จนถึงเวลาที่ระบุ สามารถกู้คืนร้านได้ก่อนหมดกำหนด
      </p>

      <div v-if="!retainedRequests.length" class="text-gray-500">
        ไม่มีร้านที่อยู่ระหว่างเก็บข้อมูล
      </div>

      <div v-for="request in retainedRequests" :key="`retained-${request.id}`"
        class="flex flex-col gap-4 border-t py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="font-medium">{{ request.store_name || `Store #${request.store_id}` }}</p>
          <p class="text-sm text-gray-500">
            อนุมัติเมื่อ {{ formatDate(request.decided_at) }} · เก็บข้อมูลถึง {{ formatRetentionDeadline(request.retention_until) }}
          </p>
          <p class="text-sm text-gray-500">
            พนักงาน {{ request.employee_count }} คน · สินค้า {{ request.product_count }} รายการ
          </p>
          <p v-if="retentionExpired(request)" class="mt-1 text-sm font-medium text-red-600">
            หมดระยะเวลาเก็บแล้ว ข้อมูลจะถูกล้างโดยระบบ
          </p>
        </div>
        <button @click="restore(request)" :disabled="restoring === request.store_id || retentionExpired(request)"
          class="shrink-0 rounded-lg border border-blue-600 px-4 py-2 text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {{ restoring === request.store_id ? 'กำลังกู้คืน...' : 'กู้คืนร้าน' }}
        </button>
      </div>
    </section>

  </div>
</template>
