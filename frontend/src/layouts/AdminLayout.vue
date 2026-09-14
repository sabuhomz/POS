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
  <div class="admin-layout">
    <header class="mobile-topbar">
      <button type="button" class="mobile-menu-button" aria-label="เปิดเมนู" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
        <span></span><span></span><span></span>
      </button>
      <div class="mobile-topbar-title">POS Admin</div>
    </header>

    <div v-if="menuOpen" class="sidebar-backdrop" aria-hidden="true" @click="closeMenu"></div>

    <aside class="admin-sidebar" :class="{ 'is-open': menuOpen }">
      <div class="sidebar-header">
        <h1 class="sidebar-brand">POS Admin</h1>
        <button type="button" class="sidebar-close" aria-label="ปิดเมนู" @click="closeMenu">×</button>
      </div>

      <nav class="admin-nav">
        <RouterLink to="/admin" class="sidebar-link">Dashboard</RouterLink>
        <RouterLink to="/admin/stores" class="sidebar-link">Stores</RouterLink>
        <RouterLink to="/admin/store-owners" class="sidebar-link">Store Owners</RouterLink>
        <RouterLink to="/admin/permissions" class="sidebar-link">Permissions</RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="sidebar-logout" @click="logout">Logout</button>
      </div>
    </aside>

    <main class="admin-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100dvh;
  background: #f3f4f6;
}

.admin-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 50;
  width: 250px;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  background: #111827;
  color: #fff;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin-bottom: 28px;
}

.sidebar-brand {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 750;
  letter-spacing: -.02em;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 9px 12px;
  border-radius: 9px;
  line-height: 1.35;
  text-decoration: none;
  color: #f9fafb;
  font-size: 14px;
  transition: background-color .15s ease;
}

.sidebar-link:hover,
.sidebar-link.router-link-active {
  background: #1f2937;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 28px;
}

.sidebar-logout {
  width: 100%;
  min-height: 42px;
  border: 0;
  border-radius: 8px;
  background: #dc2626;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}

.sidebar-logout:hover {
  background: #b91c1c;
}

.admin-main {
  min-width: 0;
  margin-left: 250px;
  min-height: 100dvh;
  padding: 32px clamp(24px, 3vw, 48px);
}

.mobile-topbar,
.mobile-menu-button,
.sidebar-close,
.sidebar-backdrop {
  display: none;
}

@media (max-width: 1023px) {
  .admin-sidebar {
    width: min(300px, 86vw);
    transform: translateX(-105%);
    transition: transform .22s ease;
    box-shadow: 14px 0 36px rgba(0, 0, 0, .2);
  }

  .admin-sidebar.is-open {
    transform: translateX(0);
  }

  .admin-main {
    margin-left: 0;
    padding: 76px 24px 24px;
  }

  .mobile-topbar {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 30;
    height: 60px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    background: rgba(255, 255, 255, .96);
    border-bottom: 1px solid #e5e7eb;
    backdrop-filter: blur(10px);
  }

  .mobile-topbar-title {
    margin-left: 54px;
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .mobile-menu-button {
    position: absolute;
    left: 14px;
    top: 10px;
    display: flex;
    width: 40px;
    height: 40px;
    padding: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 1px solid #d1d5db;
    border-radius: 9px;
    background: #fff;
    color: #111827;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .07);
    cursor: pointer;
  }

  .mobile-menu-button span {
    width: 18px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }

  .sidebar-close {
    display: block;
    border: 0;
    background: transparent;
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: block;
    background: rgba(15, 23, 42, .48);
  }
}

@media (max-width: 767px) {
  .admin-main {
    padding: 72px 16px 20px;
  }
}

@media (max-width: 479px) {
  .admin-main {
    padding: 68px 12px 16px;
  }

  .mobile-topbar {
    height: 56px;
    padding: 0 14px;
  }

  .mobile-menu-button {
    top: 8px;
    left: 10px;
  }

  .mobile-topbar-title {
    margin-left: 50px;
  }
}
</style>
