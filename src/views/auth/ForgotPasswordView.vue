<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api/services'
import AuthHeroIllustration from '@/components/auth/AuthHeroIllustration.vue'

type Step = 'email' | 'otp' | 'password'

const router = useRouter()
const step = ref<Step>('email')
const email = ref('')
const otp = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const localError = ref('')
const successMessage = ref('')

async function requestOtp() {
  localError.value = ''
  successMessage.value = ''
  const normalized = email.value.trim().toLowerCase()
  if (!normalized) {
    localError.value = 'Vui lòng nhập email'
    return
  }
  loading.value = true
  try {
    await authApi.forgotPassword(normalized)
    email.value = normalized
    successMessage.value =
      'Nếu email tồn tại, mã OTP đặt lại mật khẩu đã được gửi. Kiểm tra Hộp thư đến và Spam.'
    step.value = 'otp'
  } catch (e) {
    localError.value = e instanceof Error ? e.message : 'Không gửi được OTP'
  } finally {
    loading.value = false
  }
}

async function verifyOtp() {
  localError.value = ''
  if (!otp.value.trim()) {
    localError.value = 'Vui lòng nhập mã OTP'
    return
  }
  loading.value = true
  try {
    await authApi.verifyResetOtp(email.value, otp.value.trim())
    successMessage.value = 'OTP hợp lệ. Nhập mật khẩu mới bên dưới.'
    step.value = 'password'
  } catch (e) {
    localError.value = e instanceof Error ? e.message : 'OTP không hợp lệ'
  } finally {
    loading.value = false
  }
}

async function updatePassword() {
  localError.value = ''
  if (newPassword.value.length < 8) {
    localError.value = 'Mật khẩu mới tối thiểu 8 ký tự'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    localError.value = 'Xác nhận mật khẩu không khớp'
    return
  }
  loading.value = true
  try {
    await authApi.updatePassword(email.value, newPassword.value, confirmPassword.value)
    successMessage.value = 'Đã đổi mật khẩu. Đang chuyển tới đăng nhập…'
    setTimeout(() => {
      router.push({ name: 'login', query: { email: email.value } })
    }, 900)
  } catch (e) {
    localError.value = e instanceof Error ? e.message : 'Không đổi được mật khẩu'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-layout">
    <aside class="auth-panel-brand">
      <p class="brand-tag">SEDSP Platform</p>
      <h1>Quên mật khẩu?</h1>
      <p>
        Nhập email đăng ký — chúng tôi gửi mã OTP để bạn đặt lại mật khẩu an toàn.
      </p>
      <AuthHeroIllustration />
    </aside>

    <section class="auth-panel-form">
      <div class="auth-form-box">
        <h2 class="page-title" style="font-size: 1.35rem">Đặt lại mật khẩu</h2>
        <p class="page-lead" style="margin-bottom: 1.25rem">
          {{
            step === 'email'
              ? 'Nhập email tài khoản của bạn.'
              : step === 'otp'
                ? 'Nhập mã OTP từ email.'
                : 'Tạo mật khẩu mới.'
          }}
        </p>

        <div class="border-glow">
          <form
            class="border-glow__inner card--flat"
            style="padding: 1.25rem 1.5rem"
            @submit.prevent="
              step === 'email' ? requestOtp() : step === 'otp' ? verifyOtp() : updatePassword()
            "
          >
            <p v-if="successMessage" class="alert alert-success alert--animate">{{ successMessage }}</p>
            <p v-if="localError" class="alert alert-error alert--animate">{{ localError }}</p>

            <template v-if="step === 'email'">
              <div class="form-group">
                <label for="fp-email">Email</label>
                <input
                  id="fp-email"
                  v-model="email"
                  type="email"
                  required
                  autocomplete="email"
                  class="input-glow"
                />
              </div>
              <button type="submit" class="btn btn-primary btn-block btn-glow" :disabled="loading">
                {{ loading ? 'Đang gửi…' : 'Gửi mã OTP' }}
              </button>
            </template>

            <template v-else-if="step === 'otp'">
              <p class="muted" style="margin: 0 0 0.75rem">
                Email: <strong>{{ email }}</strong>
              </p>
              <div class="form-group">
                <label for="fp-otp">Mã OTP</label>
                <input
                  id="fp-otp"
                  v-model="otp"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="8"
                  required
                  placeholder="VD: 123456"
                  class="input-glow"
                />
              </div>
              <button type="submit" class="btn btn-primary btn-block btn-glow" :disabled="loading">
                {{ loading ? 'Đang xác minh…' : 'Xác minh OTP' }}
              </button>
              <button
                type="button"
                class="btn btn-outline btn-block"
                style="margin-top: 0.65rem"
                :disabled="loading"
                @click="step = 'email'"
              >
                Đổi email
              </button>
            </template>

            <template v-else>
              <div class="form-group">
                <label for="fp-new">Mật khẩu mới</label>
                <input
                  id="fp-new"
                  v-model="newPassword"
                  type="password"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  class="input-glow"
                />
              </div>
              <div class="form-group">
                <label for="fp-confirm">Xác nhận mật khẩu</label>
                <input
                  id="fp-confirm"
                  v-model="confirmPassword"
                  type="password"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  class="input-glow"
                />
              </div>
              <button type="submit" class="btn btn-primary btn-block btn-glow" :disabled="loading">
                {{ loading ? 'Đang lưu…' : 'Lưu mật khẩu mới' }}
              </button>
            </template>

            <p class="muted" style="margin: 1rem 0 0; text-align: center">
              <RouterLink to="/login">← Quay lại đăng nhập</RouterLink>
            </p>
          </form>
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
  margin: 0;
  opacity: 0.9;
  max-width: 36ch;
}
</style>
