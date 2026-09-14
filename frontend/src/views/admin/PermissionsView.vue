<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../../services/api'
import { PERMISSION_GROUPS } from '../../utils/permissionGroups'
const users = ref([]), selectedUserId = ref(''), selected = ref([]), loading = ref(false), saving = ref(false), error = ref('')
const targetUsers = computed(() => users.value.filter(u => u.role !== 'ADMIN'))
async function loadUsers() { users.value = (await api.get('/admin/users')).data.users; if (!selectedUserId.value && users.value.length) selectedUserId.value = users.value[0].id }
async function loadPermissions() { if (!selectedUserId.value) return; loading.value = true; try { selected.value = (await api.get(`/admin/users/${selectedUserId.value}/permissions`)).data.permissions } catch (e) { error.value = e.response?.data?.message || 'โหลดสิทธิ์ไม่สำเร็จ' } finally { loading.value = false } }
watch(selectedUserId, loadPermissions)
function has(k) { return selected.value.includes(k) }
function toggle(k) { selected.value = has(k) ? selected.value.filter(x => x !== k) : [...selected.value, k] }
function groupAll(g) { return g.permissions.every(p => has(p.key)) }
function toggleGroup(g) { if (groupAll(g)) selected.value = selected.value.filter(x => !g.permissions.some(p => p.key === x)); else selected.value = [...new Set([...selected.value, ...g.permissions.map(p => p.key)])] }
async function save() { saving.value = true; try { await api.put(`/admin/users/${selectedUserId.value}/permissions`, { permissions: selected.value }); alert('บันทึกสิทธิ์แล้ว') } catch (e) { error.value = e.response?.data?.message || 'บันทึกไม่สำเร็จ' } finally { saving.value = false } }
onMounted(loadUsers)
</script>
<template>
    <div class="mx-auto max-w-5xl space-y-5">
        <div>
            <h1 class="text-2xl font-bold">กำหนดสิทธิ์ เจ้าของร้าน</h1>
        </div>
        <div v-if="error" class="rounded bg-red-50 p-3 text-red-700">{{ error }}</div>
        <div class="rounded-xl bg-white p-5 shadow-sm"><label
                class="mb-2 block text-sm font-medium">ผู้ใช้</label><select v-model="selectedUserId"
                class="w-full rounded-lg border px-3 py-2">
                <option v-for="u in targetUsers" :key="u.id" :value="u.id">{{ u.username }} — {{ u.role }} —
                    {{ u.store_name || '-' }}</option>
            </select></div>
        <div v-if="loading" class="text-gray-500">กำลังโหลด...</div><template v-else>
            <div v-for="g in PERMISSION_GROUPS" :key="g.key" class="rounded-xl bg-white shadow-sm">
                <div class="flex items-center justify-between border-b p-5">
                    <h2 class="font-semibold">{{ g.name }}</h2><label class="flex gap-2 text-sm"><input type="checkbox"
                            :checked="groupAll(g)" @change="toggleGroup(g)">เลือกทั้งหมด</label>
                </div>
                <div class="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3"><label v-for="p in g.permissions" :key="p.key"
                        class="flex gap-3 rounded-lg border p-3"><input type="checkbox" :checked="has(p.key)"
                            @change="toggle(p.key)"><span>{{ p.label }}</span></label></div>
            </div>
            <div class="flex justify-end"><button @click="save" :disabled="saving || !selectedUserId"
                    class="rounded-lg bg-blue-600 px-6 py-3 text-white">{{ saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'
                    }}</button>
            </div>
        </template>
    </div>
</template>
