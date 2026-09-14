import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { decodeToken, isTokenExpired } from "../utils/jwt";
import api from "../services/api";
export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("access_token")),
    user = ref(loadUser()),
    permissions = ref([]);
  function loadUser() {
    try {
      const x = localStorage.getItem("user");
      return x ? JSON.parse(x) : null;
    } catch {
      return null;
    }
  }
  const isAuthenticated = computed(
    () => !!token.value && !isTokenExpired(token.value),
  );
  const role = computed(() => {
    const p = decodeToken(token.value);
    return p?.role || p?.roles?.[0] || user.value?.role || null;
  });
  const userId = computed(
    () => decodeToken(token.value)?.sub || user.value?.id || null,
  );
  const storeId = computed(
    () => decodeToken(token.value)?.storeId || user.value?.storeId || null,
  );
  function hasPermission(permission) {
    return role.value === "ADMIN" || permissions.value.includes(permission);
  }
  async function login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    const t = data.accessToken;
    const p = decodeToken(t);
    if (!p) throw new Error("Invalid JWT");
    token.value = t;
    permissions.value = p.permissions || [];
    user.value = {
      id: p.sub,
      username: p.username,
      role: p.role || p.roles?.[0],
      storeId: p.storeId,
    };
    localStorage.setItem("access_token", t);
    localStorage.setItem("user", JSON.stringify(user.value));
    return user.value;
  }
  function initialize() {
    const t = localStorage.getItem("access_token");
    if (!t || isTokenExpired(t)) {
      logout();
      return;
    }
    token.value = t;
    const p = decodeToken(t);
    if (p) {
      permissions.value = p.permissions || [];
      user.value = {
        id: p.sub,
        username: p.username,
        role: p.role || p.roles?.[0],
        storeId: p.storeId,
      };
    }
  }
  function logout() {
    token.value = null;
    permissions.value = [];
    user.value = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  }
  return {
    token,
    user,
    permissions,
    role,
    userId,
    storeId,
    isAuthenticated,
    hasPermission,
    login,
    initialize,
    logout,
  };
});
