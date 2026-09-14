<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
const router = useRouter()
function logout() { auth.logout(); router.replace('/login') }
</script>
<template>
    <div class="min-h-screen bg-gray-100">
        <aside class="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white p-5">
            <h1 class="text-xl font-bold mb-6">POS Admin</h1>
            <nav class="space-y-2">
                <RouterLink to="/admin" class="block rounded px-3 py-2 hover:bg-gray-800">Dashboard</RouterLink>
                <RouterLink to="/admin/stores" class="block rounded px-3 py-2 hover:bg-gray-800">Stores</RouterLink>
                <RouterLink to="/admin/store-owners" class="block rounded px-3 py-2 hover:bg-gray-800">Store Owners
                </RouterLink>
                <RouterLink to="/admin/permissions" class="block rounded px-3 py-2 hover:bg-gray-800">Permissions
                </RouterLink>
            </nav><button class="mt-8 cursor-pointer rounded bg-red-600 px-3 py-2" @click="logout">Logout</button>
        </aside>
        <main class="ml-64 p-6">
            <RouterView />
        </main>
    </div>
</template>
