<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, voucherApi } from '@/api/services'
import type { UpsertVoucherPayload, Voucher, VoucherRequest } from '@/api/real/vouchers'
import PageHeader from '@/components/PageHeader.vue'

const tab = ref<'vouchers' | 'requests'>('vouchers')
const vouchers = ref<Voucher[]>([])
const requests = ref<VoucherRequest[]>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const submitting = ref(false)

const form = ref<UpsertVoucherPayload>({
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  scope: 'PLATFORM',
  appliesTo: 'ALL_PRODUCTS',
  minimumOrderAmount: 0,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  productIds: [],
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
      ...form.value,
      code: form.value.code.trim().toUpperCase(),
      startsAt: new Date(form.value.startsAt).toISOString(),
      endsAt: new Date(form.value.endsAt).toISOString(),
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
  <div>
    <PageHeader
      eyebrow="Quản lý"
      title="Voucher & khuyến mãi"
      lead="Tạo mã giảm giá toàn sàn hoặc duyệt yêu cầu từ người bán."
    />

    <p style="display: flex; gap: 0.5rem; flex-wrap: wrap">
      <button type="button" class="btn btn-sm" :class="tab === 'vouchers' ? 'btn-primary' : 'btn-outline'" @click="tab = 'vouchers'">
        Voucher đang chạy
      </button>
      <button type="button" class="btn btn-sm" :class="tab === 'requests' ? 'btn-primary' : 'btn-outline'" @click="tab = 'requests'">
        Yêu cầu seller ({{ requests.length }})
      </button>
    </p>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="success" class="muted">{{ success }}</p>
    <p v-if="loading">Đang tải…</p>

    <section v-if="tab === 'vouchers' && !loading" class="card" style="margin-bottom: 1rem">
      <h2 class="card-title">Tạo voucher mới</h2>
      <div class="form-grid" style="display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
        <label>Mã <input v-model="form.code" class="input" placeholder="SALE10" /></label>
        <label>Tên <input v-model="form.name" class="input" /></label>
        <label>Loại
          <select v-model="form.discountType" class="input">
            <option value="PERCENTAGE">Phần trăm (%)</option>
            <option value="FIXED">Số tiền cố định</option>
          </select>
        </label>
        <label>Giá trị <input v-model.number="form.discountValue" type="number" min="1" class="input" /></label>
        <label>Phạm vi
          <select v-model="form.scope" class="input">
            <option value="PLATFORM">Toàn sàn</option>
            <option value="SHOP">Theo shop (sellerId)</option>
          </select>
        </label>
        <label v-if="form.scope === 'SHOP'">Seller ID <input v-model.number="form.sellerId" type="number" class="input" /></label>
        <label>Áp dụng
          <select v-model="form.appliesTo" class="input">
            <option value="ALL_PRODUCTS">Tất cả SP</option>
            <option value="SELECTED_PRODUCTS">SP chỉ định</option>
          </select>
        </label>
        <label>ĐH tối thiểu <input v-model.number="form.minimumOrderAmount" type="number" min="0" class="input" /></label>
        <label>Giảm tối đa <input v-model.number="form.maximumDiscountAmount" type="number" min="0" class="input" /></label>
        <label>Lượt dùng <input v-model.number="form.usageLimit" type="number" min="1" class="input" /></label>
        <label>Bắt đầu <input v-model="form.startsAt" type="datetime-local" class="input" /></label>
        <label>Kết thúc <input v-model="form.endsAt" type="datetime-local" class="input" /></label>
      </div>
      <label v-if="form.appliesTo === 'SELECTED_PRODUCTS'" style="display: block; margin-top: 0.75rem">
        ID sản phẩm (cách nhau dấu phẩy)
        <input v-model="productIdsText" class="input" placeholder="12, 34, 56" />
      </label>
      <label style="display: block; margin-top: 0.75rem">
        Mô tả
        <textarea v-model="form.description" class="input" rows="2" />
      </label>
      <button type="button" class="btn btn-primary" style="margin-top: 0.75rem" :disabled="submitting" @click="createVoucher">
        {{ submitting ? 'Đang tạo…' : 'Tạo voucher' }}
      </button>
    </section>

    <section v-if="tab === 'vouchers' && !loading" class="card">
      <h2 class="card-title">Danh sách voucher</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Mã</th><th>Tên</th><th>Giảm</th><th>Phạm vi</th><th>Shop</th><th>Đã dùng</th><th>Trạng thái</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in vouchers" :key="v.id">
              <td><strong>{{ v.code }}</strong></td>
              <td>{{ v.name }}</td>
              <td>{{ discountLabel(v) }}</td>
              <td>{{ v.appliesTo === 'ALL_PRODUCTS' ? 'Tất cả SP' : `${v.productIds.length} SP` }}</td>
              <td>{{ v.sellerName || 'Toàn sàn' }}</td>
              <td>{{ v.usedCount }}{{ v.usageLimit ? ` / ${v.usageLimit}` : '' }}</td>
              <td>{{ v.isActive ? 'Đang bật' : 'Tắt' }}</td>
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

    <section v-if="tab === 'requests' && !loading" class="card">
      <h2 class="card-title">Yêu cầu voucher từ seller</h2>
      <p v-if="!requests.length" class="muted">Không có yêu cầu chờ duyệt.</p>
      <div v-for="r in requests" :key="r.id" class="card card--flat" style="margin-bottom: 0.75rem; padding: 1rem">
        <p><strong>{{ r.sellerName }}</strong> · mã <code>{{ r.code }}</code> · {{ discountLabel(r) }}</p>
        <p class="muted">{{ r.description || r.name }}</p>
        <p class="muted">Áp dụng: {{ r.appliesTo === 'ALL_PRODUCTS' ? 'Tất cả SP shop' : `SP #${r.productIds.join(', #')}` }}</p>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem">
          <button type="button" class="btn btn-primary btn-sm" @click="approve(r.id)">Duyệt</button>
          <button type="button" class="btn btn-outline btn-sm" @click="reject(r.id)">Từ chối</button>
        </div>
      </div>
    </section>
  </div>
</template>
