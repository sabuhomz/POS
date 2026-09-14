import { PERMISSIONS as P } from "./permissions";
export const PERMISSION_GROUPS = [
  {
    key: "product",
    name: "จัดการสินค้า",
    permissions: [
      ["PRODUCT_VIEW", "ดูสินค้า"],
      ["PRODUCT_CREATE", "เพิ่มสินค้า"],
      ["PRODUCT_EDIT", "แก้ไขสินค้า"],
      ["PRODUCT_DELETE", "ลบสินค้า"],
      ["PRODUCT_PRICE", "เปลี่ยนราคา"],
      ["PRODUCT_IMAGE", "จัดการรูปภาพ"],
    ],
  },
  {
    key: "inventory",
    name: "จัดการคลังสินค้า",
    permissions: [
      ["INVENTORY_VIEW", "ดู Stock"],
      ["INVENTORY_EDIT", "แก้ไข Stock"],
      ["INVENTORY_RESTOCK_APPROVE", "อนุมัติ Restock"],
    ],
  },
  {
    key: "employee",
    name: "จัดการพนักงาน",
    permissions: [
      ["EMPLOYEE_VIEW", "ดูพนักงาน"],
      ["EMPLOYEE_CREATE", "เพิ่มพนักงาน"],
      ["EMPLOYEE_EDIT", "แก้ไขพนักงาน"],
      ["EMPLOYEE_DELETE", "ลบพนักงาน"],
    ],
  },
  {
    key: "promotion",
    name: "โปรโมชั่น",
    permissions: [
      ["PROMOTION_VIEW", "ดูโปรโมชั่น"],
      ["PROMOTION_CREATE", "เพิ่มโปรโมชั่น"],
      ["PROMOTION_EDIT", "แก้ไขโปรโมชั่น"],
      ["PROMOTION_DELETE", "ลบโปรโมชั่น"],
    ],
  },
  {
    key: "sales",
    name: "การขาย",
    permissions: [
      ["SALE_CREATE", "ทำรายการขาย"],
      ["SALE_VIEW", "ดูประวัติการขาย"],
    ],
  },
  {
    key: "reports",
    name: "รายงาน",
    permissions: [
      ["REPORT_VIEW", "ดู Dashboard"],
      ["REPORT_DAILY", "รายงานยอดขายรายวัน"],
      ["REPORT_TREND", "กราฟยอดขายสินค้า"],
      ["REPORT_TOP_PRODUCTS", "สินค้าขายดี"],
      ["REPORT_WEEKLY", "ยอดขายรายสัปดาห์"],
    ],
  },
].map((g) => ({
  ...g,
  permissions: g.permissions.map(([key, label]) => ({ key: P[key], label })),
}));
