<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import AccountHoverMenu from '@/components/AccountHoverMenu.vue'
import CategoryNav from '@/components/CategoryNav.vue'
import { isShopBrowsePath, roleContactPath, roleOpsHome, roleOpsHomeLabel } from '@/utils/roleNav'

const auth = useAuthStore()
const cart = useCartStore()
const route = useRoute()
const promoDismissed = ref(false)

const isShopMode = computed(() => {
  if (auth.role === 'guest' || auth.role === 'customer') return true
  return isShopBrowsePath(route.path)
})

const showCategoryNav = computed(() => {
  if (!isShopMode.value) return false
  if (route.meta.fullBleed) return false
  return !['/login', '/register'].includes(route.path)
})

const roleLabels: Record<string, string> = {
  guest: 'Khách',
  customer: 'Khách hàng',
  seller: 'Người bán',
  manager: 'Quản lý',
  admin: 'Admin',
}

const opsNavLinks = computed(() => {
  const r = auth.role
  if (r === 'seller') {
    return [
      { to: '/seller/products', label: 'Sản phẩm' },
      { to: '/seller/inventory', label: 'Tồn kho' },
      { to: '/seller/sales', label: 'Doanh số' },
      { to: '/seller/dss', label: 'DSS' },
      { to: '/seller/chatbot', label: 'Trợ lý AI' },
    ]
  }
  if (r === 'manager') {
    return [
      { to: '/manager/dashboard', label: 'Dashboard' },
      { to: '/manager/analytics', label: 'Phân tích' },
      { to: '/manager/dss', label: 'DSS' },
      { to: '/chatbot', label: 'Trợ lý AI' },
    ]
  }
  if (r === 'admin') {
    return [
      { to: '/admin/users', label: 'Người dùng' },
      { to: '/admin/monitoring', label: 'Giám sát' },
      { to: '/chatbot', label: 'Trợ lý AI' },
    ]
  }
  return []
})

const opsHome = computed(() => roleOpsHome(auth.role))
const opsHomeLabel = computed(() => roleOpsHomeLabel(auth.role))
const contactTo = computed(() => roleContactPath(auth.role))
const showCart = computed(() => auth.role === 'guest' || auth.role === 'customer')

function onOpenCart() {
  cart.openDrawer()
}
</script>

<template>
  <div class="site-chrome">
    <!-- Shop header (guest, customer, hoặc ops role đang duyệt cửa hàng) -->
    <template v-if="isShopMode">
      <div v-if="!promoDismissed" class="shop-promo-bar">
        <div class="container shop-promo-bar__inner">
          <p>
            Giảm 30% toàn shop — Có hạn!
            <RouterLink to="/search" class="shop-promo-bar__link">Mua ngay →</RouterLink>
          </p>
          <button
            type="button"
            class="shop-promo-bar__close"
            aria-label="Đóng thông báo"
            @click="promoDismissed = true"
          >
            ×
          </button>
        </div>
      </div>

      <header class="shop-header site-chrome__bar">
        <div class="container shop-header__inner">
          <RouterLink to="/" class="shop-brand">
            SEDSP<span class="shop-brand__dot">.</span>
          </RouterLink>

          <nav class="shop-nav" aria-label="Điều hướng chính">
            <RouterLink
              v-if="opsHome"
              :to="opsHome"
              class="shop-nav__link shop-nav__link--ops"
            >
              {{ opsHomeLabel }}
            </RouterLink>
            <RouterLink to="/" class="shop-nav__link" exact-active-class="shop-nav__link--active">
              Trang chủ
            </RouterLink>
            <RouterLink to="/search" class="shop-nav__link" active-class="shop-nav__link--active">
              Cửa hàng
            </RouterLink>
            <RouterLink
              v-if="auth.role === 'customer'"
              to="/recommendations"
              class="shop-nav__link shop-nav__link--ai"
              active-class="shop-nav__link--active"
            >
              Gợi ý AI
            </RouterLink>
            <RouterLink
              v-if="auth.role === 'customer'"
              to="/orders"
              class="shop-nav__link"
              active-class="shop-nav__link--active"
            >
              Đơn hàng
            </RouterLink>
            <RouterLink :to="contactTo" class="shop-nav__link" active-class="shop-nav__link--active">
              Liên hệ
            </RouterLink>
          </nav>

          <div class="shop-header__actions">
            <RouterLink
              to="/search"
              class="shop-icon-btn btn-interactive"
              title="Tìm kiếm"
              aria-label="Tìm kiếm"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </RouterLink>

            <AccountHoverMenu variant="shop" />

            <button
              v-if="showCart"
              type="button"
              class="shop-icon-btn shop-icon-btn--cart btn-interactive"
              title="Giỏ hàng"
              aria-label="Giỏ hàng"
              @click="onOpenCart"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span v-if="cart.itemCount" class="shop-icon-btn__badge">{{ cart.itemCount }}</span>
            </button>
          </div>
        </div>
      </header>

      <CategoryNav v-if="showCategoryNav" />
    </template>

    <!-- Ops header (seller/manager/admin trên trang vận hành) -->
    <header v-else class="ops-header site-chrome__bar">
      <div class="container ops-header__inner">
        <RouterLink to="/" class="shop-brand shop-brand--sm">
          SEDSP<span class="shop-brand__dot">.</span>
        </RouterLink>

        <nav class="nav ops-header__nav">
          <RouterLink v-for="link in opsNavLinks" :key="link.to" :to="link.to" class="nav-link nav-link--slide">
            {{ link.label }}
          </RouterLink>
          <RouterLink to="/" class="nav-link">← Cửa hàng</RouterLink>
        </nav>

        <div class="mkt-user-menu ops-account">
          <span class="badge badge-role">{{ roleLabels[auth.role] }}</span>
          <AccountHoverMenu variant="ops" />
        </div>
      </div>
    </header>
  </div>
</template>

<style scoped>
.site-chrome {
  position: relative;
  z-index: 100;
}

.site-chrome__bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.25rem;
}

.ops-header__nav {
  flex: 1;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--slate-600);
  border-radius: var(--radius);
  text-decoration: none;
  transition: background var(--transition), color var(--transition);
}

.nav-link:hover {
  background: var(--slate-100);
  color: var(--slate-900);
  text-decoration: none;
}

.nav-link.router-link-active {
  background: var(--primary-50);
  color: var(--primary-800);
}

.ops-account {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.shop-nav__link--ops {
  color: var(--primary-700);
  font-weight: 700;
}

.shop-nav__link--ops:hover {
  color: var(--primary-800);
}

.shop-nav__link--ai {
  color: #0f766e;
  font-weight: 600;
}

.shop-nav__link--ai:hover,
.shop-nav__link--ai.router-link-active {
  color: #065f46;
}

.shop-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-self: end;
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }

  .shop-nav__link--ai {
    display: none;
  }
}
</style>
