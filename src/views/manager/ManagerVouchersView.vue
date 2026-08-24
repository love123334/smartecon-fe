<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, voucherApi } from '@/api/services'
import type { UpsertVoucherPayload, Voucher, VoucherRequest } from '@/api/real/vouchers'
import PageHeader from '@/components/PageHeader.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const tab = ref<'vouchers' | 'requests'>('vouchers')
const vouchers = ref<Voucher[]>([])
const requests = ref<VoucherRequest[]>([])
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
  discountType: 'PERCENTAGE' as UpsertVoucherPayload['discountType'],
  discountValue: 10,
  scope: 'PLATFORM' as UpsertVoucherPayload['scope'],
  sellerId: undefined as number | undefined,
  appliesTo: 'ALL_PRODUCTS' as UpsertVoucherPayload['appliesTo'],
  minimumOrderAmount: 0,
  maximumDiscountAmount: undefined as number | undefined,
  usageLimit: undefined as number | undefined,
  startsAtLocal: toLocalDatetimeValue(new Date().toISOString()),
  endsAtLocal: toLocalDatetimeValue(new Date(Date.now() + 7 * 86400000).toISOString()),
})

const productIdsText = ref('')

onMounted(() => void loadAll())

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [v, r] = await Promise.all([
      voucherApi.listManager(),
      voucherApi.listPendingRequests(),
    ])
    vouchers.value = v
    requests.value = r
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được voucher'
  } finally {
    loading.value = false
  }
}

async function createVoucher() {
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    const payload: UpsertVoucherPayload = {
      code: form.value.code.trim().toUpperCase(),
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      discountType: form.value.discountType,
      discountValue: form.value.discountValue,
      scope: form.value.scope,
      sellerId: form.value.scope === 'SHOP' ? form.value.sellerId : undefined,
      appliesTo: form.value.appliesTo,
      minimumOrderAmount: form.value.minimumOrderAmount,
      maximumDiscountAmount: form.value.maximumDiscountAmount,
      usageLimit: form.value.usageLimit,
      startsAt: new Date(form.value.startsAtLocal).toISOString(),
      endsAt: new Date(form.value.endsAtLocal).toISOString(),
      productIds:
        form.value.appliesTo === 'SELECTED_PRODUCTS'
          ? productIdsText.value
              .split(/[\s,]+/)
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isFinite(n) && n > 0)
          : [],
    }
    await voucherApi.createManager(payload)
    success.value = 'Đã tạo voucher.'
    await loadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Tạo voucher thất bại'
  } finally {
    submitting.value = false
  }
}

async function toggleActive(v: Voucher) {
  await voucherApi.setActive(v.id, !v.isActive)
  await loadAll()
}

async function approve(id: number) {
  await voucherApi.approveRequest(id)
  success.value = 'Đã duyệt voucher shop.'
  await loadAll()
}

async function reject(id: number) {
  const note = window.prompt('Lý do từ chối (tuỳ chọn):') ?? undefined
  await voucherApi.rejectRequest(id, note)
  success.value = 'Đã từ chối yêu cầu.'
  await loadAll()
}

function discountLabel(v: Pick<Voucher, 'discountType' | 'discountValue'>) {
  return v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatVnd(v.discountValue)
}
</script>

