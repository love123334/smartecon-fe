<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import AccountHoverMenu from '@/components/AccountHoverMenu.vue'
import CategoryNav from '@/components/CategoryNav.vue'
import { isShopBrowsePath, roleContactPath, roleOpsHome, roleOpsHomeLabel, canShopAsBuyer } from '@/utils/roleNav'

const auth = useAuthStore()
const cart = useCartStore()
const route = useRoute()
const promoDismissed = ref(false)
const mobileNavOpen = ref(false)

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
      { to: '/seller/orders', label: 'Đơn hàng' },
      { to: '/seller/sales', label: 'Doanh số' },
      { to: '/seller/dss', label: 'DSS' },
    ]
  }
  if (r === 'manager') {
    return [
      { to: '/manager/dashboard', label: 'Dashboard' },
    ]
  }
  if (r === 'admin') {
    return [
      { to: '/admin/users', label: 'Người dùng' },
      { to: '/admin/approvals', label: 'Duyệt role' },
      { to: '/admin/monitoring', label: 'Giám sát' },
    ]
  }
  return []
})

const opsHome = computed(() => roleOpsHome(auth.role))
const opsHomeLabel = computed(() => roleOpsHomeLabel(auth.role))
const contactTo = computed(() => roleContactPath(auth.role))
const showCart = computed(() => auth.role === 'guest' || canShopAsBuyer(auth.role))

