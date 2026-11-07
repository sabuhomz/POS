<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const auth = useAuthStore()
const root = ref(null)
const menuOpen = ref(false)
const settingsOpen = ref(false)
const recoveryOpen = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const error = ref('')
const success = ref('')
const recoveryEmail = ref('')
const previousRecoveryEmail = ref('')
const recoveryCode = ref('')
const recoveryCodeSent = ref(false)
const recoveryVerified = ref(false)
const editingRecoveryEmail = ref(false)
const recoveryNotice = ref('')
const recoveryError = ref('')
const sendingCode = ref(false)
const verifyingCode = ref(false)

function handleOutsideClick(event) {
  if (root.value && !root.value.contains(event.target)) menuOpen.value = false
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    menuOpen.value = false
    if (!saving.value) closeSettings()
    recoveryOpen.value = false
  }
}

function openSettings() {
  menuOpen.value = false
  error.value = ''
  success.value = ''
  settingsOpen.value = true
}

function openRecoverySettings() {
  menuOpen.value = false
  recoveryError.value = ''
  recoveryNotice.value = ''
  recoveryCode.value = ''
  recoveryCodeSent.value = false
  editingRecoveryEmail.value = false
  recoveryOpen.value = true
  loadRecoveryEmail()
}

function closeSettings() {
  if (saving.value) return
  settingsOpen.value = false
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  error.value = ''
  success.value = ''
}

