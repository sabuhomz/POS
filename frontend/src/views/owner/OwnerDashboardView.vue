<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../../services/api'

const DAY = 86400000
const now = new Date()
const localDateTime = date => {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const earliest = computed(() => localDateTime(new Date(Date.now() - 365 * DAY)))
const latest = computed(() => localDateTime(new Date()))
const from = ref(localDateTime(new Date(now.getTime() - 30 * DAY)))
const to = ref(localDateTime(now))
const grain = ref('day')
const weeklyMonth = ref(localDateTime(now).slice(0, 7))
const dailySearch = ref('')
const loading = ref(false)
const errorMessage = ref('')
const dashboard = ref({
  summary: { revenue: 0, subtotal: 0, discount: 0, orders: 0, units: 0 },
  topProducts: [], dailyProducts: [], employees: [], timeline: [], recommendations: [],
  recommendationNote: ''
})

const money = value => new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', maximumFractionDigits: 2
}).format(Number(value || 0))
const count = value => new Intl.NumberFormat('th-TH').format(Number(value || 0))
const summary = computed(() => dashboard.value.summary)
const topProducts = computed(() => dashboard.value.topProducts)
const dailyProducts = computed(() => dashboard.value.dailyProducts || [])
const dailyFiltered = computed(() => dailyProducts.value.filter(item => String(item.name).toLocaleLowerCase('th').includes(dailySearch.value.trim().toLocaleLowerCase('th'))))
const dailyTotal = computed(() => dailyFiltered.value.reduce((total, item) => total + Number(item.quantity || 0), 0))
const employees = computed(() => dashboard.value.employees)
const timeline = computed(() => dashboard.value.timeline)
const recommendations = computed(() => dashboard.value.recommendations)
const toOrder = computed(() => recommendations.value.filter(row => row.decision === 'ควรสั่งเพิ่ม'))
const toPause = computed(() => recommendations.value.filter(row => row.decision === 'ชะลอสั่ง'))
const toReview = computed(() => recommendations.value.filter(row => row.decision === 'ตรวจสอบ'))
const maxRevenue = computed(() => Math.max(1, ...timeline.value.map(item => Number(item.revenue || 0))))
const rangeDays = computed(() => Math.max(0, (new Date(to.value) - new Date(from.value)) / DAY))
const maxTopQuantity = computed(() => Math.max(1, ...topProducts.value.map(item => Number(item.quantity || 0))))

function preset(days) {
  const end = new Date()
  to.value = localDateTime(end)
  from.value = localDateTime(new Date(end.getTime() - days * DAY))
  grain.value = days >= 90 ? 'month' : 'day'
  loadDashboard()
}