function onOpenCart() {
  cart.openDrawer()
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

watch(
  () => route.path,
  () => {
    mobileNavOpen.value = false
  },
)
</script>

<template>
  <div class="site-chrome">
    <!-- Shop header (guest, customer, hoặc ops role đang duyệt cửa hàng) -->
    <template v-if="isShopMode">
      <header class="shop-chrome site-chrome__bar">
        <div v-if="!promoDismissed" class="shop-promo-bar">
          <div class="container shop-promo-bar__inner">
            <p>
              <b>Giảm 30% toàn shop</b> — có hạn
              <RouterLink to="/search" class="shop-promo-bar__link">Mua ngay</RouterLink>
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

        <div class="shop-header">
          <div class="container shop-header__inner">
            <RouterLink to="/" class="shop-brand" aria-label="SEDSP — Trang chủ">
              <img src="/sedsp-logo.png" alt="SEDSP" class="shop-brand__logo" height="48" />
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
                v-if="canShopAsBuyer(auth.role)"
                to="/orders"
                class="shop-nav__link"
                active-class="shop-nav__link--active"
              >
                {{ auth.role === 'seller' ? 'Đơn mua' : 'Đơn hàng / lịch sử' }}
              </RouterLink>
              <RouterLink :to="contactTo" class="shop-nav__link" active-class="shop-nav__link--active">
                Liên hệ
              </RouterLink>
            </nav>

            <div class="shop-header__actions">
              <button
                type="button"
                class="shop-icon-btn btn-interactive mobile-nav-toggle"
                :aria-expanded="mobileNavOpen"
                aria-controls="mobile-nav-drawer"
                aria-label="Mở menu"
                @click="mobileNavOpen = !mobileNavOpen"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>

              <RouterLink
                to="/search"
                class="shop-icon-btn btn-interactive"
                title="Tìm kiếm"
                aria-label="Tìm kiếm"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
              </RouterLink>

              <button
                v-if="showCart"
                type="button"
                class="shop-icon-btn shop-icon-btn--cart btn-interactive"
                title="Giỏ hàng"
                aria-label="Giỏ hàng"
                @click="onOpenCart"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6L4.5 3H2" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" />
                </svg>
                <span v-if="cart.itemCount" class="shop-icon-btn__badge">{{ cart.itemCount }}</span>
              </button>

              <AccountHoverMenu variant="shop" />
            </div>
          </div>
        </div>

        <CategoryNav v-if="showCategoryNav" />
      </header>

    </template>

    <!-- Ops header (seller/manager/admin trên trang vận hành) -->
    <header v-else class="ops-header site-chrome__bar">
      <div class="container ops-header__inner">
        <RouterLink to="/" class="shop-brand shop-brand--sm" aria-label="SEDSP">
          <img src="/sedsp-logo.png" alt="SEDSP" class="shop-brand__logo shop-brand__logo--sm" height="40" />
        </RouterLink>

        <nav class="nav ops-header__nav">
          <RouterLink v-for="link in opsNavLinks" :key="link.to" :to="link.to" class="nav-link nav-link--slide">
            {{ link.label }}
          </RouterLink>
          <RouterLink to="/" class="nav-link">← Cửa hàng</RouterLink>
        </nav>

        <div class="mkt-user-menu ops-account">
          <button
            type="button"
            class="shop-icon-btn btn-interactive mobile-nav-toggle"
            :aria-expanded="mobileNavOpen"
            aria-controls="mobile-nav-drawer"
            aria-label="Mở menu"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span class="badge badge-role">{{ roleLabels[auth.role] }}</span>
          <AccountHoverMenu variant="ops" />
        </div>
      </div>
    </header>

    <div
      v-if="mobileNavOpen"
      id="mobile-nav-drawer"
      class="mobile-nav"
      role="dialog"
      aria-modal="true"
      aria-label="Menu điều hướng"
    >
      <div class="mobile-nav__backdrop" @click="closeMobileNav" />
      <nav class="mobile-nav__panel" @click.stop>
        <div class="mobile-nav__head">
          <strong>Menu</strong>
          <button type="button" class="shop-icon-btn" aria-label="Đóng menu" @click="closeMobileNav">
            ×
          </button>
        </div>
        <template v-if="isShopMode">
          <RouterLink v-if="opsHome" :to="opsHome" class="mobile-nav__link" @click="closeMobileNav">
            {{ opsHomeLabel }}
          </RouterLink>
          <RouterLink to="/" class="mobile-nav__link" @click="closeMobileNav">Trang chủ</RouterLink>
          <RouterLink to="/search" class="mobile-nav__link" @click="closeMobileNav">Cửa hàng</RouterLink>
          <RouterLink
            v-if="canShopAsBuyer(auth.role)"
            to="/orders"
            class="mobile-nav__link"
            @click="closeMobileNav"
          >
            {{ auth.role === 'seller' ? 'Đơn mua' : 'Đơn hàng / lịch sử' }}
          </RouterLink>
          <RouterLink :to="contactTo" class="mobile-nav__link" @click="closeMobileNav">Liên hệ</RouterLink>
        </template>
        <template v-else>
          <RouterLink
            v-for="link in opsNavLinks"
            :key="link.to"
            :to="link.to"
            class="mobile-nav__link"
            @click="closeMobileNav"
          >
            {{ link.label }}
          </RouterLink>
          <RouterLink to="/" class="mobile-nav__link" @click="closeMobileNav">← Cửa hàng</RouterLink>
        </template>
      </nav>
    </div>
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
  background: var(--paper, #fff);
}

.shop-chrome {
  background: var(--paper, #fff);
  border-bottom: 1px solid var(--line, #e4e9f2);
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

.nav-link--cart {
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  gap: 0.35rem;
}

.ops-cart-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--primary-600, #2563eb);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
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

.shop-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-self: end;
}

.mobile-nav-toggle {
  display: none;
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }

  .shop-nav {
    display: none;
  }

  .mobile-nav-toggle {
    display: inline-flex;
  }
}

.mobile-nav {
  position: fixed;
  inset: 0;
  z-index: 400;
}

.mobile-nav__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
}

.mobile-nav__panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(320px, 88vw);
  height: 100%;
  padding: 1rem;
  background: #fff;
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}

.mobile-nav__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.mobile-nav__link {
  display: block;
  padding: 0.7rem 0.75rem;
  border-radius: 8px;
  color: var(--slate-700, #334155);
  font-weight: 600;
  text-decoration: none;
}

.mobile-nav__link:hover,
.mobile-nav__link.router-link-active {
  background: var(--blue-soft, #eaf2ff);
  color: var(--navy, #14275c);
  text-decoration: none;
}
</style>
