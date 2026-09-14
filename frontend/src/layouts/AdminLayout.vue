<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

function logout() {
  menuOpen.value = false
  auth.logout()
  router.replace('/login')
}

function closeMenu() {
  menuOpen.value = false
}

watch(() => route.path, closeMenu)
</script>

<template>
  <div class="min-h-screen bg-gray-100 admin-layout">
    <button
      type="button"
      class="mobile-menu-button"
      aria-label="เปิดเมนู"
      :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div v-if="menuOpen" class="sidebar-backdrop" aria-hidden="true" @click="closeMenu"></div>

    <aside class="admin-sidebar" :class="{ 'is-open': menuOpen }">
      <div class="sidebar-header">
        <h1 class="text-xl font-bold">POS Admin</h1>
        <button type="button" class="sidebar-close" aria-label="ปิดเมนู" @click="closeMenu">×</button>
      </div>

      <nav class="admin-nav">
        <RouterLink to="/admin" class="sidebar-link">Dashboard</RouterLink>
        <RouterLink to="/admin/stores" class="sidebar-link">Stores</RouterLink>
        <RouterLink to="/admin/store-owners" class="sidebar-link">Store Owners</RouterLink>
        <RouterLink to="/admin/permissions" class="sidebar-link">Permissions</RouterLink>
      </nav>

      <button class="mt-8 cursor-pointer rounded bg-red-600 px-3 py-2 sidebar-logout" @click="logout">Logout</button>
    </aside>

    <main class="admin-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100dvh;
}

.admin-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 50;
  width: 16rem;
  padding: 1.25rem;
  background: #111827;
  color: white;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.sidebar-link {
  display: block;
  border-radius: .375rem;
  padding: .55rem .75rem;
  line-height: 1.4;
  text-decoration: none;
  color: white;
  transition: background-color .15s ease;
}

.sidebar-link:hover,
.sidebar-link.router-link-active {
  background: #1f2937;
}

.sidebar-logout {
  width: 100%;
}

.admin-main {
  min-width: 0;
  margin-left: 16rem;
  padding: 1.5rem;
}

.mobile-menu-button,
.sidebar-close,
.sidebar-backdrop {
  display: none;
}

@media (max-width: 1023px) {
  .admin-sidebar {
    width: min(18rem, 86vw);
    transform: translateX(-105%);
    transition: transform .2s ease;
    box-shadow: 12px 0 30px rgba(0, 0, 0, .18);
  }

  .admin-sidebar.is-open {
    transform: translateX(0);
  }

  .admin-main {
    margin-left: 0;
    padding: 4.5rem 1rem 1.25rem;
  }

  .mobile-menu-button {
    position: fixed;
    top: .75rem;
    left: .75rem;
    z-index: 60;
    display: flex;
    width: 2.75rem;
    height: 2.75rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .3rem;
    border: 1px solid #d1d5db;
    border-radius: .6rem;
    background: white;
    color: #111827;
    box-shadow: 0 4px 12px rgba(0, 0, 0, .1);
  }

  .mobile-menu-button span {
    width: 1.25rem;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }

  .sidebar-close {
    display: block;
    border: 0;
    background: transparent;
    color: white;
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: block;
    background: rgba(0, 0, 0, .45);
  }
}

@media (max-width: 639px) {
  .admin-main {
    padding: 4.25rem .75rem 1rem;
  }
}
</style>
