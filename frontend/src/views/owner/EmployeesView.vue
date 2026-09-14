<template>
  <div class="employees-view">

    <div class="page-header">
      <div>
        <h2>จัดการบัญชีพนักงาน</h2>
        <p class="subtitle">
          บัญชีสำหรับใช้งานระบบ POS
        </p>
      </div>

      <button
        class="btn-add"
        @click="openCreateForm"
      >
        + เพิ่มพนักงาน
      </button>
    </div>

    <!-- CREATE FORM -->
    <div
      v-if="showForm"
      class="form-container"
    >
      <h3>
        {{ editingEmployee ? 'แก้ไขบัญชีพนักงาน' : 'สร้างบัญชีพนักงาน' }}
      </h3>

      <!-- เพิ่มบรรทัดนี้สำหรับ ชื่อ-นามสกุล -->
      <div class="form-row">
        <div class="input-group">
          <label>ชื่อจริง</label>
          <input
            v-model="form.firstName"
            type="text"
            placeholder="ชื่อจริงพนักงาน"
          />
        </div>

        <div class="input-group">
          <label>นามสกุล</label>
          <input
            v-model="form.lastName"
            type="text"
            placeholder="นามสกุลพนักงาน"
          />
        </div>
      </div>

      <div class="form-row mt-15">
        <div class="input-group">
          <label>Username</label>
          <input
            v-model="form.username"
            type="text"
            autocomplete="off"
            placeholder="เช่น cashier01"
            :disabled="editingEmployee" 
          />
          <small v-if="editingEmployee" class="hint-text">ไม่สามารถเปลี่ยน Username ได้</small>
        </div>

        <div class="input-group">
          <label>
            {{ editingEmployee
              ? 'Password ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)'
              : 'Password'
            }}
          </label>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />
        </div>
      </div>

      <div class="form-actions">
        <button
          class="btn-save"
          :disabled="saving"
          @click="saveEmployee"
        >
          {{ saving ? 'กำลังบันทึก...' : 'บันทึก' }}
        </button>

        <button
          class="btn-cancel"
          :disabled="saving"
          @click="closeForm"
        >
          ยกเลิก
        </button>
      </div>
    </div>

    <!-- ERROR -->
    <div
      v-if="errorMessage"
      class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- TABLE -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>ชื่อ-นามสกุล</th>
            <th>Role</th>
            <th>สร้างเมื่อ</th>
            <th>จัดการ</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="text-center">
              กำลังโหลด...
            </td>
          </tr>

          <tr v-else-if="employees.length === 0">
            <td colspan="5" class="text-center">
              ยังไม่มีบัญชีพนักงาน
            </td>
          </tr>

          <tr
            v-for="employee in employees"
            :key="employee.id"
          >
            <td>
              <strong>{{ employee.username }}</strong>
            </td>

            <td>
              <!-- แสดงชื่อและนามสกุล -->
              {{ employee.first_name }} {{ employee.last_name }}
            </td>

            <td>
              <span class="role-badge">
                EMPLOYEE
              </span>
            </td>

            <td>
              {{ formatDate(employee.created_at) }}
            </td>

            <td class="actions">
              <button
                class="btn-edit"
                @click="openEditForm(employee)"
              >
                แก้ไข
              </button>

              <button
                class="btn-delete"
                @click="deleteEmployee(employee)"
              >
                ลบบัญชี
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const API_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const employees = ref([])

const loading = ref(false)
const saving = ref(false)

const showForm = ref(false)
const editingEmployee = ref(null)

const errorMessage = ref('')

const form = ref({
  firstName: '',
  lastName: '',
  username: '',
  password: ''
})

function getHeaders() {
  const token = localStorage.getItem('access_token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true'
    }
  }
}

function resetForm() {
  form.value = {
    firstName: '',
    lastName: '',
    username: '',
    password: ''
  }
  editingEmployee.value = null
}

function openCreateForm() {
  resetForm()
  errorMessage.value = ''
  showForm.value = true
}

function openEditForm(employee) {
  editingEmployee.value = employee
  form.value = {
    firstName: employee.first_name || '',
    lastName: employee.last_name || '',
    username: employee.username,
    password: ''
  }
  errorMessage.value = ''
  showForm.value = true
}

function closeForm() {
  if (saving.value) return
  showForm.value = false
  resetForm()
}

