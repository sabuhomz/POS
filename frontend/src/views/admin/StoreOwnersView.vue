<script setup>
import { onMounted, ref } from 'vue'
import api from '../../services/api'

const users = ref([]), stores = ref([]), loading = ref(true), saving = ref(false), error = ref('')
const showPassword = ref(false)
const form = ref({ username: '', password: '', role: 'OWNER', storeId: '' })

async function load() {
  loading.value = true; error.value = ''
  try { const [u, s] = await Promise.all([api.get('/admin/users'), api.get('/admin/stores')]); users.value = u.data.users; stores.value = s.data.stores }
  catch (e) { error.value = e.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ' }
  finally { loading.value = false }
}
async function createUser() {
  error.value = ''; saving.value = true
  try {
    await api.post('/admin/users', { ...form.value, storeId: form.value.role === 'OWNER' ? Number(form.value.storeId) : null })
    form.value = { username: '', password: '', role: 'OWNER', storeId: '' }
    await load()
  } catch (e) { error.value = e.response?.data?.message || 'สร้างผู้ใช้ไม่สำเร็จ' } finally { saving.value = false }
}
async function toggle(u) {
  try { await api.patch(`/admin/users/${u.id}/status`, { isActive: !u.is_active }); await load() } catch (e) { error.value = e.response?.data?.message || 'เปลี่ยนสถานะไม่สำเร็จ' }
}
onMounted(load)
</script>
<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">จัดการบัญชี Admin / Owner</h1>
    </div>
    <div v-if="error" class="rounded-lg bg-red-50 p-3 text-red-700">{{ error }}</div>
    <section class="rounded-xl bg-white p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">สร้างผู้ใช้งาน</h2>
      <p v-if="form.role === 'OWNER'" class="mb-4 text-sm text-gray-600">บัญชี OWNER จะได้รับสิทธิ์จัดการร้านที่เลือกครบทุกสิทธิ์โดยอัตโนมัติ</p>
      <div class="grid gap-4 md:grid-cols-4">
        <input v-model="form.username" placeholder="Username" class="rounded-lg border px-3 py-2" required>
        <div class="relative">
          <input v-model="form.password" :type="showPassword ? 'text' : 'password'"
            placeholder="Password (อย่างน้อย 8 ตัว)" autocomplete="new-password"
            class="w-full rounded-lg border px-3 py-2 pr-10" required>
          <button type="button" class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800"
            :aria-label="showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'"
            :title="showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'"
            @click="showPassword = !showPassword">
            <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.3 4.5 9 7-.3 1.1-1.2 2.6-2.6 3.9M6.2 6.2C3.9 7.7 2.4 10 2 12c.7 2.5 4 7 10 7 1.1 0 2.1-.2 3-.5" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <select v-model="form.role" class="rounded-lg border px-3 py-2">
          <option value="OWNER">OWNER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select v-if="form.role === 'OWNER'" v-model="form.storeId" class="rounded-lg border px-3 py-2">
          <option value="">เลือก Store</option>
          <option v-for="s in stores.filter(x => x.status === 'ACTIVE')" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button :disabled="saving" @click="createUser"
          class="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{{ saving ? 'กำลังสร้าง...' :
          'สร้างบัญชี' }}</button>
      </div>
    </section>
    <section class="rounded-xl bg-white shadow-sm overflow-hidden">
      <div class="border-b p-5 font-semibold">บัญชีในระบบ</div>
      <div v-if="loading" class="p-5 text-gray-500">กำลังโหลด...</div>
      <table v-else class="w-full text-left text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-4">Username</th>
            <th class="p-4">Role</th>
            <th class="p-4">Store</th>
            <th class="p-4">Status</th>
            <th class="p-4">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-t">
            <td class="p-4 font-medium">{{ u.username }}</td>
            <td class="p-4">{{ u.role }}</td>
            <td class="p-4">{{ u.store_name || '-' }}</td>
            <td class="p-4">{{ u.is_active ? 'Active' : 'Inactive' }}</td>
            <td class="p-4"><button @click="toggle(u)" class="rounded border px-3 py-1">{{ u.is_active ? 'ปิดใช้งาน' :
                'เปิดใช้งาน' }}</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
