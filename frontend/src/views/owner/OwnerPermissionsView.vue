<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../services/api'

const groups = [
  { title: 'การขาย', entries: [['sale.create', 'ขายสินค้า / สแกนบาร์โค้ด'], ['sale.view', 'ดูประวัติการขาย']] },
  { title: 'สินค้าและสต็อก', entries: [['product.view', 'ดูรายการสินค้า'], ['inventory.view', 'ดูคลังสินค้า'], ['inventory.restock.request', 'ส่งคำขอเพิ่มสต็อก'], ['inventory.restock.view', 'ดูคำขอเพิ่มสต็อก']] },
  { title: 'รายงาน', entries: [['report.view', 'ดูแดชบอร์ด'], ['report.daily', 'รายงานรายวัน'], ['report.trend', 'แนวโน้มยอดขาย'], ['report.top-products', 'สินค้าขายดี'], ['report.weekly', 'รายงานรายสัปดาห์']] },
  { title: 'อื่น ๆ', entries: [['promotion.view', 'ดูโปรโมชั่น']] }
]
const employees = ref([])
const catalog = ref([])
const selectedId = ref('')
const selectedPermissions = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const selected = computed(() => employees.value.find(e => String(e.id) === String(selectedId.value)))
const availableGroups = computed(() => groups.map(g => ({ ...g, entries: g.entries.filter(([key]) => catalog.value.includes(key)) })).filter(g => g.entries.length))
const changed = computed(() => selected.value &&
  JSON.stringify([...selectedPermissions.value].sort()) !==
  JSON.stringify((selected.value.permissions || []).filter(key => catalog.value.includes(key)).sort()))

