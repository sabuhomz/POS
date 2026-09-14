import api from './api'

export async function getProducts() {
  const response = await api.get('/products')
  return response.data
}

export async function getProduct(id) {
  const response = await api.get(`/products/${id}`)
  return response.data
}

export async function createProduct(product) {
  const formData = new FormData()

  formData.append('name', product.name)
  formData.append('sku', product.sku)
  formData.append('category', product.category || '')
  formData.append('price', String(product.price))
  formData.append(
    'reorderPoint',
    String(product.reorderPoint ?? 0)
  )

  // ไม่มีการส่ง stock
  if (product.image instanceof File) {
    formData.append('image', product.image)
  }

  const response = await api.post('/products', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data
}

export async function updateProduct(id, product) {
  const formData = new FormData()

  formData.append('name', product.name)
  formData.append('sku', product.sku)
  formData.append('category', product.category || '')
  formData.append('price', String(product.price))
  formData.append(
    'reorderPoint',
    String(product.reorderPoint ?? 0)
  )

  // ไม่ส่ง stock ตอนแก้ไขเช่นกัน
  if (product.image instanceof File) {
    formData.append('image', product.image)
  }

  const response = await api.put(`/products/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data
}

export async function deleteProduct(id) {
  const response = await api.delete(`/products/${id}`)
  return response.data
}