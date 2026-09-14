import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const routes = [
  {
    path: "/login",
    component: () => import("../layouts/AuthLayout.vue"),
    children: [
      {
        path: "",
        name: "login",
        component: () => import("../views/auth/LoginView.vue"),
        meta: { guestOnly: true },
      },
    ],
  },

  // ADMIN Web POS
  {
    path: "/admin",
    component: () => import("../layouts/AdminLayout.vue"),
    meta: {
      requiresAuth: true,
      roles: ["ADMIN"],
    },
    children: [
      {
        path: "",
        name: "admin-dashboard",
        component: () => import("../views/admin/AdminDashboardView.vue"),
      },
      {
        path: "stores",
        name: "admin-stores",
        component: () => import("../views/admin/StoresView.vue"),
      },
      {
        path: "store-owners",
        name: "admin-store-owners",
        component: () => import("../views/admin/StoreOwnersView.vue"),
      },
      {
        path: "permissions",
        name: "admin-permissions",
        component: () => import("../views/admin/PermissionsView.vue"),
      },
    ],
  },

  // OWNER Web POS
  // OWNER เข้า Web POS ได้
  // EMPLOYEE ห้ามเข้า Web POS
  {
    path: "/owner",
    component: () => import("../layouts/OwnerLayout.vue"),
    meta: {
      requiresAuth: true,
      roles: ["OWNER"],
    },
    children: [
      {
        path: "",
        name: "owner-dashboard",
        component: () => import("../views/owner/OwnerDashboardView.vue"),
        meta: {
          roles: ["OWNER"],
        },
      },
      {
        path: "inventory",
        name: "owner-inventory",
        component: () => import("../views/owner/InventoryView.vue"),
        meta: {
          permission: "inventory.view",
        },
      },
      {
        path: "employees",
        name: "owner-employees",
        component: () => import("../views/owner/EmployeesView.vue"),
        meta: {
          permission: "employee.view",
        },
      },
      {
        path: "promotions",
        name: "owner-promotions",
        component: () => import("../views/owner/PromotionsView.vue"),
        meta: {
          permission: "promotion.view",
        },
      },
      {
        path: "restock-requests",
        name: "owner-restock",
        component: () => import("../views/owner/RestockRequestsView.vue"),
        meta: {
          permission: "inventory.restock.approve",
        },
      },
      {
        path: "sales-history",
        name: "owner-sales-history",
        component: () => import("../views/owner/SalesHistoryView.vue"),
        meta: {
          permission: "sale.view",
        },
      },
      {
        path: "delete-store",
        name: "owner-delete-store",
        component: () => import("../views/owner/StoreDeletionView.vue"),
        meta: {
          roles: ["OWNER"],
        },
      },
    ],
  },

  {
    path: "/forbidden",
    name: "forbidden",
    component: () => import("../views/ForbiddenView.vue"),
  },

  {
    path: "/",
    redirect: "/login",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  auth.initialize();

  // ยังไม่ได้ login
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: "login",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  // ตรวจ role
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    return "/forbidden";
  }

  // ตรวจ permission
  if (
    to.meta.permission &&
    !auth.hasPermission(to.meta.permission)
  ) {
    return "/forbidden";
  }

  // login อยู่แล้ว
  if (to.meta.guestOnly && auth.isAuthenticated) {
    if (auth.role === "ADMIN") {
      return "/admin";
    }

    if (auth.role === "OWNER") {
      return "/owner";
    }

    // EMPLOYEE ไม่มีหน้า Web POS
    return "/forbidden";
  }

  return true;
});

export default router;