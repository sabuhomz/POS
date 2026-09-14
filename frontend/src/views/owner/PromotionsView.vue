<template>
  <div class="space-y-6 p-6">

    <!-- Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          โปรโมชั่น
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          สร้างและกำหนดกติกาโปรโมชั่นด้วยตัวเอง
        </p>
      </div>

      <button
        type="button"
        class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        @click="openCreate"
      >
        + สร้างโปรโมชั่น
      </button>
    </div>


    <!-- Error -->
    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ errorMessage }}
    </div>


    <!-- Promotion list -->
    <div class="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">

          <thead class="border-b bg-gray-50">
            <tr>
              <th class="p-4">โปรโมชั่น</th>
              <th class="p-4">ประเภท</th>
              <th class="p-4">สินค้า</th>
              <th class="p-4">ช่วงเวลา</th>
              <th class="p-4">สถานะ</th>
              <th class="p-4">จัดการ</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="p-8 text-center text-gray-500">
                กำลังโหลด...
              </td>
            </tr>

            <tr v-else-if="promotions.length === 0">
              <td colspan="6" class="p-8 text-center text-gray-500">
                ยังไม่มีโปรโมชั่น
              </td>
            </tr>

            <tr
              v-for="promotion in promotions"
              :key="promotion.id"
              class="border-b hover:bg-gray-50"
            >
              <td class="p-4">
                <div class="font-medium text-gray-900">
                  {{ promotion.name }}
                </div>
                <div
                  v-if="promotion.description"
                  class="mt-1 text-xs text-gray-500"
                >
                  {{ promotion.description }}
                </div>
              </td>

              <td class="p-4">
                {{ getTypeLabel(promotion.promotion_type) }}
              </td>

              <td class="p-4">
                <div class="max-w-xs space-y-1">
                  <div
                    v-for="product in promotion.products || []"
                    :key="product.product_id"
                    class="text-xs"
                  >
                    {{ product.product_name }}
                    <!-- แสดงจำนวนเฉพาะตอนจัดเซ็ต BUNDLE_PRICE -->
                    <span v-if="promotion.promotion_type === 'BUNDLE_PRICE'">
                      × {{ product.required_quantity }}
                    </span>
                  </div>

                  <div
                    v-if="!promotion.products || promotion.products.length === 0"
                    class="text-xs text-gray-400"
                  >
                    สินค้าทั้งหมด
                  </div>
                </div>
              </td>

              <td class="p-4 text-xs">
                <div>
                  {{ formatDate(promotion.start_at) }}
                </div>
                <div v-if="promotion.end_at">
                  ถึง {{ formatDate(promotion.end_at) }}
                </div>
                <div v-else>
                  ไม่มีกำหนดสิ้นสุด
                </div>
              </td>

              <td class="p-4">
                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="
                    promotion.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  "
                >
                  {{ promotion.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
                </span>
              </td>

              <td class="p-4">
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg border px-3 py-1 hover:bg-gray-100"
                    @click="openEdit(promotion)"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border px-3 py-1 hover:bg-gray-100"
                    @click="toggle(promotion)"
                  >
                    {{ promotion.is_active ? 'ปิด' : 'เปิด' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                    @click="remove(promotion)"
                  >
                    ลบ
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- Builder Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeModal"
    >
      <div
        class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <!-- Modal Header -->
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold">
              {{ editingPromotion ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่น' }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              OWNER สามารถกำหนดกติกาเองได้
            </p>
          </div>
          <button
            type="button"
            class="text-2xl text-gray-500 hover:text-gray-900"
            @click="closeModal"
          >
            ×
          </button>
        </div>

        <!-- Basic -->
        <div class="grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">ชื่อโปรโมชั่น</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full rounded-lg border px-3 py-2"
              placeholder="เช่น ซื้อครบ 500 บาท ลด 10%"
            />
          </div>

          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">รายละเอียด</label>
            <textarea
              v-model="form.description"
              rows="2"
              class="w-full rounded-lg border px-3 py-2"
              placeholder="รายละเอียดโปรโมชั่น"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium">ประเภทโปรโมชั่น</label>
            <select
              v-model="form.promotion_type"
              class="w-full rounded-lg border px-3 py-2"
            >
              <option value="BUNDLE_PRICE">จัดเซ็ต: สินค้าหลายรายการ → ราคาพิเศษ</option>
              <option value="PERCENT_DISCOUNT">ส่วนลด: ลดเป็นเปอร์เซ็นต์</option>
              <option value="FIXED_DISCOUNT">ส่วนลด: ลดเป็นจำนวนเงิน</option>
              <option value="QUANTITY_PRICE">ซื้อครบจำนวน → ราคาพิเศษ</option>
              <option value="QUANTITY_PERCENT">ซื้อครบจำนวน → ลด %</option>
              <option value="QUANTITY_FIXED">ซื้อครบจำนวน → ลดเงิน</option>
              <option value="AMOUNT_PERCENT">ซื้อครบยอด → ลด %</option>
              <option value="AMOUNT_FIXED">ซื้อครบยอด → ลดเงิน</option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium">Priority (ลำดับความสำคัญ)</label>
            <input
              v-model.number="form.priority"
              type="number"
              min="0"
              class="w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>

        <!-- Products -->
        <div class="mt-6 rounded-xl border p-4">
          <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="font-semibold">สินค้าที่ร่วมโปรโมชั่น</h3>
              <p class="text-xs text-gray-500">เลือกสินค้าได้หลายรายการ</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              @click="toggleSelectAllProducts"
            >
              {{ allFilteredProductsSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกสินค้าทั้งหมด' }}
            </button>
          </div>

          <!-- Search -->
          <input
            v-model="productSearch"
            type="search"
            class="mb-3 w-full rounded-lg border px-3 py-2"
            placeholder="ค้นหาชื่อสินค้า หรือ SKU..."
          />

          <!-- Product selector -->
          <div class="max-h-60 overflow-y-auto rounded-lg border">
            <button
              v-for="product in filteredProducts"
              :key="product.id"
              type="button"
              class="flex w-full items-center justify-between border-b p-3 text-left hover:bg-gray-50"
              @click="toggleProduct(product)"
            >
              <div>
                <div class="font-medium">{{ product.name }}</div>
                <div class="text-xs text-gray-500">
                  SKU: {{ product.sku || '-' }} · {{ formatMoney(product.price) }}
                </div>
              </div>
              <div
                class="flex h-5 w-5 items-center justify-center rounded border"
                :class="isSelected(product.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'"
              >
                {{ isSelected(product.id) ? '✓' : '' }}
              </div>
            </button>
            <div v-if="filteredProducts.length === 0" class="p-5 text-center text-sm text-gray-500">
              ไม่พบสินค้า
            </div>
          </div>

          <!-- Selected -->
          <div v-if="form.products.length" class="mt-4 space-y-2">
            <div
              v-for="item in form.products"
              :key="item.product_id"
              class="flex items-center justify-between rounded-lg bg-gray-50 p-3"
            >
              <div>
                <div class="font-medium">{{ getProductName(item.product_id) }}</div>
                <div class="text-xs text-gray-500">
                  ราคาปกติ {{ formatMoney(getProductPrice(item.product_id)) }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- ซ่อนจำนวนถ้าไม่ใช่การจัดเซ็ต -->
                <template v-if="form.promotion_type === 'BUNDLE_PRICE'">
                  <label class="text-xs text-gray-500">จำนวนในเซ็ต</label>
                  <input
                    v-model.number="item.required_quantity"
                    type="number"
                    min="1"
                    class="w-20 rounded-lg border px-2 py-1"
                  />
                </template>

                <button
                  type="button"
                  class="text-red-600 hover:text-red-800 ml-2"
                  @click="removeProduct(item.product_id)"
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Rule -->
        <div class="mt-6 rounded-xl border p-4">
          <h3 class="mb-4 font-semibold">เงื่อนไขโปรโมชั่น</h3>

          <!-- Bundle -->
          <template v-if="form.promotion_type === 'BUNDLE_PRICE'">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium">จำนวนเซ็ตขั้นต่ำที่ต้องซื้อ</label>
                <input
                  v-model.number="form.rule.bundle_quantity"
                  type="number"
                  min="1"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium">ราคาพิเศษต่อ 1 เซ็ต</label>
                <input
                  v-model.number="form.rule.special_price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <p class="mt-3 text-xs text-gray-500">เช่น กาแฟ 1 + ขนม 1 = 99 บาท</p>
          </template>

          <!-- Percent -->
          <template v-if="form.promotion_type === 'PERCENT_DISCOUNT'">
            <label class="mb-1 block text-sm font-medium">ส่วนลด %</label>
            <input
              v-model.number="form.rule.discount_percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              class="w-full rounded-lg border px-3 py-2"
            />
          </template>

          <!-- Fixed -->
          <template v-if="form.promotion_type === 'FIXED_DISCOUNT'">
            <label class="mb-1 block text-sm font-medium">ลดเป็นจำนวนเงิน</label>
            <input
              v-model.number="form.rule.discount_amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full rounded-lg border px-3 py-2"
            />
          </template>

          <!-- Quantity -->
          <template v-if="['QUANTITY_PRICE', 'QUANTITY_PERCENT', 'QUANTITY_FIXED'].includes(form.promotion_type)">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium">ซื้อครบจำนวน (ชิ้น)</label>
                <input
                  v-model.number="form.rule.min_quantity"
                  type="number"
                  min="1"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div v-if="form.promotion_type === 'QUANTITY_PRICE'">
                <label class="mb-1 block text-sm font-medium">ราคาพิเศษ</label>
                <input
                  v-model.number="form.rule.special_price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div v-if="form.promotion_type === 'QUANTITY_PERCENT'">
                <label class="mb-1 block text-sm font-medium">ลด %</label>
                <input
                  v-model.number="form.rule.discount_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div v-if="form.promotion_type === 'QUANTITY_FIXED'">
                <label class="mb-1 block text-sm font-medium">ลดเงิน</label>
                <input
                  v-model.number="form.rule.discount_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          </template>

          <!-- Amount -->
          <template v-if="['AMOUNT_PERCENT', 'AMOUNT_FIXED'].includes(form.promotion_type)">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium">ซื้อครบยอด (บาท)</label>
                <input
                  v-model.number="form.rule.min_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div v-if="form.promotion_type === 'AMOUNT_PERCENT'">
                <label class="mb-1 block text-sm font-medium">ลด %</label>
                <input
                  v-model.number="form.rule.discount_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div v-if="form.promotion_type === 'AMOUNT_FIXED'">
                <label class="mb-1 block text-sm font-medium">ลดเงิน (บาท)</label>
                <input
                  v-model.number="form.rule.discount_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- Dates -->
        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium">เริ่มโปรโมชั่น</label>
            <input
              v-model="form.start_at"
              type="datetime-local"
              class="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">สิ้นสุดโปรโมชั่น</label>
            <input
              v-model="form.end_at"
              type="datetime-local"
              class="w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>

        <!-- Active -->
        <label class="mt-5 flex items-center gap-2 cursor-pointer">
          <input
            v-model="form.is_active"
            type="checkbox"
            class="h-4 w-4"
          />
          <span class="text-sm">เปิดใช้งานโปรโมชั่นทันที</span>
        </label>

        <!-- Buttons -->
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border px-4 py-2 hover:bg-gray-50"
            :disabled="saving"
            @click="closeModal"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'กำลังบันทึก...' : 'บันทึกโปรโมชั่น' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getProducts } from '../../services/products'
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotion
} from '../../services/promotions'

const products = ref([])
const promotions = ref([])

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const showModal = ref(false)
const editingPromotion = ref(null)
const productSearch = ref('')

function emptyForm() {
  return {
    name: '',
    description: '',
    promotion_type: 'BUNDLE_PRICE',
    start_at: '',
    end_at: '',
    is_active: true,
    priority: 0,
    products: [],
    rule: {
      min_quantity: null,
      min_amount: null,
      discount_percent: null,
      discount_amount: null,
      special_price: null,
      bundle_quantity: 1
    }
  }
}

const form = reactive(emptyForm())

const filteredProducts = computed(() => {
  const keyword = productSearch.value.trim().toLowerCase()
  if (!keyword) return products.value

  return products.value.filter(product => {
    return (
      String(product.name || '').toLowerCase().includes(keyword) ||
      String(product.sku || '').toLowerCase().includes(keyword)
    )
  })
})

const allFilteredProductsSelected = computed(() => {
  if (filteredProducts.value.length === 0) return false
  return filteredProducts.value.every(product => isSelected(product.id))
})

function resetForm() {
  Object.assign(form, emptyForm())
  productSearch.value = ''
  editingPromotion.value = null
}

function openCreate() {
  resetForm()
  showModal.value = true
}

function openEdit(promotion) {
  resetForm()
  editingPromotion.value = promotion
  
  form.name = promotion.name || ''
  form.description = promotion.description || ''
  form.promotion_type = promotion.promotion_type || 'BUNDLE_PRICE'
  form.start_at = toDatetimeLocal(promotion.start_at)
  form.end_at = toDatetimeLocal(promotion.end_at)
  form.is_active = Boolean(promotion.is_active)
  form.priority = Number(promotion.priority || 0)
  
  form.products = (promotion.products || []).map(item => ({
    product_id: item.product_id,
    required_quantity: Number(item.required_quantity || 1)
  }))

  form.rule.min_quantity = promotion.min_quantity !== null ? Number(promotion.min_quantity) : null
  form.rule.min_amount = promotion.min_amount !== null ? Number(promotion.min_amount) : null
  form.rule.discount_percent = promotion.discount_percent !== null ? Number(promotion.discount_percent) : null
  form.rule.discount_amount = promotion.discount_amount !== null ? Number(promotion.discount_amount) : null
  form.rule.special_price = promotion.special_price !== null ? Number(promotion.special_price) : null
  form.rule.bundle_quantity = promotion.bundle_quantity !== null ? Number(promotion.bundle_quantity) : 1

  showModal.value = true
}

function closeModal() {
  if (saving.value) return
  showModal.value = false
  resetForm()
}

function isSelected(productId) {
  return form.products.some(item => Number(item.product_id) === Number(productId))
}

function toggleProduct(product) {
  const index = form.products.findIndex(item => Number(item.product_id) === Number(product.id))
  
  if (index >= 0) {
    form.products.splice(index, 1)
    return
  }

  form.products.push({
    product_id: product.id,
    required_quantity: 1
  })
}

function toggleSelectAllProducts() {
  if (filteredProducts.value.length === 0) return

  if (allFilteredProductsSelected.value) {
    for (const product of filteredProducts.value) {
      removeProduct(product.id)
    }
    return
  }

  for (const product of filteredProducts.value) {
    if (!isSelected(product.id)) {
      form.products.push({
        product_id: product.id,
        required_quantity: 1
      })
    }
  }
}

function removeProduct(productId) {
  const index = form.products.findIndex(item => Number(item.product_id) === Number(productId))
  if (index >= 0) form.products.splice(index, 1)
}

function getProduct(productId) {
  return products.value.find(product => Number(product.id) === Number(productId))
}

function getProductName(productId) {
  return getProduct(productId)?.name || '-'
}

function getProductPrice(productId) {
  return Number(getProduct(productId)?.price || 0)
}

function getTypeLabel(type) {
  const labels = {
    BUNDLE_PRICE: 'หลายสินค้า → ราคาพิเศษ',
    PERCENT_DISCOUNT: 'ลด %',
    FIXED_DISCOUNT: 'ลดเงิน',
    QUANTITY_PRICE: 'ครบจำนวน → ราคาพิเศษ',
    QUANTITY_PERCENT: 'ครบจำนวน → ลด %',
    QUANTITY_FIXED: 'ครบจำนวน → ลดเงิน',
    AMOUNT_PERCENT: 'ครบยอด → ลด %',
    AMOUNT_FIXED: 'ครบยอด → ลดเงิน'
  }
  return labels[type] || type
}

function formatMoney(value) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildPayload() {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    promotion_type: form.promotion_type,
    start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
    end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
    is_active: Boolean(form.is_active),
    priority: Number(form.priority || 0),
    
    // เคลียร์ required_quantity ให้เป็น 1 หากไม่ใช่โปรจัดเซ็ต ป้องกันข้อมูลขยะ
    products: form.products.map(item => ({
      product_id: Number(item.product_id),
      required_quantity: form.promotion_type === 'BUNDLE_PRICE' ? Number(item.required_quantity || 1) : 1
    })),

    rule: {
      min_quantity: form.rule.min_quantity !== null && form.rule.min_quantity !== '' ? Number(form.rule.min_quantity) : null,
      min_amount: form.rule.min_amount !== null && form.rule.min_amount !== '' ? Number(form.rule.min_amount) : null,
      discount_percent: form.rule.discount_percent !== null && form.rule.discount_percent !== '' ? Number(form.rule.discount_percent) : null,
      discount_amount: form.rule.discount_amount !== null && form.rule.discount_amount !== '' ? Number(form.rule.discount_amount) : null,
      special_price: form.rule.special_price !== null && form.rule.special_price !== '' ? Number(form.rule.special_price) : null,
      bundle_quantity: form.rule.bundle_quantity !== null && form.rule.bundle_quantity !== '' ? Number(form.rule.bundle_quantity) : 1
    }
  }
}

function validateForm() {
  if (!form.name.trim()) {
    errorMessage.value = 'กรุณากรอกชื่อโปรโมชั่น'
    return false
  }

  if (['BUNDLE_PRICE', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'QUANTITY_PRICE', 'QUANTITY_PERCENT', 'QUANTITY_FIXED'].includes(form.promotion_type) && form.products.length === 0) {
    errorMessage.value = 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'
    return false
  }

  if (form.start_at && form.end_at && new Date(form.end_at) <= new Date(form.start_at)) {
    errorMessage.value = 'วันสิ้นสุดต้องมากกว่าวันเริ่มโปรโมชั่น'
    return false
  }

  if (form.promotion_type === 'BUNDLE_PRICE') {
    if (!form.rule.special_price || Number(form.rule.special_price) < 0) {
      errorMessage.value = 'กรุณาระบุราคาพิเศษต่อชุด'
      return false
    }
  }

  if (form.promotion_type === 'PERCENT_DISCOUNT' || form.promotion_type === 'QUANTITY_PERCENT' || form.promotion_type === 'AMOUNT_PERCENT') {
    if (form.rule.discount_percent === null || Number(form.rule.discount_percent) <= 0 || Number(form.rule.discount_percent) > 100) {
      errorMessage.value = 'กรุณาระบุส่วนลด 0-100%'
      return false
    }
  }

  if (form.promotion_type === 'FIXED_DISCOUNT' || form.promotion_type === 'QUANTITY_FIXED' || form.promotion_type === 'AMOUNT_FIXED') {
    if (form.rule.discount_amount === null || Number(form.rule.discount_amount) <= 0) {
      errorMessage.value = 'กรุณาระบุจำนวนเงินส่วนลด'
      return false
    }
  }

  if (['QUANTITY_PRICE', 'QUANTITY_PERCENT', 'QUANTITY_FIXED'].includes(form.promotion_type)) {
    if (form.rule.min_quantity === null || Number(form.rule.min_quantity) <= 0) {
      errorMessage.value = 'กรุณาระบุจำนวนขั้นต่ำ'
      return false
    }
  }

  if (form.promotion_type === 'QUANTITY_PRICE') {
    if (form.rule.special_price === null || Number(form.rule.special_price) < 0) {
      errorMessage.value = 'กรุณาระบุราคาพิเศษ'
      return false
    }
  }

  if (['AMOUNT_PERCENT', 'AMOUNT_FIXED'].includes(form.promotion_type)) {
    if (form.rule.min_amount === null || Number(form.rule.min_amount) < 0) {
      errorMessage.value = 'กรุณาระบุยอดขั้นต่ำ'
      return false
    }
  }

  return true
}

async function loadProducts() {
  try {
    const response = await getProducts()
    const data = response?.data
    let productList = []

    if (Array.isArray(response)) {
      productList = response
    } else if (Array.isArray(data)) {
      productList = data
    } else if (Array.isArray(data?.products)) {
      productList = data.products
    } else if (Array.isArray(data?.data?.products)) {
      productList = data.data.products
    } else if (Array.isArray(data?.data)) {
      productList = data.data
    } else if (productList.length === 0 && Array.isArray(data?.rows)) {
      productList = data.rows
    } else if (productList.length === 0 && Array.isArray(response?.rows)) {
      productList = response.rows
    }

    products.value = productList.filter(
      product => product && product.id !== undefined && product.id !== null
    )
  } catch (error) {
    products.value = []
    errorMessage.value = error.response?.data?.message || error.response?.data?.error || error.message || 'ไม่สามารถโหลดสินค้าได้'
  }
}

async function loadPromotions() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await getPromotions()
    promotions.value = response.data?.promotions || response.data || []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'ไม่สามารถโหลดโปรโมชั่นได้'
  } finally {
    loading.value = false
  }
}

async function save() {
  errorMessage.value = ''
  if (!validateForm()) return
  saving.value = true

  try {
    const payload = buildPayload()
    if (editingPromotion.value) {
      await updatePromotion(editingPromotion.value.id, payload)
    } else {
      await createPromotion(payload)
    }
    showModal.value = false
    resetForm()
    await loadPromotions()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.response?.data?.error || error.message || 'ไม่สามารถบันทึกโปรโมชั่นได้'
  } finally {
    saving.value = false
  }
}

async function toggle(promotion) {
  errorMessage.value = ''
  try {
    await togglePromotion(promotion.id, !promotion.is_active)
    await loadPromotions()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'ไม่สามารถเปลี่ยนสถานะโปรโมชั่นได้'
  }
}

async function remove(promotion) {
  const confirmed = window.confirm(`ต้องการลบโปรโมชั่น "${promotion.name}" หรือไม่?`)
  if (!confirmed) return
  errorMessage.value = ''
  try {
    await deletePromotion(promotion.id)
    await loadPromotions()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'ไม่สามารถลบโปรโมชั่นได้'
  }
}

onMounted(async () => {
  await Promise.all([
    loadProducts(),
    loadPromotions()
  ])
})
</script>