async function loadDashboard() {
  errorMessage.value = ''
  let start = new Date(from.value)
  let end = new Date(to.value)
  if (grain.value === 'week') {
    if (!/^\d{4}-\d{2}$/.test(weeklyMonth.value)) {
      errorMessage.value = 'กรุณาเลือกเดือนสำหรับรายงานรายสัปดาห์'
      return
    }
    const [year, month] = weeklyMonth.value.split('-').map(Number)
    start = new Date(year, month - 1, 1)
    end = new Date(Math.min(new Date(year, month, 1).getTime() - 1000, Date.now()))
    if (start > end) {
      errorMessage.value = 'เดือนที่เลือกยังมาไม่ถึง'
      return
    }
  }
  const current = Date.now()
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      start > end || start.getTime() < current - 365 * DAY - 60000 ||
      end.getTime() > current + 60000 || end - start > 365 * DAY + 60000) {
    errorMessage.value = 'กรุณาเลือกวันและเวลาให้อยู่ในช่วงย้อนหลัง 1 ปี โดยวันเริ่มต้องไม่เกินวันสิ้นสุด'
    return
  }
  loading.value = true
  try {
    const result = await api.get('/owner/dashboard/analytics', {
      params: { from: start.toISOString(), to: end.toISOString(), grain: grain.value }
    })
    dashboard.value = result.data
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'โหลดข้อมูลวิเคราะห์ยอดขายไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

const periodLabel = value => {
  if (!value) return ''
  if (grain.value === 'week') return 'สัปดาห์ ' + value.split('-W')[1]
  const parts = value.split('-')
  return grain.value === 'month' ? `${parts[1]}/${parts[0]}` : `${parts[2]}/${parts[1]}`
}
onMounted(loadDashboard)
</script>

<template>
  <div class="analytics space-y-6 p-4 md:p-6">
    <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Dashboard วิเคราะห์ยอดขาย</h1>
      </div>
      <button type="button" class="btn border border-slate-300 bg-white text-slate-800" :disabled="loading" @click="loadDashboard">
        {{ loading ? 'กำลังโหลด...' : '↻ รีเฟรชข้อมูล' }}
      </button>
    </div>

    <section class="card">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-slate-700">ช่วงด่วน:</span>
        <button v-for="option in [{days:7,label:'7 วัน'}, {days:30,label:'30 วัน'}, {days:90,label:'90 วัน'}, {days:365,label:'1 ปี'}]"
          :key="option.days" type="button" class="btn border border-slate-200 bg-slate-50"
          :disabled="loading" @click="preset(option.days)">{{ option.label }}</button>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] xl:items-end">
        <label class="block">
          <span class="mb-1 block text-sm font-semibold">เริ่มวันที่ / เวลา</span>
          <input v-model="from" type="datetime-local" :min="earliest" :max="to" class="field" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-semibold">ถึงวันที่ / เวลา</span>
          <input v-model="to" type="datetime-local" :min="from" :max="latest" class="field" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-semibold">กราฟยอดขาย</span>
          <select v-model="grain" class="field">
            <option value="day">รายวัน</option>
            <option value="month">รายเดือน</option>
            <option value="week">รายสัปดาห์ (เลือกเดือน)</option>
          </select>
        </label>
        <label v-if="grain === 'week'" class="block">
          <span class="mb-1 block text-sm font-semibold">เดือนที่ต้องการ</span>
          <input v-model="weeklyMonth" type="month" :max="localDateTime(new Date()).slice(0, 7)" class="field" />
        </label>
        <button type="button" class="btn bg-teal-700 text-white" :disabled="loading" @click="loadDashboard">แสดงผล</button>
      </div>
      <p class="mt-3 text-xs text-slate-500">{{ grain === 'week' ? 'รายสัปดาห์: แบ่งวันที่ 1–7, 8–14, 15–21, 22–28 และ 29–สิ้นเดือน' : `ช่วงที่เลือก ${rangeDays.toFixed(1)} วัน` }}</p>
    </section>

    <div v-if="errorMessage" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{{ errorMessage }}</div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <div class="card kpi">
        <p class="text-sm text-slate-500">ยอดขายสุทธิ</p>
        <strong>{{ money(summary.revenue) }}</strong>
      </div>
      <div class="card kpi">
        <p class="text-sm text-slate-500">ส่วนลดโปรโมชั่น</p>
        <strong>{{ money(summary.discount) }}</strong>
      </div>
      <div class="card kpi">
        <p class="text-sm text-slate-500">จำนวนบิล</p>
        <strong>{{ count(summary.orders) }}</strong>
      </div>
      <div class="card kpi">
        <p class="text-sm text-slate-500">สินค้าที่ขายได้</p>
        <strong>{{ count(summary.units) }} ชิ้น</strong>
      </div>
      <div class="card kpi">
        <p class="text-sm text-slate-500">เฉลี่ยต่อบิล</p>
        <strong>{{ money(summary.orders ? summary.revenue / summary.orders : 0) }}</strong>
      </div>
    </div>

    <section class="card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2>ยอดขายย้อนหลังตามช่วงเวลาที่เลือก</h2>
        <span class="text-sm text-slate-500">{{ grain === 'month' ? 'รายเดือน' : grain === 'week' ? 'รายสัปดาห์ของเดือน ' + weeklyMonth : 'รายวัน' }} · {{ timeline.length }} ช่วงที่มียอดขาย</span>
      </div>
      <div v-if="!timeline.length" class="empty">ไม่มีรายการขายในช่วงเวลาที่เลือก</div>
      <div v-else class="overflow-x-auto">
        <div class="chart">
          <div v-for="item in timeline" :key="item.period" class="bar-item"
               :title="`${item.period}: ${money(item.revenue)} · ${count(item.orders)} บิล`">
            <span class="bar-number">{{ money(item.revenue) }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ height: `${Math.max(2, Number(item.revenue || 0) / maxRevenue * 100)}%` }"></div>
            </div>
            <span class="bar-caption">{{ periodLabel(item.period) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>จำนวนสินค้าที่ขายได้ต่อวัน แยกตามรายการ</h2>
          <p class="mt-1 text-sm text-slate-500">แสดงจำนวนชิ้นและยอดขายสุทธิจากใบเสร็จที่ไม่ถูกยกเลิก ตามช่วงเวลาที่เลือก</p>
        </div>
        <input v-model="dailySearch" type="search" class="field max-w-sm" placeholder="ค้นหาชื่อสินค้า..." aria-label="ค้นหาชื่อสินค้าในรายงานรายวัน" />
      </div>
      <div v-if="!dailyFiltered.length" class="empty">ไม่มีรายการขายรายวันที่ตรงกับเงื่อนไข</div>
      <div v-else class="max-h-[550px] overflow-auto">
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>รายการสินค้า</th><th class="text-right">จำนวนที่ขาย</th><th class="text-right">ยอดขายสุทธิ</th></tr></thead>
          <tbody>
            <tr v-for="item in dailyFiltered" :key="`${item.day}-${item.productId}-${item.name}`">
              <td class="whitespace-nowrap">{{ item.day }}</td>
              <td>{{ item.name }}</td>
              <td class="text-right font-semibold">{{ count(item.quantity) }} ชิ้น</td>
              <td class="text-right">{{ money(item.revenue) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="2" class="p-3 font-bold">รวมรายการที่แสดง</td><td class="p-3 text-right font-bold">{{ count(dailyTotal) }} ชิ้น</td><td class="p-3 text-right font-bold">{{ money(dailyFiltered.reduce((total, row) => total + Number(row.revenue || 0), 0)) }}</td></tr></tfoot>
        </table>
      </div>
    </section>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="card">
        <div class="mb-4">
          <h2>สินค้าขายดี เรียงตามจำนวนขาย</h2>
        </div>
        <div v-if="!topProducts.length" class="empty">ไม่มีข้อมูลสินค้าขายดี</div>
        <div v-else class="max-h-[520px] overflow-auto">
          <table class="data-table">
            <thead><tr><th>อันดับ</th><th>สินค้า</th><th class="text-right">จำนวน</th><th class="text-right">ยอดขายสุทธิ</th></tr></thead>
            <tbody>
              <tr v-for="(product, i) in topProducts" :key="`${product.productId}-${product.name}`">
                <td class="font-bold text-teal-700">{{ i + 1 }}</td>
                <td>
                  <div class="font-medium">{{ product.name }}</div>
                  <div class="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                    <div class="h-1.5 rounded-full bg-teal-600" :style="{ width: `${Number(product.quantity) / maxTopQuantity * 100}%` }"></div>
                  </div>
                </td>
                <td class="text-right font-semibold">{{ count(product.quantity) }} ชิ้น</td>
                <td class="text-right">{{ money(product.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="mb-4">
          <h2>ยอดขายแยกตามพนักงาน</h2>
        </div>
        <div v-if="!employees.length" class="empty">ไม่มีข้อมูลพนักงานที่ขายสินค้าในช่วงนี้</div>
        <div v-else class="max-h-[520px] overflow-auto">
          <table class="data-table">
            <thead><tr><th>พนักงาน</th><th class="text-right">บิล</th><th class="text-right">ชิ้น</th><th class="text-right">ยอดขาย</th></tr></thead>
            <tbody>
              <tr v-for="employee in employees" :key="String(employee.employeeId)">
                <td class="font-medium">{{ employee.username }}</td>
                <td class="text-right">{{ count(employee.orders) }}</td>
                <td class="text-right">{{ count(employee.units) }}</td>
                <td class="text-right font-semibold">{{ money(employee.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="mb-4">
        <h2>คำแนะนำการสั่งสินค้า</h2>
      </div>
      <div class="mb-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-rose-50 p-4 text-rose-900">
          <div class="text-sm">ควรสั่งเพิ่ม</div><strong class="text-2xl">{{ count(toOrder.length) }} รายการ</strong>
        </div>
        <div class="rounded-xl bg-amber-50 p-4 text-amber-900">
          <div class="text-sm">ชะลอการสั่ง</div><strong class="text-2xl">{{ count(toPause.length) }} รายการ</strong>
        </div>
        <div class="rounded-xl bg-slate-50 p-4 text-slate-700">
          <div class="text-sm">ต้องตรวจสอบข้อมูล</div><strong class="text-2xl">{{ count(toReview.length) }} รายการ</strong>
        </div>
      </div>
      <div v-if="!recommendations.length" class="empty">ยังไม่มีสินค้าในร้าน</div>
      <div v-else class="max-h-[550px] overflow-auto">
        <table class="data-table">
          <thead>
            <tr><th>สินค้า / SKU</th><th class="text-right">ขายได้</th>
              <th class="text-right">คงเหลือ</th><th>คำแนะนำ</th><th>เหตุผล</th></tr>
          </thead>
          <tbody>
            <tr v-for="product in recommendations" :key="product.productId">
              <td><strong>{{ product.name }}</strong><div class="text-xs text-slate-500">{{ product.sku }}</div></td>
              <td class="text-right">{{ count(product.soldQuantity) }}</td>
              <td class="text-right">{{ count(product.stock) }}</td>
              <td>
                <span class="tag" :class="{
                  'bg-rose-100 text-rose-800': product.decision === 'ควรสั่งเพิ่ม',
                  'bg-amber-100 text-amber-800': product.decision === 'ชะลอสั่ง',
                  'bg-slate-100 text-slate-600': product.decision === 'ตรวจสอบ',
                  'bg-emerald-100 text-emerald-800': product.decision === 'ปกติ'
                }">{{ product.decision }}</span>
              </td>
              <td class="text-sm text-slate-600">{{ product.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.analytics { color: #1e293b; }
.card { border: 1px solid #dbe4ee; border-radius: 16px; background: white; padding: 20px; box-shadow: 0 2px 8px rgba(15,23,42,.035); min-width: 0; }
.btn { min-height: 42px; border-radius: 10px; padding: 10px 16px; font-weight: 650; cursor: pointer; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.field { display: block; width: 100%; min-height: 46px; border: 1px solid #cbd5e1; border-radius: 9px; padding: 8px 12px; background: #fff; color: #17253c; }
.kpi strong { display: block; margin-top: 10px; font-size: clamp(20px, 2vw, 26px); color: #0f766e; overflow-wrap: anywhere; }
h2 { font-size: 18px; font-weight: 750; color: #17253c; }
.empty { padding: 30px 0; text-align: center; color: #64748b; }
.data-table { width: 100%; border-collapse: collapse; min-width: 540px; }
.data-table th { text-align: left; font-size: 13px; font-weight: 700; color: #4b5f7a; background: #f1f5f9; padding: 12px; position: sticky; top: 0; z-index: 1; }
.data-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.tag { display: inline-block; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.chart { min-width: 100%; width: max-content; display: flex; height: 270px; align-items: flex-end; gap: 9px; padding: 4px 0; }
.bar-item { width: 66px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 5px; flex: 0 0 auto; }
.bar-number { font-size: 10px; line-height: 1.15; text-align: center; color: #475569; max-width: 66px; overflow-wrap: anywhere; }
.bar-track { display: flex; align-items: flex-end; width: 28px; height: 185px; background: #f1f5f9; border-radius: 6px 6px 0 0; overflow: hidden; }
.bar-fill { width: 100%; background: #0f766e; border-radius: 5px 5px 0 0; }
.bar-caption { font-size: 11px; font-weight: 650; color: #475569; white-space: nowrap; }
@media (max-width: 640px) { .card { padding: 14px; } .data-table { font-size: 13px; } }
</style>
