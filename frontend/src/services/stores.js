import api from './api'

export async function listStores() {
  const { data } = await api.get('/admin/stores')
  return data.stores || []
}

export async function createStore(name) {
  const { data } = await api.post('/admin/stores', { name })
  return data.store
}

// Backend endpoints expected for store lifecycle management.
export async function setStoreStatus(id, status) {
  const { data } = await api.patch(`/admin/stores/${id}/status`, { status })
  return data.store
}

export async function listDeleteRequests() {
  const { data } = await api.get('/admin/store-delete-requests')
  return data.requests || []
}

export async function reviewDeleteRequest(id, decision) {
  const { data } = await api.patch(`/admin/store-delete-requests/${id}`, { decision })
  return data.request || data.store
}

export async function requestStoreDeletion(reason = '') {
  const { data } = await api.post('/stores/delete-requests', { reason })
  return data.request
}
