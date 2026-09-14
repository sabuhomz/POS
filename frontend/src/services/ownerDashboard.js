import api from './api'

export async function getOwnerDashboard() {
  const response = await api.get('/owner/dashboard')
  return response.data
}