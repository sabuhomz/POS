import api from './api'

export async function listManagedUsers() {
  const { data } = await api.get('/admin/users')
  return data.users || []
}

export async function createManagedUser(payload) {
  const { data } = await api.post('/admin/users', payload)
  return data.user
}

export async function setUserStatus(id, isActive) {
  const { data } = await api.patch(`/admin/users/${id}/status`, { isActive })
  return data.user
}

export async function getUserPermissions(id) {
  const { data } = await api.get(`/admin/users/${id}/permissions`)
  return data.permissions || []
}

export async function setUserPermissions(id, permissions) {
  const { data } = await api.put(`/admin/users/${id}/permissions`, { permissions })
  return data.permissions || []
}
