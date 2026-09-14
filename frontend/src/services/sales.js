import api from './api'

export async function getSalesHistory(params = {}) {
  const response = await api.get('/owner/sales-history', { params })
  return response.data
}
