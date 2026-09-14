<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <!-- ชื่อสินค้า -->
    <div>
      <label class="mb-1 block text-sm font-medium">
        ชื่อสินค้า
      </label>

      <input
        v-model="form.name"
        type="text"
        required
        class="w-full rounded-lg border px-3 py-2"
        placeholder="กรอกชื่อสินค้า"
      />
    </div>

    <!-- SKU -->
    <div>
      <label class="mb-1 block text-sm font-medium">
        SKU
      </label>

      <input
        v-model="form.sku"
        type="text"
        required
        class="w-full rounded-lg border px-3 py-2"
        placeholder="เช่น PROD-001"
      />
    </div>

    <!-- หมวดหมู่ -->
    <div>
      <label class="mb-1 block text-sm font-medium">
        หมวดหมู่
      </label>

      <input
        v-model="form.category"
        type="text"
        class="w-full rounded-lg border px-3 py-2"
        placeholder="เช่น เครื่องดื่ม"
      />
    </div>

    <!-- ราคา -->
    <div>
      <label class="mb-1 block text-sm font-medium">
        ราคา
      </label>

      <input
        v-model.number="form.price"
        type="number"
        min="0"
        step="0.01"
        required
        class="w-full rounded-lg border px-3 py-2"
        placeholder="0.00"
      />
    </div>

    <!-- จุดแจ้งเตือน Stock ต่ำ -->
    <div>
      <label class="mb-1 block text-sm font-medium">
        จุดแจ้งเตือน Stock ต่ำ
      </label>

      <input
        v-model.number="form.reorderPoint"
        type="number"
        min="0"
        class="w-full rounded-lg border px-3 py-2"
        placeholder="เช่น 10"
      />

      <p class="mt-1 text-xs text-gray-500">
        Stock จริงจะอ่านจาก Database
        ไม่สามารถกรอก Stock จากฟอร์มเพิ่มสินค้าได้
      </p>
    </div>

    <!-- รูปสินค้า -->
    <div>
      <label class="mb-1 block text-sm font-medium">
        รูปสินค้า
      </label>

      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        class="block w-full rounded-lg border px-3 py-2"
        @change="handleImageChange"
      />

      <!-- Preview -->
      <div v-if="previewUrl" class="mt-3">
        <p class="mb-2 text-sm text-gray-600">
          ตัวอย่างรูปสินค้า
        </p>

        <div class="relative h-40 w-40">
          <img
            :src="previewUrl"
            alt="ตัวอย่างรูปสินค้า"
            class="h-40 w-40 rounded-lg border object-cover"
          />

          <button
            type="button"
            class="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
            @click="removeImage"
          >
            ลบ
          </button>
        </div>
      </div>

      <p class="mt-1 text-xs text-gray-500">
        รองรับ JPG, PNG และ WEBP
      </p>
    </div>

    <!-- ปุ่ม -->
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="rounded-lg border px-4 py-2"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        ยกเลิก
      </button>

      <button
        type="submit"
        :disabled="loading"
        class="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {{ loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

const props = defineProps({
  product: {
    type: Object,
    default: null
  },

  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

const fileInput = ref(null)
const previewUrl = ref('')

const form = reactive({
  name: '',
  sku: '',
  category: '',
  price: 0,
  reorderPoint: 0,
  image: null
})

const isEdit = computed(() => {
  return !!props.product?.id
})

/**
 * สร้าง URL สำหรับรูปจาก Backend
 */
function getImageUrl(imageUrl) {
  if (!imageUrl) {
    return ''
  }

  // ถ้า Backend ส่ง URL เต็มมา
  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('blob:')
  ) {
    return imageUrl
  }

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api'

  // เอา /api ออกจากท้าย URL
  const serverUrl = apiBaseUrl.replace(/\/api\/?$/, '')

  const path = imageUrl.startsWith('/')
    ? imageUrl
    : `/${imageUrl}`

  return `${serverUrl}${path}`
}

/**
 * ล้าง Preview เดิม
 */
function clearPreview() {
  if (previewUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }

  previewUrl.value = ''
}

/**
 * โหลดข้อมูลสินค้าเดิมเข้า Form
 */
function fillForm(product) {
  clearPreview()

  form.name = product?.name || ''
  form.sku = product?.sku || ''
  form.category = product?.category || ''
  form.price = Number(product?.price || 0)
  form.reorderPoint = Number(product?.reorderPoint || 0)
  form.image = null

  // ถ้าเป็นการแก้ไขและมีรูปเดิม
  if (product?.imageUrl) {
    previewUrl.value = getImageUrl(product.imageUrl)
  }

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

/**
 * เลือกรูปจากเครื่อง
 */
function handleImageChange(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  // ตรวจสอบว่าเป็นรูปหรือไม่
  if (!file.type.startsWith('image/')) {
    alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น')

    event.target.value = ''
    return
  }

  // จำกัดขนาด 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert('รูปภาพต้องมีขนาดไม่เกิน 5MB')

    event.target.value = ''
    return
  }

  clearPreview()

  form.image = file

  // สร้าง Preview จากเครื่อง
  previewUrl.value = URL.createObjectURL(file)
}

/**
 * ลบรูปที่เลือก
 */
function removeImage() {
  clearPreview()

  form.image = null

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

/**
 * Submit
 */
function handleSubmit() {
  const name = form.name.trim()
  const sku = form.sku.trim()
  const category = form.category.trim()

  if (!name) {
    alert('กรุณากรอกชื่อสินค้า')
    return
  }

  if (!sku) {
    alert('กรุณากรอก SKU')
    return
  }

  if (Number(form.price) < 0) {
    alert('ราคาต้องไม่ติดลบ')
    return
  }

  if (Number(form.reorderPoint) < 0) {
    alert('จุดแจ้งเตือน Stock ต้องไม่ติดลบ')
    return
  }

  /**
   * ไม่ส่ง stock จากฟอร์ม
   * Stock ต้องมาจาก Database
   */
  emit('submit', {
    id: props.product?.id || null,
    name,
    sku,
    category,
    price: Number(form.price),
    reorderPoint: Number(form.reorderPoint),
    image: form.image
  })
}

/**
 * เมื่อ product เปลี่ยน
 */
watch(
  () => props.product,
  (product) => {
    fillForm(product)
  },
  {
    immediate: true
  }
)

/**
 * Cleanup blob URL
 */
onBeforeUnmount(() => {
  clearPreview()
})
</script>