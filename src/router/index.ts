import { createRouter, createWebHistory } from 'vue-router'
import type { UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { roleHomePath } from '@/utils/roleNav'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: UserRole[]
    guestOnly?: boolean
    title?: string
    /** Trang full-width (auth layout) */
    fullBleed?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/guest/HomeView.vue'),
      meta: { title: 'Trang chủ' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/guest/RegisterView.vue'),
      meta: { guestOnly: true, title: 'Đăng ký', fullBleed: true },
    },
    {
      path: '/products',
      redirect: '/',
    },
    {
      path: '/products/:id',
      name: 'product-detail',
      component: () => import('@/views/guest/ProductDetailView.vue'),
      meta: { title: 'Chi tiết sản phẩm' },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/guest/SearchView.vue'),
      meta: { title: 'Cửa hàng' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guestOnly: true, title: 'Đăng nhập', fullBleed: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/customer/ProfileView.vue'),
      meta: { roles: ['customer', 'seller'], title: 'Hồ sơ' },
    },
    {
      path: '/role-upgrade',
      name: 'role-upgrade',
      component: () => import('@/views/customer/RoleUpgradeView.vue'),
      meta: { roles: ['customer'], title: 'Xin nâng quyền' },
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('@/views/customer/CartView.vue'),
      meta: { roles: ['customer'], title: 'Giỏ hàng' },
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('@/views/customer/CheckoutView.vue'),
      meta: { roles: ['customer'], title: 'Thanh toán' },
    },
    {
      path: '/payment/result',
      name: 'payment-result',
      component: () => import('@/views/customer/PaymentResultView.vue'),
      meta: { title: 'Kết quả thanh toán' },
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/views/customer/OrdersView.vue'),
      meta: { roles: ['customer'], title: 'Đơn hàng' },
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('@/views/customer/OrderDetailView.vue'),
      meta: { roles: ['customer'], title: 'Chi tiết đơn' },
    },
    {
      path: '/recommendations',
      redirect: '/',
    },
    {
      path: '/chatbot',
      name: 'chatbot',
      component: () => import('@/views/customer/ChatbotView.vue'),
      meta: { roles: ['customer', 'manager'], title: 'Trợ lý AI' },
    },
    {
      path: '/seller/products',
      name: 'seller-products',
      component: () => import('@/views/seller/ProductManageView.vue'),
      meta: { roles: ['seller'], title: 'Quản lý SP' },
    },
    {
      path: '/seller/orders',
      name: 'seller-orders',
      component: () => import('@/views/seller/SellerOrdersView.vue'),
      meta: { roles: ['seller'], title: 'Đơn hàng' },
    },
    {
      path: '/seller/inventory',
      name: 'seller-inventory',
      component: () => import('@/views/seller/InventoryView.vue'),
      meta: { roles: ['seller'], title: 'Tồn kho' },
    },
    {
      path: '/seller/sales',
      name: 'seller-sales',
      component: () => import('@/views/seller/SalesDashboardView.vue'),
      meta: { roles: ['seller'], title: 'Doanh số' },
    },
    {
      path: '/seller/dss',
      name: 'seller-dss',
      component: () => import('@/views/seller/DssView.vue'),
      meta: { roles: ['seller'], title: 'DSS Người bán' },
    },
    {
      path: '/seller/dss/demand',
      name: 'seller-dss-demand',
      component: () => import('@/views/seller/DemandPredictionView.vue'),
      meta: { roles: ['seller'], title: 'Dự báo nhu cầu' },
    },
    {
      path: '/seller/dss/price',
      name: 'seller-dss-price',
      component: () => import('@/views/seller/PriceRecommendationView.vue'),
      meta: { roles: ['seller'], title: 'Gợi ý giá' },
    },
    {
      path: '/seller/dss/inventory',
      name: 'seller-dss-inventory',
      component: () => import('@/views/seller/InventoryRecommendationView.vue'),
      meta: { roles: ['seller'], title: 'Khuyến nghị tồn kho' },
    },
    {
      path: '/seller/dss/what-if',
      name: 'seller-dss-what-if',
      component: () => import('@/views/seller/WhatIfDiscountView.vue'),
      meta: { roles: ['seller'], title: 'What-if giảm giá' },
    },
    {
      path: '/seller/chatbot',
      name: 'seller-chatbot',
      component: () => import('@/views/seller/SellerChatbotView.vue'),
      meta: { roles: ['seller'], title: 'Trợ lý bán hàng' },
    },
    {
      path: '/manager/dashboard',
      name: 'manager-dashboard',
      component: () => import('@/views/manager/PlatformRevenueView.vue'),
      meta: { roles: ['manager'], title: 'Bảng điều khiển' },
    },
    {
      path: '/manager/analytics',
      redirect: { name: 'manager-dashboard' },
    },
    {
      path: '/manager/platform-revenue',
      redirect: { name: 'manager-dashboard' },
    },
    {
      path: '/manager/dss',
      redirect: { name: 'manager-dashboard' },
    },
    {
      path: '/manager/dss/what-if',
      redirect: { name: 'manager-dashboard' },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/admin/UsersView.vue'),
      meta: { roles: ['admin'], title: 'Người dùng' },
    },
    {
      path: '/admin/approvals',
      name: 'admin-approvals',
      component: () => import('@/views/shared/RoleApprovalsView.vue'),
      meta: { roles: ['admin'], title: 'Duyệt nâng quyền' },
    },
    {
      path: '/admin/monitoring',
      name: 'admin-monitoring',
      component: () => import('@/views/admin/MonitoringView.vue'),
      meta: { roles: ['admin'], title: 'Giám sát' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.user && !auth.loading) {
    await auth.hydrate()
  }

  const currentRole: UserRole = auth.user?.role ?? 'guest'

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return roleHome(currentRole)
  }

  const allowed = to.meta.roles
  if (allowed && allowed.length > 0) {
    if (!auth.isLoggedIn) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (!allowed.includes(currentRole)) {
      return roleHome(currentRole)
    }
  }

  if (to.meta.title) {
    document.title = `${to.meta.title} | SEDSP`
  }

  return true
})

function roleHome(role: UserRole): { path: string } {
  return { path: roleHomePath(role) }
}

export default router
