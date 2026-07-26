<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi } from '@/api/services'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import {
  listRoleApplications,
  reviewRoleApplication,
  type RoleApplication,
} from '@/utils/roleApplications'

const auth = useAuthStore()
const apps = ref<RoleApplication[]>([])
const note = ref<Record<string, string>>({})
const error = ref('')
const message = ref('')

function load() {
  apps.value = listRoleApplications()
}

onMounted(load)

async function decide(app: RoleApplication, decision: 'approved' | 'rejected') {
  error.value = ''
  message.value = ''
  if (!auth.user) return
  try {
    const updated = reviewRoleApplication(
      app.id,
      decision,
      auth.user.email,
      note.value[app.id]?.trim() || undefined,
    )
    if (decision === 'approved') {
      // Admin: cố gắng gán role trên backend; Manager: dùng override local
      if (auth.role === 'admin') {
        try {
          const users = await adminApi.listUsers()
          const match = users.find(
            (u) => u.email.toLowerCase() === app.userEmail.toLowerCase() || u.id === app.userId,
          )
          if (match) {
            await adminApi.setUserRole(match.id, app.targetRole)
            message.value = `Đã duyệt và gán role ${app.targetRole} trên hệ thống cho ${app.userEmail}.`
          } else {
            message.value = `Đã duyệt (override local). Không tìm thấy user ${app.userEmail} trong danh sách API — họ vẫn nhận role khi đăng nhập trên trình duyệt này.`
          }
        } catch (e) {
          message.value = `Đã duyệt local. Đồng bộ API thất bại: ${e instanceof Error ? e.message : 'lỗi'}`
        }
      } else {
        message.value = `Quản lý đã duyệt ${app.targetRole} cho ${app.userEmail}. Role có hiệu lực trên FE (override); admin có thể gán lại trên backend nếu cần.`
      }
    } else {
      message.value = `Đã từ chối yêu cầu của ${updated.userName}.`
    }
    load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không xử lý được'
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
      eyebrow="Duyệt hồ sơ"
      title="Yêu cầu nâng Seller / Manager"
      lead="Khách gửi thông tin sơ bộ hoặc giấy tờ — Admin và Quản lý có thể duyệt hoặc từ chối tại đây."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="message" class="alert alert-success">{{ message }}</p>

    <p v-if="!apps.length" class="empty">Chưa có yêu cầu nào.</p>

    <div v-else class="apps">
      <article v-for="a in apps" :key="a.id" class="card app-card">
        <div class="app-card__head">
          <div>
            <strong>{{ a.userName }}</strong>
            <span class="muted"> · {{ a.userEmail }}</span>
            <p class="muted">
              Xin → <strong>{{ a.targetRole }}</strong>
              ({{ a.applicantType === 'individual' ? 'Cá nhân' : 'Hộ KD/công ty' }})
              · {{ statusLabel(a.status) }}
            </p>
          </div>
          <span class="muted">{{ new Date(a.createdAt).toLocaleString('vi-VN') }}</span>
        </div>
        <p><strong>SĐT:</strong> {{ a.phone }}</p>
        <p v-if="a.shopName"><strong>Shop:</strong> {{ a.shopName }}</p>
        <p><strong>Lý do:</strong> {{ a.reason }}</p>
        <p><strong>Giấy tờ / thông tin:</strong> {{ a.documentsNote }}</p>
        <p v-if="a.documentFileName" class="muted">File: {{ a.documentFileName }}</p>

        <div v-if="a.status === 'pending'" class="app-card__actions">
          <input
            v-model="note[a.id]"
            class="input"
            placeholder="Ghi chú duyệt / từ chối (tuỳ chọn)"
          />
          <button type="button" class="btn btn-primary btn-sm" @click="decide(a, 'approved')">
            Duyệt
          </button>
          <button type="button" class="btn btn-outline btn-sm" @click="decide(a, 'rejected')">
            Từ chối
          </button>
        </div>
        <p v-else-if="a.reviewNote" class="muted">Phản hồi: {{ a.reviewNote }}</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.apps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.app-card {
  padding: 1rem 1.15rem;
}
.app-card__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.app-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  align-items: center;
}
.muted {
  color: var(--slate-500, #64748b);
  font-size: 0.85rem;
}
</style>
