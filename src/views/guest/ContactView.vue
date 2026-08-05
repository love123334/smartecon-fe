<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()

const ADMIN_EMAIL = 'admin@sedsp.vn'

const form = ref({
  name: auth.user?.fullName ?? '',
  email: auth.user?.email ?? '',
  subject: 'Góp ý / Khiếu nại',
  message: '',
})
const sent = ref(false)
const error = ref('')

const mailtoHref = computed(() => {
  const subject = encodeURIComponent(`[SEDSP] ${form.value.subject}`)
  const body = encodeURIComponent(
    [
      `Họ tên: ${form.value.name || '(chưa ghi)'}`,
      `Email liên hệ: ${form.value.email || '(chưa ghi)'}`,
      '',
      form.value.message.trim(),
    ].join('\n'),
  )
  return `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`
})

function submit() {
  error.value = ''
  if (!form.value.message.trim()) {
    error.value = 'Vui lòng nhập nội dung góp ý / khiếu nại.'
    return
  }
  if (!form.value.email.trim()) {
    error.value = 'Vui lòng nhập email để Admin phản hồi.'
    return
  }
  window.location.href = mailtoHref.value
  sent.value = true
}
</script>

<template>
  <div class="contact-page">
    <PageHeader
      eyebrow="Hỗ trợ"
      title="Liên hệ & góp ý"
      lead="Gửi khiếu nại hoặc góp ý qua email tới Admin. Chatbot AI vẫn hỗ trợ nhanh tại nút chat góc màn hình."
    />

    <div class="contact-grid">
      <section class="card contact-card">
        <h2>Gửi email cho Admin</h2>
        <p class="muted">
          Nội dung sẽ mở ứng dụng email của bạn tới
          <strong>{{ ADMIN_EMAIL }}</strong>.
        </p>

        <form class="contact-form" @submit.prevent="submit">
          <label>
            Họ tên
            <input v-model="form.name" class="input" type="text" autocomplete="name" />
          </label>
          <label>
            Email của bạn
            <input v-model="form.email" class="input" type="email" required autocomplete="email" />
          </label>
          <label>
            Chủ đề
            <select v-model="form.subject" class="input">
              <option>Góp ý / Khiếu nại</option>
              <option>Báo lỗi kỹ thuật</option>
              <option>Hỏi về đơn hàng</option>
              <option>Hợp tác / Seller</option>
              <option>Khác</option>
            </select>
          </label>
          <label>
            Nội dung
            <textarea
              v-model="form.message"
              class="input"
              rows="5"
              required
              placeholder="Mô tả vấn đề hoặc góp ý của bạn…"
            />
          </label>
          <p v-if="error" class="form-error">{{ error }}</p>
          <p v-if="sent" class="contact-ok" role="status">
            Đã mở hộp thư — hãy bấm Gửi trong email để hoàn tất.
          </p>
          <button type="submit" class="btn btn-primary">Mở email gửi Admin</button>
        </form>
      </section>

      <aside class="card contact-aside">
        <h2>Hỗ trợ tại chỗ</h2>
        <p>
          Cần trả lời nhanh về sản phẩm, giỏ hàng hay đơn hàng? Dùng
          <strong>Trợ lý SEDSP</strong> (nút chat góc phải) — hỗ trợ ngay trên trang.
        </p>
        <ul>
          <li>Email Admin: <a :href="`mailto:${ADMIN_EMAIL}`">{{ ADMIN_EMAIL }}</a></li>
          <li>Giờ phản hồi: 8:00–22:00 (T2–CN)</li>
          <li>
            <RouterLink to="/privacy">Chính sách bảo mật</RouterLink>
            ·
            <RouterLink to="/terms">Điều khoản</RouterLink>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.contact-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.contact-card h2,
.contact-aside h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.muted {
  margin: 0 0 1rem;
  color: var(--slate-500, #64748b);
  font-size: 0.9rem;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.contact-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.contact-ok {
  margin: 0;
  color: #0f766e;
  font-size: 0.875rem;
}

.contact-aside ul {
  margin: 0.75rem 0 0;
  padding-left: 1.1rem;
  line-height: 1.7;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
}
</style>