<template>
  <div class="voucher-page">
    <PageHeader
      eyebrow="Quản lý"
      title="Voucher & khuyến mãi"
      lead="Tạo mã giảm giá toàn sàn hoặc duyệt yêu cầu từ người bán."
    />

    <AiShortcutBar
      title="Tiếp theo:"
      :links="[{ to: '/manager/dashboard', label: '← Dashboard', highlight: true }]"
    />

    <div class="voucher-tabs">
      <button
        type="button"
        class="btn btn-sm"
        :class="tab === 'vouchers' ? 'btn-primary' : 'btn-outline'"
        @click="tab = 'vouchers'"
      >
        Voucher đang chạy
      </button>
      <button
        type="button"
        class="btn btn-sm"
        :class="tab === 'requests' ? 'btn-primary' : 'btn-outline'"
        @click="tab = 'requests'"
      >
        Yêu cầu người bán
        <span v-if="requests.length" class="voucher-tabs__badge">{{ requests.length }}</span>
      </button>
    </div>

    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <p v-if="success" class="alert alert-success">{{ success }}</p>

    <LoadingSpinner
      v-if="loading"
      page
      label="Đang tải danh sách voucher và yêu cầu..."
      sublabel="Đang nạp dữ liệu khuyến mãi toàn sàn từ hệ thống."
    />

    <template v-else>
      <section v-if="tab === 'vouchers'" class="card voucher-card">
        <h2 class="card-title">Tạo voucher mới</h2>
        <form class="voucher-form" @submit.prevent="createVoucher">
          <div class="voucher-form__grid">
            <div class="form-group">
              <label for="m-code">Mã voucher</label>
              <input id="m-code" v-model="form.code" type="text" placeholder="SALE10" required />
            </div>
            <div class="form-group">
              <label for="m-name">Tên chiến dịch</label>
              <input id="m-name" v-model="form.name" type="text" required />
            </div>
            <div class="form-group">
              <label for="m-type">Loại giảm</label>
              <select id="m-type" v-model="form.discountType">
                <option value="PERCENTAGE">Phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định</option>
              </select>
            </div>
            <div class="form-group">
              <label for="m-value">Giá trị</label>
              <input id="m-value" v-model.number="form.discountValue" type="number" min="1" required />
            </div>
            <div class="form-group">
              <label for="m-scope">Phạm vi</label>
              <select id="m-scope" v-model="form.scope">
                <option value="PLATFORM">Toàn sàn</option>
                <option value="SHOP">Theo shop</option>
              </select>
            </div>
            <div v-if="form.scope === 'SHOP'" class="form-group">
              <label for="m-seller">Mã người bán</label>
              <input id="m-seller" v-model.number="form.sellerId" type="number" min="1" />
            </div>
            <div class="form-group">
              <label for="m-apply">Áp dụng</label>
              <select id="m-apply" v-model="form.appliesTo">
                <option value="ALL_PRODUCTS">Tất cả sản phẩm</option>
                <option value="SELECTED_PRODUCTS">Sản phẩm chỉ định</option>
              </select>
            </div>
            <div class="form-group">
              <label for="m-min">ĐH tối thiểu</label>
              <input id="m-min" v-model.number="form.minimumOrderAmount" type="number" min="0" />
            </div>
            <div class="form-group">
              <label for="m-max">Giảm tối đa</label>
              <input id="m-max" v-model.number="form.maximumDiscountAmount" type="number" min="0" />
            </div>
            <div class="form-group">
              <label for="m-limit">Lượt dùng</label>
              <input id="m-limit" v-model.number="form.usageLimit" type="number" min="1" />
            </div>
            <div class="form-group">
              <label for="m-start">Bắt đầu</label>
              <input id="m-start" v-model="form.startsAtLocal" type="datetime-local" required />
            </div>
            <div class="form-group">
              <label for="m-end">Kết thúc</label>
              <input id="m-end" v-model="form.endsAtLocal" type="datetime-local" required />
            </div>
          </div>

          <div v-if="form.appliesTo === 'SELECTED_PRODUCTS'" class="form-group voucher-form__full">
            <label for="m-pids">ID sản phẩm (cách nhau dấu phẩy)</label>
            <input id="m-pids" v-model="productIdsText" type="text" placeholder="12, 34, 56" />
          </div>

          <div class="form-group voucher-form__full">
            <label for="m-desc">Mô tả hiển thị cho khách</label>
            <textarea id="m-desc" v-model="form.description" rows="3" />
          </div>

          <div class="voucher-form__actions">
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? 'Đang tạo…' : 'Tạo voucher' }}
            </button>
          </div>
        </form>
      </section>

      <section v-if="tab === 'vouchers'" class="card voucher-card">
        <h2 class="card-title">Danh sách voucher</h2>
        <EmptyState
          v-if="!vouchers.length"
          title="Chưa có voucher"
          description="Tạo mã mới ở form phía trên hoặc duyệt yêu cầu từ seller."
        />
        <div v-else class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Giảm</th>
                <th>Phạm vi</th>
                <th>Shop</th>
                <th>Đã dùng</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in vouchers" :key="v.id">
                <td><strong class="voucher-code">{{ v.code }}</strong></td>
                <td>{{ v.name }}</td>
                <td>{{ discountLabel(v) }}</td>
                <td>{{ v.appliesTo === 'ALL_PRODUCTS' ? 'Tất cả SP' : `${v.productIds.length} SP` }}</td>
                <td>{{ v.sellerName || 'Toàn sàn' }}</td>
                <td>{{ v.usedCount }}{{ v.usageLimit ? ` / ${v.usageLimit}` : '' }}</td>
                <td>
                  <span :class="v.isActive ? 'voucher-status voucher-status--approved' : 'voucher-status voucher-status--rejected'">
                    {{ v.isActive ? 'Đang bật' : 'Tắt' }}
                  </span>
                </td>
                <td>
                  <button type="button" class="btn btn-outline btn-sm" @click="toggleActive(v)">
                    {{ v.isActive ? 'Tắt' : 'Bật' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="tab === 'requests'" class="card voucher-card">
        <h2 class="card-title">Yêu cầu voucher từ seller</h2>
        <EmptyState
          v-if="!requests.length"
          title="Không có yêu cầu chờ duyệt"
          description="Seller gửi yêu cầu từ trang Yêu cầu voucher — bạn duyệt tại đây."
        />
        <div v-else class="voucher-request-list">
          <article v-for="r in requests" :key="r.id" class="voucher-request card card--flat">
            <div class="voucher-request__head">
              <div>
                <strong>{{ r.sellerName }}</strong>
                <span class="muted"> · mã </span>
                <code class="voucher-code">{{ r.code }}</code>
                <span class="voucher-request__discount">{{ discountLabel(r) }}</span>
              </div>
            </div>
            <p class="voucher-request__title">{{ r.name }}</p>
            <p v-if="r.description" class="muted">{{ r.description }}</p>
            <p class="muted voucher-request__meta">
              Áp dụng:
              {{ r.appliesTo === 'ALL_PRODUCTS' ? 'Tất cả SP shop' : `SP #${r.productIds.join(', #')}` }}
            </p>
            <div class="voucher-request__actions">
              <button type="button" class="btn btn-primary btn-sm" @click="approve(r.id)">Duyệt</button>
              <button type="button" class="btn btn-outline btn-sm" @click="reject(r.id)">Từ chối</button>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.voucher-page {
  max-width: 1080px;
}

.voucher-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.voucher-tabs__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  margin-left: 0.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  font-size: 0.7rem;
  font-weight: 800;
}

.voucher-card {
  margin-bottom: 1.25rem;
}

.voucher-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1rem;
}

@media (min-width: 900px) {
  .voucher-form__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.voucher-form__full {
  margin-top: 0.5rem;
}

.voucher-form__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.voucher-code {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  letter-spacing: 0.04em;
}

.voucher-status {
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.voucher-status--approved {
  background: #dcfce7;
  color: #166534;
}

.voucher-status--rejected {
  background: #f1f5f9;
  color: #64748b;
}

.voucher-request-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.voucher-request {
  padding: 1rem 1.1rem;
}

.voucher-request__discount {
  margin-left: 0.5rem;
  font-weight: 700;
  color: var(--primary-700);
}

.voucher-request__title {
  margin: 0.35rem 0 0;
  font-weight: 600;
}

.voucher-request__meta {
  margin: 0.35rem 0 0;
  font-size: 0.8125rem;
}

.voucher-request__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

@media (max-width: 720px) {
  .voucher-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
