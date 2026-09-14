import api from './api'

export async function getPromotions() {
  const response = await api.get('/promotions')
  return response.data
}

export async function getPromotion(id) {
  const response = await api.get(`/promotions/${id}`)
  return response.data
}

export async function createPromotion(promotion) {
  const response = await api.post(
    '/promotions',
    promotion
  )

  return response.data
}

export async function updatePromotion(id, promotion) {
  const response = await api.put(
    `/promotions/${id}`,
    promotion
  )

  return response.data
}

export async function deletePromotion(id) {
  const response = await api.delete(
    `/promotions/${id}`
  )

  return response.data
}

export async function togglePromotion(id) {
  const response = await api.patch(
    `/promotions/${id}/toggle`
  )

  return response.data
}

export async function getActivePromotions() {
  const response = await api.get(
    '/promotions/active'
  )

  return response.data
}