async function changePassword() {
  error.value = ''
  success.value = ''

  if (newPassword.value.length < 8) {
    error.value = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน'
    return
  }

  saving.value = true
  try {
    const { data } = await api.patch('/auth/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    success.value = data.message || 'เปลี่ยนรหัสผ่านสำเร็จ'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง'
  } finally {
    saving.value = false
  }
}

async function loadRecoveryEmail() {
  try {
    const { data } = await api.get('/auth/recovery-email')
    recoveryEmail.value = data.email || ''
    previousRecoveryEmail.value = recoveryEmail.value
    recoveryVerified.value = data.verified
    editingRecoveryEmail.value = false
  } catch (requestError) {
    recoveryError.value = requestError.response?.data?.message || 'โหลดข้อมูล Gmail ไม่สำเร็จ'
  }
}

async function requestRecoveryCode() {
  recoveryError.value = ''
  recoveryNotice.value = ''
  sendingCode.value = true
  try {
    const { data } = await api.post('/auth/recovery-email/request-code', { email: recoveryEmail.value })
    recoveryNotice.value = data.message
    recoveryCodeSent.value = true
  } catch (requestError) {
    recoveryError.value = requestError.response?.data?.message || 'ส่งรหัสยืนยันไม่สำเร็จ'
  } finally {
    sendingCode.value = false
  }
}

async function verifyRecoveryCode() {
  recoveryError.value = ''
  recoveryNotice.value = ''
  verifyingCode.value = true
  try {
    const { data } = await api.post('/auth/recovery-email/verify', { email: recoveryEmail.value, code: recoveryCode.value })
    recoveryVerified.value = true
    editingRecoveryEmail.value = false
    recoveryCodeSent.value = false
    previousRecoveryEmail.value = recoveryEmail.value
    recoveryNotice.value = data.message
    recoveryCode.value = ''
  } catch (requestError) {
    recoveryError.value = requestError.response?.data?.message || 'ยืนยัน Gmail ไม่สำเร็จ'
  } finally {
    verifyingCode.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div ref="root" class="account-root">
    <button
      type="button"
      class="account-badge"
      :aria-expanded="menuOpen"
      aria-haspopup="menu"
      :title="auth.role || 'บัญชีผู้ใช้'"
      @click="menuOpen = !menuOpen"
    >
      <span class="account-avatar">
        <svg
          class="account-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.5-3.3 3.2-5.5 7-5.5s6.5 2.2 7 5.5" />
        </svg>
      </span>
      <span class="account-name">{{ auth.user?.username || 'บัญชีผู้ใช้' }}</span>
      <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clip-rule="evenodd" />
      </svg>
    </button>

    <div v-if="menuOpen" class="account-menu" role="menu">
      <div class="menu-account">
        <span class="menu-name">{{ auth.user?.username || 'บัญชีผู้ใช้' }}</span>
        <span class="menu-role">{{ auth.role }}</span>
      </div>
      <button type="button" class="menu-action" role="menuitem" @click="openSettings">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 2a1 1 0 00-.894.553L8.382 4H6.5a1 1 0 00-.98.804l-.43 2.15-1.541.77a1 1 0 00-.448 1.342l.84 1.68-.84 1.68a1 1 0 00.448 1.342l1.54.77.431 2.15A1 1 0 006.5 17h1.882l.724 1.447a1 1 0 001.788 0L11.618 17H13.5a1 1 0 00.98-.804l.43-2.15 1.541-.77a1 1 0 00.448-1.342l-.84-1.68.84-1.68a1 1 0 00-.448-1.342l-1.54-.77-.431-2.15A1 1 0 0013.5 4h-1.882l-.724-1.447A1 1 0 0010 2zm0 5a3 3 0 100 6 3 3 0 000-6z" clip-rule="evenodd" />
        </svg>
        เปลี่ยนรหัสผ่าน
      </button>
      <button type="button" class="menu-action" role="menuitem" @click="openRecoverySettings">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M2.94 6.34A2 2 0 014.8 5h10.4a2 2 0 011.86 1.34L10 10.7 2.94 6.34z" />
          <path d="M2.5 7.8v6.4A1.8 1.8 0 004.3 16h11.4a1.8 1.8 0 001.8-1.8V7.8l-7.1 4.4a.8.8 0 01-.84 0L2.5 7.8z" />
        </svg>
        Gmail กู้คืนรหัสผ่าน
      </button>
    </div>

    <Teleport to="body">
      <div v-if="settingsOpen" class="settings-backdrop" @click.self="closeSettings">
        <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
          <div class="dialog-heading">
            <div>
              <h2 id="account-settings-title">เปลี่ยนรหัสผ่าน</h2>
              <p>{{ auth.user?.username }} · {{ auth.role }}</p>
            </div>
            <button type="button" class="close-button" aria-label="ปิด" @click="closeSettings">×</button>
          </div>

          <form class="password-form" @submit.prevent="changePassword">
            <label>
              <span>รหัสผ่านปัจจุบัน</span>
              <input v-model="currentPassword" type="password" autocomplete="current-password" required>
            </label>
            <label>
              <span>รหัสผ่านใหม่</span>
              <input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required>
              <small>ต้องมีอย่างน้อย 8 ตัวอักษร</small>
            </label>
            <label>
              <span>ยืนยันรหัสผ่านใหม่</span>
              <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
            </label>

            <p v-if="error" class="form-message error-message" role="alert">{{ error }}</p>
            <p v-if="success" class="form-message success-message" role="status">{{ success }}</p>

            <div class="dialog-actions">
              <button type="button" class="cancel-button" :disabled="saving" @click="closeSettings">ปิด</button>
              <button type="submit" class="save-button" :disabled="saving">
                {{ saving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน' }}
              </button>
            </div>
          </form>
        </section>
      </div>
      <div v-if="recoveryOpen" class="settings-backdrop" @click.self="recoveryOpen = false">
        <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <div class="dialog-heading">
            <div>
              <h2 id="recovery-title">Gmail สำหรับกู้คืนรหัสผ่าน</h2>
              <p>ใช้รับรหัสเมื่อลืมรหัสผ่านเท่านั้น ไม่ใช้เข้าสู่ระบบ</p>
            </div>
            <button type="button" class="close-button" aria-label="ปิด" @click="recoveryOpen = false">×</button>
          </div>
          <form class="password-form" @submit.prevent="requestRecoveryCode">
            <label>
              <span>Gmail</span>
              <input v-model="recoveryEmail" type="email" autocomplete="email" placeholder="name@gmail.com" required :disabled="recoveryVerified && !editingRecoveryEmail">
            </label>
            <div v-if="recoveryVerified && !editingRecoveryEmail" class="verified-email-row">
              <p class="form-message success-message">ยืนยันแล้วและล็อกอีเมลนี้ไว้: {{ recoveryEmail }}</p>
              <button type="button" class="edit-email-button" @click="editingRecoveryEmail = true; recoveryCode = ''; recoveryCodeSent = false; recoveryNotice = ''; recoveryError = ''">แก้ไข Gmail</button>
            </div>
            <template v-else>
              <button type="submit" class="save-button" :disabled="sendingCode || !recoveryEmail">
                {{ sendingCode ? 'กำลังส่ง...' : 'ส่งรหัสยืนยัน' }}
              </button>
              <template v-if="recoveryCodeSent">
                <label>
                  <span>รหัสยืนยัน 6 หลัก</span>
                  <input v-model="recoveryCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456" required>
                </label>
                <div class="dialog-actions">
                  <button v-if="editingRecoveryEmail" type="button" class="cancel-button" :disabled="verifyingCode" @click="recoveryEmail = previousRecoveryEmail; editingRecoveryEmail = false; recoveryCode = ''; recoveryCodeSent = false; recoveryNotice = ''; recoveryError = ''">ยกเลิก</button>
                  <button v-else type="button" class="cancel-button" :disabled="verifyingCode" @click="recoveryCode = ''; recoveryEmail = ''; recoveryCodeSent = false; recoveryNotice = ''; recoveryError = ''">ล้าง</button>
                  <button type="button" class="save-button" :disabled="verifyingCode || recoveryCode.length !== 6" @click="verifyRecoveryCode">
                    {{ verifyingCode ? 'กำลังตรวจสอบ...' : 'ยืนยัน Gmail' }}
                  </button>
                </div>
              </template>
            </template>
            <p v-if="recoveryError" class="form-message error-message" role="alert">{{ recoveryError }}</p>
            <p v-if="recoveryNotice" class="form-message success-message" role="status">{{ recoveryNotice }}</p>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.account-root {
  position: relative;
}

.account-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  max-width: min(100%, 280px);
  padding: 4px 10px 4px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .06);
  cursor: pointer;
}

.account-badge:hover,
.account-badge:focus-visible {
  border-color: #cbd5e1;
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .12);
}

.account-avatar {
  display: inline-grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  background: #f8fafc;
  color: #4b5563;
}

.account-icon {
  display: block;
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.account-name {
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #6b7280;
}

.account-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 70;
  width: 220px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, .14);
}

.menu-account {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 13px 15px;
  border-bottom: 1px solid #f1f5f9;
}

.menu-name {
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.menu-role {
  color: #6b7280;
  font-size: 12px;
}

.menu-action {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border: 0;
  background: #fff;
  color: #374151;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.menu-action:hover {
  background: #f8fafc;
}

.menu-action svg {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, .48);
}

.settings-dialog {
  width: min(100%, 460px);
  border-radius: 16px;
  background: #fff;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .25);
}

.dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.dialog-heading h2 {
  margin: 0;
  color: #111827;
  font-size: 20px;
  font-weight: 700;
}

.dialog-heading p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.close-button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.close-button:hover {
  background: #f1f5f9;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.settings-dialog { max-height: min(90vh, 820px); overflow-y: auto; }
.verified-email-row { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.edit-email-button { border: 0; background: transparent; padding: 0; color: #2563eb; font-size: 14px; font-weight: 600; cursor: pointer; }
.edit-email-button:hover { text-decoration: underline; }

.password-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

.password-form input {
  min-height: 42px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  padding: 8px 11px;
  color: #111827;
  outline: none;
}

.password-form input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .12);
}

.password-form small {
  color: #6b7280;
  font-size: 12px;
  font-weight: 400;
}

.form-message {
  margin: 0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
}

.error-message {
  background: #fef2f2;
  color: #b91c1c;
}

.success-message {
  background: #f0fdf4;
  color: #15803d;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 5px;
}

.cancel-button,
.save-button {
  min-height: 40px;
  border-radius: 9px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-button {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}

.save-button {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.cancel-button:disabled,
.save-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}
</style>
