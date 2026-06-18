<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { apiConfig } from '@/api/config'
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_PASSWORD_BACKEND,
} from '@/api/mockData'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const email = ref('')
const password = ref('')
const localError = ref('')

const demoPassword = computed(() =>
  apiConfig.useRealAuth ? DEMO_PASSWORD_BACKEND : DEMO_PASSWORD,
)

function fillDemo(accountEmail: string) {
  email.value = accountEmail
  password.value = demoPassword.value
}

async function submit() {
  localError.value = ''
  try {
    await auth.login(email.value, password.value)
    if (auth.role === 'customer') await cart.refresh()
    const redirect = (route.query.redirect as string) || undefined
    if (redirect) router.push(redirect)
    else if (auth.role === 'seller') router.push('/seller/products')
    else if (auth.role === 'manager') router.push('/manager/dashboard')
    else if (auth.role === 'admin') router.push('/admin/users')
    else router.push('/')
  } catch {
    localError.value = auth.error ?? 'Đăng nhập thất bại'
  }
}
</script>

<template>
  <div class="auth-layout">
    <aside class="auth-panel-brand">
      <p class="brand-tag">SEDSP Platform</p>
      <h1>Đăng nhập để tiếp tục</h1>
      <p>
        Hệ thố hỗ trợ quyết định kinh doanh tích hợp AI — kết nối backend Spring Boot khi
        API sẵn sàng.
      </p>
      <ul class="features">
        <li>JWT & phân quyền RBAC</li>
        <li>DSS: dự báo, gợi ý giá & tồn kho</li>
        <li>Chatbot tư vấn khách hàng & seller</li>
      </ul>
    </aside>

    <section class="auth-panel-form">
      <div class="auth-form-box">
        <h2 class="page-title" style="font-size: 1.35rem">Chào mừng trở lại</h2>
        <p class="page-lead" style="margin-bottom: 1.25rem">Nhập email và mật khẩu tài khoản của bạn.</p>

        <div class="border-glow">
          <form class="border-glow__inner card--flat" style="padding: 1.25rem 1.5rem" @submit.prevent="submit">
          <p v-if="localError || auth.error" class="alert alert-error alert--animate">
            {{ localError || auth.error }}
          </p>
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" required autocomplete="email" class="input-glow" />
          </div>
          <div class="form-group">
            <label for="pw">Mật khẩu</label>
            <input id="pw" v-model="password" type="password" required autocomplete="current-password" class="input-glow" />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-glow" :disabled="auth.loading">
            {{ auth.loading ? 'Đang xử lý...' : 'Đăng nhập' }}
          </button>
          <p class="muted" style="margin: 1rem 0 0; text-align: center">
            Chưa có tài khoản?
            <RouterLink to="/register">Đăng ký ngay</RouterLink>
          </p>
          </form>
        </div>

        <div class="card demo-box card--flat" style="margin-top: 1.25rem">
          <p class="card-title" style="margin-bottom: 0.5rem">Tài khoản demo</p>
          <p class="muted" style="margin: 0 0 0.75rem">
            Mật khẩu chung: <code>{{ demoPassword }}</code>
            <span v-if="apiConfig.useRealAuth" class="demo-hint">(backend)</span>
            <span v-else class="demo-hint">(mock)</span>
          </p>
          <div class="demo-grid">
            <button
              v-for="d in DEMO_ACCOUNTS"
              :key="d.email"
              type="button"
              class="demo-chip btn-interactive"
              :class="`demo-chip--${d.role}`"
              @click="fillDemo(d.email)"
            >
              <span class="demo-chip__badge">{{ d.label }}</span>
              <strong>{{ d.fullName }}</strong>
              <span class="demo-chip__email">{{ d.email }}</span>
              <span class="demo-chip__desc">{{ d.description }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.brand-tag {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.85;
  margin: 0 0 1rem;
}

.auth-panel-brand h1 {
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.auth-panel-brand > p {
  margin: 0 0 1.5rem;
  opacity: 0.9;
  max-width: 36ch;
}

.features {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.95;
}

.features li::before {
  content: '✓ ';
  font-weight: 700;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.demo-hint {
  font-size: 0.75rem;
  margin-left: 0.25rem;
  opacity: 0.75;
}

.demo-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.65rem 0.75rem;
  text-align: left;
  background: var(--slate-50);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}

.demo-chip:hover {
  border-color: var(--primary-500);
  background: var(--primary-50);
  transform: translateY(-1px);
}

.demo-chip__badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
}

.demo-chip--customer .demo-chip__badge {
  background: #e0f2fe;
  color: #0369a1;
}

.demo-chip--seller .demo-chip__badge {
  background: #dcfce7;
  color: #15803d;
}

.demo-chip--manager .demo-chip__badge {
  background: #fef3c7;
  color: #b45309;
}

.demo-chip--admin .demo-chip__badge {
  background: #fce7f3;
  color: #be185d;
}

.demo-chip strong {
  font-size: 0.8125rem;
  color: var(--slate-800);
}

.demo-chip__email {
  font-size: 0.68rem;
  color: var(--slate-600);
  font-family: ui-monospace, monospace;
}

.demo-chip__desc {
  font-size: 0.68rem;
  color: var(--slate-500);
}

@media (max-width: 520px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
