<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import {
  getMyRoleApplications,
  getRoleOverride,
  hasPendingApplication,
  submitRoleApplication,
  type RoleApplicationTarget,
} from '@/utils/roleApplications'

const auth = useAuthStore()
const router = useRouter()
const targetRole = ref<RoleApplicationTarget>('seller')
const applicantType = ref<'individual' | 'business'>('individual')
const shopName = ref('')
const phone = ref('')
const reason = ref('')
const documentsNote = ref('')
const documentFileName = ref('')
const error = ref('')
const success = ref('')
const history = ref(getMyRoleApplications(auth.user?.id ?? '', auth.user?.email ?? ''))

const canApply = computed(() => auth.role === 'customer')

onMounted(() => {
  phone.value = auth.user?.phone ?? ''
  const override = getRoleOverride(auth.user?.email)
  if (override && override !== auth.role) {
    auth.applyLocalRole(override)
    success.value = `Yêu cầu đã được duyệt — bạn đang ở role ${override}. Tải lại hoặc mở trang người bán/quản lý.`
  }
  refresh()
})

function refresh() {
  if (!auth.user) return
  history.value = getMyRoleApplications(auth.user.id, auth.user.email)
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  documentFileName.value = file?.name ?? ''
}

function submit() {
  error.value = ''
  success.value = ''
  if (!auth.user || !canApply.value) {
    error.value = 'Chỉ tài khoản khách hàng mới gửi yêu cầu nâng role.'
    return
  }
  if (hasPendingApplication(auth.user.id, auth.user.email, targetRole.value)) {
    error.value = 'Bạn đã có yêu cầu cùng loại đang chờ duyệt.'
    return
  }
  if (!phone.value.trim() || !reason.value.trim() || !documentsNote.value.trim()) {
    error.value = 'Vui lòng điền SĐT, lý do và thông tin giấy tờ sơ bộ.'
    return
  }
  if (targetRole.value === 'seller' && applicantType.value === 'business' && !shopName.value.trim()) {
    error.value = 'Hộ KD / công ty cần tên cửa hàng.'
    return
  }
  try {
    submitRoleApplication({
      userId: auth.user.id,
      userEmail: auth.user.email,
      userName: auth.user.fullName,
      targetRole: targetRole.value,
      applicantType: applicantType.value,
      shopName: shopName.value.trim() || undefined,
      phone: phone.value.trim(),
      reason: reason.value.trim(),
      documentsNote: documentsNote.value.trim(),
      documentFileName: documentFileName.value || undefined,
    })
    success.value =
      'Đã gửi yêu cầu. Admin hoặc Quản lý sẽ duyệt — khi được duyệt, đăng xuất rồi đăng nhập lại (hoặc tải lại trang) để vào role mới.'
    reason.value = ''
    documentsNote.value = ''
    documentFileName.value = ''
    refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Gửi thất bại'
  }
}

function statusLabel(s: string) {
  if (s === 'pending') return 'Chờ duyệt'
  if (s === 'approved') return 'Đã duyệt'
  return 'Từ chối'
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tài khoản"
      title="Xin nâng quyền (Seller / Manager)"
      lead="Khách hàng cá nhân có thể gửi thông tin sơ bộ để bán hàng; doanh nghiệp/đơn vị có thể xin Seller hoặc Manager kèm giấy tờ bất kỳ để admin/quản lý duyệt."
    />

    <p v-if="!canApply" class="alert alert-error">
      Tài khoản hiện tại là <strong>{{ auth.role }}</strong> — không cần / không gửi yêu cầu nâng từ form này.
      <button type="button" class="btn btn-sm" style="margin-left: 0.5rem" @click="router.push('/profile')">
        Về hồ sơ
      </button>
    </p>

    <form v-else class="card" style="padding: 1.25rem; max-width: 560px" @submit.prevent="submit">
      <p v-if="error" class="alert alert-error">{{ error }}</p>
      <p v-if="success" class="alert alert-success">{{ success }}</p>

      <div class="form-group">
        <label>Muốn trở thành</label>
        <select v-model="targetRole" class="input">
          <option value="seller">Người bán (Seller)</option>
          <option value="manager">Quản lý (Manager)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Loại hồ sơ</label>
        <select v-model="applicantType" class="input">
          <option value="individual">Cá nhân (thông tin sơ bộ)</option>
          <option value="business">Hộ KD / công ty (giấy tờ)</option>
        </select>
      </div>

      <div v-if="targetRole === 'seller'" class="form-group">
        <label>Tên cửa hàng {{ applicantType === 'business' ? '(bắt buộc)' : '(tuỳ chọn)' }}</label>
        <input v-model="shopName" class="input" placeholder="VD: Shop ABC" />
      </div>

      <div class="form-group">
        <label>Số điện thoại liên hệ</label>
        <input v-model="phone" class="input" required />
      </div>

      <div class="form-group">
        <label>Lý do / mô tả ngắn</label>
        <textarea v-model="reason" class="input" rows="3" required placeholder="Tôi muốn bán… / Quản lý vận hành…" />
      </div>

      <div class="form-group">
        <label>
          {{ applicantType === 'individual' ? 'Thông tin sơ bộ (CCCD/SĐT/địa chỉ…)' : 'Thông tin giấy tờ (MST, GPKD…)' }}
        </label>
        <textarea
          v-model="documentsNote"
          class="input"
          rows="3"
          required
          placeholder="Ghi chú giấy tờ bất kỳ — lưu trên trình duyệt để admin/quản lý xem duyệt (demo multi-seller)."
        />
      </div>

      <div class="form-group">
        <label>Đính kèm file (tuỳ chọn — chỉ lưu tên file demo)</label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" @change="onFile" />
        <p v-if="documentFileName" class="muted">Đã chọn: {{ documentFileName }}</p>
      </div>

      <button type="submit" class="btn btn-primary">Gửi yêu cầu duyệt</button>
    </form>

    <section v-if="history.length" class="card" style="margin-top: 1.25rem; padding: 1.25rem">
      <h2 class="card-title">Lịch sử yêu cầu của bạn</h2>
      <ul class="app-list">
        <li v-for="a in history" :key="a.id">
          <strong>{{ a.targetRole }}</strong>
          · {{ statusLabel(a.status) }}
          · {{ new Date(a.createdAt).toLocaleString('vi-VN') }}
          <p class="muted">{{ a.reason }}</p>
          <p v-if="a.reviewNote" class="muted">Phản hồi: {{ a.reviewNote }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.app-list {
  margin: 0;
  padding-left: 1.1rem;
}
.muted {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--slate-500, #64748b);
}
</style>
