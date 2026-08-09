<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, voucherApi } from '@/api/services'
import type { SellerVoucherRequestPayload, VoucherRequest } from '@/api/real/vouchers'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const auth = useAuthStore()
const requests = ref<VoucherRequest[]>([])
const products = ref<Array<{ id: string; name: string }>>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const submitting = ref(false)

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = ref({
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE' as SellerVoucherRequestPayload['discountType'],
  discountValue: 10,
  appliesTo: 'ALL_PRODUCTS' as SellerVoucherRequestPayload['appliesTo'],
  minimumOrderAmount: 0,
  startsAtLocal: toLocalDatetimeValue(new Date().toISOString()),
  endsAtLocal: toLocalDatetimeValue(new Date(Date.now() + 14 * 86400000).toISOString()),
})

const selectedProducts = ref<string[]>([])

onMounted(async () => {
  loading.value = true
  try {
    const sellerKey = auth.user?.backendId ?? auth.user?.id
    const [reqs, catalog] = await Promise.all([
      voucherApi.listSellerRequests(),
      loadSellerCatalogForDss({ sellerId: sellerKey, withStock: false }),
    ])
    requests.value = reqs
    products.value = catalog.products.map((p) => ({ id: p.id, name: p.name }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được dữ liệu'
  } finally {
    loading.value = false
  }
})

async function submit() {
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    const payload: SellerVoucherRequestPayload = {
      code: form.value.code.trim().toUpperCase(),
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      discountType: form.value.discountType,
      discountValue: form.value.discountValue,
      appliesTo: form.value.appliesTo,
      minimumOrderAmount: form.value.minimumOrderAmount,
      startsAt: new Date(form.value.startsAtLocal).toISOString(),
      endsAt: new Date(form.value.endsAtLocal).toISOString(),
      productIds:
        form.value.appliesTo === 'SELECTED_PRODUCTS'
          ? selectedProducts.value.map(Number)
          : [],
    }
    await voucherApi.createSellerRequest(payload)
    success.value = 'Đã gửi yêu cầu — manager sẽ duyệt và mã sẽ hiện trên shop của bạn.'
    requests.value = await voucherApi.listSellerRequests()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Gửi yêu cầu thất bại'
  } finally {
    submitting.value = false
  }
}

function statusLabel(s: VoucherRequest['status']) {
  if (s === 'PENDING') return 'Chờ duyệt'
  if (s === 'APPROVED') return 'Đã duyệt'
  return 'Từ chối'
}

function statusClass(s: VoucherRequest['status']) {
  if (s === 'PENDING') return 'voucher-status voucher-status--pending'
  if (s === 'APPROVED') return 'voucher-status voucher-status--approved'
  return 'voucher-status voucher-status--rejected'
}

function discountLabel(r: VoucherRequest) {
  return r.discountType === 'PERCENTAGE' ? `${r.discountValue}%` : formatVnd(r.discountValue)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="voucher-page">
    <PageHeader
      eyebrow="Người bán"
      title="Yêu cầu voucher"
      lead="Gửi đề xuất mã giảm giá cho manager duyệt — sau khi duyệt, khách nhập mã sẽ được giảm trên shop bạn."
    />

    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <p v-if="success" class="alert alert-success">{{ success }}</p>

    <LoadingSpinner v-if="loading" />

    <template v-else>
      <section class="card voucher-card">
        <div class="voucher-card__head">
          <h2 class="card-title">Gửi yêu cầu mới</h2>
          <p class="voucher-card__hint">
            Điền đầy đủ thông tin — manager sẽ xem và bật mã trên shop của bạn nếu phù hợp.
          </p>
        </div>

        <form class="voucher-form" @submit.prevent="submit">
          <div class="voucher-form__grid">
            <div class="form-group">
              <label for="v-code">Mã đề xuất</label>
              <input
                id="v-code"
                v-model="form.code"
                type="text"
                placeholder="VD: SHOP15"
                autocomplete="off"
                required
              />
            </div>

            <div class="form-group">
              <label for="v-name">Tên chiến dịch</label>
              <input
                id="v-name"
                v-model="form.name"
                type="text"
                placeholder="Flash sale cuối tuần"
                required
              />
            </div>

            <div class="form-group">
              <label for="v-type">Loại giảm</label>
              <select id="v-type" v-model="form.discountType">
                <option value="PERCENTAGE">Phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định (VND)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="v-value">
                Giá trị giảm
                <span class="voucher-form__unit">
                  {{ form.discountType === 'PERCENTAGE' ? '(%)' : '(VND)' }}
                </span>
              </label>
              <input
                id="v-value"
                v-model.number="form.discountValue"
                type="number"
                min="1"
                :max="form.discountType === 'PERCENTAGE' ? 100 : undefined"
                required
              />
            </div>

            <div class="form-group">
              <label for="v-scope">Phạm vi sản phẩm</label>
              <select id="v-scope" v-model="form.appliesTo">
                <option value="ALL_PRODUCTS">Tất cả sản phẩm shop</option>
                <option value="SELECTED_PRODUCTS">Chọn sản phẩm cụ thể</option>
              </select>
            </div>

            <div class="form-group">
              <label for="v-min">Đơn hàng tối thiểu (VND)</label>
              <input
                id="v-min"
                v-model.number="form.minimumOrderAmount"
                type="number"
                min="0"
                step="1000"
              />
            </div>

            <div class="form-group">
              <label for="v-start">Bắt đầu</label>
              <input id="v-start" v-model="form.startsAtLocal" type="datetime-local" required />
            </div>

            <div class="form-group">
              <label for="v-end">Kết thúc</label>
              <input id="v-end" v-model="form.endsAtLocal" type="datetime-local" required />
            </div>
          </div>

          <div v-if="form.appliesTo === 'SELECTED_PRODUCTS'" class="form-group voucher-form__full">
            <label for="v-products">Chọn sản phẩm áp dụng</label>
            <select id="v-products" v-model="selectedProducts" multiple size="5">
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p class="voucher-form__help">Giữ Ctrl (Windows) hoặc Cmd (Mac) để chọn nhiều sản phẩm.</p>
          </div>

          <div class="form-group voucher-form__full">
            <label for="v-desc">Mô tả / lý do gửi manager</label>
            <textarea
              id="v-desc"
              v-model="form.description"
              rows="3"
              placeholder="VD: Flash sale cuối tuần, giảm 15% cho danh mục cà phê…"
            />
          </div>

          <div class="voucher-form__actions">
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? 'Đang gửi…' : 'Gửi manager duyệt' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card voucher-card">
        <h2 class="card-title">Lịch sử yêu cầu</h2>

        <EmptyState
          v-if="!requests.length"
          title="Chưa có yêu cầu nào"
          description="Gửi form phía trên để manager xem xét mã giảm giá cho shop bạn."
        />

        <div v-else class="table-wrap">
          <table class="data voucher-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Giảm</th>
                <th>Thời hạn</th>
                <th>Trạng thái</th>
                <th>Ghi chú manager</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in requests" :key="r.id">
                <td><strong class="voucher-code">{{ r.code }}</strong></td>
                <td>{{ r.name || '—' }}</td>
                <td>{{ discountLabel(r) }}</td>
                <td class="voucher-table__dates">
                  <span>{{ formatDate(r.startsAt) }}</span>
                  <span class="muted">→ {{ formatDate(r.endsAt) }}</span>
                </td>
                <td>
                  <span :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
                </td>
                <td>{{ r.managerNote || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.voucher-page {
  max-width: 960px;
}

.voucher-card {
  margin-bottom: 1.25rem;
}

.voucher-card__head {
  margin-bottom: 1.25rem;
}

.voucher-card__hint {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: var(--slate-500);
  line-height: 1.5;
}

.voucher-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1rem;
}

.voucher-form__full {
  margin-top: 0.5rem;
}

.voucher-form__unit {
  font-weight: 500;
  color: var(--slate-500);
}

.voucher-form__help {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: var(--slate-500);
}

.voucher-form__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.voucher-form select[multiple] {
  min-height: 7.5rem;
}

.voucher-code {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  letter-spacing: 0.04em;
}

.voucher-table__dates {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.voucher-status {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.voucher-status--pending {
  background: #fef3c7;
  color: #92400e;
}

.voucher-status--approved {
  background: #dcfce7;
  color: #166534;
}

.voucher-status--rejected {
  background: #fee2e2;
  color: #991b1b;
}

.alert-success {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

@media (max-width: 720px) {
  .voucher-form__grid {
    grid-template-columns: 1fr;
  }

  .voucher-form__actions {
    justify-content: stretch;
  }

  .voucher-form__actions .btn {
    width: 100%;
  }
}
</style>
