import api from './api'

export async function healthCheck() {
  const { data } = await api.get('/health')
  return data
}