function chooseEmployee() {
  selectedPermissions.value = (selected.value?.permissions || []).filter(key => catalog.value.includes(key))
  error.value = ''
  success.value = ''
}
function toggle(key, checked) {
  selectedPermissions.value = checked
    ? [...new Set([...selectedPermissions.value, key])]
    : selectedPermissions.value.filter(p => p !== key)
  success.value = ''
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [catalogResult, employeeResult] = await Promise.all([
      api.get('/owner/permissions/catalog'),
      api.get('/owner/permissions/employees')
    ])
    catalog.value = catalogResult.data.permissions
    employees.value = employeeResult.data.employees
    if (!employees.value.some(e => String(e.id) === String(selectedId.value))) {
      selectedId.value = employees.value.length ? String(employees.value[0].id) : ''
    }
    chooseEmployee()
  } catch (e) {
    error.value = e.response?.data?.message || 'โหลดสิทธิ์พนักงานไม่สำเร็จ'
  } finally { loading.value = false }
}
async function save() {
  if (!selected.value || !changed.value || saving.value) return
  if (!window.confirm('ยืนยันการบันทึกสิทธิ์ให้ ' + selected.value.username + ' ?')) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await api.put('/owner/permissions/employees/' + selected.value.id, {
      permissions: selectedPermissions.value
    })
    selected.value.permissions = [...selectedPermissions.value]
    success.value = 'บันทึกสิทธิ์สำเร็จ พนักงานควรออกจากระบบและเข้าสู่ระบบใหม่'
  } catch (e) {
    error.value = e.response?.data?.message || 'บันทึกสิทธิ์ไม่สำเร็จ'
  } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <section class="permissions-page">
    <div class="heading">
      <div>
        <h1>กำหนดสิทธิ์พนักงาน</h1>
        <p>เจ้าของร้านเลือกการเข้าถึงของพนักงานภายในร้านตนเองได้</p>
      </div>
      <button class="secondary" type="button" :disabled="loading || saving" @click="load">↻ รีเฟรช</button>
    </div>
    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <div v-if="success" class="notice success" role="status">{{ success }}</div>
    <div class="workspace">
      <aside class="staff-panel">
        <h2>เลือกพนักงาน</h2>
        <p v-if="loading">กำลังโหลดข้อมูล...</p>
        <p v-else-if="!employees.length">ยังไม่มีพนักงานในร้าน</p>
        <button
          v-for="employee in employees" :key="employee.id"
          class="employee" :class="{ active: String(selectedId) === String(employee.id) }"
          type="button" :disabled="saving"
          @click="selectedId = String(employee.id); chooseEmployee()"
        >
          <strong>{{ employee.username }}</strong>
          <span>{{ [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'บัญชีพนักงาน' }}</span>
          <small>{{ employee.isActive ? 'เปิดใช้งาน' : 'ระงับบัญชี' }}</small>
        </button>
      </aside>
      <div class="permissions-panel">
        <template v-if="selected">
          <div class="panel-heading">
            <div>
              <h2>สิทธิ์ของ {{ selected.username }}</h2>
              <p>เลือกเฉพาะสิทธิ์ที่ต้องการให้พนักงานใช้ในแอป POS</p>
            </div>
            <span class="counter">เลือก {{ selectedPermissions.length }} สิทธิ์</span>
          </div>
          <div class="groups">
            <section v-for="group in availableGroups" :key="group.title" class="group">
              <h3>{{ group.title }}</h3>
              <div class="checks">
                <label v-for="[key, name] in group.entries" :key="key" class="check">
                  <input type="checkbox" :checked="selectedPermissions.includes(key)"
                    :disabled="saving" @change="toggle(key, $event.target.checked)" />
                  <span><strong>{{ name }}</strong><small>{{ key }}</small></span>
                </label>
              </div>
            </section>
          </div>
          <div class="toolbar">
            <button class="secondary" type="button" :disabled="!changed || saving" @click="chooseEmployee">ยกเลิกการเปลี่ยนแปลง</button>
            <button class="primary" type="button" :disabled="!changed || saving" @click="save">
              {{ saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์พนักงาน' }}
            </button>
          </div>
          <p class="footnote">สิทธิ์ผู้ดูแลระบบและการแก้ไขข้อมูลสำคัญไม่ได้เปิดให้กำหนดจากหน้านี้ เพื่อป้องกันการให้สิทธิ์เกินจำเป็น</p>
        </template>
        <p v-else>เลือกพนักงานเพื่อกำหนดสิทธิ์</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.permissions-page { max-width: 1400px; margin: 0 auto; color: #182c49; }
.heading, .panel-heading, .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.heading { margin-bottom: 22px; }
h1 { font-size: 28px; margin: 0 0 6px; }
h2 { font-size: 20px; margin: 0 0 8px; }
h3 { font-size: 17px; margin: 0 0 16px; }
p { color: #68788e; margin: 0; line-height: 1.6; }
.workspace { display: grid; grid-template-columns: minmax(230px, .8fr) minmax(0, 2fr); gap: 18px; }
.staff-panel, .permissions-panel { background: #fff; border: 1px solid #dce4ee; border-radius: 16px; padding: 22px; min-width: 0; }
.employee { display: flex; text-align: left; flex-direction: column; gap: 5px; width: 100%; padding: 15px; margin-top: 10px; background: #f8fafc; border: 1px solid #e1e8f0; border-radius: 12px; cursor: pointer; color: #223954; }
.employee.active { background: #e6f5f1; border-color: #0b8979; }
.employee span, .employee small { color: #607188; }
.panel-heading { align-items: flex-start; margin-bottom: 22px; }
.counter { white-space: nowrap; background: #e5f5f1; color: #087969; padding: 8px 12px; border-radius: 24px; font-weight: 700; }
.groups { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
.group { border: 1px solid #e1e8f0; border-radius: 13px; padding: 18px; }
.checks { display: grid; gap: 10px; }
.check { display: flex; align-items: center; gap: 12px; padding: 9px 0; cursor: pointer; }
.check input { width: 23px; height: 23px; accent-color: #087f74; flex-shrink: 0; }
.check span { display: flex; flex-direction: column; gap: 4px; }
.check small { color: #697d92; font-size: 12px; }
.toolbar { justify-content: flex-end; margin-top: 22px; flex-wrap: wrap; }
button.primary, button.secondary { min-height: 46px; padding: 11px 18px; border-radius: 10px; font-weight: 700; cursor: pointer; }
button.primary { border: 1px solid #087f74; background: #087f74; color: #fff; }
button.secondary { border: 1px solid #ccd7e3; background: #fff; color: #233d59; }
button:disabled { opacity: .55; cursor: not-allowed; }
.footnote { margin-top: 20px; font-size: 13px; }
.notice { margin: 15px 0; border-radius: 10px; padding: 14px; }
.notice.error { background: #fff1f1; color: #af2626; }
.notice.success { background: #e6f6ef; color: #08744f; }
@media (max-width: 1050px) { .workspace { grid-template-columns: 1fr; } .groups { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .heading, .panel-heading { align-items: flex-start; flex-direction: column; } .staff-panel, .permissions-panel { padding: 15px; } }
</style>
