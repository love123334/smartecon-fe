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
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0, left: 0 }
  },
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
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { guestOnly: true, title: 'Quên mật khẩu', fullBleed: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/customer/ProfileView.vue'),
      meta: { roles: ['customer', 'seller', 'manager', 'admin'], title: 'Hồ sơ' },
    },
    {
      path: '/role-upgrade',
      name: 'role-upgrade',
      component: () => import('@/views/customer/RoleUpgradeView.vue'),
      meta: { roles: ['customer', 'seller'], title: 'Xin nâng quyền' },
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('@/views/customer/CartView.vue'),
      meta: { roles: ['customer', 'seller', 'manager', 'admin'], title: 'Giỏ hàng' },
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('@/views/customer/CheckoutView.vue'),
      meta: { roles: ['customer', 'seller', 'manager', 'admin'], title: 'Thanh toán' },
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
      meta: { roles: ['customer', 'seller', 'manager', 'admin'], title: 'Đơn hàng' },
    },
    {
      path: '/orders/:id/pay-momo',
      name: 'order-pay-momo',
      component: () => import('@/views/customer/MomoTransferPayView.vue'),
      meta: { roles: ['customer', 'seller', 'manager', 'admin'], title: 'Chuyển MoMo' },
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('@/views/customer/OrderDetailView.vue'),
      meta: { roles: ['customer', 'seller', 'manager', 'admin'], title: 'Chi tiết đơn' },
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
      path: '/contact',
      name: 'contact',
      component: () => import('@/views/guest/ContactView.vue'),
      meta: { title: 'Liên hệ' },
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/guest/PrivacyView.vue'),
      meta: { title: 'Chính sách bảo mật' },
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/guest/TermsView.vue'),
      meta: { title: 'Điều khoản' },
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
      path: '/seller/momo-settings',
      name: 'seller-momo-settings',
      component: () => import('@/views/seller/SellerMomoSettingsView.vue'),
      meta: { roles: ['seller'], title: 'MoMo shop' },
    },
    {
      path: '/seller/inventory',
      redirect: { name: 'seller-products' },
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
      redirect: { name: 'seller-dss-demand-lightgbm-demo' },
    },
    {
      path: '/seller/dss/demand-lightgbm-demo',
      name: 'seller-dss-demand-lightgbm-demo',
      component: () => import('@/views/seller/LightGbmDemandDemoView.vue'),
      meta: { roles: ['seller'], title: 'Dự báo Nhu cầu' },
    },
    {
      path: '/seller/dss/price',
      name: 'seller-dss-price',
      redirect: { name: 'seller-dss-advanced-price' },
    },
    {
      path: '/seller/dss/advanced-price',
      name: 'seller-dss-advanced-price',
      component: () => import('@/views/seller/AdvancedPriceRecommendationView.vue'),
      meta: { roles: ['seller'], title: 'Gợi ý Giá bán' },
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
      path: '/seller/dss/order-economics',
      name: 'seller-dss-order-economics',
      component: () => import('@/views/seller/OrderEconomicsWhatIfView.vue'),
      meta: { roles: ['seller'], title: 'What-if Hiệu suất' },
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
      name: 'manager-dss',
      component: () => import('@/views/manager/ManagerDssView.vue'),
      meta: { roles: ['manager'], title: 'DSS Quản trị' },
    },
    {
      path: '/manager/dss/what-if',
      name: 'manager-dss-what-if',
      component: () => import('@/views/manager/WhatIfPromotionView.vue'),
      meta: { roles: ['manager'], title: 'What-if khuyến mãi' },
    },
    {
      path: '/manager/vouchers',
      name: 'manager-vouchers',
      component: () => import('@/views/manager/ManagerVouchersView.vue'),
      meta: { roles: ['manager'], title: 'Voucher' },
    },
    {
      path: '/seller/vouchers',
      name: 'seller-vouchers',
      component: () => import('@/views/seller/SellerVoucherRequestView.vue'),
      meta: { roles: ['seller'], title: 'Yêu cầu voucher' },
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

let dssCssLoaded = false

async function ensureDssStyles(path: string) {
  if (dssCssLoaded) return
  if (
    !path.includes('/dss') &&
    !path.includes('/seller/demand') &&
    !path.includes('/seller/price') &&
    !path.includes('/seller/inventory') &&
    !path.includes('/seller/what-if') &&
    !path.includes('/seller/sales') &&
    !path.includes('/manager/')
  ) {
    return
  }
  await import('@/assets/dss-dashboard.css')
  dssCssLoaded = true
}

router.beforeEach(async (to) => {
  void ensureDssStyles(to.path)
  const auth = useAuthStore()
  // Always await shared hydrate when session not ready (single-flight in store)
  if (!auth.user) {
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

router.afterEach(() => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }
  if (typeof document !== 'undefined') {
    document.body.scrollTop = 0
    document.documentElement.scrollTop = 0
  }
})

function roleHome(role: UserRole): { path: string } {
  return { path: roleHomePath(role) }
}

router.onError((error, to) => {
  const msg = error?.message || ''
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      msg,
    )
  ) {
    const targetUrl = to?.fullPath ? to.fullPath : window.location.href
    window.location.href = targetUrl
  }
})

export default router
