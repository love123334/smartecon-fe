<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const fullName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirm = ref('')
const otp = ref('')
const localError = ref('')
const pendingEmail = ref('')
const successMessage = ref('')
const resendMsg = ref('')
const resending = ref(false)
const verifying = ref(false)

async function submit() {
  localError.value = ''
  successMessage.value = ''
  pendingEmail.value = ''
  if (password.value !== confirm.value) {
    localError.value = 'Mật khẩu không khớp'
    return
  }
  if (password.value.length < 8) {
    localError.value = 'Mật khẩu tối thiểu 8 ký tự (theo quy định hệ thống)'
    return
  }
  try {
    const result = await auth.register({
      email: email.value,
      password: password.value,
      fullName: fullName.value,
      phone: phone.value || undefined,
    })
    if (result.status === 'active') {
      router.push('/')
      return
    }
    pendingEmail.value = result.email
    successMessage.value =
      result.message ||
      'Đã gửi mã OTP tới email của bạn. Nhập mã bên dưới để kích hoạt tài khoản.'
  } catch {
    localError.value = auth.error ?? 'Đăng ký thất bại'
  }
}

async function verify() {
  if (!pendingEmail.value || !otp.value.trim()) {
    localError.value = 'Vui lòng nhập mã OTP từ email'
    return
  }
  verifying.value = true
  localError.value = ''
  try {
    await auth.verifyEmail(pendingEmail.value, otp.value.trim())
    successMessage.value = 'Xác thực thành công! Đang chuyển tới đăng nhập…'
    setTimeout(() => {
      router.push({ name: 'login', query: { email: pendingEmail.value } })
    }, 800)
  } catch (e) {
    localError.value = e instanceof Error ? e.message : 'OTP không hợp lệ'
  } finally {
    verifying.value = false
  }
}

async function resend() {
  if (!pendingEmail.value) return
  resending.value = true
  resendMsg.value = ''
  try {
    await auth.resendOtp(pendingEmail.value)
    resendMsg.value = `Đã gửi lại OTP tới ${pendingEmail.value}. Kiểm tra hộp thư (và Spam).`
  } catch (e) {
    resendMsg.value = e instanceof Error ? e.message : 'Không gửi lại được OTP'
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <h1 class="page-title">Đăng ký</h1>

    <div v-if="pendingEmail" class="card auth-form">
      <p class="alert alert-success">{{ successMessage }}</p>
      <p class="muted">
        Mã OTP đã được gửi tới: <strong>{{ pendingEmail }}</strong>
      </p>

      <div class="form-group">
        <label for="otp">Nhập mã OTP từ email</label>
        <input
          id="otp"
          v-model="otp"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="8"
          placeholder="VD: 123456"
          required
        />
      </div>
      <p v-if="localError" class="alert alert-error">{{ localError }}</p>
      <button type="button" class="btn btn-primary" :disabled="verifying" @click="verify">
        {{ verifying ? 'Đang xác nhận…' : 'Xác nhận OTP & kích hoạt' }}
      </button>

      <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem">
        <button type="button" class="btn btn-outline" :disabled="resending" @click="resend">
          {{ resending ? 'Đang gửi…' : 'Gửi lại OTP' }}
        </button>
        <RouterLink to="/login" class="btn btn-outline">Đến đăng nhập</RouterLink>
      </div>
      <p v-if="resendMsg" class="muted" style="margin-top: 0.75rem">{{ resendMsg }}</p>
    </div>

    <form v-else class="card auth-form" @submit.prevent="submit">
      <p v-if="localError || auth.error" class="alert alert-error">
        {{ localError || auth.error }}
      </p>
      <div class="form-group">
        <label for="name">Họ tên</label>
        <input id="name" v-model="fullName" required />
      </div>
      <div class="form-group">
        <label for="email">Email (nhận mã OTP)</label>
        <input id="email" v-model="email" type="email" required />
      </div>
      <div class="form-group">
        <label for="phone">Số điện thoại</label>
        <input id="phone" v-model="phone" />
      </div>
      <div class="form-group">
        <label for="pw">Mật khẩu (tối thiểu 8 ký tự)</label>
        <input id="pw" v-model="password" type="password" required minlength="8" />
      </div>
      <div class="form-group">
        <label for="pw2">Xác nhận mật khẩu</label>
        <input id="pw2" v-model="confirm" type="password" required minlength="8" />
      </div>
      <button type="submit" class="btn btn-primary" :disabled="auth.loading">
        Đăng ký &amp; gửi OTP
      </button>
      <p class="muted" style="margin-top: 0.75rem; font-size: 0.85rem">
        Hệ thống gửi mã xác nhận tới đúng email bạn nhập. Sau khi nhập OTP, tài khoản được kích hoạt và có thể đăng nhập.
      </p>
      <p>
        Đã có tài khoản?
        <RouterLink to="/login">Đăng nhập</RouterLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  max-width: 420px;
  margin: 0 auto;
}
.muted {
  color: var(--slate-500, #64748b);
  font-size: 0.9rem;
}
</style>