async function fetchEmployees() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await axios.get(
      `${API_URL}/employees`,
      getHeaders()
    )
    employees.value = response.data
  } catch (error) {
    console.error(error)
    errorMessage.value =
      error.response?.data?.message ||
      'ไม่สามารถโหลดข้อมูลพนักงานได้'
  } finally {
    loading.value = false
  }
}

async function saveEmployee() {
  errorMessage.value = ''

  const firstName = form.value.firstName.trim()
  const lastName = form.value.lastName.trim()
  const username = form.value.username.trim()
  const password = form.value.password

  if (!firstName || !lastName) {
    errorMessage.value = 'กรุณากรอกชื่อและนามสกุล'
    return
  }

  if (!username) {
    errorMessage.value = 'กรุณากรอก Username'
    return
  }

  if (!editingEmployee.value && !password) {
    errorMessage.value = 'กรุณากรอกรหัสผ่าน'
    return
  }

  if (password && password.length < 8) {
    errorMessage.value = 'Password ต้องมีอย่างน้อย 8 ตัวอักษร'
    return
  }

  saving.value = true

  try {
    const payload = {
      first_name: firstName,
      last_name: lastName,
      username: username
    }

    if (password) {
      payload.password = password
    }

    if (editingEmployee.value) {
      await axios.put(
        `${API_URL}/employees/${editingEmployee.value.id}`,
        payload,
        getHeaders()
      )
      alert('แก้ไขบัญชีพนักงานสำเร็จ')
    } else {
      await axios.post(
        `${API_URL}/employees`,
        payload,
        getHeaders()
      )
      alert('สร้างบัญชีพนักงานสำเร็จ\nสามารถใช้บัญชีนี้ Login เข้า POS ได้')
    }

    closeForm()
    await fetchEmployees()

  } catch (error) {
    console.error(error)
    errorMessage.value =
      error.response?.data?.message ||
      'ไม่สามารถบันทึกข้อมูลได้'
  } finally {
    saving.value = false
  }
}

async function deleteEmployee(employee) {
  const confirmed = confirm(
    `ยืนยันการลบบัญชี "${employee.username}" ใช่หรือไม่?\n หากลบแล้ว พนักงานจะไม่สามารถเข้าสู่ระบบได้อีก`
  )

  if (!confirmed) return

  try {
    await axios.delete(
      `${API_URL}/employees/${employee.id}`,
      getHeaders()
    )

    alert('ลบบัญชีสำเร็จ')
    await fetchEmployees()

  } catch (error) {
    console.error(error)
    alert(
      error.response?.data?.message ||
      'ไม่สามารถลบบัญชีได้'
    )
  }
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString(
    'th-TH',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  )
}

onMounted(() => {
  fetchEmployees()
})
</script>

<style scoped>
.employees-view {
  padding: 20px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
}

.subtitle {
  margin: 5px 0 0;
  color: #777;
}

.form-container {
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  gap: 15px;
}

.mt-15 {
  margin-top: 15px;
}

.input-group {
  flex: 1;
}

.input-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}

.input-group input {
  width: 100%;
  padding: 10px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.input-group input:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.hint-text {
  display: block;
  margin-top: 4px;
  color: #dc3545;
  font-size: 0.8em;
}

.form-actions {
  margin-top: 20px;
}

button {
  cursor: pointer;
  border: none;
  border-radius: 5px;
  padding: 8px 14px;
  font-weight: 600;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-add {
  background: #0d6efd;
  color: white;
}

.btn-save {
  background: #198754;
  color: white;
  margin-right: 10px;
}

.btn-cancel {
  background: #6c757d;
  color: white;
}

.btn-edit {
  background: #0d6efd;
  color: white;
  margin-right: 6px;
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th,
td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background: #f1f3f5;
}

.text-center {
  text-align: center;
}

.actions {
  white-space: nowrap;
}

.role-badge {
  background: #ffc107;
  padding: 4px 9px;
  border-radius: 20px;
  font-size: 12px;
}

.error-message {
  background: #f8d7da;
  color: #842029;
  padding: 12px;
  border-radius: 5px;
  margin-bottom: 15px;
}

@media (max-width: 700px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 15px;
  }

  .form-row {
    flex-direction: column;
  }
}
</style>