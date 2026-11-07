<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()
const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const requested = ref(false)
const loading = ref(false)
const error = ref('')
const message = ref('')

async function requestCode() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.post('/auth/password-reset/request-code', { email: email.value })
    requested.value = true
    message.value = data.message
  } catch (e) {
    error.value = e.response?.data?.message || 'ส่งรหัสกู้คืนไม่สำเร็จ'
  } finally { loading.value = false }
}

async function resetPassword() {
  error.value = ''
  message.value = ''
  if (newPassword.value.length < 8) { error.value = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'; return }
  if (newPassword.value !== confirmPassword.value) { error.value = 'ยืนยันรหัสผ่านไม่ตรงกัน'; return }
  loading.value = true
  try {
    const { data } = await api.post('/auth/password-reset/confirm', {
      email: email.value, code: code.value, newPassword: newPassword.value,
    })
    message.value = data.message
    setTimeout(() => router.push('/login'), 1200)
  } catch (e) {
    error.value = e.response?.data?.message || 'กู้คืนรหัสผ่านไม่สำเร็จ'
  } finally { loading.value = false }
}
</script>

<template>
  <section class="w-full max-w-md rounded-xl bg-white p-8 shadow">
    <h1 class="text-2xl font-bold">กู้คืนรหัสผ่าน</h1>
    <p class="mb-6 mt-1 text-sm text-gray-500">ใช้ Gmail ที่ผูกไว้กับบัญชีเพื่อรับรหัสกู้คืนเท่านั้น</p>
    <p v-if="error" class="mb-4 rounded bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="message" class="mb-4 rounded bg-green-50 p-3 text-sm text-green-700" role="status">{{ message }}</p>
    <form v-if="!requested" class="space-y-4" @submit.prevent="requestCode">
      <label class="block text-sm font-medium">Gmail
        <input v-model="email" type="email" required autocomplete="email" placeholder="name@gmail.com" class="mt-1 w-full rounded-lg border px-3 py-2">
      </label>
      <button :disabled="loading" class="w-full rounded-lg bg-blue-600 py-2 text-white disabled:opacity-50">{{ loading ? 'กำลังส่ง...' : 'ส่งรหัสกู้คืน' }}</button>
    </form>
    <form v-else class="space-y-4" @submit.prevent="resetPassword">
      <label class="block text-sm font-medium">รหัส 6 หลัก
        <input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required class="mt-1 w-full rounded-lg border px-3 py-2">
      </label>
      <label class="block text-sm font-medium">รหัสผ่านใหม่
        <input v-model="newPassword" type="password" minlength="8" autocomplete="new-password" required class="mt-1 w-full rounded-lg border px-3 py-2">
      </label>
      <label class="block text-sm font-medium">ยืนยันรหัสผ่านใหม่
        <input v-model="confirmPassword" type="password" minlength="8" autocomplete="new-password" required class="mt-1 w-full rounded-lg border px-3 py-2">
      </label>
      <button :disabled="loading" class="w-full rounded-lg bg-blue-600 py-2 text-white disabled:opacity-50">{{ loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่' }}</button>
      <button type="button" class="w-full text-sm text-blue-600 hover:underline" @click="requested = false; message = ''; code = ''">ขอรหัสอีกครั้ง</button>
    </form>
    <RouterLink to="/login" class="mt-5 block text-center text-sm text-gray-600 hover:underline">กลับไปหน้าเข้าสู่ระบบ</RouterLink>
  </section>
</template>
