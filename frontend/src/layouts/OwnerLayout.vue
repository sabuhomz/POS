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
            <h1 class="text-xl font-bold mb-6">POS Store</h1>
            <nav class="space-y-2">
                <RouterLink to="/owner" class="block rounded px-3 py-2 hover:bg-gray-800">สรุปข้อมูลการขาย</RouterLink>
                <RouterLink to="/owner/inventory" class="block rounded px-3 py-2 hover:bg-gray-800">คลังสินค้า</RouterLink>
                <RouterLink to="/owner/employees" class="block rounded px-3 py-2 hover:bg-gray-800">พนักงาน
                </RouterLink>
                <RouterLink to="/owner/promotions" class="block rounded px-3 py-2 hover:bg-gray-800">โปรโมชั่น</RouterLink>
                <RouterLink to="/owner/restock-requests" class="block rounded px-3 py-2 hover:bg-gray-800">คำขอเพิ่มจำนวนสินค้า</RouterLink>
                <RouterLink to="/owner/sales-history" class="block rounded px-3 py-2 hover:bg-gray-800">ประวัติการขาย</RouterLink>
                <RouterLink to="/owner/delete-store" class="block rounded px-3 py-2 hover:bg-gray-800">ยื่นคำขอปิดร้านค้า</RouterLink>
            </nav><button class="mt-8 cursor-pointer rounded bg-red-600 px-3 py-2" @click="logout">Logout</button>
        </aside>
        <main class="ml-64 p-6">
            <RouterView />
        </main>
    </div>
</template>
