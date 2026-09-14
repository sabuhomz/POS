<template>
  <div class="space-y-6 p-6">
    <!-- Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          จัดการสินค้า
        </h1>

        <p class="mt-1 text-sm text-gray-500">
          เพิ่ม แก้ไข และจัดการสินค้า รวมถึงรูปภาพสินค้า
        </p>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          @click="openCreateModal"
        >
          + เพิ่มสินค้า
        </button>

        <button
          type="button"
          class="rounded-lg border px-4 py-2 hover:bg-gray-50"
          :disabled="loading"
          @click="loadProducts"
        >
          {{ loading ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล' }}
        </button>
      </div>
    </div>

    <!-- Error -->
    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ errorMessage }}
    </div>

    <!-- Search -->
    <div class="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row">
      <input
        v-model="search"
        type="search"
        placeholder="ค้นหาชื่อสินค้า หรือ SKU..."
        class="w-full rounded-lg border px-4 py-2 outline-none focus:border-blue-500 md:max-w-sm"
      />

      <select
        v-model="categoryFilter"
        class="rounded-lg border px-4 py-2 outline-none focus:border-blue-500"
      >
        <option value="">ทุกหมวดหมู่</option>

        <option
          v-for="category in categories"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>
    </div>

    <!-- Summary -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl border bg-white p-4 shadow-sm">
        <p class="text-sm text-gray-500">สินค้าทั้งหมด</p>
        <p class="mt-1 text-2xl font-bold">
          {{ products.length }}
        </p>
      </div>

      <div class="rounded-xl border bg-white p-4 shadow-sm">
        <p class="text-sm text-gray-500">สินค้าที่แสดง</p>
        <p class="mt-1 text-2xl font-bold">
          {{ filtered.length }}
        </p>
      </div>

      <div class="rounded-xl border bg-white p-4 shadow-sm">
        <p class="text-sm text-gray-500">สินค้า Stock ต่ำ</p>
        <p class="mt-1 text-2xl font-bold text-red-600">
          {{ lowStockCount }}
        </p>
      </div>
    </div>

    <!-- Product table -->
    <div class="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b bg-gray-50">
            <tr>
              <th class="p-4 font-semibold">สินค้า</th>
              <th class="p-4 font-semibold">SKU</th>
              <th class="p-4 font-semibold">หมวดหมู่</th>
              <th class="p-4 font-semibold">ราคา</th>
              <th class="p-4 font-semibold">Stock</th>
              <th class="p-4 font-semibold">สถานะ</th>
              <th class="p-4 font-semibold">จัดการ</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="p-8 text-center text-gray-500">
                กำลังโหลดข้อมูลสินค้า...
              </td>
            </tr>

            <tr v-else-if="filtered.length === 0">
              <td colspan="7" class="p-8 text-center text-gray-500">
                ไม่พบข้อมูลสินค้า
              </td>
            </tr>

            <tr
              v-for="product in filtered"
              v-else
              :key="product.id"
              class="border-b hover:bg-gray-50"
            >
              <!-- Image -->
              <td class="p-4">
                <div class="flex min-w-[240px] items-center gap-3">
                  <div
                    class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gray-100"
                  >
                    <img
                      v-if="getProductImage(product)"
                      :src="getProductImage(product)"
                      :alt="product.name || 'รูปสินค้า'"
                      class="h-full w-full object-cover"
                      @error="handleImageError"
                    />

                    <span
                      v-else
                      class="text-xs text-gray-400"
                    >
                      ไม่มีรูป
                    </span>
                  </div>

                  <div>
                    <p class="font-medium text-gray-900">
                      {{ product.name || '-' }}
                    </p>

                    <p class="text-xs text-gray-500">
                      ID: {{ product.id }}
                    </p>
                  </div>
                </div>
              </td>

              <td class="whitespace-nowrap p-4">
                {{ product.sku || '-' }}
              </td>

              <td class="whitespace-nowrap p-4">
                {{ product.category || '-' }}
              </td>

              <td class="whitespace-nowrap p-4 font-medium">
                {{ formatMoney(product.price) }}
              </td>

              <td class="whitespace-nowrap p-4 font-semibold">
                {{ getStock(product) }}
              </td>

              <td class="whitespace-nowrap p-4">
                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="getStockStatusClass(product)"
                >
                  {{ getStockStatusText(product) }}
                </span>
              </td>

              <td class="whitespace-nowrap p-4">
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="rounded-lg border px-3 py-1 text-sm hover:bg-gray-100"
                    @click="openEditModal(product)"
                  >
                    แก้ไข
                  </button>

                  <button
                    type="button"
                    class="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                    @click="removeProduct(product)"
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

    <!-- Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeModal"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-xl font-bold">
            {{ editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า' }}
          </h2>

          <button
            type="button"
            class="text-2xl text-gray-500 hover:text-gray-900"
            @click="closeModal"
          >
            ×
          </button>
        </div>

        <ProductForm
          :product="editingProduct"
          :loading="saving"
          @submit="saveProduct"
          @cancel="closeModal"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import ProductForm from '../../components/inventory/ProductForm.vue'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from '../../services/products'

const products = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const search = ref('')
const categoryFilter = ref('')

const showModal = ref(false)
const editingProduct = ref(null)

function openCreateModal() {
  editingProduct.value = null
  showModal.value = true
}

function openEditModal(product) {
  editingProduct.value = product
  showModal.value = true
}

function closeModal() {
  if (saving.value) return

  showModal.value = false
  editingProduct.value = null
}

async function saveProduct(productData) {
  saving.value = true
  errorMessage.value = ''

  try {
    if (editingProduct.value?.id) {
      await updateProduct(editingProduct.value.id, productData)
    } else {
      await createProduct(productData)
    }

    closeModal()
    await loadProducts()
  } catch (error) {
    console.error('Save product error:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'ไม่สามารถบันทึกสินค้าได้'
  } finally {
    saving.value = false
  }
}

async function removeProduct(product) {
  const confirmed = window.confirm(
    `ต้องการลบสินค้า "${product.name}" ใช่หรือไม่?`
  )

  if (!confirmed) return

  try {
    await deleteProduct(product.id)
    await loadProducts()
  } catch (error) {
    console.error('Delete product error:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'ไม่สามารถลบสินค้าได้'
  }
}

async function loadProducts() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getProducts()

    if (Array.isArray(response)) {
      products.value = response
    } else if (Array.isArray(response?.products)) {
      products.value = response.products
    } else if (Array.isArray(response?.data)) {
      products.value = response.data
    } else {
      products.value = []
    }
  } catch (error) {
    console.error('Load products error:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'ไม่สามารถโหลดข้อมูลสินค้าได้'

    products.value = []
  } finally {
    loading.value = false
  }
}

function getImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return ''
  }

  const value = imageUrl.trim()

  if (!value) return ''

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api'

  const serverUrl = apiBaseUrl.replace(/\/api\/?$/, '')

  const imagePath = value.startsWith('/')
    ? value
    : `/${value}`

  return `${serverUrl}${imagePath}`
}

function getProductImage(product) {
  const image =
    product.imageUrl ||
    product.image_url ||
    product.image ||
    product.imagePath ||
    product.image_path ||
    ''

  return getImageUrl(image)
}

function handleImageError(event) {
  event.target.style.display = 'none'
}

function getStock(product) {
  const stock = Number(
    product.stock ??
    product.quantity ??
    product.currentStock ??
    0
  )

  return Number.isFinite(stock) ? stock : 0
}

function getReorderPoint(product) {
  const reorderPoint = Number(
    product.reorderPoint ??
    product.reorder_point ??
    0
  )

  return Number.isFinite(reorderPoint)
    ? reorderPoint
    : 0
}

function getStockStatusText(product) {
  const stock = getStock(product)
  const reorderPoint = getReorderPoint(product)

  if (stock <= 0) return 'สินค้าหมด'
  if (stock <= reorderPoint) return 'Stock ต่ำ'

  return 'ปกติ'
}

function getStockStatusClass(product) {
  const stock = getStock(product)
  const reorderPoint = getReorderPoint(product)

  if (stock <= 0) {
    return 'bg-red-100 text-red-700'
  }

  if (stock <= reorderPoint) {
    return 'bg-yellow-100 text-yellow-700'
  }

  return 'bg-green-100 text-green-700'
}

function formatMoney(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(Number(value || 0))
}

const categories = computed(() => {
  return [
    ...new Set(
      products.value
        .map((product) => product.category)
        .filter(Boolean)
    )
  ].sort()
})

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return products.value.filter((product) => {
    const matchesSearch =
      !keyword ||
      String(product.name || '')
        .toLowerCase()
        .includes(keyword) ||
      String(product.sku || '')
        .toLowerCase()
        .includes(keyword)

    const matchesCategory =
      !categoryFilter.value ||
      product.category === categoryFilter.value

    return matchesSearch && matchesCategory
  })
})

const lowStockCount = computed(() => {
  return products.value.filter((product) => {
    return getStock(product) <= getReorderPoint(product)
  }).length
})

onMounted(loadProducts)
</script>